import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import type { SavedResource } from '../../../types';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Please log in to save resources.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { resourceId } = await request.json();
    if (!resourceId) {
      return new Response(JSON.stringify({ error: 'Missing resourceId.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getDb();
    const existing = await db.collection<SavedResource>('savedResources').findOne({
      userId: user.id,
      resourceId,
    });

    if (existing) {
      // Remove bookmark (toggle)
      await db.collection('savedResources').deleteOne({ userId: user.id, resourceId });
      return new Response(JSON.stringify({ ok: true, saved: false, message: 'Removed from My Resources.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // Add bookmark
      await db.collection<SavedResource>('savedResources').insertOne({
        userId: user.id,
        resourceId,
        createdAt: new Date(),
      });
      return new Response(JSON.stringify({ ok: true, saved: true, message: 'Saved to My Resources.' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
