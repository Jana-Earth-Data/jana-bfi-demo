/**
 * Provenance-scoped Supabase client.
 *
 * Every capture table carries an `origin` column ('demo' | 'live') — see
 * scripts/supabase-origin-column.sql. This module is what makes sure the
 * column is honoured on every read and populated on every write, without
 * asking a hundred call sites to remember.
 *
 * WHY A WRAPPER RATHER THAN EDITING THE CALL SITES
 *
 * There are ~104 `.from("bfi_…")` chains across 31 files. Adding
 * `.eq("origin", mode)` to each is a mechanical edit with a nasty asymmetry:
 * forget one WRITE and a row is mislabelled, which is visible and fixable;
 * forget one READ and demo rows leak into live, silently, forever. It is the
 * failure mode this entire piece of work exists to eliminate, and hand-editing
 * a hundred sites is the single most reliable way to produce it.
 *
 * So the rule lives in one place. `.from()` on a wrapped client returns a
 * builder that has already been scoped.
 *
 * WHAT IT DOES
 *   select / update / delete  →  .eq("origin", <current mode>) appended
 *   insert / upsert           →  origin injected into every row
 *
 * Only for tables in CAPTURE_TABLES. Anything else passes through untouched,
 * so an unrelated table cannot be broken by a query it was never meant to get.
 * The list is explicit rather than a `bfi_` prefix match — a new table should
 * have to be thought about, not silently enrolled.
 *
 * STRICT PARTITION, BOTH DIRECTIONS
 * Demo mode on reads only 'demo'; off reads only 'live'. Not merely "off hides
 * demo". A one-way filter is the kind that looks correct until someone tests
 * the direction you did not.
 *
 * LIMITS, STATED PLAINLY
 * This is a Proxy over the PostgREST builder. It appends a filter to the
 * chain; it cannot reach inside `.or()` groups or raw RPC. Anything using
 * `.rpc()` bypasses it entirely — check-capture-client.mjs fails the build if
 * an RPC call touches a capture table.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { isDemoMode } from "@/lib/demo/mode";

export type Origin = "demo" | "live";

/**
 * Tables whose rows are provenance-scoped. Must match the array in
 * scripts/supabase-origin-column.sql — check-capture-client.mjs asserts it.
 */
export const CAPTURE_TABLES = [
  "bfi_loan_assignments",
  "bfi_taxonomy_assessments",
  "bfi_esrm_screenings",
  "bfi_esdd_responses",
  "bfi_cap_items",
  "bfi_evidence_attachments",
  "bfi_pf_screening_responses",
  "bfi_pf_screening_results",
  "bfi_pcaf_availability",
  "bfi_pcaf_evidence_docs",
  "bfi_covenants",
  "bfi_monitoring_reports",
  "bfi_climate_risk_assessments",
  "bfi_hydro_doc_status",
  "bfi_borrower_overrides",
  "bfi_loans_denorm",
  "bfi_officers",
  "bfi_tenant_settings",
] as const;

const CAPTURE_SET: ReadonlySet<string> = new Set(CAPTURE_TABLES);

/** Methods that read or target existing rows — these get a filter. */
const FILTERED = new Set(["select", "update", "delete"]);
/** Methods that create rows — these get origin stamped into the payload. */
const STAMPED = new Set(["insert", "upsert"]);

function stamp<T>(payload: T, origin: Origin): T {
  if (Array.isArray(payload)) {
    return payload.map((row) =>
      row && typeof row === "object" ? { ...row, origin } : row,
    ) as T;
  }
  if (payload && typeof payload === "object") {
    return { ...(payload as object), origin } as T;
  }
  return payload;
}

/**
 * Wrap a client so all capture-table access is scoped to one origin.
 *
 * Prefer getCaptureClient(), which resolves the origin from the request. Use
 * this directly only where the origin must be forced — the seeder writing
 * 'demo', or a test asserting both sides.
 */
export function withOrigin(
  supabase: SupabaseClient,
  origin: Origin,
): SupabaseClient {
  return new Proxy(supabase, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);

      return (table: string) => {
        const builder = target.from(table);
        if (!CAPTURE_SET.has(table)) return builder;

        return new Proxy(builder, {
          get(bTarget, bProp, bReceiver) {
            const value = Reflect.get(bTarget, bProp, bReceiver);
            if (typeof value !== "function") return value;
            const name = String(bProp);

            if (FILTERED.has(name)) {
              return (...args: unknown[]) => {
                const q = (value as (...a: unknown[]) => unknown).apply(
                  bTarget,
                  args,
                );
                // PostgREST builders are chainable and return themselves;
                // .eq() narrows the same query.
                return (q as { eq: (c: string, v: string) => unknown }).eq(
                  "origin",
                  origin,
                );
              };
            }

            if (STAMPED.has(name)) {
              return (...args: unknown[]) => {
                const [payload, ...rest] = args;
                return (value as (...a: unknown[]) => unknown).apply(bTarget, [
                  stamp(payload, origin),
                  ...rest,
                ]);
              };
            }

            return value.bind(bTarget);
          },
        });
      };
    },
  }) as SupabaseClient;
}

/**
 * The client every request handler should use.
 *
 * Returns null when Supabase is unconfigured, matching getSupabaseAdmin() so
 * existing null-checks keep working unchanged.
 */
export async function getCaptureClient(): Promise<SupabaseClient | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  return withOrigin(supabase, await currentOrigin());
}

/** The origin rows written by this request should carry. */
export async function currentOrigin(): Promise<Origin> {
  return (await isDemoMode()) ? "demo" : "live";
}

/**
 * Unscoped admin client, for the few places that legitimately need to see
 * across both origins: the seeded-row report and the reset endpoint.
 *
 * Deliberately verbose. If this name appears in a request handler, that is a
 * bug worth noticing in review.
 */
export function getUnscopedAdminClientForProvenanceReporting(): SupabaseClient | null {
  return getSupabaseAdmin();
}
