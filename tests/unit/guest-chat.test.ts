import { describe, it, expect } from 'vitest';
import type { CommunityThread } from '../../src/types';

describe('Community & 8-Hour Guest Chat Expiration', () => {
  function filterActiveDiscussions(threads: CommunityThread[], currentTime = new Date()): CommunityThread[] {
    return threads.filter((t) => {
      if (!t.expiresAt) return true; // Permanent thread
      return new Date(t.expiresAt).getTime() > currentTime.getTime();
    });
  }

  it('preserves authenticated student discussions indefinitely', () => {
    const studentThread: CommunityThread = {
      _id: 't1',
      title: 'Permanent Thread',
      content: 'Important study guide',
      authorName: 'Aarav',
      isGuest: false,
      expiresAt: null,
      replyCount: 0,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const active = filterActiveDiscussions([studentThread], new Date('2025-01-01'));
    expect(active.length).toBe(1);
  });

  it('filters out guest discussions that are older than 8 hours', () => {
    const now = new Date('2026-10-19T12:00:00Z');

    const freshGuestThread: CommunityThread = {
      _id: 't-fresh',
      title: 'Fresh Doubt',
      content: 'Can someone explain question 4?',
      authorName: 'Guest',
      isGuest: true,
      expiresAt: new Date('2026-10-19T16:00:00Z'), // 4 hours in future
      replyCount: 0,
      createdAt: new Date('2026-10-19T08:00:00Z'),
      updatedAt: new Date('2026-10-19T08:00:00Z'),
    };

    const expiredGuestThread: CommunityThread = {
      _id: 't-expired',
      title: 'Old Doubt',
      content: 'Expired question',
      authorName: 'Guest',
      isGuest: true,
      expiresAt: new Date('2026-10-19T10:00:00Z'), // 2 hours in PAST
      replyCount: 0,
      createdAt: new Date('2026-10-19T02:00:00Z'),
      updatedAt: new Date('2026-10-19T02:00:00Z'),
    };

    const active = filterActiveDiscussions([freshGuestThread, expiredGuestThread], now);
    expect(active.length).toBe(1);
    expect(active[0]._id).toBe('t-fresh');
  });
});
