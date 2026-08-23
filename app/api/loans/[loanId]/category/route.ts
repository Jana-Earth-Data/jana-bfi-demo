/**
 * GET  /api/loans/[loanId]/category
 *   Returns the officer-set ESDD loan-category override for this loan
 *   (from bfi_loan_assignments.loan_category_override), or null when
 *   no override has been recorded. Callers should fall back to the
 *   derived category (deriveEsddLoanCategory) when null.
 *
 * PATCH /api/loans/[loanId]/category
 *   Body: { category: string | null }
 *   Upserts the override onto the assignment row for the current
 *   (bank, loan). Passing null clears the override. Owner-only; a
 *   non-owner is 403'd via assertOwnerOrRespond.
 *
 *   Why on bfi_loan_assignments and not a new table:
 *     - one row per (bank, loan) already exists post-P36 auto-claim
 *     - override is inherently officer-scoped (per-loan, not per-request)
 *     - keeps the schema flat — P45 is a one-column extension, no join
 *
 * Both paths require:
 *   - A resolved tenant (jana_demo_tenant cookie).
 *   - A resolved officer (jana_demo_officer cookie).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ loanId: string }> };

// Enum values codified in lib/regulatory/esdd/annex5-questions.ts —
// EsddLoanCategory. Kept as a Set here so the PATCH body validator does
// not have to import the client-facing type at runtime.
const VALID_CATEGORIES = new Set<string>([
  "small-non-critical",
  "small-critical",
  "bwc-term",
  "project-finance",
]);

export async function GET(_req: NextRequest, { params }: Params) {
  const { loanId } = await params;
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId is required" },
      { status: 400 },
    );
  }

  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return NextResponse.json(
      { error: "Officer must be selected before reading category override." },
      { status: 401 },
    );
  }
  const tenant = await resolveCurrentTenant();

  // 404 when the loan id is unknown to the synthesizer — matches the
  // ESDD page's notFound() behaviour so a bad URL is not confused with
  // an empty override.
  const data = await getBfiDemoData();
  const loan = data.loans.find((l) => l.id === loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // No DB — return a null override so the caller falls back to the
    // derived category. Preserves the local-dev path where Supabase
    // isn't wired up.
    return NextResponse.json({ ok: true, loanId, category: null });
  }

  const { data: row, error } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_category_override")
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .maybeSingle();
  if (error) {
    console.warn(
      "[loans/category] override lookup failed (returning null):",
      error.message,
    );
    return NextResponse.json({ ok: true, loanId, category: null });
  }

  const category =
    (row?.loan_category_override as string | null | undefined) ?? null;
  return NextResponse.json({ ok: true, loanId, category });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { loanId } = await params;
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId is required" },
      { status: 400 },
    );
  }

  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return NextResponse.json(
      { error: "Officer must be selected before writing category override." },
      { status: 401 },
    );
  }
  const tenant = await resolveCurrentTenant();

  const data = await getBfiDemoData();
  const loan = data.loans.find((l) => l.id === loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  let body: { category?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const raw = body.category;
  // Normalise: undefined / empty string / null → clear override.
  const category: string | null =
    raw === null || raw === undefined || raw === "" ? null : raw;

  if (category !== null && !VALID_CATEGORIES.has(category)) {
    return NextResponse.json(
      {
        error:
          "category must be one of small-non-critical, small-critical, bwc-term, project-finance — or null to clear.",
      },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // No DB — succeed as a no-op so the offline dev path doesn't
    // fail the wizard. The next mount will still derive from
    // loan.category (there's no persistence layer to read back).
    return NextResponse.json({ ok: true, loanId, category });
  }

  // Owner-only edit (P36). Enforce even though the wizard also gates
  // via readOnly — a URL-crafter must not be able to overwrite another
  // officer's override.
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  // Fast path — assignment row already exists (post-P36 auto-claim).
  const { data: existing, error: lookupErr } = await supabase
    .from("bfi_loan_assignments")
    .select("id")
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json(
      { error: `Assignment lookup failed: ${lookupErr.message}` },
      { status: 500 },
    );
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from("bfi_loan_assignments")
      .update({ loan_category_override: category })
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId);
    if (updErr) {
      return NextResponse.json(
        { error: `Update failed: ${updErr.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, loanId, category });
  }

  // Safety net — no assignment row yet. Should be rare (the auto-
  // claim runs on every wizard mount for a signed-in officer) but the
  // API contract says we must not lose the write.
  const { error: insErr } = await supabase
    .from("bfi_loan_assignments")
    .insert({
      bank_id: tenant.id,
      loan_id: loanId,
      officer_id: officer.id,
      assigned_by: officer.id,
      assigned_at: new Date().toISOString(),
      loan_category_override: category,
    });
  if (insErr) {
    return NextResponse.json(
      { error: `Assignment insert failed: ${insErr.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, loanId, category });
}
