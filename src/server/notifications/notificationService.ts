import { getDb } from '../db/mongo';
import type { Notification, NotificationType } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalNotifications(): Notification[] {
  ensureDataDir();
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return [];
  try {
    const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalNotifications(items: Notification[]) {
  ensureDataDir();
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(items, null, 2), 'utf8');
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

