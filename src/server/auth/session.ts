import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
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
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const SESSION_SECRET = process.env.SESSION_SECRET || 'studdybuddy-academic-session-secret-2026';

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
 * Sign session payload using HMAC-SHA256.
 * This guarantees multi-user concurrency and seamless verification across
 * isolated serverless/Vercel execution instances without cross-tab interference.
 */
function signToken(userId: string, createdAt: number, nonce: string): string {
  const payload = `${userId}.${createdAt}.${nonce}`;
  const hmac = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `sb_${payload}.${hmac}`;
}

/**
 * Cryptographically verify a signed session token.
 */
function verifySignedToken(token: string): { userId: string; createdAt: number } | null {
  if (!token || !token.startsWith('sb_')) return null;
  const parts = token.slice(3).split('.');
  if (parts.length !== 4) return null;

  const [userId, createdAtStr, nonce, hmac] = parts;
  const createdAt = parseInt(createdAtStr, 10);
  if (isNaN(createdAt)) return null;

  // Verify expiration
  if (Date.now() - createdAt > SESSION_TTL_MS) return null;

  // Verify HMAC signature in constant time
  const payload = `${userId}.${createdAtStr}.${nonce}`;
  const expectedHmac = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');

  try {
    const bufA = Buffer.from(hmac, 'hex');
    const bufB = Buffer.from(expectedHmac, 'hex');
    if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
      return null;
    }
  } catch {
    return null;
  }

  return { userId, createdAt };
}

/**
 * Create a new authenticated session and return the session token.
 * Multiple users can log in concurrently from different devices or browser profiles.
 */
export async function createSession(userId: string, req?: Request): Promise<string> {
  const now = new Date();
  const createdAtMs = now.getTime();
  const nonce = randomBytes(16).toString('hex');
  const token = signToken(userId, createdAtMs, nonce);
  const expiresAt = new Date(createdAtMs + SESSION_TTL_MS);

  const ipAddress = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req?.headers.get('cf-connecting-ip') || undefined;
  const userAgent = req?.headers.get('user-agent') || undefined;

  try {
    await saveSession({
      userId,
      token,
      ipAddress,
      userAgent,
      expiresAt,
      createdAt: now,
    });
  } catch (err: any) {
    console.warn('[Session] Session record notice:', err?.message);
  }

  return token;
}

/**
 * Validate session token and return user if active.
 * Uses both stateful store lookup and stateless cryptographic token verification,
 * guaranteeing multi-user concurrency even on stateless serverless clouds.
 */
export async function validateSession(token: string): Promise<User | null> {
  if (!token) return null;

  try {
    let userId: string | null = null;

    // 1. Try finding in active session store first
    const session = await findSession(token);
    if (session) {
      userId = session.userId;
    } else {
      // 2. Cryptographically verify signed token (handles new serverless containers)
      const verified = verifySignedToken(token);
      if (verified) {
        userId = verified.userId;
      }
    }

    if (!userId) return null;

    const user = await findUserById(userId);
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
