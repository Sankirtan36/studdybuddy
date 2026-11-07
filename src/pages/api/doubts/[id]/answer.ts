import type { APIRoute } from 'astro';
import { addDoubtAnswer } from '../../../../server/repositories/doubtRepository';
import { findUserById } from '../../../../server/auth/userStore';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be signed in to post an answer.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing question ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { content, codeSnippet } = await request.json();
    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ error: 'Answer content cannot be empty.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fullUser = await findUserById(user.id);
    const isSeniorGuidance = fullUser?.isVerifiedSenior || false;

    const answer = await addDoubtAnswer(
      id,
      content.trim(),
      codeSnippet?.trim(),
      user.id,
      user.displayName,
      isSeniorGuidance
    );

    return new Response(
      JSON.stringify({
        ok: true,
        answerId: answer._id?.toString(),
        message: isSeniorGuidance
          ? 'Senior Guidance solution posted successfully!'
          : 'Answer posted successfully!',
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
