import type { APIRoute } from 'astro';
import { getPublishedAnnouncements } from '../../../server/repositories/announcementRepository';
import { getUserNotifications, markAllNotificationsRead } from '../../../server/notifications/notificationService';

/**
 * Universal Notifications API
 * Accessible to ALL visitors — both unauthenticated guests and logged-in students.
 */
export const GET: APIRoute = async ({ locals }) => {
  try {
    // 1. Fetch public announcements broadcasted to all users
    const announcements = await getPublishedAnnouncements(20);

    const mappedAnnouncements = announcements.map((a) => ({
      id: a._id?.toString(),
      title: a.title,
      content: a.content,
      priority: a.priority || 'normal',
      callToActionLabel: a.callToActionLabel,
      callToActionUrl: a.callToActionUrl,
      publishedAt: a.publishedAt || a.createdAt,
      createdByName: a.createdByName || 'Administrator',
      isPublicBroadcast: true,
    }));

    // 2. If user is logged in, optionally include personal account notifications
    const user = locals.user;
    let personalNotifications: any[] = [];
    let unreadCount = mappedAnnouncements.length;

    if (user?.id) {
      try {
        const userNotifData = await getUserNotifications(user.id, 20);
        personalNotifications = userNotifData.notifications || [];
        unreadCount += (userNotifData.unreadCount || 0);
      } catch {}
    }

    // Merge announcements first, followed by personal notifications
    const allNotifications = [...mappedAnnouncements, ...personalNotifications];

    return new Response(
      JSON.stringify({
        ok: true,
        count: allNotifications.length,
        unreadCount,
        notifications: allNotifications,
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

export const POST: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ ok: true, message: 'Guest session — read state saved in browser' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await markAllNotificationsRead(user.id);
    return new Response(JSON.stringify({ ok: true, message: 'All notifications marked as read' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
