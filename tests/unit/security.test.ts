import { describe, it, expect } from 'vitest';
import { validateMagicBytes, scanBufferForThreats, computeFileChecksum } from '../../src/server/storage/storage';
import { checkRateLimit } from '../../src/server/security/rateLimiter';

describe('Security & Automated Upload Validation', () => {
  it('correctly validates valid PDF magic bytes (%PDF-)', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4 valid content here');
    const result = validateMagicBytes(validPdfBuffer, 'pdf');
    expect(result.valid).toBe(true);
  });

  it('rejects spoofed PDF with invalid header', () => {
    const fakePdfBuffer = Buffer.from('NOT A PDF FILE');
    const result = validateMagicBytes(fakePdfBuffer, 'pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not match a valid PDF');
  });

  it('correctly validates PNG header', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateMagicBytes(pngBuffer, 'png');
    expect(result.valid).toBe(true);
  });

  it('detects and flags dangerous executable binary headers (MZ)', () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const threat = scanBufferForThreats(exeBuffer);
    expect(threat.safe).toBe(false);
    expect(threat.reason).toContain('executable binary header');
  });

  it('detects and flags shell scripts or script tags', () => {
    const scriptBuffer = Buffer.from('#!/bin/bash\nrm -rf /');
    const threat = scanBufferForThreats(scriptBuffer);
    expect(threat.safe).toBe(false);
    expect(threat.reason).toContain('embedded script code');
  });

  it('computes deterministic SHA-256 file checksums', () => {
    const data = Buffer.from('StuddyBuddy Academic Resource Sample Document');
    const hash1 = computeFileChecksum(data);
    const hash2 = computeFileChecksum(data);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('enforces sliding-window rate limits accurately', () => {
    const testKey = `test-user-${Date.now()}`;
    // Limit: max 3 requests in 10 seconds
    const req1 = checkRateLimit(testKey, 3, 10);
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(2);

    const req2 = checkRateLimit(testKey, 3, 10);
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(1);

    const req3 = checkRateLimit(testKey, 3, 10);
    expect(req3.allowed).toBe(true);
    expect(req3.remaining).toBe(0);

    // 4th request must be blocked
    const req4 = checkRateLimit(testKey, 3, 10);
    expect(req4.allowed).toBe(false);
    expect(req4.remaining).toBe(0);
  });
});

