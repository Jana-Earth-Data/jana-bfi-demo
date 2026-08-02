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

function unauthorized(msg: string) {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(request: NextRequest) {
  // --- Auth ---------------------------------------------------------------
  const expected = process.env.SEED_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_ADMIN_TOKEN not configured on the server." },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim() ?? "";
  if (!provided || provided !== expected) {
    return unauthorized("Unauthorized: bad or missing bearer token.");
  }

  // --- Parse body ---------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be valid JSON.");
  }
  const { tenantId, confirmName } = (body ?? {}) as {
    tenantId?: unknown;
    confirmName?: unknown;
  };
  if (typeof tenantId !== "string" || !tenantId) {
    return badRequest("Missing tenantId (string).");
  }
  if (typeof confirmName !== "string" || !confirmName) {
    return badRequest("Missing confirmName (string).");
  }
  if (!isTenantId(tenantId)) {
    return badRequest(`Unknown tenantId: ${tenantId}`);
  }

  const tenant = REGISTRY[tenantId];
  // Case-sensitive, exact match. The point of typing the name is to force
  // the operator to look at it and copy it correctly.
  if (confirmName !== tenant.branding.displayName) {
    return badRequest(
      `confirmName does not match tenant displayName. Expected exactly "${tenant.branding.displayName}".`,
    );
  }

  // --- Supabase -----------------------------------------------------------
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase env vars not configured." },
      { status: 500 },
    );
  }

  // --- Delete per table ---------------------------------------------------
  const deleted: Partial<DeletedCounts> = {};
  for (const { table, key } of TABLES) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("bank_id", tenantId);
    if (error) {
      return NextResponse.json(
        {
          error: `Delete failed on ${table}: ${error.message}`,
          tenantId,
          deletedSoFar: deleted,
        },
        { status: 500 },
      );
    }
    deleted[key] = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    tenantId,
    deleted: deleted as DeletedCounts,
  });
}
