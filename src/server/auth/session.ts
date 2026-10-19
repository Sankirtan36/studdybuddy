import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { User } from '../../types';
import { 
  saveSession, 
  findSession, 
  deleteSession, 
  deleteAllUserSessions, 
  findUserById 
} from './userStore';

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE_NAME = 'studdybuddy_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Hash password securely using Node.js crypto scrypt with random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored salt:hash string using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const key = Buffer.from(keyHex, 'hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(key, derivedKey);
  } catch (err) {
    return false;
  }
}

/**
 * Create a new authenticated session and return the session token.
 */
export async function createSession(userId: string, req?: Request): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const ipAddress = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req?.headers.get('cf-connecting-ip') || undefined;
  const userAgent = req?.headers.get('user-agent') || undefined;

  await saveSession({
    userId,
    token,
    ipAddress,
    userAgent,
    expiresAt,
    createdAt: now,
  });

  return token;
}

/**
 * Validate session token and return user if active.
 */
export async function validateSession(token: string): Promise<User | null> {
  if (!token) return null;

  try {
    const session = await findSession(token);
    if (!session) return null;

    const user = await findUserById(session.userId);
    if (!user || user.status === 'suspended') {
      return null;
    }

    return user;
  } catch (err) {
    return null;
  }
}

/**
 * Invalidate a session token on logout.
 */
export async function revokeSession(token: string): Promise<void> {
  await deleteSession(token);
}

/**
 * Invalidate all sessions for a user (e.g. on account suspension or password reset).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await deleteAllUserSessions(userId);
}
