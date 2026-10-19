import { describe, it, expect } from 'vitest';
import { validateUploadFile, generateStorageKey } from '../../src/server/storage/storage';

describe('Storage & File Upload Validation', () => {
  it('accepts valid PDF, PPTX, DOCX, and JPG files within 25MB limit', () => {
    const validPdf = validateUploadFile('paper.pdf', 'application/pdf', 5 * 1024 * 1024);
    expect(validPdf.valid).toBe(true);
    expect(validPdf.extension).toBe('pdf');

    const validPptx = validateUploadFile('lecture.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 12 * 1024 * 1024);
    expect(validPptx.valid).toBe(true);
    expect(validPptx.extension).toBe('pptx');

    const validJpg = validateUploadFile('notes.jpg', 'image/jpeg', 2 * 1024 * 1024);
    expect(validJpg.valid).toBe(true);
    expect(validJpg.extension).toBe('jpg');
  });

  it('rejects oversized files exceeding 25 MB limit', () => {
    const oversized = validateUploadFile('huge-book.pdf', 'application/pdf', 30 * 1024 * 1024);
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain('maximum allowed size');
  });

  it('rejects disallowed file extensions like .exe, .sh, or .php', () => {
    const maliciousExe = validateUploadFile('malware.exe', 'application/octet-stream', 1024);
    expect(maliciousExe.valid).toBe(false);
    expect(maliciousExe.error).toContain('Unsupported file extension');

    const scriptSh = validateUploadFile('script.sh', 'text/x-shellscript', 1024);
    expect(scriptSh.valid).toBe(false);
  });

  it('generates sanitized, unpredictable storage keys', () => {
    const key1 = generateStorageKey('parul-university', 'btech-cse', 'pdf');
    const key2 = generateStorageKey('parul-university', 'btech-cse', 'pdf');

    expect(key1).toMatch(/^resources\/parul-university\/btech-cse\/[a-f0-9]+\.pdf$/);
    expect(key2).toMatch(/^resources\/parul-university\/btech-cse\/[a-f0-9]+\.pdf$/);
    expect(key1).not.toBe(key2);
  });
});
