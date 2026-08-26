/**
 * POST /api/admin/reset
 *
 * Wipes one tenant's captured demo data so the demo team can start fresh
 * before a rehearsal. Scoped strictly by bank_id — resetting one tenant
 * NEVER touches rows belonging to any other tenant.
 *
 * Requires:
 *   Authorization: Bearer <SEED_ADMIN_TOKEN>
 *
 * Body (JSON):
 *   { tenantId: string, confirmName: string }
 *
 * `confirmName` must equal the tenant's displayName (case-sensitive). This
 * is the "type the name to confirm" safety pattern — protects against
 * hitting the button on the wrong tenant.
 *
 * Deletes rows from:
 *   - bfi_esdd_responses
 *   - bfi_taxonomy_assessments
 *   - bfi_esrm_screenings
 *   - bfi_loan_assignments
 *   - bfi_borrower_overrides
 *
 * Does NOT touch bfi_banks or bfi_officers — those are seeded infrastructure,
 * not captured demo output.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { REGISTRY } from "@/lib/tenants/registry";
import { isTenantId } from "@/lib/tenants/registry";
import { apiError, requireAdminToken, parseJsonBody } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

// Tables to wipe, in a sensible order (leaf-most first — none of these
// have FK relationships between each other today, but we keep the order
// stable so operators reading the response counts see them in the same
// order every time).
const TABLES = [
  { table: "bfi_esdd_responses", key: "esddResponses" },
  { table: "bfi_taxonomy_assessments", key: "taxonomyAssessments" },
  { table: "bfi_esrm_screenings", key: "esrmScreenings" },
  { table: "bfi_loan_assignments", key: "loanAssignments" },
  { table: "bfi_borrower_overrides", key: "borrowerOverrides" },
] as const;

type DeletedCounts = Record<(typeof TABLES)[number]["key"], number>;

export async function POST(request: NextRequest) {
  // --- Auth ---------------------------------------------------------------
  const authErr = requireAdminToken(request);
  if (authErr) return authErr;

  // --- Parse body ---------------------------------------------------------
  const [body, parseErr] = await parseJsonBody<{ tenantId?: unknown; confirmName?: unknown }>(request);
  if (parseErr) return parseErr;
  const { tenantId, confirmName } = body ?? {};
  if (typeof tenantId !== "string" || !tenantId) {
    return apiError("Missing tenantId (string).", 400);
  }
  if (typeof confirmName !== "string" || !confirmName) {
    return apiError("Missing confirmName (string).", 400);
  }
  if (!isTenantId(tenantId)) {
    return apiError(`Unknown tenantId: ${tenantId}`, 400);
  }

  const tenant = REGISTRY[tenantId];
  // Case-sensitive, exact match. The point of typing the name is to force
  // the operator to look at it and copy it correctly.
  if (confirmName !== tenant.branding.displayName) {
    return apiError(
      `confirmName does not match tenant displayName. Expected exactly "${tenant.branding.displayName}".`,
      400,
    );
  }

  // --- Supabase -----------------------------------------------------------
  // Deliberately UNSCOPED. Reset must be able to clear both origins --
  // scoping it to the current mode would leave the other half behind and
  // report success, which is how you end up with a "reset" demo that still
  // has yesterday's rows in it.
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return apiError("Supabase env vars not configured.", 500);
  }

  // --- Delete per table ---------------------------------------------------
  const deleted: Partial<DeletedCounts> = {};
  for (const { table, key } of TABLES) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("bank_id", tenantId);
    if (error) {
      return apiError(`Delete failed on ${table}: ${error.message}`, 500, {
        details: { tenantId, deletedSoFar: deleted },
      });
    }
    deleted[key] = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    deleted: deleted as DeletedCounts,
  });
}
