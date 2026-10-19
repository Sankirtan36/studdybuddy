import { getDb } from '../db/mongo';
import type { Resource, ResourceCategory, ResourceStatus, SupportedFileExtension } from '../../types';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { deleteObjectFromStorage } from '../storage/storage';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readLocalResources(): Resource[] {
  ensureDataDir();
  if (!fs.existsSync(RESOURCES_FILE)) return [];
  try {
    const raw = fs.readFileSync(RESOURCES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeLocalResources(resources: Resource[]) {
  ensureDataDir();
  fs.writeFileSync(RESOURCES_FILE, JSON.stringify(resources, null, 2), 'utf8');
}

export interface ResourceFilterOptions {
  search?: string;
  universityId?: string;
  facultyId?: string;
  programId?: string;
  academicTermId?: string;
  subjectId?: string;
  category?: ResourceCategory;
  examYear?: number;
  fileExtension?: SupportedFileExtension;
  status?: ResourceStatus;
  contributorId?: string;
  sortBy?: 'newest' | 'downloads' | 'views' | 'relevance';
  page?: number;
  limit?: number;
}

export interface ResourcePaginatedResult {
  resources: Resource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Empty fallback - no dummy data
const FALLBACK_RESOURCES: Resource[] = [];

export async function searchResources(options: ResourceFilterOptions = {}): Promise<ResourcePaginatedResult> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 12));
  const skip = (page - 1) * limit;

  try {
    const db = await getDb();
    const query: any = {};

    // By default, public search only returns approved resources unless explicitly specified
    query.status = options.status || 'approved';

    if (options.universityId) query.universityId = options.universityId;
    if (options.facultyId) query.facultyId = options.facultyId;
    if (options.programId) query.programId = options.programId;
    if (options.academicTermId) query.academicTermId = options.academicTermId;
    if (options.subjectId) query.subjectId = options.subjectId;
    if (options.category) query.category = options.category;
    if (options.examYear) query.examYear = options.examYear;
    if (options.fileExtension) query.fileExtension = options.fileExtension;
    if (options.contributorId) query.contributorId = options.contributorId;

    if (options.search && options.search.trim()) {
      const term = options.search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { originalFilename: { $regex: term, $options: 'i' } },
      ];
    }

    const sortObj: any = {};
    if (options.sortBy === 'downloads') {
      sortObj.downloadCount = -1;
    } else if (options.sortBy === 'views') {
      sortObj.viewCount = -1;
    } else {
      sortObj.createdAt = -1;
    }

    const total = await db.collection<Resource>('resources').countDocuments(query);
    const resources = await db.collection<Resource>('resources').find(query).sort(sortObj).skip(skip).limit(limit).toArray();

    return {
      resources,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (err) {
    // Return local stored resources and fallback sample data filtered in memory
    const combinedPool = [...readLocalResources(), ...FALLBACK_RESOURCES];
    let items = combinedPool.filter((r) => {
      if (options.status && r.status !== options.status) return false;
      if (options.category && r.category !== options.category) return false;
      if (options.programId && r.programId !== options.programId) return false;
      if (options.subjectId && r.subjectId !== options.subjectId) return false;
      if (options.contributorId && r.contributorId !== options.contributorId) return false;
      if (options.search) {
        const q = options.search.toLowerCase();
        return r.title.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q));
      }
      return true;
    });

    return {
      resources: items.slice(skip, skip + limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit) || 1,
    };
  }
}

export async function getResourceById(id: string): Promise<Resource | null> {
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    const item = await db.collection<Resource>('resources').findOne(query);
    if (item) return item;
  } catch (err) {
    // fallback
  }

  const localItem = readLocalResources().find((r) => r._id === id || r._id?.toString() === id);
  if (localItem) return localItem;

  return FALLBACK_RESOURCES.find((r) => r._id === id || r._id?.toString() === id) || null;
}

export async function incrementResourceView(id: string): Promise<void> {
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    await db.collection('resources').updateOne(query, { $inc: { viewCount: 1 } });
  } catch (err) {
    // silently ignore if DB not ready
  }
}

export async function incrementResourceDownload(id: string): Promise<void> {
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    await db.collection('resources').updateOne(query, { $inc: { downloadCount: 1 } });
  } catch (err) {
    // silently ignore
  }
}

export async function createResource(resourceData: Omit<Resource, '_id' | 'createdAt' | 'updatedAt' | 'viewCount' | 'downloadCount'>): Promise<Resource> {
  const now = new Date();
  const generatedId = `res-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const newResource: Resource = {
    ...resourceData,
    _id: generatedId,
    viewCount: 0,
    downloadCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();
    const res = await db.collection('resources').insertOne(newResource as any);
    if (res?.insertedId) {
      newResource._id = res.insertedId.toString();
    }
  } catch (err: any) {
    console.warn('[ResourceRepository] MongoDB write skipped/failed, using local fallback:', err?.message);
  }

  // Always keep local store in sync
  try {
    const local = readLocalResources();
    local.unshift(newResource);
    writeLocalResources(local);
  } catch (err: any) {
    console.warn('[ResourceRepository] Local write failed:', err?.message);
  }

  return newResource;
}

export async function updateResource(id: string, updates: Partial<Resource>): Promise<boolean> {
  let updated = false;
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    const res = await db.collection('resources').updateOne(query, {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    });
    updated = res.matchedCount > 0;
  } catch (err) {}

  try {
    const local = readLocalResources();
    const item = local.find((r) => r._id === id || r._id?.toString() === id);
    if (item) {
      Object.assign(item, updates, { updatedAt: new Date() });
      writeLocalResources(local);
      updated = true;
    }
  } catch (err) {}

  return updated;
}

export async function deleteResource(id: string): Promise<boolean> {
  let deleted = false;
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    const res = await db.collection('resources').deleteOne(query);
    deleted = res.deletedCount > 0;
  } catch (err) {}

  try {
    const local = readLocalResources();
    const filtered = local.filter((r) => r._id !== id && r._id?.toString() !== id);
    if (filtered.length !== local.length) {
      writeLocalResources(filtered);
      deleted = true;
    }
  } catch (err) {}

  return deleted;
}

export async function deleteUserResource(
  id: string,
  userId: string,
  isAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const resource = await getResourceById(id);
    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    // Strict security check: only the contributor who uploaded it (or admin/owner) can delete
    if (!isAdmin && resource.contributorId !== userId) {
      return { success: false, error: 'Unauthorized: You can only delete your own contributions.' };
    }

    // 1. Delete from MongoDB
    try {
      const db = await getDb();
      let query: any = { _id: id };
      if (ObjectId.isValid(id)) {
        query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
      }
      await db.collection('resources').deleteOne(query);
    } catch {}

    // 2. Delete from local resources.json
    try {
      const local = readLocalResources();
      const filtered = local.filter((r) => r._id !== id && r._id?.toString() !== id);
      writeLocalResources(filtered);
    } catch {}

    // 3. Delete physical/cloud file from storage
    if (resource.storageKey) {
      await deleteObjectFromStorage(resource.storageKey);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Database error deleting resource' };
  }
}

