/**
 * POST /api/admin/seed-demo-data?token=<SEED_ADMIN_TOKEN>
 * Body (optional): { tenantId?: string }
 *
 * Primes the target tenant with realistic demo data so tour and screencast
 * demos show concrete state instead of empty widgets:
 *
 *   - ESDD responses for a cement borrower with two 'c' answers so the
 *     ESRM screening escalates to the credit committee with real driving
 *     questions to display in the manager view banner.
 *   - A saved ESRM screening for that loan (risk = extreme, escalated).
 *   - A saved Taxonomy assessment for that loan (Amber — cement plant
 *     with waste heat recovery, transitional).
 *   - A saved Taxonomy assessment for a small-hydro borrower (Green).
 *
 * Idempotent for a given (tenant, loan, question) pair: each response
 * row is append-only, but the demo primer wipes prior demo-seeded
 * responses for the target loans first so re-runs don't pile up
 * duplicates. Uses the same admin token pattern as seed-officers.
 *
 * Loan IDs used:
 *   L-0079959  Hongshi-Shivam Cement — escalated ESDD + Amber taxonomy
 *   L-0080028  Himal Power (small hydro) — Green taxonomy, non-escalated
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { listTenants } from "@/lib/tenants";
import { getBfiDemoData } from "@/lib/api/bfi";

export const dynamic = "force-dynamic";

const CEMENT_LOAN_ID = "L-0079959";
const HYDRO_LOAN_ID = "L-0080028";

// A canonical set of ESDD answers that produces an escalated, extreme-
// risk cement screening. Two 'c' answers (Q 3.2 labour, Q 3.3 community
// H&S) are the escalation drivers. Every other question answered 'a' or
// 'b' so the escalation is unambiguous.
const CEMENT_ESDD_RESPONSES: Array<{
  questionId: string;
  answer: "a" | "b" | "c" | "d";
  remarks: string | null;
}> = [
  { questionId: "annex5.1.1", answer: "a", remarks: null },
  { questionId: "annex5.1.2", answer: "b", remarks: "Prior media coverage in 2023 on dust complaints from neighbouring communities; addressed via community outreach in 2024." },
  { questionId: "annex5.1.3", answer: "b", remarks: null },
  { questionId: "annex5.2.1", answer: "b", remarks: "Kiln stack emissions within limits; boundary dust from packing line under mitigation." },
  { questionId: "annex5.2.2", answer: "a", remarks: null },
  { questionId: "annex5.2.3", answer: "b", remarks: null },
  { questionId: "annex5.2.4", answer: "a", remarks: "Waste-heat recovery installed 2022; captive 8 MW cogen from kiln exhaust." },
  { questionId: "annex5.3.1", answer: "b", remarks: null },
  { questionId: "annex5.3.2", answer: "c", remarks: "Reports from union representatives on unsafe contract-worker conditions; borrower has not shared a remediation plan." },
  { questionId: "annex5.3.3", answer: "c", remarks: "Recurring community complaints on heavy-vehicle traffic through Biratnagar city limits; no committed traffic-safety measures on file." },
  { questionId: "annex5.3.4", answer: "b", remarks: null },
  // Cement sector supplement
  { questionId: "annex5.cement.1", answer: "b", remarks: null },
  { questionId: "annex5.cement.2", answer: "b", remarks: "Quarry rehabilitation lags mining by ~2 years; committed catch-up schedule submitted." },
  { questionId: "annex5.cement.3", answer: "b", remarks: null },
];

const CEMENT_TAXONOMY_ANSWERS = {
  whr_operational: true,
  kiln_pm_within_limits: true,
  alternative_fuel_share_pct: 22,
  dnsh_quarry_rehabilitation: false,
};

const HYDRO_TAXONOMY_ANSWERS = {
  installed_capacity_mw: 22,
  iee_or_eia_current: true,
  dnsh_environmental_flow: true,
  dnsh_resettlement_discharged: true,
};

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const expected = process.env.SEED_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_ADMIN_TOKEN not configured on the server." },
      { status: 500 },
    );
  }
  if (token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized: bad or missing token." },
      { status: 401 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase env vars not configured." },
      { status: 500 },
    );
  }

  let body: { tenantId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — default to laxmi_sunrise.
  }
  const tenantId = body.tenantId ?? "laxmi_sunrise";
  const tenant = listTenants().find((t) => t.id === tenantId);
  if (!tenant) {
    return NextResponse.json(
      { error: `Unknown tenantId: ${tenantId}` },
      { status: 400 },
    );
  }
  // Pick the tenant's first ESG-ish officer for attribution.
  const officer =
    tenant.demoOfficers.find((o) => o.role === "esg_officer") ??
    tenant.demoOfficers[0];
  if (!officer) {
    return NextResponse.json(
      { error: `Tenant ${tenantId} has no seeded officers. Run seed-officers first.` },
      { status: 400 },
    );
  }

  // Look up borrower IDs at runtime — they're generated by the
  // portfolio synthesiser and not hardcoded here so we don't drift.
  const demoData = await getBfiDemoData();
  const cementLoan = demoData.loans.find((l) => l.id === CEMENT_LOAN_ID);
  const hydroLoan = demoData.loans.find((l) => l.id === HYDRO_LOAN_ID);
  if (!cementLoan || !hydroLoan) {
    return NextResponse.json(
      {
        error: `Demo loans not found. Cement L-0079959: ${!!cementLoan}, hydro L-0080028: ${!!hydroLoan}. If the loan IDs have shifted, update this seed endpoint.`,
      },
      { status: 500 },
    );
  }
  const CEMENT_BORROWER_ID = cementLoan.borrowerId;
  const HYDRO_BORROWER_ID = hydroLoan.borrowerId;

  // 1) Wipe prior seeded rows for the two demo loans so re-runs don't
  // pile up duplicates.
  const targetLoanIds = [CEMENT_LOAN_ID, HYDRO_LOAN_ID];
  for (const table of [
    "bfi_esdd_responses",
    "bfi_esrm_screenings",
    "bfi_taxonomy_assessments",
  ] as const) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("bank_id", tenant.id)
      .in("loan_id", targetLoanIds);
    if (error) {
      return NextResponse.json(
        { error: `Wipe of ${table} failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 2) Insert ESDD responses for the cement borrower.
  const responseRows = CEMENT_ESDD_RESPONSES.map((r) => ({
    bank_id: tenant.id,
    loan_id: CEMENT_LOAN_ID,
    borrower_id: CEMENT_BORROWER_ID,
    officer_id: officer.id,
    question_id: r.questionId,
    answer: r.answer,
    remarks: r.remarks,
  }));
  {
    const { error } = await supabase.from("bfi_esdd_responses").insert(responseRows);
    if (error) {
      return NextResponse.json(
        { error: `ESDD response insert failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 3) Insert the ESRM screening (escalated, extreme risk).
  const drivingQuestionIds = CEMENT_ESDD_RESPONSES.filter(
    (r) => r.answer === "c",
  ).map((r) => r.questionId);
  const esddSnapshot: Record<
    string,
    { answer: string; remarks: string | null; capturedAt: string; officerId: string }
  > = {};
  const now = new Date().toISOString();
  for (const r of CEMENT_ESDD_RESPONSES) {
    esddSnapshot[r.questionId] = {
      answer: r.answer,
      remarks: r.remarks,
      capturedAt: now,
      officerId: officer.id,
    };
  }
  {
    const { error } = await supabase.from("bfi_esrm_screenings").insert({
      bank_id: tenant.id,
      loan_id: CEMENT_LOAN_ID,
      borrower_id: CEMENT_BORROWER_ID,
      officer_id: officer.id,
      computed_risk_class: "extreme",
      computed_recommendation: "approve-with-conditions",
      escalation_flag: true,
      computed_rationale:
        "Two Section 3 questions received 'c' answers (labour practices, community health & safety). Per NRB ESRM Annex 5 guidance, any unmitigated concern escalates to the credit committee. Recommend approval only with binding covenants on the flagged items plus quarterly monitoring.",
      esdd_snapshot: esddSnapshot,
    });
    if (error) {
      return NextResponse.json(
        { error: `ESRM screening insert failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 4) Insert a saved taxonomy assessment for the cement borrower (Amber).
  {
    const { error } = await supabase.from("bfi_taxonomy_assessments").insert({
      bank_id: tenant.id,
      loan_id: CEMENT_LOAN_ID,
      borrower_id: CEMENT_BORROWER_ID,
      officer_id: officer.id,
      activity_id: "cement-whr",
      criterion_answers: CEMENT_TAXONOMY_ANSWERS,
      computed_color: "amber",
      computed_rationale:
        "Cement plant with operational Waste Heat Recovery, kiln emissions compliant, and 22% alternative fuel share. Classified as Amber (transitional). Cement remains a hard-to-abate sector so full Green requires further alternative-fuel substitution. Quarry rehabilitation plan flagged under DNSH.",
      citation: "NRB GFT 2024, Ch. 2 Industry — Cement",
    });
    if (error) {
      return NextResponse.json(
        { error: `Taxonomy insert (cement) failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 5) Insert a saved taxonomy assessment for the hydro borrower (Green).
  {
    const { error } = await supabase.from("bfi_taxonomy_assessments").insert({
      bank_id: tenant.id,
      loan_id: HYDRO_LOAN_ID,
      borrower_id: HYDRO_BORROWER_ID,
      officer_id: officer.id,
      activity_id: "hydro-small",
      criterion_answers: HYDRO_TAXONOMY_ANSWERS,
      computed_color: "green",
      computed_rationale:
        "Small hydropower plant (22 MW) with current IEE/EIA approval, maintained environmental flow, and cleared resettlement obligations. Aligns with the NRB Green Finance Taxonomy under Renewable Energy — Hydropower.",
      citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
    });
    if (error) {
      return NextResponse.json(
        { error: `Taxonomy insert (hydro) failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 6) Assign the cement loan to the seeded officer so the manager tour
  // shows an owner (and so the officer's queue has it under "In review").
  {
    const { error } = await supabase.from("bfi_loan_assignments").upsert(
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        officer_id: officer.id,
        assigned_by: officer.id,
        assigned_at: now,
      },
      { onConflict: "bank_id,loan_id" },
    );
    if (error) {
      return NextResponse.json(
        { error: `Assignment upsert failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    tenant: tenant.id,
    officer: officer.id,
    seeded: {
      esddResponses: responseRows.length,
      esrmScreenings: 1,
      taxonomyAssessments: 2,
      loanAssignments: 1,
    },
    drivingQuestionIds,
    loans: {
      cement: CEMENT_LOAN_ID,
      hydro: HYDRO_LOAN_ID,
    },
  });
}
