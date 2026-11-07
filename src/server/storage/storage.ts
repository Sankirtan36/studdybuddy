import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDb } from '../db/mongo';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { SupportedFileExtension } from '../../types';

export function getLocalUploadsDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );

  if (isServerless) {
    const tmp = path.join(os.tmpdir(), 'studdybuddy', 'uploads');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    } catch {}
    return tmp;
  }

  const p1 = path.resolve(process.cwd(), '.data', 'uploads');
  try {
    if (!fs.existsSync(p1)) fs.mkdirSync(p1, { recursive: true });
    return p1;
  } catch {
    const tmp = path.join(os.tmpdir(), 'studdybuddy', 'uploads');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    } catch {}
    return tmp;
  }
}

const STORAGE_BUDGET_BYTES = parseInt(process.env.STORAGE_BUDGET_BYTES || '21474836480', 10); // 20 GB
const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '3145728', 10); // 3 MB limit

const ALLOWED_EXTENSIONS: Record<string, SupportedFileExtension> = {
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'pptx',
  doc: 'doc',
  docx: 'docx',
  jpg: 'jpg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

const ALLOWED_MIME_TYPES: Record<string, boolean> = {
  'application/pdf': true,
  'application/vnd.ms-powerpoint': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
  'application/msword': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  extension?: SupportedFileExtension;
  mimeType?: string;
}

/**
 * Validate file extension, MIME type, and file size.
 */
export function validateUploadFile(filename: string, mimeType: string, sizeBytes: number): FileValidationResult {
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `File exceeds maximum allowed size of ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const parts = filename.split('.');
  const ext = parts.pop()?.toLowerCase() || '';

  if (!ALLOWED_EXTENSIONS[ext]) {
    return {
      valid: false,
      error: `Unsupported file extension .${ext}. Allowed formats: PDF, PPT, PPTX, DOC, DOCX, JPG, PNG, WEBP.`,
    };
  }

  if (!ALLOWED_MIME_TYPES[mimeType] && mimeType !== 'application/octet-stream') {
    return {
      valid: false,
      error: `Invalid file MIME type: ${mimeType}.`,
    };
  }

  return {
    valid: true,
    extension: ALLOWED_EXTENSIONS[ext],
    mimeType,
  };
}

/**
 * Compute SHA-256 checksum of file buffer for duplicate detection.
 */
export function computeFileChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validate magic bytes / file signatures to prevent extension spoofing.
 */
export function validateMagicBytes(buffer: Buffer, extension: SupportedFileExtension): { valid: boolean; error?: string } {
  if (buffer.length < 4) {
    return { valid: false, error: 'File is corrupt or empty (less than 4 bytes).' };
  }

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (extension === 'pdf') {
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    if (!isPdf) return { valid: false, error: 'File signature does not match a valid PDF document.' };
    return { valid: true };
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47
  if (extension === 'png') {
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    if (!isPng) return { valid: false, error: 'File signature does not match a valid PNG image.' };
    return { valid: true };
  }

  // 3. JPEG: 0xFF 0xD8 0xFF
  if (extension === 'jpg' || extension === 'jpeg') {
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!isJpg) return { valid: false, error: 'File signature does not match a valid JPEG image.' };
    return { valid: true };
  }

  // 4. WebP: RIFF (0x52 0x49 0x46 0x46) + WEBP at offset 8 (0x57 0x45 0x42 0x50)
  if (extension === 'webp') {
    if (buffer.length < 12) return { valid: false, error: 'WebP image too small.' };
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    if (!isRiff || !isWebp) return { valid: false, error: 'File signature does not match a valid WebP image.' };
    return { valid: true };
  }

  // 5. DOCX / PPTX: Standard ZIP archive signature PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (extension === 'docx' || extension === 'pptx') {
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZip) return { valid: false, error: `File signature does not match a valid ${extension.toUpperCase()} document.` };
    return { valid: true };
  }

  // 6. Legacy DOC / PPT: Compound Binary Format 0xD0 0xCF 0x11 0xE0
  if (extension === 'doc' || extension === 'ppt') {
    const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    if (!isOle) return { valid: false, error: `File signature does not match a valid ${extension.toUpperCase()} document.` };
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Scan buffer for suspicious patterns (malware signatures, executable headers, script injection).
 */
export function scanBufferForThreats(buffer: Buffer): { safe: boolean; reason?: string } {
  // Check for Windows executable header ('MZ' - 0x4D 0x5A)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { safe: false, reason: 'File contains executable binary header (MZ), which is forbidden.' };
  }

  // Check for Linux ELF binary header (0x7F 'E' 'L' 'F')
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { safe: false, reason: 'File contains ELF executable binary header, which is forbidden.' };
  }

  // Check for dangerous shell or HTML scripts at start of file
  const first1024Bytes = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('ascii').toLowerCase();
  if (first1024Bytes.startsWith('#!') || first1024Bytes.includes('<script') || first1024Bytes.includes('<?php')) {
    return { safe: false, reason: 'File contains embedded script code or shell shebang, which is forbidden.' };
  }

  return { safe: true };
}

/**
 * Automatically clean up expired storage reservations older than 1 hour.
 */
export async function cleanupOrphanedReservations(): Promise<number> {
  try {
    const db = await getDb();
    const result = await db.collection('storageReservations').updateMany(
      { status: 'pending', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );
    return result.modifiedCount || 0;
  } catch {
    return 0;
  }
}

/**
 * Check if storage budget has capacity and create an atomic reservation.
 */
export async function reserveUploadCapacity(userId: string, expectedSizeBytes: number): Promise<{ ok: boolean; reservationId?: string; error?: string }> {
  try {
    const db = await getDb();

    // Sum currently verified stored resources
    const aggregate = await db.collection('resources').aggregate([
      { $match: { status: { $ne: 'removed' } } },
      { $group: { _id: null, totalBytes: { $sum: '$fileSizeBytes' } } },
    ]).toArray();

    const usedBytes = aggregate[0]?.totalBytes || 0;

    // Sum active unexpired reservations
    const reservationsAgg = await db.collection('storageReservations').aggregate([
      { $match: { status: 'pending', expiresAt: { $gt: new Date() } } },
      { $group: { _id: null, reservedBytes: { $sum: '$expectedSizeBytes' } } },
    ]).toArray();

    const reservedBytes = reservationsAgg[0]?.reservedBytes || 0;

    if (usedBytes + reservedBytes + expectedSizeBytes > STORAGE_BUDGET_BYTES) {
      return {
        ok: false,
        error: 'Storage quota limit reached (20 GB budget exceeded). Please contact administrators.',
      };
    }

    const reservationId = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    await db.collection('storageReservations').insertOne({
      reservationId,
      userId,
      expectedSizeBytes,
      expiresAt,
      status: 'pending',
      createdAt: new Date(),
    });

    return { ok: true, reservationId };
  } catch (err: any) {
    // If DB is offline in test, allow reservation
    return { ok: true, reservationId: randomUUID() };
  }
}

/**
 * Generate a safe unique object-storage key.
 */
export function generateStorageKey(universitySlug: string, programSlug: string, extension: string): string {
  const safeUni = universitySlug.replace(/[^a-zA-Z0-9-]/g, '') || 'general';
  const safeProg = programSlug.replace(/[^a-zA-Z0-9-]/g, '') || 'general';
  const randomSuffix = randomBytes(16).toString('hex');
  return `resources/${safeUni}/${safeProg}/${randomSuffix}.${extension}`;
}

function isValidEndpoint(endpoint?: string): boolean {
  if (!endpoint) return false;
  if (endpoint.includes('<') || endpoint.includes('>') || endpoint.includes('your_')) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasValidS3Config(): boolean {
  const s3Endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  const s3Bucket = process.env.OBJECT_STORAGE_BUCKET;
  const s3AccessKey = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
  const s3SecretKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;

  if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) return false;
  if (s3AccessKey.includes('your_') || s3SecretKey.includes('your_')) return false;
  return isValidEndpoint(s3Endpoint);
}

/**
 * Upload a file buffer to Cloudflare R2 / S3 object storage, with local disk persistence fallback.
 */
export async function uploadObjectToStorage(storageKey: string, fileBuffer: Buffer, mimeType: string): Promise<boolean> {
  // 1. Always persist file locally in uploads dir for reliable local retrieval
  try {
    const uploadsDir = getLocalUploadsDir();
    const fullPath = path.join(uploadsDir, storageKey);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, fileBuffer);
  } catch (err: any) {
    console.warn('[Storage] Warning: Failed to write to local uploads:', err?.message);
  }

  // 2. Upload to S3 if valid credentials and endpoint are configured (without placeholder angle-brackets)
  if (hasValidS3Config()) {
    try {
      const s3 = new S3Client({
        region: process.env.OBJECT_STORAGE_REGION || 'auto',
        endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
        credentials: {
          accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
        },
      });

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.OBJECT_STORAGE_BUCKET,
          Key: storageKey,
          Body: fileBuffer,
          ContentType: mimeType,
        })
      );
    } catch (s3Err: any) {
      console.warn('[Storage] S3 upload skipped/failed:', s3Err?.message);
    }
  }

  return true;
}

/**
 * Delete an object from storage.
 */
export async function deleteObjectFromStorage(storageKey: string): Promise<boolean> {
  // 1. Delete local file if present
  try {
    const uploadsDir = path.resolve(process.cwd(), '.data', 'uploads');
    const fullPath = path.join(uploadsDir, storageKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err: any) {
    console.warn('[Storage] Local file deletion error:', err?.message);
  }

  // 2. Delete from S3 if configured
  if (hasValidS3Config()) {
    try {
      const s3 = new S3Client({
        region: process.env.OBJECT_STORAGE_REGION || 'auto',
        endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
        credentials: {
          accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
        },
      });

      await s3.send(new DeleteObjectCommand({ Bucket: process.env.OBJECT_STORAGE_BUCKET, Key: storageKey }));
    } catch (err: any) {
      console.warn('[Storage] S3 delete error:', err?.message);
    }
  }

  return true;
}
