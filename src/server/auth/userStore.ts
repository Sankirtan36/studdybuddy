import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/mongo';
import type { User, Session } from '../../types';
import { ObjectId } from 'mongodb';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalUsers(): User[] {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalUsers(users: User[]) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function readLocalSessions(): Session[] {
  ensureDataDir();
  if (!fs.existsSync(SESSIONS_FILE)) return [];
  try {
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalSessions(sessions: Session[]) {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

/**
 * Find user by email (MongoDB first, local fallback)
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const db = await getDb();
    const user = await db.collection<User>('users').findOne({ email: normalizedEmail });
    if (user) return user;
  } catch (err) {
    // MongoDB unavailable or auth failed -> fallback to local store
  }

  const local = readLocalUsers();
  return local.find((u) => u.email.toLowerCase() === normalizedEmail) || null;
}

/**
 * Find user by ID (MongoDB first, local fallback)
 */
export async function findUserById(id: string): Promise<User | null> {
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    const user = await db.collection<User>('users').findOne(query);
    if (user) return user;
  } catch (err) {
    // fallback
  }

  const local = readLocalUsers();
  return local.find((u) => u._id?.toString() === id.toString()) || null;
}

/**
 * Create a new user (MongoDB first, local fallback)
 */
export async function createUser(userData: User): Promise<User> {
  const normalized: User = {
    ...userData,
    email: userData.email.toLowerCase().trim(),
    createdAt: userData.createdAt || new Date(),
    updatedAt: userData.updatedAt || new Date(),
  };

  try {
    const db = await getDb();
    const result = await db.collection<User>('users').insertOne(normalized as any);
    return {
      ...normalized,
      _id: result.insertedId.toString(),
    };
  } catch (err) {
    // Fallback to local store
    const local = readLocalUsers();
    const newId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const saved: User = {
      ...normalized,
      _id: newId,
    };
    local.push(saved);
    writeLocalUsers(local);
    return saved;
  }
}

/**
 * Update user fields
 */
export async function updateUser(id: string, updates: Partial<User>): Promise<void> {
  try {
    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
    }
    await db.collection<User>('users').updateOne(query, { $set: updates });
  } catch (err) {
    // Fallback
    const local = readLocalUsers();
    const idx = local.findIndex((u) => u._id?.toString() === id.toString());
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...updates, updatedAt: new Date() };
      writeLocalUsers(local);
    }
  }
}

/**
 * Save session record
 */
export async function saveSession(session: Session): Promise<void> {
  try {
    const db = await getDb();
    await db.collection<Session>('sessions').insertOne(session);
  } catch (err) {
    const local = readLocalSessions();
    local.push(session);
    writeLocalSessions(local);
  }
}

/**
 * Find active session by token
 */
export async function findSession(token: string): Promise<Session | null> {
  try {
    const db = await getDb();
    const session = await db.collection<Session>('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() },
    });
    if (session) return session;
  } catch (err) {
    // Fallback
  }

  const local = readLocalSessions();
  const now = new Date();
  return local.find((s) => s.token === token && new Date(s.expiresAt) > now) || null;
}

/**
 * Delete session
 */
export async function deleteSession(token: string): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('sessions').deleteOne({ token });
  } catch (err) {
    const local = readLocalSessions().filter((s) => s.token !== token);
    writeLocalSessions(local);
  }
}

/**
 * Delete all sessions for user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('sessions').deleteMany({ userId });
  } catch (err) {
    const local = readLocalSessions().filter((s) => s.userId !== userId);
    writeLocalSessions(local);
  }
}
