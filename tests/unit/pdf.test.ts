import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, splitPdf, compressPdf } from '../../src/server/pdf/pdfTools';

describe('PDF Processing Utilities', () => {
  async function createSamplePdf(pageCount = 1, text = 'Sample Page'): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([600, 400]);
      page.drawText(`${text} - Page ${i + 1}`, { x: 50, y: 350 });
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('merges multiple PDF documents into one document', async () => {
    const pdf1 = await createSamplePdf(2, 'Doc 1');
    const pdf2 = await createSamplePdf(3, 'Doc 2');

    const mergedBytes = await mergePdfs([pdf1, pdf2]);
    const mergedDoc = await PDFDocument.load(mergedBytes);

    expect(mergedDoc.getPageCount()).toBe(5);
  });

  it('splits a PDF document by page range', async () => {
    const originalPdf = await createSamplePdf(5, 'Multi Page Doc');
    // Extract pages 2 to 4
    const splitBytes = await splitPdf(originalPdf, 2, 4);
    const splitDoc = await PDFDocument.load(splitBytes);

    expect(splitDoc.getPageCount()).toBe(3);
  });

  it('compresses a PDF document cleanly', async () => {
    const originalPdf = await createSamplePdf(2, 'Compression Test');
    const compressedBytes = await compressPdf(originalPdf);

    expect(compressedBytes.byteLength).toBeGreaterThan(0);
    const loaded = await PDFDocument.load(compressedBytes);
    expect(loaded.getPageCount()).toBe(2);
  });
});
