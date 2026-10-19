import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db/mongo';
import type { CommunityThread } from '../../../types';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const title = body.title?.toString().trim();
    const content = body.content?.toString().trim();
    const authorName = body.authorName?.toString().trim() || 'Anonymous Student';
    const isGuest = !locals.user;

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'Title and content are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (content.length > 2000) {
      return new Response(JSON.stringify({ error: 'Message cannot exceed 2000 characters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();

    // Guest Chat 8-hour expiry rule
    let expiresAt: Date | null = null;
    if (isGuest) {
      expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // exactly 8 hours from now
    }

    const newThread: CommunityThread = {
      title,
      content,
      authorId: locals.user?.id || undefined,
      authorName: locals.user?.displayName || authorName,
      isGuest,
      expiresAt,
      replyCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const insertRes = await db.collection('communityThreads').insertOne(newThread as any);

    return new Response(
      JSON.stringify({
        ok: true,
        threadId: insertRes.insertedId.toString(),
        isGuest,
        expiresAt: expiresAt?.toISOString() || null,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
