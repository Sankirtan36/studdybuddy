import type { APIRoute } from 'astro';
import { createResourceRequest, searchResourceRequests } from '../../../server/repositories/requestRepository';
import { isRequestRateLimited } from '../../../server/security/rateLimiter';
import type { ResourceCategory } from '../../../types';
import { z } from 'zod';

const createRequestSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  subjectName: z.string().min(1, 'Subject name is required'),
  programId: z.string().default('prog-btech-cse'),
  universityId: z.string().default('parul-university'),
  category: z.string().default('Previous Year Question Paper'),
  examYear: z.number().optional(),
  description: z.string().max(1000).optional(),
  urgency: z.enum(['low', 'normal', 'urgent']).default('normal'),
});

export const GET: APIRoute = async ({ url }) => {
  try {
    const status = url.searchParams.get('status') || undefined;
    const programId = url.searchParams.get('programId') || undefined;
    const subjectId = url.searchParams.get('subjectId') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '15', 10);

    const result = await searchResourceRequests({ status, programId, subjectId, page, limit });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be signed in to request resources.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit
  const rateLimit = isRequestRateLimited(user.id);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: `Request limit reached. Please wait ${rateLimit.resetSeconds}s before creating more requests.` }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const parsed = createRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid request payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { subjectId, subjectName, programId, universityId, category, examYear, description, urgency } = parsed.data;

    const newRequest = await createResourceRequest({
      requesterId: user.id,
      requesterName: user.displayName,
      universityId,
      programId,
      subjectId,
      subjectName,
      category: category as ResourceCategory,
      examYear,
      description,
      urgency,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        requestId: newRequest._id?.toString(),
        message: 'Resource request created successfully! Fellow students can now discover and fulfill it.',
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

