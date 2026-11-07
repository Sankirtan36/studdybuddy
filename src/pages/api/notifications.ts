import type { APIRoute } from 'astro';
import { getPublishedAnnouncements } from '../../server/repositories/announcementRepository';

/**
 * Public Notifications Endpoint
 * GET /api/notifications
 * Accessible to EVERY visitor — whether unauthenticated guest or authenticated student.
 */
export const GET: APIRoute = async () => {
  try {
    const announcements = await getPublishedAnnouncements(20);

    return new Response(
      JSON.stringify({
        ok: true,
        count: announcements.length,
        notifications: announcements.map((a) => ({
          id: a._id?.toString(),
          title: a.title,
          content: a.content,
          priority: a.priority || 'normal',
          callToActionLabel: a.callToActionLabel,
          callToActionUrl: a.callToActionUrl,
          publishedAt: a.publishedAt || a.createdAt,
          createdByName: a.createdByName || 'Administrator',
        })),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || 'Failed to retrieve platform notifications.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

