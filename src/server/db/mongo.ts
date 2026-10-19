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
    const envPath = path.resolve(process.cwd(), '.env');
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
            if (!process.env[key]) {
              process.env[key] = val;
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

/**
 * Get the MongoDB database instance using connection pooling.
 * Caches client instance across serverless execution contexts.
 */
export async function getDb(): Promise<Db> {
  if (dbInstance) {
    return dbInstance;
  }

  const uri = getMongoUri();
  const dbName = getMongoDbName();

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables. Please configure .env with your MongoDB Atlas connection string.'
    );
  }

  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    } as any);
    await client.connect();
  }

  dbInstance = client.db(dbName);
  return dbInstance;
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
 * Create mandatory indexes across all collections according to SRS Section 14.1.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  // Users: unique email, role index
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ role: 1 });
  await db.collection('users').createIndex({ status: 1 });

  // Sessions: unique token, TTL index for auto-cleanup
  await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Catalog: Universities
  await db.collection('universities').createIndex({ slug: 1 }, { unique: true });
  await db.collection('universities').createIndex({ isActive: 1 });

  // Catalog: Faculties
  await db.collection('faculties').createIndex({ universityId: 1, slug: 1 }, { unique: true });
  await db.collection('faculties').createIndex({ universityId: 1 });

  // Catalog: Programs
  await db.collection('programs').createIndex({ universityId: 1, facultyId: 1, slug: 1 }, { unique: true });
  await db.collection('programs').createIndex({ universityId: 1 });
  await db.collection('programs').createIndex({ facultyId: 1 });

  // Catalog: Academic Terms
  await db.collection('academicTerms').createIndex({ programId: 1, orderIndex: 1 });

  // Catalog: Subjects
  await db.collection('subjects').createIndex({ programId: 1, academicTermId: 1, slug: 1 }, { unique: true });
  await db.collection('subjects').createIndex({ programId: 1, academicTermId: 1 });

  // Resources
  await db.collection('resources').createIndex({ status: 1 });
  await db.collection('resources').createIndex({ universityId: 1, subjectId: 1, status: 1 });
  await db.collection('resources').createIndex({ programId: 1, academicTermId: 1, status: 1 });
  await db.collection('resources').createIndex({ category: 1 });
  await db.collection('resources').createIndex({ contributorId: 1 });
  await db.collection('resources').createIndex({ createdAt: -1 });
  await db.collection('resources').createIndex(
    { title: 'text', description: 'text', originalFilename: 'text' },
    { weights: { title: 10, description: 5, originalFilename: 2 } }
  );

  // Saved Resources: unique per user+resource
  await db.collection('savedResources').createIndex({ userId: 1, resourceId: 1 }, { unique: true });
  await db.collection('savedResources').createIndex({ userId: 1 });

  // Catalog Suggestions
  await db.collection('catalogSuggestions').createIndex({ status: 1 });
  await db.collection('catalogSuggestions').createIndex({ entityType: 1 });

  // Community Threads & 8-hour guest chat TTL cleanup
  await db.collection('communityThreads').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('communityThreads').createIndex({ universityId: 1 });
  await db.collection('communityThreads').createIndex({ createdAt: -1 });

  await db.collection('communityReplies').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('communityReplies').createIndex({ threadId: 1, createdAt: 1 });

  // Announcements
  await db.collection('announcements').createIndex({ status: 1, publishedAt: 1, expiresAt: 1 });

  // Reports
  await db.collection('reports').createIndex({ status: 1, targetType: 1 });

  // Audit Logs
  await db.collection('auditLogs').createIndex({ createdAt: -1 });
  await db.collection('auditLogs').createIndex({ actorId: 1 });
  await db.collection('auditLogs').createIndex({ targetType: 1, targetId: 1 });

  // Analytics Events
  await db.collection('analyticsEvents').createIndex({ timestamp: -1 });
  await db.collection('analyticsEvents').createIndex({ eventType: 1, timestamp: -1 });
  await db.collection('analyticsEvents').createIndex({ resourceId: 1 });

  // Storage Reservations TTL (auto expire abandoned reservations after 1 hour)
  await db.collection('storageReservations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('storageReservations').createIndex({ reservationId: 1 }, { unique: true });
}
