import type { APIRoute } from 'astro';
import { createAcademicDoubt, searchAcademicDoubts } from '../../../server/repositories/doubtRepository';
import { isDoubtRateLimited } from '../../../server/security/rateLimiter';
import { findUserById } from '../../../server/auth/userStore';
import { z } from 'zod';

const createDoubtSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  content: z.string().min(10, 'Description must be at least 10 characters').max(3000),
  codeSnippet: z.string().max(5000).optional(),
  codeLanguage: z.string().max(20).optional(),
  programId: z.string().default('btech-cse'),
  universityId: z.string().default('parul-university'),
  subjectId: z.string().default('general'),
  subjectName: z.string().default('General Studies'),
  tags: z.array(z.string()).default([]),
});

export const GET: APIRoute = async ({ url }) => {
  try {
    const programId = url.searchParams.get('programId') || undefined;
    const subjectId = url.searchParams.get('subjectId') || undefined;
    const tag = url.searchParams.get('tag') || undefined;

    const doubts = await searchAcademicDoubts({ programId, subjectId, tag });
    return new Response(JSON.stringify({ ok: true, doubts }), {
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
    return new Response(JSON.stringify({ error: 'You must be signed in to ask academic doubts.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting
  const rateLimit = isDoubtRateLimited(user.id);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: `Doubt question limit reached. Please wait ${rateLimit.resetSeconds}s before asking again.` }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const parsed = createDoubtSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message || 'Invalid doubt payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const fullUser = await findUserById(user.id);

    const doubt = await createAcademicDoubt({
      ...parsed.data,
      authorId: user.id,
      authorName: user.displayName,
      isVerifiedSenior: fullUser?.isVerifiedSenior || false,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        doubtId: doubt._id?.toString(),
        message: 'Doubt question published successfully to the academic community.',
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

