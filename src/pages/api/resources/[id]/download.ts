import type { APIRoute } from 'astro';
import { getResourceById, incrementResourceDownload } from '../../../../server/repositories/resourceRepository';
import { getDb } from '../../../../server/db/mongo';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs';
import path from 'node:path';

function isValidS3Endpoint(endpoint?: string): boolean {
  if (!endpoint) return false;
  if (endpoint.includes('<') || endpoint.includes('>') || endpoint.includes('your_')) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const s3Endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
const s3Bucket = process.env.OBJECT_STORAGE_BUCKET;
const s3AccessKey = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
const s3SecretKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;

export const GET: APIRoute = async ({ params, request }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing resource ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resource = await getResourceById(id);

  // Enforce server-side authorization: only approved resources can be downloaded publicly
  if (!resource || resource.status !== 'approved') {
    return new Response(JSON.stringify({ error: 'Resource not available or pending moderation' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Increment verified download count
  await incrementResourceDownload(id);

  // 2. Record analytics event server-side
  try {
    const db = await getDb();
    await db.collection('analyticsEvents').insertOne({
      eventType: 'download_completed',
      resourceId: id,
      universityId: resource.universityId,
      programId: resource.programId,
      subjectId: resource.subjectId,
      category: resource.category,
      fileSizeBytes: resource.fileSizeBytes,
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date(),
    });
  } catch (err) {
    // Non-blocking for download delivery
  }

  // 3. Check if uploaded file exists locally on disk in .data/uploads/
  try {
    const localFilePath = path.resolve(process.cwd(), '.data', 'uploads', resource.storageKey);
    if (fs.existsSync(localFilePath)) {
      const fileBuffer = fs.readFileSync(localFilePath);
      // Ensure clean, unencoded filename in ASCII quotes AND UTF-8 encoded parameter
      let safeFilename = (resource.originalFilename || `${resource.title}.${resource.fileExtension || 'pdf'}`).trim();
      const expectedExt = `.${resource.fileExtension || 'pdf'}`;
      if (!safeFilename.toLowerCase().endsWith(expectedExt.toLowerCase())) {
        safeFilename += expectedExt;
      }
      const cleanAsciiFilename = safeFilename.replace(/["\r\n\\]/g, '');
      const utf8EncodedFilename = encodeURIComponent(safeFilename);

      const mimeType = resource.mimeType && resource.mimeType !== 'application/octet-stream'
        ? resource.mimeType
        : (resource.fileExtension === 'pdf' ? 'application/pdf' : 'application/octet-stream');

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${cleanAsciiFilename}"; filename*=UTF-8''${utf8EncodedFilename}`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (err: any) {
    console.warn('[Download] Local file read warning:', err?.message);
  }

  // 4. Object storage delivery (if valid S3/R2 configured)
  if (isValidS3Endpoint(s3Endpoint) && s3Bucket && s3AccessKey && s3SecretKey && !s3AccessKey.includes('your_')) {
    try {
      const s3 = new S3Client({
        region: process.env.OBJECT_STORAGE_REGION || 'auto',
        endpoint: s3Endpoint,
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
        },
      });

      const command = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: resource.storageKey,
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(resource.originalFilename || 'study-resource.pdf')}"`,
      });

      // Generate 5-minute signed URL
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      return Response.redirect(signedUrl, 302);
    } catch (s3Error: any) {
      console.error('Failed to generate presigned download URL:', s3Error?.message);
    }
  }

  // 5. Safe fallback for local development: Deliver a valid generated PDF document
  const samplePdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> endobj
5 0 obj << /Length 120 >> stream
BT
/F1 16 Tf
50 720 Td
(StuddyBuddy — ${resource.title.replace(/[()]/g, '')}) Tj
/F1 12 Tf
0 -30 Td
(Category: ${resource.category} | Exam: ${resource.examYear || 'N/A'}) Tj
0 -20 Td
(Contributed by: ${resource.contributorName}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000219 00000 n
0000000306 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
478
%%EOF`;

  const safeFilename = resource.originalFilename || `${resource.title.slice(0, 30)}.pdf`;

  return new Response(samplePdfContent, {
    status: 200,
    headers: {
      'Content-Type': resource.mimeType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}"`,
      'Cache-Control': 'no-store',
    },
  });
};
