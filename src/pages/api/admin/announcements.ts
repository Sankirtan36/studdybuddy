import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import type { Announcement } from '../../../types';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;

  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return new Response(JSON.stringify({ error: '403 Forbidden — Administrative privileges required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const title = body.title?.toString().trim();
    const content = body.content?.toString().trim();
    const priority = body.priority || 'normal';
    const ctaLabel = body.callToActionLabel?.toString().trim() || undefined;
    const ctaUrl = body.callToActionUrl?.toString().trim() || undefined;

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Title and content are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const newAnnouncement: Announcement = {
      title,
      content,
      priority,
      status: 'published',
      publishedAt: now,
      callToActionLabel: ctaLabel,
      callToActionUrl: ctaUrl,
      createdBy: user.id,
      createdByName: user.displayName,
      viewCount: 0,
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const insertRes = await db.collection('announcements').insertOne(newAnnouncement as any);

    // Audit trail
    await db.collection('auditLogs').insertOne({
      actorId: user.id,
      actorEmail: user.email,
      action: 'announcement_published',
      targetType: 'announcement',
      targetId: insertRes.insertedId.toString(),
      reason: title,
      createdAt: now,
    });

    return new Response(
      JSON.stringify({ ok: true, announcementId: insertRes.insertedId.toString() }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
