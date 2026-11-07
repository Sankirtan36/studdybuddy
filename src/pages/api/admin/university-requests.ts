import type { APIRoute } from 'astro';
import {
  getAllUniversityRequests,
  approveUniversityRequest,
  rejectUniversityRequest,
} from '../../../server/repositories/universityRequestRepository';

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(
      JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status') as any;

  try {
    const list = await getAllUniversityRequests(statusParam || undefined);
    return new Response(JSON.stringify({ ok: true, requests: list }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(
      JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { requestId, action, reason } = body;

    if (!requestId || !action) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing requestId or action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve') {
      const result = await approveUniversityRequest(requestId, {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          message: `University "${result.university.name}" approved successfully! It is now live across StuddyBuddy.`,
          university: result.university,
          faculties: result.faculties,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reject') {
      await rejectUniversityRequest(
        requestId,
        reason || 'Did not meet platform guidelines',
        { id: user.id, email: user.email }
      );

      return new Response(
        JSON.stringify({
          ok: true,
          message: `University request has been rejected.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: `Invalid action "${action}". Use 'approve' or 'reject'.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Moderation action failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
