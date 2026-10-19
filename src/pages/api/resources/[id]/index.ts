import type { APIRoute } from 'astro';
import { deleteUserResource } from '../../../../server/repositories/resourceRepository';

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required to delete resources.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { id } = params;
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Missing resource ID.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const isAdmin = user.role === 'admin' || user.role === 'owner';
  const result = await deleteUserResource(id, user.id, isAdmin);

  if (!result.success) {
    const status = result.error?.includes('Unauthorized') ? 403 : 404;
    return new Response(
      JSON.stringify({ error: result.error || 'Failed to delete resource.' }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, message: 'Resource deleted successfully.' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
