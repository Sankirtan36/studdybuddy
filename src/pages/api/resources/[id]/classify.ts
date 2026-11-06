import type { APIRoute } from 'astro';
import { getResourceById, updateResource } from '../../../../server/repositories/resourceRepository';
import { getDb } from '../../../../server/db/mongo';
import { z } from 'zod';

const correctClassificationSchema = z.object({
  subjectId: z.string().min(1),
  programId: z.string().optional(),
  facultyId: z.string().optional(),
  academicTermId: z.string().optional(),
  category: z.string().optional(),
  examYear: z.number().optional(),
});

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing resource ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resource = await getResourceById(id);
  if (!resource) {
    return new Response(JSON.stringify({ error: 'Resource not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Permission check: Contributor or Admin/Owner
  const isOwner = resource.contributorId === user.id;
  const isAdmin = user.role === 'admin' || user.role === 'owner';
  if (!isOwner && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Only the contributor or administrators can reclassify.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const parsed = correctClassificationSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid classification update' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updates = parsed.data;
    await updateResource(id, updates as any);

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Resource academic classification updated successfully!',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing resource ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const reason = body.reason?.toString().trim() || 'Misclassified academic subject';
    const suggestedSubject = body.suggestedSubject?.toString().trim() || '';

    const db = await getDb();
    await db.collection('reports').insertOne({
      targetType: 'resource',
      targetId: id,
      reason: 'misleading',
      details: `Reported misclassification: ${reason}. Suggested subject: ${suggestedSubject}`,
      reporterId: locals.user?.id || undefined,
      reporterEmail: locals.user?.email || 'anonymous',
      status: 'open',
      createdAt: new Date(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Classification report submitted for review. Thank you for keeping catalog metadata accurate!',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

