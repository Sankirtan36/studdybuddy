import { getDb } from '../db/mongo';
import type { ResourceRequest } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { awardReputation, REPUTATION_REWARDS } from '../reputation/reputationService';
import { createNotification } from '../notifications/notificationService';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readLocalRequests(): ResourceRequest[] {
  ensureDataDir();
  if (!fs.existsSync(REQUESTS_FILE)) return [];
  try {
    const raw = fs.readFileSync(REQUESTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeLocalRequests(requests: ResourceRequest[]) {
  ensureDataDir();
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf8');
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

