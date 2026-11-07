import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { getDb } from '../db/mongo';
import { createAnnouncement } from './announcementRepository';
import type { University, UniversityRequest, UniversityRequestStatus, Faculty } from '../../types';

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

const REQUESTS_FILE = path.join(getDataDir(), 'university-requests.json');
const UNIVERSITIES_FILE = path.join(getDataDir(), 'universities.json');
const FACULTIES_FILE = path.join(getDataDir(), 'faculties.json');

// In-memory cache for fast lookup
const memoryRequests = new Map<string, UniversityRequest>();
const memoryUniversities = new Map<string, University>();
const memoryFaculties = new Map<string, Faculty>();

function ensureDir() {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {}
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizes university name for strict fuzzy duplicate comparison
 * (e.g., "Parul University", "parul university", "Parul University, Vadodara")
 */
export function normalizeNameForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/university|college|institute|of|technology|sciences|and|&|,|\.|\(|\)/gi, '')
    .replace(/[\s_-]+/g, '')
    .trim();
}

export function readLocalRequests(): UniversityRequest[] {
  ensureDir();
  const file = path.join(getDataDir(), 'university-requests.json');
  let disk: UniversityRequest[] = [];
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      disk = JSON.parse(raw);
    }
  } catch {}

  const map = new Map<string, UniversityRequest>();
  for (const r of disk) {
    map.set(r._id?.toString() || r.slug, {
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : undefined,
    });
  }
  for (const [id, r] of memoryRequests.entries()) {
    if (!map.has(id)) {
      map.set(id, r);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function writeLocalRequests(items: UniversityRequest[]) {
  ensureDir();
  const file = path.join(getDataDir(), 'university-requests.json');
  try {
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[UniversityRequestRepo] Could not write requests to disk:', err?.message);
  }
}

export function readLocalCustomUniversities(): University[] {
  ensureDir();
  const file = path.join(getDataDir(), 'universities.json');
  let disk: University[] = [];
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      disk = JSON.parse(raw);
    }
  } catch {}

  const map = new Map<string, University>();
  for (const u of disk) {
    map.set(u.slug, {
      ...u,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    });
  }
  for (const [slug, u] of memoryUniversities.entries()) {
    if (!map.has(slug)) {
      map.set(slug, u);
    }
  }
  return Array.from(map.values());
}

export function writeLocalCustomUniversities(items: University[]) {
  ensureDir();
  const file = path.join(getDataDir(), 'universities.json');
  try {
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[UniversityRequestRepo] Could not write universities to disk:', err?.message);
  }
}

export function readLocalCustomFaculties(): Faculty[] {
  ensureDir();
  const file = path.join(getDataDir(), 'faculties.json');
  let disk: Faculty[] = [];
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      disk = JSON.parse(raw);
    }
  } catch {}

  const map = new Map<string, Faculty>();
  for (const f of disk) {
    map.set(f._id?.toString() || f.slug, {
      ...f,
      createdAt: new Date(f.createdAt),
      updatedAt: new Date(f.updatedAt),
    });
  }
  for (const [id, f] of memoryFaculties.entries()) {
    if (!map.has(id)) {
      map.set(id, f);
    }
  }
  return Array.from(map.values());
}

export function writeLocalCustomFaculties(items: Faculty[]) {
  ensureDir();
  const file = path.join(getDataDir(), 'faculties.json');
  try {
    fs.writeFileSync(file, JSON.stringify(items, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[UniversityRequestRepo] Could not write faculties to disk:', err?.message);
  }
}

/**
 * Check if a university already exists (checks fallback seeds, custom universities, and MongoDB)
 */
export async function findExistingUniversity(nameOrSlug: string): Promise<University | null> {
  const targetSlug = slugify(nameOrSlug);
  const targetNorm = normalizeNameForComparison(nameOrSlug);

  // 1. Check custom universities
  const custom = readLocalCustomUniversities();
  for (const u of custom) {
    if (u.slug === targetSlug || u.name.toLowerCase() === nameOrSlug.toLowerCase()) {
      return u;
    }
    if (targetNorm && normalizeNameForComparison(u.name) === targetNorm) {
      return u;
    }
  }

  // 2. Check catalog fallback universities
  const { getUniversities } = await import('./catalogRepository');
  const allUnis = await getUniversities();
  for (const u of allUnis) {
    if (u.slug === targetSlug || u.name.toLowerCase() === nameOrSlug.toLowerCase()) {
      return u;
    }
    if (targetNorm && normalizeNameForComparison(u.name) === targetNorm) {
      return u;
    }
  }

  // 3. Check MongoDB
  try {
    const db = await getDb();
    const found = await db.collection<University>('universities').findOne({
      $or: [
        { slug: targetSlug },
        { name: { $regex: new RegExp(`^${nameOrSlug.trim()}$`, 'i') } },
      ],
    });
    if (found) return found;
  } catch {}

  return null;
}

/**
 * Check if a request for this university is already pending review
 */
export function findPendingUniversityRequest(nameOrSlug: string): UniversityRequest | null {
  const targetSlug = slugify(nameOrSlug);
  const targetNorm = normalizeNameForComparison(nameOrSlug);

  const requests = readLocalRequests().filter((r) => r.status === 'pending');
  for (const r of requests) {
    if (r.slug === targetSlug || r.name.toLowerCase() === nameOrSlug.toLowerCase()) {
      return r;
    }
    if (targetNorm && normalizeNameForComparison(r.name) === targetNorm) {
      return r;
    }
  }
  return null;
}

/**
 * Submit a request to add a new university or college.
 * Enforces strict duplicate prevention:
 * - If already exists on StuddyBuddy -> rejected with existing link
 * - If already pending admin review -> informed with pending status
 */
export async function submitUniversityRequest(payload: {
  name: string;
  location: string;
  websiteUrl?: string;
  description?: string;
  departments?: string[];
  requestedBy?: string;
  requestedByName?: string;
  requestedByEmail?: string;
}): Promise<UniversityRequest> {
  const name = payload.name.trim();
  const location = payload.location.trim();
  const slug = slugify(name);

  if (!name || name.length < 3) {
    throw new Error('Please enter a valid university or college name (minimum 3 characters).');
  }

  if (!location || location.length < 2) {
    throw new Error('Please enter the campus location (City, State, or Country).');
  }

  // 1. Strict Duplicate Check: Has it already been created?
  const existing = await findExistingUniversity(name);
  if (existing) {
    const err: any = new Error(`"${existing.name}" pehle se StuddyBuddy par registered hai! Aap iske andar directly notes aur question papers browse ya upload kar sakte hain.`);
    err.isDuplicate = true;
    err.existingUniversity = existing;
    throw err;
  }

  // 2. Pending Check: Is it already submitted and waiting for admin approval?
  const pending = findPendingUniversityRequest(name);
  if (pending) {
    const err: any = new Error(`"${pending.name}" ki request pehle se Admin ke review mein pending hai! Admin ke approval ke baad ye live ho jayegi.`);
    err.isPending = true;
    err.pendingRequest = pending;
    throw err;
  }

  const now = new Date();
  const idStr = `unireq-${Date.now()}-${randomBytes(4).toString('hex')}`;

  const newRequest: UniversityRequest = {
    _id: idStr,
    name,
    slug,
    location,
    websiteUrl: payload.websiteUrl?.trim() || undefined,
    description: payload.description?.trim() || undefined,
    departments: payload.departments && payload.departments.length > 0 ? payload.departments : undefined,
    requestedBy: payload.requestedBy || 'guest',
    requestedByName: payload.requestedByName?.trim() || 'Student Contributor',
    requestedByEmail: payload.requestedByEmail?.trim() || undefined,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save to local requests
  memoryRequests.set(idStr, newRequest);
  const local = readLocalRequests().filter((r) => r._id?.toString() !== idStr);
  local.unshift(newRequest);
  writeLocalRequests(local);

  // 2. Sync to MongoDB in background
  (async () => {
    try {
      const db = await getDb();
      await db.collection('universityRequests').insertOne({ ...newRequest });
    } catch {}
  })();

  return newRequest;
}

/**
 * Get all university requests (for Admin dashboard)
 */
export async function getAllUniversityRequests(status?: UniversityRequestStatus): Promise<UniversityRequest[]> {
  const local = readLocalRequests();
  if (status) {
    return local.filter((r) => r.status === status);
  }
  return local;
}

/**
 * Admin Action: Approve a university request.
 * - Activates university into the official catalog
 * - Creates requested departments / faculties
 * - Emits a Universal Announcement notice
 * - Logs audit trail
 */
export async function approveUniversityRequest(
  requestId: string,
  adminUser: { id: string; email: string; displayName?: string }
): Promise<{ university: University; faculties: Faculty[] }> {
  const requests = readLocalRequests();
  const targetReq = requests.find((r) => r._id?.toString() === requestId || r.slug === requestId);

  if (!targetReq) {
    throw new Error('University request not found.');
  }

  if (targetReq.status === 'approved') {
    throw new Error('This university has already been approved.');
  }

  const now = new Date();

  // 1. Update request status to 'approved'
  targetReq.status = 'approved';
  targetReq.reviewedBy = adminUser.email;
  targetReq.reviewedAt = now;
  targetReq.updatedAt = now;
  memoryRequests.set(targetReq._id!.toString(), targetReq);
  writeLocalRequests(requests);

  // 2. Create the official University object
  const newUniversity: University = {
    _id: `uni-${targetReq.slug}`,
    name: targetReq.name,
    slug: targetReq.slug,
    location: targetReq.location,
    websiteUrl: targetReq.websiteUrl,
    description: targetReq.description || `Welcome to ${targetReq.name} on StuddyBuddy! Access syllabus, lecture notes, and question papers shared by verified students.`,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Save to custom universities list
  memoryUniversities.set(newUniversity.slug, newUniversity);
  const customUnis = readLocalCustomUniversities().filter((u) => u.slug !== newUniversity.slug);
  customUnis.unshift(newUniversity);
  writeLocalCustomUniversities(customUnis);

  // 3. Create initial departments/faculties for this university
  const defaultDepartments = [
    'Engineering & Technology',
    'Computer Applications & IT',
    'Management & Commerce',
    'Applied Sciences & Humanities',
  ];

  const deptNamesToCreate = targetReq.departments && targetReq.departments.length > 0
    ? targetReq.departments
    : defaultDepartments;

  const createdFaculties: Faculty[] = [];
  const currentFaculties = readLocalCustomFaculties();

  for (const deptName of deptNamesToCreate) {
    const fSlug = slugify(deptName);
    const faculty: Faculty = {
      _id: `fac-${newUniversity.slug}-${fSlug}`,
      universityId: newUniversity.slug,
      name: deptName.trim(),
      slug: fSlug,
      description: `${deptName} at ${newUniversity.name}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    createdFaculties.push(faculty);
    memoryFaculties.set(faculty._id!.toString(), faculty);
    currentFaculties.push(faculty);
  }

  writeLocalCustomFaculties(currentFaculties);

  // 4. Synchronize to MongoDB in background
  (async () => {
    try {
      const db = await getDb();
      await db.collection('universityRequests').updateOne(
        { _id: targetReq._id },
        { $set: { status: 'approved', reviewedBy: adminUser.email, reviewedAt: now, updatedAt: now } }
      );
      await db.collection('universities').updateOne(
        { slug: newUniversity.slug },
        { $set: newUniversity },
        { upsert: true }
      );
      for (const f of createdFaculties) {
        await db.collection('faculties').updateOne(
          { _id: f._id },
          { $set: f },
          { upsert: true }
        );
      }
      // Log audit
      await db.collection('auditLogs').insertOne({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        action: 'approve_university_request',
        targetType: 'university',
        targetId: newUniversity.slug,
        details: { universityName: newUniversity.name },
        createdAt: now,
      });
    } catch {}
  })();

  // 5. Broadcast announcement so all students see the new campus on the notification bell!
  try {
    await createAnnouncement({
      title: `🎉 New Campus Added: ${newUniversity.name}`,
      content: `${newUniversity.name} (${newUniversity.location}) is now officially live on StuddyBuddy! You can now browse courses, access question papers, and upload lecture notes.`,
      priority: 'normal',
      callToActionLabel: 'Explore Campus',
      callToActionUrl: `/university/${newUniversity.slug}`,
      createdBy: adminUser.id,
      createdByName: adminUser.displayName || 'Administrator',
    });
  } catch {}

  return { university: newUniversity, faculties: createdFaculties };
}

/**
 * Admin Action: Reject a university request
 */
export async function rejectUniversityRequest(
  requestId: string,
  reason: string,
  adminUser: { id: string; email: string }
): Promise<boolean> {
  const requests = readLocalRequests();
  const targetReq = requests.find((r) => r._id?.toString() === requestId || r.slug === requestId);

  if (!targetReq) {
    throw new Error('University request not found.');
  }

  const now = new Date();
  targetReq.status = 'rejected';
  targetReq.rejectionReason = reason.trim() || 'Does not meet platform catalog criteria.';
  targetReq.reviewedBy = adminUser.email;
  targetReq.reviewedAt = now;
  targetReq.updatedAt = now;

  memoryRequests.set(targetReq._id!.toString(), targetReq);
  writeLocalRequests(requests);

  (async () => {
    try {
      const db = await getDb();
      await db.collection('universityRequests').updateOne(
        { _id: targetReq._id },
        { $set: { status: 'rejected', rejectionReason: targetReq.rejectionReason, reviewedBy: adminUser.email, reviewedAt: now, updatedAt: now } }
      );
      await db.collection('auditLogs').insertOne({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        action: 'reject_university_request',
        targetType: 'university_request',
        targetId: requestId,
        details: { reason },
        createdAt: now,
      });
    } catch {}
  })();

  return true;
}

/**
 * Add a new department / faculty inside an approved university
 */
export async function addFacultyToUniversity(
  universitySlug: string,
  facultyName: string,
  description?: string
): Promise<Faculty> {
  const uni = await findExistingUniversity(universitySlug);
  if (!uni) {
    throw new Error(`University with slug "${universitySlug}" was not found.`);
  }

  const fSlug = slugify(facultyName);
  const now = new Date();

  // Check if faculty already exists under this university
  const existingFaculties = readLocalCustomFaculties();
  const found = existingFaculties.find((f) => f.universityId === uni.slug && f.slug === fSlug);
  if (found) {
    throw new Error(`Department "${facultyName}" pehle se is university ke andar exist karta hai.`);
  }

  const newFaculty: Faculty = {
    _id: `fac-${uni.slug}-${fSlug}`,
    universityId: uni.slug,
    name: facultyName.trim(),
    slug: fSlug,
    description: description?.trim() || `${facultyName} at ${uni.name}`,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  existingFaculties.push(newFaculty);
  memoryFaculties.set(newFaculty._id!.toString(), newFaculty);
  writeLocalCustomFaculties(existingFaculties);

  (async () => {
    try {
      const db = await getDb();
      await db.collection('faculties').updateOne(
        { _id: newFaculty._id },
        { $set: newFaculty },
        { upsert: true }
      );
    } catch {}
  })();

  return newFaculty;
}

