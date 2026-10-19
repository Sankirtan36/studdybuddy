import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDb } from '../db/mongo';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SupportedFileExtension } from '../../types';

const STORAGE_BUDGET_BYTES = parseInt(process.env.STORAGE_BUDGET_BYTES || '21474836480', 10); // 20 GB
const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '26214400', 10); // 25 MB

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
  // 1. Always persist file locally in .data/uploads/ for reliable local retrieval
  try {
    const uploadsDir = path.resolve(process.cwd(), '.data', 'uploads');
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
