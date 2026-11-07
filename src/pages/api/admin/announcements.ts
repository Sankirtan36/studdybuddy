import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAllAnnouncements,
} from '../../../server/repositories/announcementRepository';

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;

  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(
      JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const list = await getAllAnnouncements(50);
    return new Response(JSON.stringify({ ok: true, announcements: list }), {
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
    const title = body.title?.toString().trim();
    const content = body.content?.toString().trim();
    const priority = body.priority || 'normal';
    const ctaLabel = body.callToActionLabel?.toString().trim() || undefined;
    const ctaUrl = body.callToActionUrl?.toString().trim() || undefined;

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await createAnnouncement({
      title,
      content,
      priority,
      callToActionLabel: ctaLabel,
      callToActionUrl: ctaUrl,
      createdBy: user.id,
      createdByName: user.displayName,
    });

    // Record Audit trail
    try {
      const db = await getDb();
      await db.collection('auditLogs').insertOne({
        actorId: user.id,
        actorEmail: user.email,
        action: 'announcement_published',
        targetType: 'announcement',
        targetId: created._id?.toString() || 'announcement',
        reason: title,
        createdAt: new Date(),
      });
    } catch {}

    return new Response(
      JSON.stringify({ ok: true, announcement: created }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;

  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(
      JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(request.url);
    let id = url.searchParams.get('id');
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = body.id || body.announcementId;
    }

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Announcement ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await deleteAnnouncement(id);

    // Record Audit trail
    try {
      const db = await getDb();
      await db.collection('auditLogs').insertOne({
        actorId: user.id,
        actorEmail: user.email,
        action: 'announcement_deleted',
        targetType: 'announcement',
        targetId: id,
        reason: 'Revoked by admin',
        createdAt: new Date(),
      });
    } catch {}

    return new Response(
      JSON.stringify({ ok: true, message: 'Announcement deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
