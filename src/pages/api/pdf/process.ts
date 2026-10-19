import type { APIRoute } from 'astro';
import { mergePdfs, splitPdf, convertImagesToPdf, compressPdf } from '../../../server/pdf/pdfTools';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const tool = formData.get('tool')?.toString();

    if (!tool) {
      return new Response(JSON.stringify({ error: 'Missing tool operation' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let outputBuffer: Uint8Array;
    let filename = 'studdybuddy-output.pdf';

    if (tool === 'merge') {
      const files = formData.getAll('files') as File[];
      if (files.length < 2) {
        return new Response(JSON.stringify({ error: 'Please select at least 2 PDF files to merge.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const buffers: Buffer[] = [];
      for (const file of files) {
        buffers.push(Buffer.from(await file.arrayBuffer()));
      }
      outputBuffer = await mergePdfs(buffers);
      filename = 'merged-documents.pdf';
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

      const buffer = Buffer.from(await file.arrayBuffer());
      outputBuffer = await splitPdf(buffer, startPage, endPage);
      filename = `split-pages-${startPage}-to-${endPage}.pdf`;
    } else if (tool === 'image-to-pdf') {
      const files = formData.getAll('files') as File[];
      if (files.length === 0) {
        return new Response(JSON.stringify({ error: 'Please upload at least one image.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const imageItems: Array<{ buffer: Buffer; mimeType: string }> = [];
      for (const file of files) {
        imageItems.push({
          buffer: Buffer.from(await file.arrayBuffer()),
          mimeType: file.type || 'image/jpeg',
        });
      }

      outputBuffer = await convertImagesToPdf(imageItems);
      filename = 'converted-images.pdf';
    } else if (tool === 'compress') {
      const file = formData.get('file') as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'Please select a PDF file to compress.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      outputBuffer = await compressPdf(buffer);
      filename = 'compressed-document.pdf';
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported PDF tool' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(outputBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Failed to process document' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
