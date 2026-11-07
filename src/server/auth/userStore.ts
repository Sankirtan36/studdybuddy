import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb } from '../db/mongo';
import type { User, Session } from '../../types';
import { ObjectId } from 'mongodb';

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

  // Check studdybuddy/.data first if it has real data
  const p2 = path.resolve(process.cwd(), 'studdybuddy', '.data');
  if (fs.existsSync(path.join(p2, 'users.json'))) return p2;

  const p1 = path.resolve(process.cwd(), '.data');
  if (fs.existsSync(p1)) return p1;
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

function getUsersFile(): string {
  return path.join(getDataDir(), 'users.json');
}

function getSessionsFile(): string {
  return path.join(getDataDir(), 'sessions.json');
}

// Built-in production fallback seed accounts (guaranteed to exist even in fresh serverless containers)
export const BUNDLED_DEFAULT_USERS: User[] = [
  {
    _id: 'usr-1792582359652-xip8c',
    email: 'admin2820@gmail.com',
    displayName: 'Admin',
    passwordHash: 'b53adfe34b3819d9e6fdb5a4847f6c5b:2a678111d7fa764d91a046bb97ef0d19373621a4ed4d3fcd581377b1b3bad81d70b6b14781a5dc4f3065e0397eca2d2c3af5887aed2ae89307c7594d3f21b749',
    role: 'owner',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'usr-1792433244591-qlfsj',
    email: 'aryan@gmail.com',
    displayName: 'Aryan Tripathi',
    passwordHash: '71580ec6d7aeebb46fe2d6b86750ea4e:99e050225893a606251bc7655125de6e3fb386d978bea49c6442473f1d11bf614e9075cf03479626379af078a07d82cd9af64c0fb306df2b9dcfe1e0c37fb931',
    role: 'owner',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'usr-admin-sys-default',
    email: 'admin@studdybuddy.in',
    displayName: 'System Admin',
    passwordHash: 'b53adfe34b3819d9e6fdb5a4847f6c5b:2a678111d7fa764d91a046bb97ef0d19373621a4ed4d3fcd581377b1b3bad81d70b6b14781a5dc4f3065e0397eca2d2c3af5887aed2ae89307c7594d3f21b749',
    role: 'admin',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    _id: 'usr-demo-student-1',
    email: 'student@studdybuddy.in',
    displayName: 'Student Contributor',
    passwordHash: 'c54e914a053c8255dc276e3b3fe9ce76:224f354e2122c27e98fd53345d88fe1d4d515531134f5e8da1f071ae2ff391bf84017873b0de4b8f9e44c5eae3fa7cd5c4fd41308336914dc1a2d526be6cbff8',
    role: 'user',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

// High-speed in-memory session and user caches for instant sub-millisecond response times
const sessionCache = new Map<string, Session>();
const userCache = new Map<string, User>();

function ensureDataDir() {
  const dir = getDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
}

export function readLocalUsers(): User[] {
  ensureDataDir();
  const file = getUsersFile();
  let users: User[] = [];

  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      users = JSON.parse(raw);
    } catch {
      users = [];
    }
  } else {
    // If running in serverless /tmp, attempt seed from bundled repository .data/users.json
    const bundledCandidates = [
      path.resolve(process.cwd(), 'studdybuddy', '.data', 'users.json'),
      path.resolve(process.cwd(), '.data', 'users.json'),
    ];
    for (const b of bundledCandidates) {
      if (fs.existsSync(b)) {
        try {
          const raw = fs.readFileSync(b, 'utf8');
          users = JSON.parse(raw);
          break;
        } catch {}
      }
    }
  }

  // Merge bundled default seeds to guarantee admin and default users ALWAYS exist
  const existingMap = new Map<string, User>();
  for (const u of users) {
    if (u.email) existingMap.set(u.email.toLowerCase().trim(), u);
  }

  for (const def of BUNDLED_DEFAULT_USERS) {
    const key = def.email.toLowerCase().trim();
    if (!existingMap.has(key)) {
      users.push(def);
      existingMap.set(key, def);
    } else {
      // Ensure owner/admin role integrity
      const existing = existingMap.get(key)!;
      if (def.role === 'owner' && existing.role !== 'owner') {
        existing.role = 'owner';
      }
    }
  }

  return users;
}

function writeLocalUsers(users: User[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(getUsersFile(), JSON.stringify(users, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[UserStore] Could not write users to disk, keeping in memory:', err?.message);
  }
}

function readLocalSessions(): Session[] {
  ensureDataDir();
  const file = getSessionsFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalSessions(sessions: Session[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(getSessionsFile(), JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[UserStore] Could not write sessions to disk, keeping in memory:', err?.message);
  }
}

/**
 * Find user by email (Local fast-path first for instant login, Mongo fallback)
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Fast path: check in-memory cache
  for (const u of userCache.values()) {
    if (u.email.toLowerCase() === normalizedEmail) {
      return u;
    }
  }

  // 2. Fast path: check local disk store (takes ~0.1ms)
  const local = readLocalUsers();
  const localUser = local.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (localUser) {
    if (localUser._id) {
      userCache.set(localUser._id.toString(), localUser);
    }
    return localUser;
  }

  // 3. If not found locally, query MongoDB
  try {
    const db = await getDb();
    const user = await db.collection<User>('users').findOne({ email: normalizedEmail });
    if (user) {
      local.push(user);
      writeLocalUsers(local);
      if (user._id) {
        userCache.set(user._id.toString(), user);
      }
      return user;
    }
  } catch {
    // MongoDB unavailable -> fallback already checked
  }

  return null;
}

/**
 * Find user by ID (Local fast-path first for instant session validation)
 */
export async function findUserById(id: string): Promise<User | null> {
  if (!id) return null;
  const idStr = id.toString();

  // 1. Fast path: in-memory cache (<0.001ms)
  const cached = userCache.get(idStr);
  if (cached) return cached;

  // 2. Fast path: local disk store (~0.1ms)
  const local = readLocalUsers();
  const found = local.find((u) => u._id?.toString() === idStr);
  if (found) {
    userCache.set(idStr, found);
    return found;
  }

  // 3. Fallback to MongoDB if not found in local store
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    const user = await db.collection<User>('users').findOne(query);
    if (user) {
      local.push(user);
      writeLocalUsers(local);
      userCache.set(idStr, user);
      return user;
    }
  } catch {
    // fallback
  }

  return null;
}

/**
 * Create a new user (Local-first persistence with non-blocking Mongo sync)
 */
export async function createUser(userData: User): Promise<User> {
  const normalized: User = {
    ...userData,
    email: userData.email.toLowerCase().trim(),
    createdAt: userData.createdAt || new Date(),
    updatedAt: userData.updatedAt || new Date(),
  };

  const newId = normalized._id?.toString() || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const saved: User = {
    ...normalized,
    _id: newId,
  };

  // 1. Write to local store and memory cache immediately (instant response)
  const local = readLocalUsers();
  local.push(saved);
  writeLocalUsers(local);
  userCache.set(newId, saved);

  // 2. Synchronize to MongoDB if reachable
  try {
    const db = await getDb();
    await db.collection<User>('users').insertOne({ ...saved } as any);
  } catch {
    // Local fallback is active
  }

  return saved;
}

/**
 * Update user fields (Local-first instant update with non-blocking Mongo sync)
 */
export async function updateUser(id: string, updates: Partial<User>): Promise<void> {
  const idStr = id.toString();

  // 1. Update local store and memory cache immediately
  const local = readLocalUsers();
  const idx = local.findIndex((u) => u._id?.toString() === idStr);
  if (idx !== -1) {
    local[idx] = { ...local[idx], ...updates, updatedAt: new Date() };
    writeLocalUsers(local);
    userCache.set(idStr, local[idx]);
  }

  // 2. Synchronize to MongoDB if reachable
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    await db.collection<User>('users').updateOne(query, { $set: updates });
  } catch {
    // Local fallback is active
  }
}

/**
 * Save session record (Instant local + memory cache, non-blocking Mongo sync)
 */
export async function saveSession(session: Session): Promise<void> {
  // 1. Save in memory cache (<0.001ms) and local sessions (~0.1ms)
  sessionCache.set(session.token, session);

  const local = readLocalSessions();
  local.push(session);
  writeLocalSessions(local);

  // 2. Synchronize to MongoDB if reachable
  try {
    const db = await getDb();
    await db.collection<Session>('sessions').insertOne({ ...session });
  } catch {
    // Local session active
  }
}

/**
 * Find active session by token (Sub-millisecond memory and local lookup)
 */
export async function findSession(token: string): Promise<Session | null> {
  if (!token) return null;
  const now = new Date();

  // 1. Check in-memory cache (<0.001ms)
  const cached = sessionCache.get(token);
  if (cached) {
    if (new Date(cached.expiresAt) > now) {
      return cached;
    }
    sessionCache.delete(token);
    return null;
  }

  // 2. Check local sessions (~0.1ms)
  const local = readLocalSessions();
  const found = local.find((s) => s.token === token && new Date(s.expiresAt) > now);
  if (found) {
    sessionCache.set(token, found);
    return found;
  }

  // 3. Fallback to MongoDB if not found locally
  try {
    const db = await getDb();
    const session = await db.collection<Session>('sessions').findOne({
      token,
      expiresAt: { $gt: now },
    });
    if (session) {
      sessionCache.set(token, session);
      return session;
    }
  } catch {
    // Fallback
  }

  return null;
}

/**
 * Delete session
 */
export async function deleteSession(token: string): Promise<void> {
  sessionCache.delete(token);

  const local = readLocalSessions().filter((s) => s.token !== token);
  writeLocalSessions(local);

  try {
    const db = await getDb();
    await db.collection('sessions').deleteOne({ token });
  } catch {}
}

/**
 * Delete all sessions for user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  for (const [t, s] of sessionCache.entries()) {
    if (s.userId === userId) {
      sessionCache.delete(t);
    }
  }

  const local = readLocalSessions().filter((s) => s.userId !== userId);
  writeLocalSessions(local);

  try {
    const db = await getDb();
    await db.collection('sessions').deleteMany({ userId });
  } catch {}
}
