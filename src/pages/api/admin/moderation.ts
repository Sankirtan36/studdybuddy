import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import { ObjectId } from 'mongodb';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;

  // Server-side RBAC enforcement
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { resourceId, action, reason } = body;

    if (!resourceId || !action) {
      return new Response(JSON.stringify({ error: 'Missing resourceId or action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let targetStatus: 'approved' | 'rejected' | 'removed';
    if (action === 'approve') targetStatus = 'approved';
    else if (action === 'reject') targetStatus = 'rejected';
    else if (action === 'remove') targetStatus = 'removed';
    else {
      return new Response(JSON.stringify({ error: 'Invalid moderation action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getDb();
    let query: any = { _id: resourceId };
    if (ObjectId.isValid(resourceId)) {
      query = { $or: [{ _id: new ObjectId(resourceId) }, { _id: resourceId }] };
    }

    const now = new Date();
    const updateResult = await db.collection('resources').updateOne(query, {
      $set: {
        status: targetStatus,
        moderatedBy: user.id,
        moderationReason: reason || undefined,
        moderatedAt: now,
        updatedAt: now,
      },
    });

    if (updateResult.matchedCount === 0) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Append-only audit log
    await db.collection('auditLogs').insertOne({
      actorId: user.id,
      actorEmail: user.email,
      action: `resource_${action}`,
      targetType: 'resource',
      targetId: resourceId,
      reason: reason || 'Moderator action',
      createdAt: now,
    });

    // Analytics event
    await db.collection('analyticsEvents').insertOne({
      eventType: targetStatus === 'approved' ? 'resource_approved' : 'resource_rejected',
      resourceId,
      userId: user.id,
      timestamp: now,
    });

    return new Response(
      JSON.stringify({ ok: true, resourceId, status: targetStatus }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
