import type { APIRoute } from 'astro';
import { checkDbHealth } from '../../server/db/mongo';
import { cleanupOrphanedReservations } from '../../server/storage/storage';

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  const dbHealth = await checkDbHealth();
  const cleanedReservations = await cleanupOrphanedReservations();

  const isHealthy = dbHealth.ok;

  const responsePayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      healthy: dbHealth.ok,
      message: dbHealth.message,
    },
    storage: {
      budgetBytes: 20 * 1024 * 1024 * 1024,
      provider: process.env.OBJECT_STORAGE_ENDPOINT ? 'cloudflare_r2_or_s3' : 'local_disk_buffer',
      cleanedOrphanReservations: cleanedReservations,
    },
    system: {
      nodeVersion: process.version,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      responseTimeMs: Date.now() - startTime,
    },
  };

  return new Response(JSON.stringify(responsePayload, null, 2), {
    status: isHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};

