import type { APIRoute } from 'astro';
import { getProcessedPdf } from '../../../server/pdf/pdfStorage';

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing document ID.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = getProcessedPdf(id);

  if (!result) {
    return new Response(
      JSON.stringify({
        error: 'This document has expired and was automatically deleted from the server (guest files expire after 6 hours; logged-in files expire after 48 hours).',
      }),
      {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { record, buffer } = result;
  const cleanAsciiFilename = record.outputName.replace(/["\r\n\\]/g, '');
  const utf8EncodedFilename = encodeURIComponent(record.outputName);

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cleanAsciiFilename}"; filename*=UTF-8''${utf8EncodedFilename}`,
      'Content-Length': buffer.length.toString(),
      'X-Expires-At': new Date(record.expiresAt).toISOString(),
      'Cache-Control': 'no-store, no-cache',
    },
  });
};
