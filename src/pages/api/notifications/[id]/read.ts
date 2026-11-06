import type { APIRoute } from 'astro';
import { markNotificationRead } from '../../../../server/notifications/notificationService';

export const PATCH: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing notification ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const success = await markNotificationRead(id, user.id);
    return new Response(JSON.stringify({ ok: success }), {
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

