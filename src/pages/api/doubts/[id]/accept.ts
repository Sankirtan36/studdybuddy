import type { APIRoute } from 'astro';
import { acceptDoubtAnswer } from '../../../../server/repositories/doubtRepository';

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
    return new Response(JSON.stringify({ error: 'Missing question ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { answerId } = await request.json();
    if (!answerId) {
      return new Response(JSON.stringify({ error: 'Missing answerId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await acceptDoubtAnswer(id, answerId, user.id);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Answer marked as verified solution! +15 reputation awarded to author.',
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

