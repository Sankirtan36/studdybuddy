import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnnouncement,
  getPublishedAnnouncements,
  getAllAnnouncements,
  deleteAnnouncement,
  writeLocalAnnouncements,
} from '../../src/server/repositories/announcementRepository';

describe('Universal Broadcast Notifications & Announcements System', () => {
  beforeEach(() => {
    // Clean local announcements before each test
    writeLocalAnnouncements([]);
  });

  it('allows admin to publish a broadcast announcement that is visible to everyone', async () => {
    const ann = await createAnnouncement({
      title: 'Exam Guidelines 2026',
      content: 'All question papers and revision sheets are now live.',
      priority: 'high',
      callToActionLabel: 'Explore Resources',
      callToActionUrl: '/resources',
      createdBy: 'admin-1',
      createdByName: 'Lead Admin',
    });

    expect(ann).toBeDefined();
    expect(ann.title).toBe('Exam Guidelines 2026');
    expect(ann.status).toBe('published');
    expect(ann.priority).toBe('high');

    // Retrieve notifications (simulating a guest or unauthenticated user visit)
    const publicNotifs = await getPublishedAnnouncements(10);
    expect(publicNotifs.length).toBeGreaterThanOrEqual(1);

    const found = publicNotifs.find((n) => n.title === 'Exam Guidelines 2026');
    expect(found).toBeDefined();
    expect(found?.content).toContain('All question papers');
    expect(found?.callToActionUrl).toBe('/resources');
  });

  it('supports deletion / revocation of broadcast announcements', async () => {
    const ann = await createAnnouncement({
      title: 'Temporary Notice',
      content: 'Scheduled maintenance at midnight.',
      priority: 'urgent',
      createdBy: 'admin-1',
    });

    const notifsBefore = await getPublishedAnnouncements(10);
    expect(notifsBefore.some((n) => n._id?.toString() === ann._id?.toString())).toBe(true);

    // Admin revokes the announcement
    await deleteAnnouncement(ann._id!.toString());

    const notifsAfter = await getPublishedAnnouncements(10);
    expect(notifsAfter.some((n) => n._id?.toString() === ann._id?.toString())).toBe(false);
  });

  it('retrieves all announcements for admin dashboard overview', async () => {
    await createAnnouncement({
      title: 'Notice 1',
      content: 'Message 1',
      priority: 'normal',
      createdBy: 'admin-1',
    });
    await createAnnouncement({
      title: 'Notice 2',
      content: 'Message 2',
      priority: 'urgent',
      createdBy: 'admin-1',
    });

    const all = await getAllAnnouncements(10);
    expect(all.length).toBe(2);
    expect(all[0].title).toBe('Notice 2'); // Latest first
    expect(all[1].title).toBe('Notice 1');
  });
});

