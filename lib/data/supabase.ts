/**
 * Server-side Supabase client.
 *
 * Uses the service-role key, which bypasses Row Level Security. NEVER import
 * this from a client component. The functions here are intended for use only
 * from API routes, server components, or other server-side code.
 *
 * When the Supabase env vars are not configured the helpers return null so
 * the rest of the demo can fall back to the in-memory synthesizer (local dev
 * without a database, the original behaviour).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/**
 * Hard ceiling on any single Supabase REST call, in milliseconds.
 *
 * On Vercel serverless we have observed a same-region (Mumbai bom1 ->
 * Supabase ap-south-1) REST request wedge for 73 seconds on a cold render:
 * the connection stalls, and because the Supabase JS client uses the global
 * `fetch` with no default timeout, nothing aborts it. A `force-dynamic` page
 * that awaits such a call hangs for the full duration on every request.
 *
 * The query itself (a tiny, indexed lookup) is milliseconds when it responds,
 * so a 5s ceiling can only ever cut off a stall, never a legitimate slow
 * query. Callers must treat an aborted read as "no data" and fall back to the
 * precomputed portfolio rather than surfacing a hang.
 */
const SUPABASE_FETCH_TIMEOUT_MS = 5_000;

/**
 * `fetch` wrapper that bounds every request with an AbortSignal. This is the
 * only place the timeout needs to live: the Supabase client routes all REST,
 * auth, and storage traffic through the `global.fetch` we hand it here, so a
 * single wrapper covers every call site without asking each one to remember.
 */
function timeoutFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Respect an abort signal the caller already supplied by racing both.
  const timeout = AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  return fetch(input, { ...init, signal });
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Supabase env vars are not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Falling back to in-memory synthesizer."
      );
    }
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: { schema: "public" },
    global: { fetch: timeoutFetch },
  });
  return cached;
}

/** True when the demo should read loans from Supabase instead of memory. */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export const BFI_LOANS_TABLE = "bfi_loans_denorm";
