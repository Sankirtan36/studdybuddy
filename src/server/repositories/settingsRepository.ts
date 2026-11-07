import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb } from '../db/mongo';

export interface SystemSettings {
  allowUniversitySubmissions: boolean;
  strictDuplicateCheck: boolean;
  moderationMode: 'manual_first' | 'instant_publish';
  guestPdfRetentionHours: number;
  userPdfRetentionHours: number;
  maxUploadSizeBytes: number;
  maintenanceMode: boolean;
  maintenanceNotice: string;
  updatedAt: Date;
  updatedBy: string;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  allowUniversitySubmissions: true,
  strictDuplicateCheck: true,
  moderationMode: 'manual_first',
  guestPdfRetentionHours: 6,
  userPdfRetentionHours: 48,
  maxUploadSizeBytes: 26214400, // 25 MB
  maintenanceMode: false,
  maintenanceNotice: 'StuddyBuddy is currently undergoing scheduled platform maintenance. Services will resume shortly.',
  updatedAt: new Date(),
  updatedBy: 'system',
};

function getDataDir(): string {
  const p1 = path.resolve(process.cwd(), '.data');
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

function getSettingsFile(): string {
  return path.join(getDataDir(), 'system-settings.json');
}

let inMemorySettings: SystemSettings = { ...DEFAULT_SETTINGS };

/**
 * Read system settings with in-memory caching, MongoDB Atlas persistence and local fallback.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  // 1. Try MongoDB
  try {
    const db = await getDb();
    const doc = await db.collection('systemSettings').findOne({ _id: 'global_config' as any });
    if (doc) {
      inMemorySettings = {
        allowUniversitySubmissions: doc.allowUniversitySubmissions ?? DEFAULT_SETTINGS.allowUniversitySubmissions,
        strictDuplicateCheck: doc.strictDuplicateCheck ?? DEFAULT_SETTINGS.strictDuplicateCheck,
        moderationMode: doc.moderationMode ?? DEFAULT_SETTINGS.moderationMode,
        guestPdfRetentionHours: Number(doc.guestPdfRetentionHours) || DEFAULT_SETTINGS.guestPdfRetentionHours,
        userPdfRetentionHours: Number(doc.userPdfRetentionHours) || DEFAULT_SETTINGS.userPdfRetentionHours,
        maxUploadSizeBytes: Number(doc.maxUploadSizeBytes) || DEFAULT_SETTINGS.maxUploadSizeBytes,
        maintenanceMode: Boolean(doc.maintenanceMode),
        maintenanceNotice: doc.maintenanceNotice || DEFAULT_SETTINGS.maintenanceNotice,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
        updatedBy: doc.updatedBy || 'admin',
      };
      return inMemorySettings;
    }
  } catch {}

  // 2. Try Local File
  try {
    const file = getSettingsFile();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      inMemorySettings = { ...DEFAULT_SETTINGS, ...parsed };
      return inMemorySettings;
    }
  } catch {}

  return inMemorySettings;
}

/**
 * Update system settings in MongoDB and local disk.
 */
export async function updateSystemSettings(
  partial: Partial<SystemSettings>,
  adminEmail: string
): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const updated: SystemSettings = {
    ...current,
    ...partial,
    updatedAt: new Date(),
    updatedBy: adminEmail,
  };

  inMemorySettings = updated;

  // Persist to local disk
  try {
    fs.writeFileSync(getSettingsFile(), JSON.stringify(updated, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[SettingsRepository] Failed to write settings to disk:', err?.message);
  }

  // Persist to MongoDB
  try {
    const db = await getDb();
    await db.collection('systemSettings').updateOne(
      { _id: 'global_config' as any },
      { $set: { ...updated, _id: 'global_config' } },
      { upsert: true }
    );
  } catch (err: any) {
    console.warn('[SettingsRepository] Failed to update MongoDB systemSettings:', err?.message);
  }

  return updated;
}

