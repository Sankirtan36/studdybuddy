import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import { updateResource, deleteResource } from '../../../server/repositories/resourceRepository';
import fs from 'node:fs';
import path from 'node:path';

function appendLocalAudit(log: any) {
  try {
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const auditFile = path.join(dataDir, 'auditLogs.json');
    let logs: any[] = [];
    if (fs.existsSync(auditFile)) {
      logs = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    }
    logs.unshift(log);
    fs.writeFileSync(auditFile, JSON.stringify(logs.slice(0, 200), null, 2), 'utf8');
  } catch {}
}

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

    const now = new Date();

    if (action === 'delete' || action === 'remove') {
      const ok = await deleteResource(resourceId);
      if (!ok) {
        return new Response(JSON.stringify({ error: 'Resource not found or already deleted' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const log = {
        actorId: user.id,
        actorEmail: user.email,
        action: 'resource_deleted',
        targetType: 'resource',
        targetId: resourceId,
        reason: reason || 'Admin deleted resource',
        createdAt: now,
      };
      appendLocalAudit(log);

      try {
        const db = await getDb();
        await db.collection('auditLogs').insertOne(log);
      } catch {}

      return new Response(JSON.stringify({ ok: true, resourceId, action: 'deleted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let targetStatus: 'approved' | 'rejected' | 'pending' | 'published';
    if (action === 'approve') targetStatus = 'approved';
    else if (action === 'reject') targetStatus = 'rejected';
    else {
      return new Response(JSON.stringify({ error: 'Invalid moderation action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updated = await updateResource(resourceId, {
      status: targetStatus as any,
      moderatedBy: user.id,
      moderationReason: reason || undefined,
      moderatedAt: now,
    });

    if (!updated) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const log = {
      actorId: user.id,
      actorEmail: user.email,
      action: `resource_${action}`,
      targetType: 'resource',
      targetId: resourceId,
      reason: reason || 'Moderator action',
      createdAt: now,
    };
    appendLocalAudit(log);

    try {
      const db = await getDb();
      await db.collection('auditLogs').insertOne(log);
      await db.collection('analyticsEvents').insertOne({
        eventType: targetStatus === 'approved' ? 'resource_approved' : 'resource_rejected',
        resourceId,
        userId: user.id,
        timestamp: now,
      });
    } catch {}

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
