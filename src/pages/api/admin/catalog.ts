import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import { ObjectId } from 'mongodb';

export const POST: APIRoute = async ({ request, locals }) => {
  const adminUser = locals.user;

  if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'owner')) {
    return new Response(JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { suggestionId, action, reason } = await request.json();

    if (!suggestionId || !action) {
      return new Response(JSON.stringify({ error: 'Missing suggestionId or action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getDb();
    let query: any = { _id: suggestionId };
    if (ObjectId.isValid(suggestionId)) {
      query = { $or: [{ _id: new ObjectId(suggestionId) }, { _id: suggestionId }] };
    }

    const now = new Date();
    const status = action === 'approve' ? 'approved' : 'rejected';

    const updateRes = await db.collection('catalogSuggestions').updateOne(query, {
      $set: {
        status,
        reviewedBy: adminUser.id,
        reviewDecisionReason: reason || undefined,
        reviewedAt: now,
        updatedAt: now,
      },
    });

    if (updateRes.matchedCount === 0) {
      return new Response(JSON.stringify({ error: 'Suggestion not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Append-only audit record
    await db.collection('auditLogs').insertOne({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      action: `catalog_suggestion_${status}`,
      targetType: 'catalogSuggestion',
      targetId: suggestionId,
      reason: reason || action,
      createdAt: now,
    });

    return new Response(JSON.stringify({ ok: true, suggestionId, status }), {
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
