/**
 * POST /api/admin/seed-demo-data?token=<SEED_ADMIN_TOKEN>
 * Body (optional): { tenantId?: string | "all" }
 *
 * When tenantId is omitted or set to "all", every registered tenant is
 * seeded. When set to a specific id ("default", "laxmi_sunrise"), only
 * that tenant is seeded.
 *
 * Primes the target tenant(s) with realistic demo data so tour and
 * screencast demos show concrete state instead of empty widgets:
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
  // Q2.5 climate risks and opportunities (new in 2022 update)
  { questionId: "annex5.2.5", answer: "b", remarks: "Physical: heat + water stress on kiln cooling. Transition: cement policy tightening. Reduction target not on file." },
  // Sector supplements were removed in P1 — Circular 22 has no sector Q&A.
];

// Cement — NRB §5.11 has NO Green column; classification maxes at Amber.
// These answers exercise the dry-process kiln + alternative-fuel Amber path
// with quarry rehabilitation flagged under DNSH.
const CEMENT_TAXONOMY_ANSWERS = {
  dry_process_kiln: true,
  alt_fuel_or_low_carbon_kiln: true,
  efficient_kiln_60pct_masonry_share: false,
  whr_operational: true,
  alternative_fuel_share_pct: 22,
  dnsh_air_emissions_compliance: true,
  dnsh_quarry_rehabilitation: false,
};

// Hydro — NRB §7.1 uses run-of-river + power-density + lifecycle GHG,
// not MW capacity bands. These answers exercise the Green path.
const HYDRO_TAXONOMY_ANSWERS = {
  installed_capacity_mw: 22,
  run_of_river_no_reservoir: true,
  power_density_above_5: true,
  lifecycle_gco2e_per_kwh: 45,
  eia_or_iee_current: true,
  avoids_protected_and_disaster_zones: true,
  dnsh_environmental_flow: true,
  dnsh_resettlement_discharged: true,
  dnsh_biodiversity_offset: true,
  dnsh_seismic_assessment: true,
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
    // Empty body is fine — default to seeding every tenant so the demo
    // works out of the box regardless of which tenant the caller lands on.
  }
  const tenantIdInput = body.tenantId ?? "all";
  const registered = listTenants();
  const tenantsToSeed = tenantIdInput === "all"
    ? registered
    : registered.filter((t) => t.id === tenantIdInput);
  if (tenantsToSeed.length === 0) {
    return NextResponse.json(
      { error: `Unknown tenantId: ${tenantIdInput}. Valid: ${registered.map((t) => t.id).join(", ")}, or "all".` },
      { status: 400 },
    );
  }
  // Look up borrower IDs at runtime — they're generated by the
  // portfolio synthesiser and not hardcoded here so we don't drift.
  // Borrower IDs are tenant-agnostic in the demo data.
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
  const targetLoanIds = [CEMENT_LOAN_ID, HYDRO_LOAN_ID];
  const now = new Date().toISOString();

  const perTenantResults: Array<Record<string, unknown>> = [];

  for (const tenant of tenantsToSeed) {
    // Pick the tenant's first ESG-ish officer for attribution.
    const officer =
      tenant.demoOfficers.find((o) => o.role === "esg_officer") ??
      tenant.demoOfficers[0];
    if (!officer) {
      return NextResponse.json(
        { error: `Tenant ${tenant.id} has no seeded officers. Run seed-officers first.` },
        { status: 400 },
      );
    }

    // 1) Wipe prior seeded rows for the two demo loans so re-runs don't
    // pile up duplicates.
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
          { error: `[${tenant.id}] Wipe of ${table} failed: ${error.message}` },
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
          { error: `[${tenant.id}] ESDD response insert failed: ${error.message}` },
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
          "Two Section 3 questions received 'c' answers (labour practices, community health & safety). Per NRB Circular 22 guidance, any unmitigated concern escalates to the credit committee. Recommend approval only with binding covenants on the flagged items plus quarterly monitoring.",
        esdd_snapshot: esddSnapshot,
      });
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] ESRM screening insert failed: ${error.message}` },
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
          "Cement production classified Amber (transitional). NRB §5.11 has NO Green column — cement is a hard-to-abate sector and the best possible outcome under the taxonomy is Amber. Levers in place: dry-process kiln + reduced clinker; HHK/TK/CSEB or clinker substitution; WHR operational (Jana editorial, not NRB-named); 22% alternative fuel share. Quarry rehabilitation plan flagged under DNSH.",
        citation:
          "NRB GFT 2024, Annex 2 §5.11 (Table 9, pp. 97-98 — Amber only)",
      });
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Taxonomy insert (cement) failed: ${error.message}` },
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
        // Legacy id "hydro-small" is aliased to "hydro" by findActivityById.
        // Persist the current activity id so re-openings resolve directly.
        activity_id: "hydro",
        criterion_answers: HYDRO_TAXONOMY_ANSWERS,
        computed_color: "green",
        computed_rationale:
          "Hydro plant meets NRB §7.1 Green: run-of-river or > 5 W/m² power density + verified lifecycle GHG at 45 gCO2e/kWh (< 100 ceiling) + EIA/IEE current + site outside protected / disaster zones. DNSH checks passed.",
        citation:
          "NRB GFT 2024, Annex 2 §7.1 (Table 11, pp. 104-105 — Green)",
      });
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Taxonomy insert (hydro) failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    // 6) Assign both seeded loans to the officer so the manager tour
    // shows owners and so the officer's queue has both under "In review".
    // Cement is the escalated case (drives the escalation banner); hydro
    // is the Green-taxonomy case (drives the taxonomy walkthrough — the
    // tour step "the manager clicks into a hydro borrower" needs an
    // assigned loan to click into).
    for (const loanId of [CEMENT_LOAN_ID, HYDRO_LOAN_ID]) {
      const { error } = await supabase.from("bfi_loan_assignments").upsert(
        {
          bank_id: tenant.id,
          loan_id: loanId,
          officer_id: officer.id,
          assigned_by: officer.id,
          assigned_at: now,
        },
        { onConflict: "bank_id,loan_id" },
      );
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Assignment upsert (${loanId}) failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    perTenantResults.push({
      tenant: tenant.id,
      officer: officer.id,
      seeded: {
        esddResponses: responseRows.length,
        esrmScreenings: 1,
        taxonomyAssessments: 2,
        loanAssignments: 2,
      },
      drivingQuestionIds,
    });
  }

  return NextResponse.json({
    ok: true,
    tenantsSeeded: perTenantResults.length,
    results: perTenantResults,
    loans: {
      cement: CEMENT_LOAN_ID,
      hydro: HYDRO_LOAN_ID,
    },
  });
}
