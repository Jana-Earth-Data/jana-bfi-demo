/**
 * POST /api/pf-screening/submit
 *
 * Snapshots the latest Annex 5b responses for a loan, runs them through
 * the scoring engine (lib/regulatory/esdd/annex5b-pf-scoring.ts), and
 * saves the derived risk class + flag summary + rationale to
 * bfi_pf_screening_results.
 *
 * Body: { loanId, borrowerId }
 *
 * Requires resolved tenant + officer.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { scorePfScreening } from "@/lib/regulatory/esdd/annex5b-pf-scoring";
import type {
  PfAnswer,
  PfScreeningResponse,
} from "@/lib/regulatory/esdd/annex5b-pf-types";

export const dynamic = "force-dynamic";

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
      { error: "Officer must be selected before submitting a PF screening." },
      { status: 401 },
    );
  }

  let body: { loanId?: string; borrowerId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { loanId, borrowerId } = body;
  if (!loanId || !borrowerId) {
    return NextResponse.json(
      { error: "loanId and borrowerId are required." },
      { status: 400 },
    );
  }

  const { data: raw, error: respErr } = await supabase
    .from("bfi_pf_screening_responses")
    .select("item_id, answer, remarks, captured_at, officer_id")
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .order("captured_at", { ascending: false });
  if (respErr) {
    return NextResponse.json(
      { error: `Response query failed: ${respErr.message}` },
      { status: 500 },
    );
  }
  const latest = new Map<
    string,
    { itemId: string; answer: PfAnswer; remarks: string | null; capturedAt: string; officerId: string }
  >();
  for (const r of raw ?? []) {
    if (!latest.has(r.item_id)) {
      latest.set(r.item_id, {
        itemId: r.item_id,
        answer: r.answer as PfAnswer,
        remarks: r.remarks,
        capturedAt: r.captured_at,
        officerId: r.officer_id,
      });
    }
  }
  if (latest.size === 0) {
    return NextResponse.json(
      { error: "No Annex 5b PF responses recorded for this loan yet." },
      { status: 400 },
    );
  }

  const responseMap: PfScreeningResponse = {};
  const responsesSnapshot: Record<
    string,
    { answer: PfAnswer; remarks: string | null; capturedAt: string; officerId: string }
  > = {};
  for (const r of latest.values()) {
    responseMap[r.itemId] = r.answer;
    responsesSnapshot[r.itemId] = {
      answer: r.answer,
      remarks: r.remarks,
      capturedAt: r.capturedAt,
      officerId: r.officerId,
    };
  }
  const result = scorePfScreening(responseMap);

  const { data: inserted, error: insErr } = await supabase
    .from("bfi_pf_screening_results")
    .insert({
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      officer_id: officer.id,
      computed_risk_class: result.riskClass,
      items_answered: result.itemsAnswered,
      items_applicable: result.itemsApplicable,
      items_flagged: result.itemsFlagged,
      critical_flagged_items: result.criticalFlaggedItems,
      ps_breakdown: result.psBreakdown,
      computed_rationale: result.rationale,
      responses_snapshot: responsesSnapshot,
    })
    .select("id, captured_at")
    .single();
  if (insErr) {
    return NextResponse.json(
      { error: `PF screening insert failed: ${insErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    screening: {
      id: inserted.id,
      capturedAt: inserted.captured_at,
      result,
      officer: { id: officer.id, name: officer.name, role: officer.role },
    },
  });
}
