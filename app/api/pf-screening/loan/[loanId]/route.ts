/**
 * GET /api/pf-screening/loan/[loanId]
 *
 * Returns:
 *   {
 *     ok: true,
 *     responses: PfResponseRow[],           // latest per item_id
 *     latestResult: PfResultRow | null,     // most recent saved screening
 *   }
 *
 * Used by the PF screening wizard on mount so it can resume mid-flow and,
 * when a prior screening exists, jump to the Review step.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { getSupabaseAdmin } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> },
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();
  const { loanId } = await params;
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId path parameter is required." },
      { status: 400 },
    );
  }

  const [respRes, resultRes] = await Promise.all([
    supabase
      .from("bfi_pf_screening_responses")
      .select("id, item_id, ifc_ps, answer, remarks, captured_at, officer_id")
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .order("captured_at", { ascending: false }),
    supabase
      .from("bfi_pf_screening_results")
      .select(
        "id, computed_risk_class, items_answered, items_applicable, items_flagged, critical_flagged_items, ps_breakdown, computed_rationale, captured_at, officer_id",
      )
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .order("captured_at", { ascending: false })
      .limit(1),
  ]);

  if (respRes.error) {
    return NextResponse.json(
      { error: `Response query failed: ${respRes.error.message}` },
      { status: 500 },
    );
  }
  if (resultRes.error) {
    return NextResponse.json(
      { error: `Result query failed: ${resultRes.error.message}` },
      { status: 500 },
    );
  }

  // Reduce responses to latest per item_id.
  const latest = new Map<
    string,
    {
      itemId: string;
      ifcPS: string;
      answer: string;
      remarks: string | null;
      capturedAt: string;
      officerId: string;
    }
  >();
  for (const row of respRes.data ?? []) {
    if (!latest.has(row.item_id)) {
      latest.set(row.item_id, {
        itemId: row.item_id,
        ifcPS: row.ifc_ps,
        answer: row.answer,
        remarks: row.remarks,
        capturedAt: row.captured_at,
        officerId: row.officer_id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    loanId,
    responses: Array.from(latest.values()),
    latestResult: resultRes.data?.[0] ?? null,
  });
}
