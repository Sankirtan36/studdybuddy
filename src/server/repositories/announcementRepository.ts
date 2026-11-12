import { getDb } from '../db/mongo';
import type { Announcement } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

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

export function readLocalAnnouncements(): Announcement[] {
  const file = path.join(ensureDataDir(), 'announcements.json');
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.map((item: any) => ({
      ...item,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

export function writeLocalAnnouncements(announcements: Announcement[]) {
  try {
    const file = path.join(ensureDataDir(), 'announcements.json');
    fs.writeFileSync(file, JSON.stringify(announcements, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[AnnouncementRepo] Could not write announcements to disk:', err?.message);
  }
}

/**
 * Get published announcements for public viewing (guests and logged-in users)
 * Fast local-first response in sub-millisecond, Mongo sync
 */
export async function getPublishedAnnouncements(limitCount = 20): Promise<Announcement[]> {
  // 1. Fast path: If local file exists, use it as primary ground truth (<0.1ms)
  const announcementsFile = path.join(ensureDataDir(), 'announcements.json');
  if (fs.existsSync(announcementsFile)) {
    const local = readLocalAnnouncements().filter((a) => a.status === 'published');
    return local
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitCount);
  }

  // 2. Query MongoDB if local store is not yet initialized
  try {
    const db = await getDb();
    const items = await db
      .collection<Announcement>('announcements')
      .find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(limitCount)
      .toArray();

    if (items && items.length > 0) {
      const mapped = items.map((item) => ({
        ...item,
        _id: item._id?.toString(),
      }));
      writeLocalAnnouncements(mapped);
      return mapped;
    }
  } catch {
    // MongoDB offline
  }

  return [];
}

/**
 * Get all announcements (for admin management)
 */
export async function getAllAnnouncements(limitCount = 50): Promise<Announcement[]> {
  // 1. Fast path: If local file exists, use it (<0.1ms)
  const announcementsFile = path.join(ensureDataDir(), 'announcements.json');
  if (fs.existsSync(announcementsFile)) {
    const local = readLocalAnnouncements();
    return local
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitCount);
  }

  // 2. MongoDB if not yet initialized
  try {
    const db = await getDb();
    const items = await db
      .collection<Announcement>('announcements')
      .find({})
      .sort({ createdAt: -1 })
      .limit(limitCount)
      .toArray();

    if (items && items.length > 0) {
      const mapped = items.map((item) => ({
        ...item,
        _id: item._id?.toString(),
      }));
      writeLocalAnnouncements(mapped);
      return mapped;
    }
  } catch {}

  return [];
}

/**
 * Create a new broadcast announcement / notification
 */
export async function createAnnouncement(payload: {
  title: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  callToActionLabel?: string;
  callToActionUrl?: string;
  createdBy: string;
  createdByName?: string;
}): Promise<Announcement> {
  const now = new Date();
  const idStr = randomBytes(12).toString('hex');

  const newDoc: Announcement = {
    _id: idStr,
    title: payload.title.trim(),
    content: payload.content.trim(),
    status: 'published',
    priority: payload.priority || 'normal',
    callToActionLabel: payload.callToActionLabel?.trim() || undefined,
    callToActionUrl: payload.callToActionUrl?.trim() || undefined,
    publishedAt: now,
    createdBy: payload.createdBy,
    createdByName: payload.createdByName || 'Administrator',
    viewCount: 0,
    clickCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save to local JSON first for immediate 0ms persistence
  const localList = readLocalAnnouncements();
  localList.unshift(newDoc);
  writeLocalAnnouncements(localList);

  // 2. Save to MongoDB if available (non-blocking background)
  (async () => {
    try {
      const db = await getDb();
      let mongoId: any;
      try {
        mongoId = new ObjectId(idStr);
      } catch {
        mongoId = undefined;
      }
      const docToInsert = { ...newDoc };
      if (mongoId) {
        (docToInsert as any)._id = mongoId;
      }
      await db.collection('announcements').insertOne(docToInsert as any);
    } catch {}
  })();

  // 3. Non-blocking Firestore sync (never blocks user or test execution)
  (async () => {
    try {
      const { saveFirestoreDocument } = await import('../../lib/firebase');
      const cleanDoc: any = {};
      for (const [k, v] of Object.entries(newDoc)) {
        if (v !== undefined) cleanDoc[k] = v;
      }
      cleanDoc.publishedAt = now.toISOString();
      cleanDoc.createdAt = now.toISOString();
      cleanDoc.updatedAt = now.toISOString();

      await Promise.race([
        saveFirestoreDocument('announcements', idStr, cleanDoc),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
      ]);
    } catch {}
  })();

  return newDoc;
}

/**
 * Delete / Revoke an announcement by ID
 */
export async function deleteAnnouncement(id: string): Promise<boolean> {
  // 1. Remove from local JSON immediately
  const localList = readLocalAnnouncements();
  const filtered = localList.filter((a) => a._id?.toString() !== id);
  writeLocalAnnouncements(filtered);

  // 2. Remove from MongoDB (non-blocking)
  (async () => {
    try {
      const db = await getDb();
      let query: any = { _id: id };
      try {
        query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
      } catch {}
      await db.collection('announcements').deleteOne(query);
    } catch {}
  })();

  // 3. Remove from Firestore (non-blocking)
  (async () => {
    try {
      const { deleteFirestoreDocument } = await import('../../lib/firebase');
      await Promise.race([
        deleteFirestoreDocument('announcements', id),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
      ]);
    } catch {}
  })();

  return true;
}
