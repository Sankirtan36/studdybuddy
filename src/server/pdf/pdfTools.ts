import { PDFDocument } from 'pdf-lib';

/**
 * Check whether a buffer has PNG signature bytes (89 50 4E 47)
 */
function isPngBuffer(buf: Buffer): boolean {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}

/**
 * Check whether a buffer has JPEG signature bytes (FF D8)
 */
function isJpgBuffer(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xD8;
}

/**
 * Merge multiple PDF file buffers into a single PDF document.
 */
export async function mergePdfs(pdfBuffers: Buffer[]): Promise<Uint8Array> {
  if (pdfBuffers.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    const buffer = pdfBuffers[i];
    try {
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    } catch (err: any) {
      throw new Error(`Failed to read PDF document #${i + 1}: ${err?.message || 'Invalid or password-protected PDF.'}`);
    }
  }

  return await mergedPdf.save({ useObjectStreams: true });
}

/**
 * Split a PDF document and extract pages from startPage to endPage (1-indexed).
 */
export async function splitPdf(pdfBuffer: Buffer, startPage: number, endPage: number): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  if (totalPages === 0) {
    throw new Error('The selected PDF contains no pages.');
  }

  const p1 = Math.min(startPage, endPage);
  const p2 = Math.max(startPage, endPage);

  const start = Math.max(1, Math.min(p1, totalPages));
  const end = Math.max(start, Math.min(p2, totalPages));

  const splitDoc = await PDFDocument.create();
  const pageIndices: number[] = [];
  for (let i = start - 1; i <= end - 1; i++) {
    pageIndices.push(i);
  }

  const copiedPages = await splitDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    splitDoc.addPage(page);
  }

  return await splitDoc.save({ useObjectStreams: true });
}

/**
 * Convert an array of image buffers (JPEG or PNG) into a single PDF document.
 */
export async function convertImagesToPdf(images: Array<{ buffer: Buffer; mimeType: string }>): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error('Please select at least one image to convert.');
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let embeddedImage;

    // Detect format by magic bytes first, fallback to mimeType
    const isPng = isPngBuffer(img.buffer) || img.mimeType.toLowerCase().includes('png');
    const isJpg = isJpgBuffer(img.buffer) || img.mimeType.toLowerCase().includes('jpg') || img.mimeType.toLowerCase().includes('jpeg');

    try {
      if (isPng) {
        embeddedImage = await pdfDoc.embedPng(img.buffer);
      } else if (isJpg) {
        embeddedImage = await pdfDoc.embedJpg(img.buffer);
      } else {
        // Try JPG first then fallback to PNG
        try {
          embeddedImage = await pdfDoc.embedJpg(img.buffer);
        } catch {
          embeddedImage = await pdfDoc.embedPng(img.buffer);
        }
      }
    } catch (err: any) {
      throw new Error(`Failed to embed image #${i + 1}. Please ensure images are valid JPG or PNG files.`);
    }

    const { width, height } = embeddedImage.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Compress PDF by rebuilding document and optimizing object streams.
 */
export async function compressPdf(pdfBuffer: Buffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return await doc.save({ useObjectStreams: true });
}
