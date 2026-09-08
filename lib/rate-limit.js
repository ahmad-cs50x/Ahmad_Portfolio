/**
 * Rate Limiter for Next.js API Routes
 *
 * Cloudflare Pages compatible rate limiting using in-memory store.
 * For production with multiple instances, consider using Cloudflare KV or a Redis adapter.
 *
 * Limits: 25 requests per 15 minutes per IP (same as your original Express setup)
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 25;

// In-memory store for rate limiting
// In production on Cloudflare, use KV or Redis
const rateLimitStore = new Map();

export const ratelimit = {
  /**
   * Check if a request should be rate limited
   * @param {string} identifier - Usually the IP address
   * @returns {Object} { success, limit, remaining, reset }
   */
  limit: async (identifier) => {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Get or create record for this identifier
    let record = rateLimitStore.get(identifier);

    if (!record) {
      // First request from this IP
      record = {
        count: 1,
        resetAt: now + WINDOW_MS,
        timestamps: [now],
      };
      rateLimitStore.set(identifier, record);
    } else {
      // Clean up old timestamps outside the window
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

      if (now > record.resetAt) {
        // Window expired, reset
        record.count = 1;
        record.resetAt = now + WINDOW_MS;
        record.timestamps = [now];
      } else {
        // Within window, increment
        record.count = record.timestamps.length;
        if (record.count < MAX_REQUESTS) {
          record.count++;
          record.timestamps.push(now);
        }
      }
    }

    // Cleanup old entries periodically (every 100 requests)
    if (Math.random() < 0.01) {
      cleanupOldEntries(windowStart);
    }

    const remaining = Math.max(0, MAX_REQUESTS - record.count);
    const success = record.count <= MAX_REQUESTS;

    return {
      success,
      limit: MAX_REQUESTS,
      remaining,
      reset: record.resetAt,
    };
  },
};

/**
 * Remove expired entries from the store to prevent memory leaks
 */
function cleanupOldEntries(windowStart) {
  for (const [key, record] of rateLimitStore.entries()) {
    // Remove entries that haven't had activity within the window
    const recentActivity = record.timestamps.some((ts) => ts > windowStart);
    if (!recentActivity && Date.now() > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}
