/**
 * POST /api/esrm/screenings
 *
 * Snapshots the latest ESDD responses for a loan, runs them through the
 * scoring engine (lib/regulatory/esdd/scoring.ts), and saves the derived
 * risk class + recommendation + rationale + escalation flag to
 * bfi_esrm_screenings. The response body is the same derivation, so the
 * wizard's review step can render it inline without a separate GET.
 *
 * Body: { loanId, borrowerId }
 *
 * Requires resolved tenant + officer.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import {
  deriveEsrm,
  scoreBySection,
  type EsddResponseRecord,
} from "@/lib/regulatory/esdd/scoring";
import {
  ANNEX5_EHS_RISK,
  ANNEX5_GENERAL_RISK,
  ANNEX5_SECTOR_SUPPLEMENTS,
  ANNEX5_SOCIAL_RISK,
} from "@/lib/regulatory/esdd/annex5-questions";

export const dynamic = "force-dynamic";

/**
 * GET /api/esrm/screenings?loanId=X
 *
 * Returns { latest: { ... } | null } — the most recent saved screening
 * for the loan, drawn from bfi_esrm_screenings. Used by the ESDD
 * wizard on mount and by the drawer to render live status.
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();
  const loanId = request.nextUrl.searchParams.get("loanId");
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId query parameter is required." },
      { status: 400 },
    );
  }
  const { data, error } = await supabase
    .from("bfi_esrm_screenings")
    .select(
      "id, computed_risk_class, computed_recommendation, escalation_flag, computed_rationale, captured_at, officer_id",
    )
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .order("captured_at", { ascending: false })
    .limit(1);
  if (error) {
    return NextResponse.json(
      { error: `Screening query failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    loanId,
    latest: data && data[0] ? data[0] : null,
  });
}

// Precompute question-id → section lookup once at module load. Sector
// supplements append to this at runtime once they're populated.
const SECTION_BY_QUESTION_ID: Record<string, string> = {};
for (const q of ANNEX5_GENERAL_RISK) SECTION_BY_QUESTION_ID[q.id] = q.section;
for (const q of ANNEX5_EHS_RISK) SECTION_BY_QUESTION_ID[q.id] = q.section;
for (const q of ANNEX5_SOCIAL_RISK) SECTION_BY_QUESTION_ID[q.id] = q.section;
// Include every sector supplement so scoring can bucket sector-specific
// answers into their own section rather than "unknown".
for (const supplement of Object.values(ANNEX5_SECTOR_SUPPLEMENTS)) {
  for (const q of supplement) SECTION_BY_QUESTION_ID[q.id] = q.section;
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
      { error: "Officer must be selected before saving a screening." },
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

  // Pull the officer's response set for this loan (latest per question).
  const { data: raw, error: respErr } = await supabase
    .from("bfi_esdd_responses")
    .select("question_id, answer, remarks, captured_at, officer_id")
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
    {
      questionId: string;
      answer: EsddResponseRecord["answer"];
      remarks: string | null;
      capturedAt: string;
      officerId: string;
    }
  >();
  for (const r of raw ?? []) {
    if (!latest.has(r.question_id)) {
      latest.set(r.question_id, {
        questionId: r.question_id,
        answer: r.answer as EsddResponseRecord["answer"],
        remarks: r.remarks,
        capturedAt: r.captured_at,
        officerId: r.officer_id,
      });
    }
  }
  if (latest.size === 0) {
    return NextResponse.json(
      { error: "No ESDD responses recorded for this loan yet." },
      { status: 400 },
    );
  }

  // Score + derive.
  const responses: EsddResponseRecord[] = Array.from(latest.values()).map(
    (r) => ({
      questionId: r.questionId,
      answer: r.answer,
      remarks: r.remarks ?? undefined,
    }),
  );
  const bucketed = scoreBySection(
    responses,
    (id) => SECTION_BY_QUESTION_ID[id] ?? "unknown",
  );
  const derivation = deriveEsrm(bucketed, responses);

  // Snapshot latest responses (dictionary shape) for audit.
  const esddSnapshot: Record<
    string,
    { answer: string; remarks: string | null; capturedAt: string; officerId: string }
  > = {};
  for (const r of latest.values()) {
    esddSnapshot[r.questionId] = {
      answer: r.answer,
      remarks: r.remarks,
      capturedAt: r.capturedAt,
      officerId: r.officerId,
    };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("bfi_esrm_screenings")
    .insert({
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      officer_id: officer.id,
      computed_risk_class: derivation.riskClass,
      computed_recommendation: derivation.recommendation,
      escalation_flag: derivation.escalationFlag,
      computed_rationale: derivation.rationale,
      esdd_snapshot: esddSnapshot,
    })
    .select("id, captured_at")
    .single();
  if (insErr) {
    return NextResponse.json(
      { error: `Screening insert failed: ${insErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    screening: {
      id: inserted.id,
      capturedAt: inserted.captured_at,
      riskClass: derivation.riskClass,
      recommendation: derivation.recommendation,
      escalationFlag: derivation.escalationFlag,
      rationale: derivation.rationale,
      drivingQuestionIds: derivation.drivingQuestionIds,
      officer: { id: officer.id, name: officer.name, role: officer.role },
      sectionScores: bucketed,
    },
  });
}
