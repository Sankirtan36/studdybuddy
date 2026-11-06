import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const STORAGE_DIR = path.resolve(process.cwd(), '.data', 'pdf-tools');
const MANIFEST_FILE = path.join(STORAGE_DIR, 'manifest.json');

// Retention TTLs
export const GUEST_TTL_MS = 6 * 60 * 60 * 1000;    // 6 Hours for Unauthenticated Guests
export const USER_TTL_MS = 48 * 60 * 60 * 1000;   // 48 Hours for Logged-In Users

export interface ProcessedPdfRecord {
  id: string;
  userId?: string;
  userEmail?: string;
  isGuest: boolean;
  tool: string; // 'merge' | 'split' | 'image-to-pdf' | 'compress'
  originalName: string;
  outputName: string;
  fileSizeBytes: number;
  createdAt: number; // timestamp ms
  expiresAt: number; // timestamp ms (createdAt + 6h or 48h)
  filePath: string;
}

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function readManifest(): ProcessedPdfRecord[] {
  ensureStorageDir();
  if (!fs.existsSync(MANIFEST_FILE)) return [];
  try {
    const raw = fs.readFileSync(MANIFEST_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeManifest(records: ProcessedPdfRecord[]) {
  ensureStorageDir();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(records, null, 2), 'utf8');
}

/**
 * Automatically clean up files that have passed their expiration time:
 * - Guests: deleted after 6 hours
 * - Logged-in users: deleted after 48 hours
 */
export function cleanupExpiredPdfFiles(): { removedCount: number } {
  try {
    ensureStorageDir();
    const records = readManifest();
    const now = Date.now();
    const remaining: ProcessedPdfRecord[] = [];
    let removedCount = 0;

    for (const record of records) {
      if (record.expiresAt <= now) {
        // Expired -> Delete from disk
        if (fs.existsSync(record.filePath)) {
          try {
            fs.unlinkSync(record.filePath);
          } catch {}
        }
        removedCount++;
      } else {
        remaining.push(record);
      }
    }

    if (removedCount > 0) {
      writeManifest(remaining);
      console.log(`[PdfStorage] Cleaned up ${removedCount} expired PDF documents.`);
    }

    return { removedCount };
  } catch (err: any) {
    console.warn('[PdfStorage] Cleanup error:', err?.message);
    return { removedCount: 0 };
  }
}

// Background auto-cleanup runner every 15 minutes (unref so it doesn't block process exit)
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    cleanupExpiredPdfFiles();
  }, 15 * 60 * 1000);
  if (timer.unref) {
    timer.unref();
  }
}

/**
 * Save a processed PDF document:
 * - If user is logged in: expires in 48 hours
 * - If unauthenticated guest: expires in 6 hours
 */
export function saveProcessedPdf(options: {
  originalName: string;
  outputName: string;
  buffer: Uint8Array;
  tool: string;
  user?: { id?: string; email?: string } | null;
}): ProcessedPdfRecord {
  ensureStorageDir();
  cleanupExpiredPdfFiles();

  const { originalName, outputName, buffer, tool, user } = options;
  const isGuest = !user || !user.id;
  const ttlMs = isGuest ? GUEST_TTL_MS : USER_TTL_MS;
  const now = Date.now();
  const expiresAt = now + ttlMs;

  const prefix = isGuest ? 'guest' : 'user';
  const id = `pdf-${prefix}-${now}-${randomBytes(6).toString('hex')}`;
  const fileName = `${id}.pdf`;
  const filePath = path.join(STORAGE_DIR, fileName);

  fs.writeFileSync(filePath, Buffer.from(buffer));

  const record: ProcessedPdfRecord = {
    id,
    userId: user?.id,
    userEmail: user?.email,
    isGuest,
    tool,
    originalName,
    outputName,
    fileSizeBytes: buffer.byteLength,
    createdAt: now,
    expiresAt,
    filePath,
  };

  const records = readManifest();
  records.unshift(record);
  writeManifest(records);

  return record;
}

/**
 * Retrieve a processed PDF if not expired
 */
export function getProcessedPdf(id: string): { record: ProcessedPdfRecord; buffer: Buffer } | null {
  cleanupExpiredPdfFiles();
  const records = readManifest();
  const record = records.find((r) => r.id === id);

  if (!record) return null;

  if (record.expiresAt <= Date.now()) {
    // Expired
    if (fs.existsSync(record.filePath)) {
      try {
        fs.unlinkSync(record.filePath);
      } catch {}
    }
    return null;
  }

  if (!fs.existsSync(record.filePath)) return null;

  const buffer = fs.readFileSync(record.filePath);
  return { record, buffer };
}

/**
 * Get all active processed PDFs for a logged-in user (created within 48 hours)
 */
export function getUserProcessedPdfs(userId: string): ProcessedPdfRecord[] {
  cleanupExpiredPdfFiles();
  const records = readManifest();
  const now = Date.now();
  return records.filter((r) => r.userId === userId && r.expiresAt > now);
}

// Backward compatibility wrappers
export function saveGuestDocument(originalName: string, outputName: string, buffer: Uint8Array) {
  return saveProcessedPdf({
    originalName,
    outputName,
    buffer,
    tool: 'generic',
    user: null,
  });
}

export function getGuestDocument(id: string) {
  return getProcessedPdf(id);
}

export function cleanupExpiredGuestFiles() {
  return cleanupExpiredPdfFiles();
}
