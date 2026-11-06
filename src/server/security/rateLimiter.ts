/**
 * StuddyBuddy Sliding-Window Rate Limiter
 * Provides distributed/in-memory protection against abuse and spam.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 3600 * 1000);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Check if an action is allowed within the sliding window.
 * @param key Unique identifier (e.g. `upload:userId` or `auth:ip`)
 * @param maxRequests Maximum requests allowed in window
 * @param windowSeconds Window length in seconds
 */
export function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const threshold = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Remove timestamps outside window
  record.timestamps = record.timestamps.filter((ts) => ts > threshold);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
    };
  }

  record.timestamps.push(now);
  const resetSeconds = Math.ceil(windowSeconds);

  return {
    allowed: true,
    remaining: maxRequests - record.timestamps.length,
    resetSeconds,
  };
}

/**
 * Rate limit helpers for key workflows
 */
export function isUploadRateLimited(identifier: string): RateLimitResult {
  // Max 20 uploads per 10 minutes
  return checkRateLimit(`upload:${identifier}`, 20, 10 * 60);
}

export function isAuthRateLimited(ip: string): RateLimitResult {
  // Max 10 auth requests per 5 minutes per IP
  return checkRateLimit(`auth:${ip}`, 10, 5 * 60);
}

export function isDownloadRateLimited(ip: string): RateLimitResult {
  // Max 120 downloads per hour per IP
  return checkRateLimit(`download:${ip}`, 120, 60 * 60);
}

export function isRequestRateLimited(userId: string): RateLimitResult {
  // Max 10 resource requests per hour per student
  return checkRateLimit(`req:${userId}`, 10, 60 * 60);
}

export function isDoubtRateLimited(userId: string): RateLimitResult {
  // Max 15 questions per hour per student
  return checkRateLimit(`doubt:${userId}`, 15, 60 * 60);
}

