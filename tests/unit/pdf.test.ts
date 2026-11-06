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

import { saveProcessedPdf, GUEST_TTL_MS, USER_TTL_MS, cleanupExpiredPdfFiles } from '../../src/server/pdf/pdfStorage';

describe('PDF Storage Retention Policy (6h Guest / 48h User)', () => {
  it('enforces 6-hour expiration TTL for unauthenticated guest files', () => {
    const fakeBuffer = new Uint8Array([37, 80, 68, 70]); // %PDF
    const guestRecord = saveProcessedPdf({
      originalName: 'guest_notes.pdf',
      outputName: 'guest_notes_compressed.pdf',
      buffer: fakeBuffer,
      tool: 'compress',
      user: null,
    });

    expect(guestRecord.isGuest).toBe(true);
    expect(guestRecord.expiresAt - guestRecord.createdAt).toBe(GUEST_TTL_MS);
    expect(GUEST_TTL_MS).toBe(6 * 60 * 60 * 1000); // Exactly 6 Hours
  });

  it('enforces 48-hour expiration TTL for logged-in user files', () => {
    const fakeBuffer = new Uint8Array([37, 80, 68, 70]); // %PDF
    const userRecord = saveProcessedPdf({
      originalName: 'student_paper.pdf',
      outputName: 'student_paper_pages_1-3.pdf',
      buffer: fakeBuffer,
      tool: 'split',
      user: { id: 'usr-student-123', email: 'student@parul.ac.in' },
    });

    expect(userRecord.isGuest).toBe(false);
    expect(userRecord.userId).toBe('usr-student-123');
    expect(userRecord.expiresAt - userRecord.createdAt).toBe(USER_TTL_MS);
    expect(USER_TTL_MS).toBe(48 * 60 * 60 * 1000); // Exactly 48 Hours
  });

  it('runs cleanupExpiredPdfFiles without throwing errors', () => {
    const result = cleanupExpiredPdfFiles();
    expect(result).toHaveProperty('removedCount');
    expect(typeof result.removedCount).toBe('number');
  });

  it('automatically deletes expired records and physically removes file from disk', async () => {
    const fakeBuffer = new Uint8Array([37, 80, 68, 70]);
    const record = saveProcessedPdf({
      originalName: 'temp_doc.pdf',
      outputName: 'temp_doc_merged.pdf',
      buffer: fakeBuffer,
      tool: 'merge',
      user: null,
    });

    const fs = await import('node:fs');
    expect(fs.existsSync(record.filePath)).toBe(true);

    // Manually force record to be expired in manifest
    const manifestPath = (await import('node:path')).resolve(process.cwd(), '.data', 'pdf-tools', 'manifest.json');
    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const targetIdx = manifestData.findIndex((r: any) => r.id === record.id);
    if (targetIdx !== -1) {
      manifestData[targetIdx].expiresAt = Date.now() - 1000; // expired 1s ago
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData));
    }

    // Call getProcessedPdf which triggers cleanup & expiration check
    const { getProcessedPdf } = await import('../../src/server/pdf/pdfStorage');
    const result = getProcessedPdf(record.id);
    expect(result).toBeNull();
    // Physical file should now be deleted
    expect(fs.existsSync(record.filePath)).toBe(false);
  });
});

