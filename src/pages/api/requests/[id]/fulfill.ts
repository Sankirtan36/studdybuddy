import type { APIRoute } from 'astro';
import { fulfillResourceRequest } from '../../../../server/repositories/requestRepository';
import { getResourceById } from '../../../../server/repositories/resourceRepository';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be signed in to fulfill resource requests.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing request ID.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { resourceId } = await request.json();
    if (!resourceId) {
      return new Response(
        JSON.stringify({ error: 'Please select or upload a resource to fulfill this request.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify resource exists and is approved
    const resource = await getResourceById(resourceId);
    if (!resource || resource.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Selected resource is either invalid or pending verification.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await fulfillResourceRequest(id, resourceId, user.id, user.displayName);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Request fulfilled successfully! +25 reputation points awarded to your profile.',
        request: result.request,
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
