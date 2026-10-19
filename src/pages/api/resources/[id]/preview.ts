import type { APIRoute } from 'astro';
import { getResourceById } from '../../../../server/repositories/resourceRepository';
import fs from 'node:fs';
import path from 'node:path';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) {
    return new Response('Missing resource ID', { status: 400 });
  }

  const resource = await getResourceById(id);
  if (!resource || resource.status !== 'approved') {
    return new Response('Resource not found', { status: 404 });
  }

  try {
    const localFilePath = path.resolve(process.cwd(), '.data', 'uploads', resource.storageKey);
    if (fs.existsSync(localFilePath)) {
      const fileBuffer = fs.readFileSync(localFilePath);
      const mimeType = resource.mimeType && resource.mimeType !== 'application/octet-stream'
        ? resource.mimeType
        : (resource.fileExtension === 'pdf' ? 'application/pdf' : 'application/octet-stream');

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${(resource.originalFilename || resource.title).replace(/["\r\n\\]/g, '')}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (err: any) {
    console.warn('[Preview] Local file read error:', err?.message);
  }

  return new Response('File preview not available', { status: 404 });
};
