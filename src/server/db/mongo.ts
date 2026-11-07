import { MongoClient, type Db } from 'mongodb';
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';

// Configure reliable DNS servers to resolve MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fallback gracefully if not permitted in environment
}

// Ensure .env is read even if the dev server was started before .env was created
function loadEnvFallback() {
  try {
    const cwd = process.cwd();
    const candidates = [
      path.resolve(cwd, '.env'),
      path.resolve(cwd, 'studdybuddy', '.env'),
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (val.endsWith(',')) {
                val = val.slice(0, -1).trim();
              }
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        }
      }
    }
  } catch {}
}

loadEnvFallback();

function getMongoUri(): string {
  loadEnvFallback();
  return process.env.MONGODB_URI || (import.meta as any).env?.MONGODB_URI || '';
}

function getMongoDbName(): string {
  loadEnvFallback();
  return process.env.MONGODB_DB_NAME || (import.meta as any).env?.MONGODB_DB_NAME || 'studdybuddy';
}

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isCircuitOpen = false;
let lastFailureTimestamp = 0;
const CIRCUIT_COOLDOWN_MS = 30000; // 30 seconds circuit breaker cooldown

/**
 * Get the MongoDB database instance using connection pooling and instant-fail circuit breaker.
 * Protects login and dashboard operations from blocking/hanging if Atlas is unreachable or slow.
 */
export async function getDb(): Promise<Db> {
  // 1. Fast path: return existing connected database instance (<0.001ms)
  if (dbInstance) {
    return dbInstance;
  }

  // 2. Circuit breaker fast-fail: if recent connection attempt failed, fail immediately in 0.0001ms
  if (isCircuitOpen) {
    const elapsed = Date.now() - lastFailureTimestamp;
    if (elapsed < CIRCUIT_COOLDOWN_MS) {
      throw new Error(`MongoDB Atlas temporarily offline (circuit open, retry in ${Math.ceil((CIRCUIT_COOLDOWN_MS - elapsed) / 1000)}s).`);
    }
    // Cooldown elapsed, allow one probe attempt
    isCircuitOpen = false;
  }

  const uri = getMongoUri();
  const dbName = getMongoDbName();

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables. Please configure .env with your MongoDB Atlas connection string.'
    );
  }

  try {
    // Configure lean, fast timeouts (1.5s max selection, 2s max connect)
    const newClient = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 1500,
      connectTimeoutMS: 2000,
      tlsAllowInvalidCertificates: true,
    } as any);

    await newClient.connect();
    client = newClient;
    dbInstance = client.db(dbName);
    isCircuitOpen = false;
    return dbInstance;
  } catch (err: any) {
    client = null;
    dbInstance = null;
    isCircuitOpen = true;
    lastFailureTimestamp = Date.now();
    throw err;
  }
}

/**
 * Check if the database connection is healthy.
 */
export async function checkDbHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const uri = getMongoUri();
    if (!uri) {
      return { ok: false, message: 'MONGODB_URI is not configured.' };
    }
    const db = await getDb();
    await db.command({ ping: 1 });
    return { ok: true, message: 'MongoDB connection healthy.' };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Failed to ping MongoDB.' };
  }
}

/**
 * Create necessary indexes for collections.
 */
export async function ensureIndexes(): Promise<void> {
  try {
    const db = await getDb();

    // Users indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    // Sessions indexes (TTL)
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Catalog suggestions
    await db.collection('catalogSuggestions').createIndex({ status: 1 });
    await db.collection('catalogSuggestions').createIndex({ createdAt: -1 });

    // Resources indexes
    await db.collection('resources').createIndex({ universityId: 1, facultyId: 1, programId: 1 });
    await db.collection('resources').createIndex({ status: 1 });
    await db.collection('resources').createIndex({ createdAt: -1 });
    await db.collection('resources').createIndex({
      title: 'text',
      description: 'text',
      keywords: 'text',
    });

    // Recently viewed resources compound unique indexes
    await db.collection('recentlyViewedResources').createIndex({ userId: 1, resourceId: 1 }, { unique: true });
    await db.collection('recentlyViewedResources').createIndex({ userId: 1, universityId: 1, viewedAt: -1 });

    // Announcements
    await db.collection('announcements').createIndex({ status: 1, createdAt: -1 });

    // Audit logs
    await db.collection('auditLogs').createIndex({ createdAt: -1 });
  } catch (err: any) {
    console.warn('Skipping MongoDB index creation:', err?.message || err);
  }
}

/**
 * Close MongoDB client connection on shutdown.
 */
export async function closeDb(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {}
    client = null;
    dbInstance = null;
  }
}
