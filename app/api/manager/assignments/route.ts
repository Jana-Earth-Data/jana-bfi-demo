/**
 * Loan assignment management (manager view).
 *
 * GET  /api/manager/assignments
 *   Returns a map { loanId -> { officerId, officerName, assignedAt } } for
 *   the current tenant. Empty map if no assignments exist yet.
 *
 * POST /api/manager/assignments
 *   Body: { loanId: string, officerId: string | null }
 *   Upserts (bank_id, loan_id) -> officer_id. Passing officerId=null
 *   unassigns the loan. Requires a signed-in officer (used as assigned_by).
 *
 * Both endpoints are open to any signed-in officer in the demo; role
 * gating (compliance/credit_committee only) can be layered on later.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();

  const { data, error } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_id, officer_id, assigned_at, assigned_by")
    .eq("bank_id", tenant.id);
  if (error) {
    return NextResponse.json(
      { error: `Assignment query failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Enrich with officer names in a single lookup so callers don't have to
  // round-trip.
  const officerIds = Array.from(
    new Set((data ?? []).map((r) => r.officer_id)),
  );
  const nameById = new Map<string, string>();
  if (officerIds.length > 0) {
    const { data: officers } = await supabase
      .from("bfi_officers")
      .select("id, name")
      .eq("bank_id", tenant.id)
      .in("id", officerIds);
    for (const o of officers ?? []) nameById.set(o.id, o.name);
  }

  const assignments: Record<
    string,
    { officerId: string; officerName: string; assignedAt: string }
  > = {};
  for (const row of data ?? []) {
    assignments[row.loan_id] = {
      officerId: row.officer_id,
      officerName: nameById.get(row.officer_id) ?? row.officer_id,
      assignedAt: row.assigned_at,
    };
  }
  return NextResponse.json({ ok: true, assignments });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return NextResponse.json(
      { error: "Officer must be selected before assigning loans." },
      { status: 401 },
    );
  }

  let body: { loanId?: string; officerId?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { loanId, officerId } = body;
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId is required." },
      { status: 400 },
    );
  }

  // Unassign: delete the row.
  if (officerId === null || officerId === undefined || officerId === "") {
    const { error } = await supabase
      .from("bfi_loan_assignments")
      .delete()
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId);
    if (error) {
      return NextResponse.json(
        { error: `Unassign failed: ${error.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, loanId, officerId: null });
  }

  // Verify the target officer belongs to this tenant.
  const { data: target, error: targetErr } = await supabase
    .from("bfi_officers")
    .select("id, name")
    .eq("bank_id", tenant.id)
    .eq("id", officerId)
    .maybeSingle();
  if (targetErr) {
    return NextResponse.json(
      { error: `Officer lookup failed: ${targetErr.message}` },
      { status: 500 },
    );
  }
  if (!target) {
    return NextResponse.json(
      { error: `Officer ${officerId} not found in this tenant.` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("bfi_loan_assignments")
    .upsert(
      {
        bank_id: tenant.id,
        loan_id: loanId,
        officer_id: officerId,
        assigned_by: officer.id,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "bank_id,loan_id" },
    );
  if (error) {
    return NextResponse.json(
      { error: `Assign failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    loanId,
    officerId,
    officerName: target.name,
  });
}
