import type { APIRoute } from 'astro';
import { mergePdfs, splitPdf, convertImagesToPdf, compressPdf } from '../../../server/pdf/pdfTools';
import { saveProcessedPdf, cleanupExpiredPdfFiles } from '../../../server/pdf/pdfStorage';

const MAX_PDF_TOOL_FILE_SIZE = 3 * 1024 * 1024; // 3 MB limit per file

function getCleanBaseName(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/["\r\n\\]/g, '').trim() || 'document';
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Run maintenance cleanup of expired files (guests > 6h, logged-in > 48h)
    cleanupExpiredPdfFiles();

    const formData = await request.formData();
    const tool = formData.get('tool')?.toString();

    if (!tool) {
      return new Response(JSON.stringify({ error: 'Missing PDF tool operation.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let outputBuffer: Uint8Array;
    let originalName = 'document.pdf';
    let outputFilename = 'processed-document.pdf';

    // 1. TOOL: MERGE
    if (tool === 'merge') {
      const files = formData.getAll('files') as File[];
      if (files.length < 2) {
        return new Response(JSON.stringify({ error: 'Please select at least 2 PDF files to merge.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      for (const file of files) {
        if (file.size > MAX_PDF_TOOL_FILE_SIZE) {
          const mb = (file.size / (1024 * 1024)).toFixed(2);
          return new Response(
            JSON.stringify({ error: `File "${file.name}" is ${mb} MB, which exceeds the 3 MB maximum size limit.` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      const buffers: Buffer[] = [];
      for (const file of files) {
        buffers.push(Buffer.from(await file.arrayBuffer()));
      }

      outputBuffer = await mergePdfs(buffers);
      originalName = files[0].name;
      outputFilename = `Merged_${getCleanBaseName(files[0].name)}.pdf`;

    // 2. TOOL: SPLIT
    } else if (tool === 'split') {
      const file = formData.get('file') as File | null;
      const startPage = parseInt(formData.get('startPage')?.toString() || '1', 10);
      const endPage = parseInt(formData.get('endPage')?.toString() || '1', 10);

      if (!file) {
        return new Response(JSON.stringify({ error: 'Please select a PDF file to split.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (file.size > MAX_PDF_TOOL_FILE_SIZE) {
        const mb = (file.size / (1024 * 1024)).toFixed(2);
        return new Response(
          JSON.stringify({ error: `File "${file.name}" is ${mb} MB, which exceeds the 3 MB maximum size limit.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      outputBuffer = await splitPdf(buffer, startPage, endPage);
      originalName = file.name;
      outputFilename = `${getCleanBaseName(file.name)}_pages_${startPage}-${endPage}.pdf`;

    // 3. TOOL: IMAGE TO PDF
    } else if (tool === 'image-to-pdf') {
      const files = formData.getAll('files') as File[];
      if (files.length === 0) {
        return new Response(JSON.stringify({ error: 'Please upload at least one image.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      for (const file of files) {
        if (file.size > MAX_PDF_TOOL_FILE_SIZE) {
          const mb = (file.size / (1024 * 1024)).toFixed(2);
          return new Response(
            JSON.stringify({ error: `Image "${file.name}" is ${mb} MB, which exceeds the 3 MB maximum size limit.` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      const imageItems: Array<{ buffer: Buffer; mimeType: string }> = [];
      for (const file of files) {
        imageItems.push({
          buffer: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || 'image/jpeg',
        });
      }

      outputBuffer = await convertImagesToPdf(imageItems);
      originalName = files[0].name;
      outputFilename = `${getCleanBaseName(files[0].name)}_converted.pdf`;

    // 4. TOOL: COMPRESS
    } else if (tool === 'compress') {
      const file = formData.get('file') as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'Please select a PDF file to compress.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (file.size > MAX_PDF_TOOL_FILE_SIZE) {
        const mb = (file.size / (1024 * 1024)).toFixed(2);
        return new Response(
          JSON.stringify({ error: `File "${file.name}" is ${mb} MB, which exceeds the 3 MB maximum size limit.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      outputBuffer = await compressPdf(buffer);
      originalName = file.name;
      outputFilename = `${getCleanBaseName(file.name)}_compressed.pdf`;

    } else {
      return new Response(JSON.stringify({ error: 'Unsupported PDF tool operation.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save to processed PDF storage:
    // - Guests (without login/signup) -> stored for 6 hours
    // - Logged-in users -> stored for 48 hours
    const user = locals.user;
    const isGuest = !user;
    const record = saveProcessedPdf({
      originalName,
      outputName: outputFilename,
      buffer: outputBuffer,
      tool,
      user: user || null,
    });

    // Prepare standard RFC 6266/5987 Content-Disposition header
    const cleanAsciiFilename = outputFilename.replace(/["\r\n\\]/g, '');
    const utf8EncodedFilename = encodeURIComponent(outputFilename);

    return new Response(outputBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cleanAsciiFilename}"; filename*=UTF-8''${utf8EncodedFilename}`,
        'Content-Length': outputBuffer.byteLength.toString(),
        'X-Original-Filename': outputFilename,
        'X-Document-Id': record.id,
        'X-Storage-TTL': isGuest ? '6-hours' : '48-hours',
        'X-Expires-At': new Date(record.expiresAt).toISOString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('PDF Process error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Failed to process document. Please ensure files are valid and uncorrupted.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
