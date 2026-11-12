import { getDb } from '../db/mongo';
import type { ResourceRequest } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { awardReputation, REPUTATION_REWARDS } from '../reputation/reputationService';
import { createNotification } from '../notifications/notificationService';

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

export function readLocalRequests(): ResourceRequest[] {
  const file = path.join(ensureDataDir(), 'requests.json');
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeLocalRequests(requests: ResourceRequest[]) {
  try {
    const file = path.join(ensureDataDir(), 'requests.json');
    fs.writeFileSync(file, JSON.stringify(requests, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[RequestRepo] Could not write requests to disk:', err?.message);
  }
}

export async function createResourceRequest(
  data: Omit<ResourceRequest, '_id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<ResourceRequest> {
  const now = new Date();
  const newReq: ResourceRequest = {
    ...data,
    _id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();
    const result = await db.collection('resourceRequests').insertOne(newReq as any);
    if (result.insertedId) {
      newReq._id = result.insertedId.toString();
    }
  } catch {
    // Local fallback
  }

  const local = readLocalRequests();
  local.unshift(newReq);
  writeLocalRequests(local);

  return newReq;
}

export async function searchResourceRequests(options: {
  programId?: string;
  subjectId?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ requests: ResourceRequest[]; total: number }> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 15));
  const skip = (page - 1) * limit;

  try {
    const db = await getDb();
    const query: any = {};
    if (options.status) {
      query.status = options.status;
    }
    if (options.programId) {
      query.programId = options.programId;
    }
    if (options.subjectId) {
      query.subjectId = options.subjectId;
    }

    const total = await db.collection('resourceRequests').countDocuments(query);
    const requests = await db
      .collection<ResourceRequest>('resourceRequests')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return { requests, total };
  } catch {
    const local = readLocalRequests();
    let filtered = local.filter((r) => {
      if (options.status && r.status !== options.status) return false;
      if (options.programId && r.programId !== options.programId) return false;
      if (options.subjectId && r.subjectId !== options.subjectId) return false;
      return true;
    });

    return {
      requests: filtered.slice(skip, skip + limit),
      total: filtered.length,
    };
  }
}

export async function getRequestById(id: string): Promise<ResourceRequest | null> {
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    const item = await db.collection<ResourceRequest>('resourceRequests').findOne(query);
    if (item) return item;
  } catch {}

  const local = readLocalRequests();
  return local.find((r) => r._id === id || r._id?.toString() === id) || null;
}

/**
 * Fulfill a resource request when a student provides the requested material.
 * Automatically marks fulfilled, awards +25 reputation points to helper, and notifies requester.
 */
export async function fulfillResourceRequest(
  requestId: string,
  resourceId: string,
  helperUserId: string,
  helperUserName: string
): Promise<{ success: boolean; error?: string; request?: ResourceRequest }> {
  const reqItem = await getRequestById(requestId);
  if (!reqItem) {
    return { success: false, error: 'Resource request not found.' };
  }

  if (reqItem.status === 'fulfilled') {
    return { success: false, error: 'This request has already been fulfilled.' };
  }

  if (reqItem.requesterId === helperUserId) {
    return { success: false, error: 'You cannot fulfill your own resource request.' };
  }

  const now = new Date();
  const updates: Partial<ResourceRequest> = {
    status: 'fulfilled',
    fulfilledResourceId: resourceId,
    fulfilledByUserId: helperUserId,
    fulfilledByUserName: helperUserName,
    fulfilledAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();
    let query: any = { _id: requestId };
    if (ObjectId.isValid(requestId)) {
      query = { $or: [{ _id: new ObjectId(requestId) }, { _id: requestId }] };
    }
    await db.collection('resourceRequests').updateOne(query, { $set: updates });
  } catch {}

  const local = readLocalRequests();
  const idx = local.findIndex((r) => r._id === requestId || r._id?.toString() === requestId);
  if (idx !== -1) {
    local[idx] = { ...local[idx], ...updates };
    writeLocalRequests(local);
  }

  // 1. Award +25 reputation points to helper
  await awardReputation(helperUserId, REPUTATION_REWARDS.REQUEST_FULFILLED, 'request_fulfilled', requestId);

  // 2. Send notification to requester
  await createNotification(
    reqItem.requesterId,
    'request_fulfilled',
    'Requested Material Uploaded!',
    `${helperUserName} uploaded the resource for "${reqItem.subjectName}" (${reqItem.category}) you requested.`,
    `/resources/${resourceId}`
  );

  return { success: true, request: { ...reqItem, ...updates } };
}

export async function closeResourceRequest(
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const reqItem = await getRequestById(requestId);
  if (!reqItem) {
    return { success: false, error: 'Request not found.' };
  }

  if (reqItem.requesterId !== userId) {
    return { success: false, error: 'Only the student who created the request can close it.' };
  }

  const updates: Partial<ResourceRequest> = {
    status: 'closed',
    updatedAt: new Date(),
  };

  try {
    const db = await getDb();
    let query: any = { _id: requestId };
    if (ObjectId.isValid(requestId)) {
      query = { $or: [{ _id: new ObjectId(requestId) }, { _id: requestId }] };
    }
    await db.collection('resourceRequests').updateOne(query, { $set: updates });
  } catch {}

  const local = readLocalRequests();
  const idx = local.findIndex((r) => r._id === requestId || r._id?.toString() === requestId);
  if (idx !== -1) {
    local[idx] = { ...local[idx], ...updates };
    writeLocalRequests(local);
  }

  return { success: true };
}

