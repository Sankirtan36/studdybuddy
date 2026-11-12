import { getDb } from '../db/mongo';
import type { Notification, NotificationType } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';

import os from 'node:os';

function getDataDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (typeof process.cwd === 'function' && process.cwd().startsWith('/var/task'))
  );

  if (isServerless) {
    const tmp = path.join(os.tmpdir(), 'studdybuddy-data');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    } catch {}
    return tmp;
  }

  const p1 = path.resolve(process.cwd(), '.data');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), 'studdybuddy', '.data');
  if (fs.existsSync(p2)) return p2;

  try {
    if (!fs.existsSync(p1)) fs.mkdirSync(p1, { recursive: true });
    return p1;
  } catch {
    const tmp = path.join(os.tmpdir(), 'studdybuddy-data');
    try {
      if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    } catch {}
    return tmp;
  }
}

function ensureDataDir(): string {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

function readLocalNotifications(): Notification[] {
  const file = path.join(ensureDataDir(), 'notifications.json');
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalNotifications(items: Notification[]) {
  try {
    const file = path.join(ensureDataDir(), 'notifications.json');
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[NotificationService] Could not write notifications to disk:', err?.message);
  }
}

/**
 * Create a new notification for a student.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl?: string
): Promise<Notification> {
  const newNotif: Notification = {
    _id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    type,
    title,
    message,
    actionUrl,
    isRead: false,
    createdAt: new Date(),
  };

  try {
    const db = await getDb();
    const result = await db.collection('notifications').insertOne(newNotif as any);
    if (result.insertedId) {
      newNotif._id = result.insertedId.toString();
    }
  } catch {
    // MongoDB offline fallback
    const local = readLocalNotifications();
    local.unshift(newNotif);
    writeLocalNotifications(local);
  }

  return newNotif;
}

/**
 * Get notifications for a user with unread counter.
 */
export async function getUserNotifications(
  userId: string,
  limit = 20
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  try {
    const db = await getDb();
    const query = { userId };
    const notifications = await db
      .collection<Notification>('notifications')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const unreadCount = await db.collection('notifications').countDocuments({ userId, isRead: false });

    return { notifications, unreadCount };
  } catch {
    const local = readLocalNotifications().filter((n) => n.userId === userId);
    const unreadCount = local.filter((n) => !n.isRead).length;
    return {
      notifications: local.slice(0, limit),
      unreadCount,
    };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const db = await getDb();
    let query: any = { _id: notificationId, userId };
    if (ObjectId.isValid(notificationId)) {
      query = { $or: [{ _id: new ObjectId(notificationId) }, { _id: notificationId }], userId };
    }
    const res = await db.collection('notifications').updateOne(query, { $set: { isRead: true } });
    return res.modifiedCount > 0;
  } catch {
    const local = readLocalNotifications();
    const item = local.find((n) => n._id === notificationId && n.userId === userId);
    if (item) {
      item.isRead = true;
      writeLocalNotifications(local);
      return true;
    }
    return false;
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  try {
    const db = await getDb();
    await db.collection('notifications').updateMany({ userId, isRead: false }, { $set: { isRead: true } });
    return true;
  } catch {
    const local = readLocalNotifications();
    for (const item of local) {
      if (item.userId === userId) {
        item.isRead = true;
      }
    }
    writeLocalNotifications(local);
    return true;
  }
}

