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
