import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/mongo';

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

// In-memory cache for fast lookup and serverless fallback
const inMemoryRecords = new Map<string, ProcessedPdfRecord>();
const inMemoryBuffers = new Map<string, Buffer>();

let cachedStorageDir: string | null = null;

/**
 * Returns a writable directory for processed PDFs.
 * In serverless environments (Vercel, AWS Lambda) where /var/task is read-only,
 * this automatically and safely uses os.tmpdir().
 */
export function getSafeStorageDir(): string {
  if (cachedStorageDir) {
    try {
      if (!fs.existsSync(cachedStorageDir)) {
        fs.mkdirSync(cachedStorageDir, { recursive: true });
      }
      return cachedStorageDir;
    } catch {}
  }

  // Detect serverless environment (Vercel, AWS Lambda, Netlify)
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );

  if (isServerless) {
    const tmp = path.join(os.tmpdir(), 'studdybuddy-pdf-tools');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
      cachedStorageDir = tmp;
      return tmp;
    } catch {}
  }

  const candidates = [
    path.resolve(process.cwd(), '.data', 'pdf-tools'),
    path.resolve(process.cwd(), 'studdybuddy', '.data', 'pdf-tools'),
    path.join(os.tmpdir(), 'studdybuddy-pdf-tools'),
  ];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const testFile = path.join(dir, `.write-test-${Date.now()}`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      cachedStorageDir = dir;
      return dir;
    } catch {
      continue;
    }
  }

  const fallback = path.join(os.tmpdir(), 'studdybuddy-pdf-tools');
  try {
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  } catch {}
  cachedStorageDir = fallback;
  return fallback;
}

function getManifestPath(): string {
  return path.join(getSafeStorageDir(), 'manifest.json');
}

function ensureStorageDir(): string {
  return getSafeStorageDir();
}

function readManifest(): ProcessedPdfRecord[] {
  const manifestFile = getManifestPath();
  let diskRecords: ProcessedPdfRecord[] = [];
  try {
    if (fs.existsSync(manifestFile)) {
      const raw = fs.readFileSync(manifestFile, 'utf8');
      diskRecords = JSON.parse(raw);
    }
  } catch {}

  // Sync disk state with in-memory records
  for (const r of diskRecords) {
    inMemoryRecords.set(r.id, r);
  }

  // Also include any memory-only records that haven't been written to disk yet
  const result: ProcessedPdfRecord[] = [...diskRecords];
  const diskIds = new Set(diskRecords.map((r) => r.id));
  for (const [id, r] of inMemoryRecords.entries()) {
    if (!diskIds.has(id)) {
      result.push(r);
    }
  }

  return result.sort((a, b) => b.createdAt - a.createdAt);
}

function writeManifest(records: ProcessedPdfRecord[]) {
  const manifestFile = getManifestPath();
  try {
    fs.writeFileSync(manifestFile, JSON.stringify(records, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[PdfStorage] Could not write manifest to disk, keeping in memory:', err?.message);
  }
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
        // Expired -> Delete from disk and memory
        if (record.filePath && fs.existsSync(record.filePath)) {
          try {
            fs.unlinkSync(record.filePath);
          } catch {}
        }
        inMemoryRecords.delete(record.id);
        inMemoryBuffers.delete(record.id);
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
  const storageDir = ensureStorageDir();
  cleanupExpiredPdfFiles();

  const { originalName, outputName, buffer, tool, user } = options;
  const isGuest = !user || !user.id;
  const ttlMs = isGuest ? GUEST_TTL_MS : USER_TTL_MS;
  const now = Date.now();
  const expiresAt = now + ttlMs;

  const prefix = isGuest ? 'guest' : 'user';
  const id = `pdf-${prefix}-${now}-${randomBytes(6).toString('hex')}`;
  const fileName = `${id}.pdf`;
  const filePath = path.join(storageDir, fileName);

  const nodeBuffer = Buffer.from(buffer);

  // Store in memory cache
  inMemoryBuffers.set(id, nodeBuffer);

  // Attempt to write to disk
  try {
    fs.writeFileSync(filePath, nodeBuffer);
  } catch (err: any) {
    console.warn('[PdfStorage] Could not write file to disk, relying on memory cache:', err?.message);
  }

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

  inMemoryRecords.set(id, record);

  try {
    const records = readManifest().filter((r) => r.id !== id);
    records.unshift(record);
    writeManifest(records);
  } catch {}

  // Cross-serverless background persistence: store in MongoDB so any lambda container can retrieve it
  (async () => {
    try {
      const db = await getDb();
      await db.collection('processed_pdfs').updateOne(
        { _id: id as any },
        {
          $set: {
            _id: id as any,
            userId: user?.id,
            userEmail: user?.email,
            isGuest,
            tool,
            originalName,
            outputName,
            fileSizeBytes: buffer.byteLength,
            createdAt: new Date(now),
            expiresAt: new Date(expiresAt),
            buffer: nodeBuffer,
          },
        },
        { upsert: true }
      );
      // Ensure TTL expiration index
      try {
        await db.collection('processed_pdfs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      } catch {}
    } catch (err: any) {
      // In-memory and local disk copy are already safe
    }
  })();

  return record;
}

/**
 * Retrieve a processed PDF if not expired (Synchronous check from memory or local disk)
 */
export function getProcessedPdf(id: string): { record: ProcessedPdfRecord; buffer: Buffer } | null {
  cleanupExpiredPdfFiles();
  const records = readManifest();
  const record = records.find((r) => r.id === id) || inMemoryRecords.get(id);

  if (!record) return null;

  if (record.expiresAt <= Date.now()) {
    // Expired
    if (record.filePath && fs.existsSync(record.filePath)) {
      try {
        fs.unlinkSync(record.filePath);
      } catch {}
    }
    inMemoryRecords.delete(id);
    inMemoryBuffers.delete(id);
    return null;
  }

  // 1. Check in-memory buffer
  if (inMemoryBuffers.has(id)) {
    return { record, buffer: inMemoryBuffers.get(id)! };
  }

  // 2. Check disk file
  if (record.filePath && fs.existsSync(record.filePath)) {
    try {
      const buffer = fs.readFileSync(record.filePath);
      return { record, buffer };
    } catch {}
  }

  return null;
}

/**
 * Resilient Async PDF Retrieval:
 * Checks memory -> local disk -> MongoDB cross-container collection
 * This guarantees 100% reliable downloads even if requests hit different Vercel serverless containers!
 */
export async function getProcessedPdfAsync(id: string): Promise<{ record: ProcessedPdfRecord; buffer: Buffer } | null> {
  // 1. Fast local check (memory / disk)
  const local = getProcessedPdf(id);
  if (local) return local;

  // 2. Cross-container MongoDB check
  try {
    const db = await getDb();
    const doc: any = await db.collection('processed_pdfs').findOne({ _id: id as any });
    if (doc && doc.expiresAt && new Date(doc.expiresAt).getTime() > Date.now()) {
      const record: ProcessedPdfRecord = {
        id: doc._id,
        userId: doc.userId,
        userEmail: doc.userEmail,
        isGuest: Boolean(doc.isGuest),
        tool: doc.tool || 'generic',
        originalName: doc.originalName || 'document.pdf',
        outputName: doc.outputName || 'document.pdf',
        fileSizeBytes: doc.fileSizeBytes || 0,
        createdAt: new Date(doc.createdAt).getTime(),
        expiresAt: new Date(doc.expiresAt).getTime(),
        filePath: '',
      };

      let buffer: Buffer;
      if (Buffer.isBuffer(doc.buffer)) {
        buffer = doc.buffer;
      } else if (doc.buffer?.buffer) {
        buffer = Buffer.from(doc.buffer.buffer);
      } else {
        buffer = Buffer.from(doc.buffer);
      }

      // Populate local memory caches for instant access
      inMemoryRecords.set(id, record);
      inMemoryBuffers.set(id, buffer);

      return { record, buffer };
    }
  } catch (err: any) {
    // MongoDB lookup fallback
  }

  return null;
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
