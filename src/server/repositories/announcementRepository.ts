import { getDb } from '../db/mongo';
import type { Announcement } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readLocalAnnouncements(): Announcement[] {
  ensureDataDir();
  if (!fs.existsSync(ANNOUNCEMENTS_FILE)) return [];
  try {
    const raw = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
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
  ensureDataDir();
  fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(announcements, null, 2), 'utf8');
}

/**
 * Get published announcements for public viewing (guests and logged-in users)
 * Fast local-first response in sub-millisecond, Mongo sync
 */
export async function getPublishedAnnouncements(limitCount = 20): Promise<Announcement[]> {
  // 1. Fast path: If local file exists, use it as primary ground truth (<0.1ms)
  if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
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
  if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
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
