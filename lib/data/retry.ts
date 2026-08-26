/**
 * Supabase query retry helper.
 *
 * The Supabase JS client talks to PostgREST over HTTP. Transient errors
 * (network blips, connection resets, 502/503/504 from the proxy layer)
 * are recoverable with a simple retry. This helper wraps a query thunk
 * and retries on failure with exponential backoff.
 *
 * Usage:
 *   const { data, error } = await withRetry(() =>
 *     supabase.from("bfi_loans").select("id").eq("bank_id", tenant.id)
 *   );
 *
 * Only use for idempotent reads (SELECT). Do not retry inserts or
 * updates unless they are themselves idempotent (upsert on conflict).
 */

export type RetryConfig = {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts: number;
  /** Initial delay in milliseconds. Doubles on each retry. Default: 200. */
  initialDelayMs: number;
};

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 200,
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

/**
 * Execute a Supabase query thunk with retry on transient errors.
 *
 * An error is considered transient if its message matches common HTTP/network
 * failure patterns. Application-level Supabase errors (constraint violations,
 * RLS denials) are NOT retried.
 */
export async function withRetry<T>(
  queryFn: () => PromiseLike<SupabaseResult<T>>,
  config: Partial<RetryConfig> = {},
): Promise<SupabaseResult<T>> {
  const { maxAttempts, initialDelayMs } = { ...DEFAULT_CONFIG, ...config };
  let lastResult: SupabaseResult<T> | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await queryFn();

    // Success — return immediately.
    if (!lastResult.error) return lastResult;

    // Only retry transient errors. Application errors should fail fast.
    if (!isTransient(lastResult.error)) return lastResult;

    // Last attempt — don't sleep, just return the error.
    if (attempt >= maxAttempts) break;

    // Exponential backoff: 200ms, 400ms, 800ms, ...
    const delay = initialDelayMs * Math.pow(2, attempt - 1);
    await sleep(delay);
  }

  return lastResult!;
}

/** Patterns that indicate a transient / recoverable error. */
const TRANSIENT_PATTERNS = [
  /fetch failed/i,
  /network/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /socket hang up/i,
  /502/,
  /503/,
  /504/,
  /timeout/i,
];

function isTransient(error: { message: string; code?: string }): boolean {
  return TRANSIENT_PATTERNS.some((re) => re.test(error.message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
