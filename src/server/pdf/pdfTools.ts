import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF file buffers into a single PDF document.
 */
export async function mergePdfs(pdfBuffers: Buffer[]): Promise<Uint8Array> {
  if (pdfBuffers.length < 2) {
    throw new Error('At least two PDF files are required to merge.');
  }

  const mergedPdf = await PDFDocument.create();

  for (const buffer of pdfBuffers) {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
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

  const start = Math.max(1, Math.min(startPage, totalPages));
  const end = Math.max(start, Math.min(endPage, totalPages));

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
    throw new Error('At least one image is required.');
  }

  const pdfDoc = await PDFDocument.create();

  for (const img of images) {
    let embeddedImage;
    if (img.mimeType === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(img.buffer);
    } else {
      embeddedImage = await pdfDoc.embedJpg(img.buffer);
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
 * Compress PDF by rebuilding and enabling object streams.
 */
export async function compressPdf(pdfBuffer: Buffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  return await doc.save({ useObjectStreams: true });
}
