import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import { revokeAllUserSessions } from '../../../server/auth/session';
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
    const { userId, action, reason } = await request.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: 'Missing userId or action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getDb();
    let query: any = { _id: userId };
    if (ObjectId.isValid(userId)) {
      query = { $or: [{ _id: new ObjectId(userId) }, { _id: userId }] };
    }

    const targetUser = await db.collection('users').findOne(query);
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prevent modifying owner unless caller is owner
    if (targetUser.role === 'owner' && adminUser.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Cannot modify system owner account' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    let updates: any = { updatedAt: now };

    if (action === 'suspend') {
      updates.status = 'suspended';
      updates.restrictions = {
        ...targetUser.restrictions,
        reason: reason || 'Administrative suspension',
      };
      // Revoke all sessions immediately on suspension!
      await revokeAllUserSessions(userId);
    } else if (action === 'restore') {
      updates.status = 'active';
      if (updates.restrictions) {
        updates.restrictions.reason = undefined;
      }
    } else if (action === 'restrict_uploads') {
      updates.restrictions = {
        ...targetUser.restrictions,
        uploadsBlocked: true,
        reason: reason || 'Uploads restricted by administrator',
      };
    } else if (action === 'unrestrict_uploads') {
      updates.restrictions = {
        ...targetUser.restrictions,
        uploadsBlocked: false,
      };
    } else {
      return new Response(JSON.stringify({ error: 'Invalid user action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.collection('users').updateOne(query, { $set: updates });

    // Append-only audit record
    await db.collection('auditLogs').insertOne({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      action: `user_${action}`,
      targetType: 'user',
      targetId: userId,
      reason: reason || action,
      createdAt: now,
    });

    return new Response(JSON.stringify({ ok: true, action, userId }), {
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
