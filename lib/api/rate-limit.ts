/**
 * In-memory sliding-window rate limiter for API routes.
 *
 * This is a simple per-IP token bucket that resets every `windowMs`. It runs
 * in the Next.js middleware layer (Edge Runtime compatible) and protects
 * against casual abuse — it is NOT a replacement for a proper CDN or WAF
 * rate limit in production, but it provides a baseline defense that the
 * application controls directly.
 *
 * Limitations:
 *   - In-memory: each serverless instance / Edge location gets its own
 *     counter. A determined attacker can hit different instances. For a
 *     demo deployment this is fine.
 *   - No persistence: counters reset on redeploy.
 *   - x-forwarded-for is taken from the request unconditionally. An
 *     attacker can rotate the header value to avoid the limit entirely,
 *     while legitimate users behind a shared NAT or proxy are penalised.
 *     This is the opposite of the desired outcome. Behind a trusted
 *     reverse proxy (ALB, Cloudfront) that overwrites the header, the
 *     value is reliable; on a direct-to-origin path it is not. A WAF or
 *     CDN rate limit should be the primary defence; this layer is a
 *     backstop for casual abuse only.
 *   - IPv6 clients behind the same prefix share a counter only if their
 *     forwarded IP matches exactly.
 */

export type RateLimitConfig = {
  /** Maximum number of requests allowed per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000, // 1 minute
};

// Module-level Map — survives across requests within a single process.
const buckets = new Map<string, Bucket>();

// Periodic cleanup to prevent unbounded memory growth. Runs at most once
// per cleanup interval regardless of request volume.
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * Check whether a request from `key` (typically an IP address) should be
 * allowed.
 *
 * Returns `{ allowed: true }` when the request is within the rate limit, or
 * `{ allowed: false, retryAfterMs }` when the limit has been exceeded.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  cleanup(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > config.maxRequests) {
    return {
      allowed: false,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  return { allowed: true };
}

/**
 * Extract the client IP from standard forwarding headers.
 *
 * Checks headers in priority order:
 *   1. x-forwarded-for (first entry — the original client IP)
 *   2. x-real-ip
 *   3. Falls back to "unknown" (rate limiting still works but all
 *      unknown-IP requests share one bucket)
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
