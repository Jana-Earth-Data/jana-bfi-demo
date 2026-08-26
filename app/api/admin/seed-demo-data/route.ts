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
import { withOrigin } from "@/lib/data/capture-client";
import { listTenants } from "@/lib/tenants";
import { getBfiDemoData } from "@/lib/api/bfi";
import { suggestActivitiesForSector } from "@/lib/regulatory/taxonomy/applicability";
import { apiError, requireAdminToken } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

const CEMENT_LOAN_ID = "L-0079959";
const HYDRO_LOAN_ID = "L-0080028";

// Small loan in a critical sector — walkthrough path for the fourth
// EsddLoanCategory variant. Loan ID is looked up at seed time because
// the brick-industry SME borrower + loan are stochastic in the
// synthesizer (pinned to under-review by the portfolio hook but not
// pinned to a specific ID). Non-escalated answers throughout — the
// point is to demonstrate that a small brick loan still routes
// through the FULL Annex 5 checklist (no fast-path) because brick is on
// NRB's §5 critical-sector list.
const BRICK_ESDD_RESPONSES: Array<{
  questionId: string;
  answer: "a" | "b" | "c" | "d";
  remarks: string | null;
}> = [
  { questionId: "annex5.1.1", answer: "a", remarks: null },
  { questionId: "annex5.1.2", answer: "a", remarks: null },
  { questionId: "annex5.1.3", answer: "b", remarks: "Kiln downwind of a wetland; buffer maintained per DoE guidance." },
  // Q1.4 land acquisition / involuntary resettlement (new in the 2022 edition)
  { questionId: "annex5.1.4", answer: "a", remarks: "Kiln operates on land held by the promoter family since 2009; no acquisition and no displacement associated with the facility." },
  { questionId: "annex5.2.1", answer: "b", remarks: "Legacy fixed-chimney bull's trench kiln; brick-sector modernisation programme retrofit committed by FY 2027." },
  { questionId: "annex5.2.2", answer: "a", remarks: null },
  { questionId: "annex5.2.3", answer: "a", remarks: null },
  { questionId: "annex5.2.4", answer: "b", remarks: "Retrofit plan includes zig-zag firing; energy use expected to drop 25%." },
  { questionId: "annex5.2.5", answer: "b", remarks: "Physical: air-quality PM2.5 exposure. Transition: brick-sector modernisation regulation." },
  { questionId: "annex5.3.1", answer: "a", remarks: null },
  { questionId: "annex5.3.2", answer: "b", remarks: "Seasonal migrant labour, all age-verified per Nepal Labour Act; no child labour on site." },
  { questionId: "annex5.3.3", answer: "a", remarks: null },
  { questionId: "annex5.3.4", answer: "a", remarks: null },
];

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
  // Q1.4 land acquisition / involuntary resettlement (new in the 2022 edition)
  { questionId: "annex5.1.4", answer: "b", remarks: "Limestone quarry extension acquired 14 ha in 2021; compensation paid at district rate and a Livelihood Restoration Plan is in place for the eleven affected households." },
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
  // Sector supplements were removed in P1 — the NRB ESRM Guideline has
  // no sector-specific Q&A.
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

// PCAF Data Availability overrides — one per demonstration borrower so the
// PCAF collection panel has real analyst-confirmed state at demo time.
// Hongshi: verified Score 1 (borrower publishes with third-party assurance).
// Himal Power: physical activity data available → Score 2b/3 path.
const PCAF_AVAILABILITY_SEEDS = [
  {
    borrowerKey: "cement" as const, // Hongshi-Shivam Cement
    flags: {
      borrower_publishes_verified: true,
      borrower_publishes_unverified: false,
      energy_consumption_data_available: true,
      physical_activity_data_available: true,
      revenue_data_available: true,
      sector_average_only: false,
      out_of_scope: false,
    },
    evidence_note:
      "Hongshi-Shivam Cement 2024 Sustainability & GHG Report (pp. 42-46). Scope 1+2 emissions independently assured by KPMG per ISAE 3410. Physical clinker production tonnage in AR. Facility-level Climate TRACE cross-check consistent (±3%).",
    pcaf_citation: "PCAF Part A 3rd Edition §5.3 Option 1a (verified reported)",
  },
  {
    borrowerKey: "hydro" as const, // Himal Power
    flags: {
      borrower_publishes_verified: false,
      borrower_publishes_unverified: false,
      energy_consumption_data_available: false,
      physical_activity_data_available: true,
      revenue_data_available: true,
      sector_average_only: false,
      out_of_scope: false,
    },
    evidence_note:
      "Himal Power annual generation report (GWh sent-out to NEA grid). No borrower-published GHG. Physical activity × Nepal grid emission factor (DoED / NEA 2024). Climate TRACE for downstream methane from reservoir surface confirms de-minimis (~0 gCO2/kWh in run-of-river configuration).",
    pcaf_citation: "PCAF Part A 3rd Edition §5.3 Option 2b (physical activity × emission factor)",
  },
];

// Circular 22 Annex 2 documentation matrix — Himal Power's 60 MW Khimti
// station puts it in the ">50 MW / EIA" band, which has 5 required
// documents: company registration, survey license, EIA approval,
// development license, PPA. Seed a mix so the panel has visible state
// at demo time (verified / in-progress / not-collected). We also record
// an audit row for the IEE approval doc — it is NOT required for >50 MW
// so the panel filters it out, but the row lets us demonstrate the
// audit trail for a doc the officer initially assumed might apply.
const HYDRO_DOC_STATUSES: Array<{
  documentId: string;
  status:
    | "not-required"
    | "not-collected"
    | "in-progress"
    | "received"
    | "verified";
  notes: string | null;
}> = [
  {
    documentId: "company-registration",
    status: "verified",
    notes: "VAT + PAN + registration certificate on file · verified 2026-02-11.",
  },
  {
    documentId: "survey-license",
    status: "verified",
    notes: "Generation + transmission survey license (DoED ref. SL-2054-021).",
  },
  {
    documentId: "eia-approval-letter",
    status: "verified",
    notes: "MoFE approval letter on file (Ashad 2081); no outstanding conditions.",
  },
  {
    documentId: "development-license",
    status: "in-progress",
    notes: "Amendment request to include Khimti-II tie-in — DoED intake 2026-04-02.",
  },
  {
    documentId: "power-purchase-agreement",
    status: "in-progress",
    notes: "NEA PPA in final drafting; tariff annex still pending signatures.",
  },
  {
    // IEE is only required for the 1-50 MW band. Recorded here as
    // 'not-collected' to demonstrate the audit trail for a doc the
    // officer briefly considered; the panel filters not-required docs
    // out of the render, so this stays in the DB without cluttering
    // the UI.
    documentId: "iee-approval-letter",
    status: "not-collected",
    notes: "N/A for >50 MW band (EIA path); noted for audit trail only.",
  },
];


// ---------------------------------------------------------------------------
// Two further escalating screenings, added so the manager escalation banner
// reflects a realistic caseload rather than a pair of set-piece loans.
//
// Both sit on loans the synthesizer marks `under-review`, which matters:
// app/api/manager/queue/route.ts builds its queue from applicationQueue(),
// i.e. under-review loans only. A screening on an `active` loan is written
// to the database and then never shown. (L-0080028, the hydro loan used for
// the taxonomy walkthrough, is `active` for exactly this reason — do not
// attach a screening to it expecting the banner to move.)
//
// Answers are chosen so that lib/regulatory/esdd/scoring.ts derives the
// stated risk class from the responses themselves. They are not decorative:
// re-saving either screening through the wizard reproduces the same rating.
// Weights are a=0, b=1, c=3, d=excluded.

// Himal Power run-of-river PF. general = (0+1+1+3)/4 = 1.25, ehs = 3/5 = 0.6,
// social = (0+0+3+1)/4 = 1.0. Two 'c' answers -> HIGH (>=2 c), and not
// EXTREME because that needs 3 'c' answers or a section mean >= 2.5.
const HYDRO_PF_ESDD_RESPONSES: Array<{
  questionId: string;
  answer: "a" | "b" | "c" | "d";
  remarks: string | null;
}> = [
  { questionId: "annex5.1.1", answer: "a", remarks: "No outstanding DoED or MoFE enforcement action; generation licence in good standing." },
  { questionId: "annex5.1.2", answer: "b", remarks: "Downstream irrigation users raised dry-season abstraction concerns during construction; environmental flow release agreed with the district committee." },
  { questionId: "annex5.1.3", answer: "b", remarks: "Headworks sit on a river reach with documented migratory fish presence; fish ladder installed and monitored." },
  { questionId: "annex5.1.4", answer: "c", remarks: "Penstock corridor and powerhouse required acquisition of 6.2 ha across 23 households, of which 9 were physically displaced. Resettlement Action Plan is in place but two compensation appeals remain unresolved." },
  { questionId: "annex5.2.1", answer: "a", remarks: null },
  { questionId: "annex5.2.2", answer: "b", remarks: "Construction-phase sediment load exceeded permit limits twice in 2025; settling ponds since enlarged." },
  { questionId: "annex5.2.3", answer: "a", remarks: null },
  { questionId: "annex5.2.4", answer: "b", remarks: "Environmental flow telemetry and a sediment-flushing regime funded; catchment reforestation still unbudgeted." },
  { questionId: "annex5.2.5", answer: "b", remarks: "GLOF exposure from an upstream glacial lake; early-warning tie-in to the DHM network installed 2025." },
  { questionId: "annex5.3.1", answer: "a", remarks: null },
  { questionId: "annex5.3.2", answer: "a", remarks: null },
  { questionId: "annex5.3.3", answer: "c", remarks: "Unannounced sluice-gate releases and heavy construction traffic through two village sections; no downstream siren system at the time of assessment." },
  { questionId: "annex5.3.4", answer: "b", remarks: "Public hearings held at EIA stage; no standing grievance mechanism until 2025." },
];

// Kantipur Hotels working capital. general = 1/4 = 0.25, ehs = 5/5 = 1.0,
// social = 1/4 = 0.25. No 'c' answers, so not HIGH; ehs mean is above 0.5,
// so not LOW either. Lands on MEDIUM -- which still escalates under s7.3.6.
const HOTEL_ESDD_RESPONSES: Array<{
  questionId: string;
  answer: "a" | "b" | "c" | "d";
  remarks: string | null;
}> = [
  { questionId: "annex5.1.1", answer: "a", remarks: null },
  { questionId: "annex5.1.2", answer: "b", remarks: "Neighbourhood noise complaints regarding rooftop events; hours curtailed by agreement with the ward office in 2025." },
  { questionId: "annex5.1.3", answer: "a", remarks: null },
  { questionId: "annex5.1.4", answer: "a", remarks: "Existing building on land held since 2011; no acquisition and no displacement." },
  { questionId: "annex5.2.1", answer: "b", remarks: "Two diesel gensets run during load-shedding; stack height compliant but no emissions monitoring in place." },
  { questionId: "annex5.2.2", answer: "b", remarks: "Greywater and kitchen effluent discharge to the municipal sewer with no on-site pre-treatment; grease trap only." },
  { questionId: "annex5.2.3", answer: "b", remarks: "Segregation at source is partial; organic waste goes to the municipal stream rather than composting." },
  { questionId: "annex5.2.4", answer: "b", remarks: "Solar water heating and LED retrofit completed on the new wing; heat-recovery and STP still deferred." },
  { questionId: "annex5.2.5", answer: "b", remarks: "Dry-season municipal water shortfall met by tanker purchase; no rainwater harvesting despite roof area." },
  { questionId: "annex5.3.1", answer: "b", remarks: "Fire detection covers the new wing; the 1990s block still lacks addressable detection and a second protected stairwell." },
  { questionId: "annex5.3.2", answer: "a", remarks: null },
  { questionId: "annex5.3.3", answer: "a", remarks: null },
  { questionId: "annex5.3.4", answer: "a", remarks: null },
];

export async function POST(request: NextRequest) {
  const authErr = requireAdminToken(request);
  if (authErr) return authErr;

  // Seeded rows are demo rows by definition, regardless of what mode the
  // operator happens to be in when they run the seeder. Forcing 'demo' here
  // rather than deriving it from the request is what makes the label mean
  // "this was manufactured" instead of "this was written on a Tuesday".
  const admin = getSupabaseAdmin();
  const supabase = admin ? withOrigin(admin, "demo") : null;
  if (!supabase) {
    return apiError("Supabase env vars not configured.", 500);
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
    return apiError(
      `Unknown tenantId: ${tenantIdInput}. Valid: ${registered.map((t) => t.id).join(", ")}, or "all".`,
      400,
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

  // Find the SME brick loan pinned to under-review by the portfolio
  // synthesizer's demo-tour hook. Brick is on NRB ESRM Guideline 2022 §5
  // critical-sector list, so this is the small-loan-in-critical-sector
  // walkthrough path. Not fatal if missing — brick borrowers appear
  // stochastically in the SME pool.
  const brickBorrower = demoData.borrowers.find(
    (b) => b.nrbSector?.toLowerCase().includes("brick"),
  );
  const brickLoan = brickBorrower
    ? demoData.loans.find(
        (l) =>
          l.borrowerId === brickBorrower.id &&
          l.category === "sme-term-loan" &&
          l.status === "under-review",
      )
    : undefined;
  const BRICK_LOAN_ID = brickLoan?.id ?? null;
  const BRICK_BORROWER_ID = brickBorrower?.id ?? null;

  // Two more escalating cases so the manager banner shows a realistic
  // caseload. Both MUST be under-review — the manager queue is built from
  // applicationQueue(), so a screening on any other status is invisible.
  // Resolved by sector rather than by hardcoded id, matching the brick
  // lookup above, so a re-synthesised portfolio does not silently break
  // the seed. Non-fatal if absent.
  // Search LOANS first, not borrowers. Picking the first borrower in a
  // sector and then asking whether it has an under-review loan fails
  // whenever it doesn't: there are 24 hydropower borrowers and the first
  // is Nepal Electricity Authority, which has none, so a borrower-first
  // lookup silently returns null and the screening is never seeded.
  // (The brick lookup above is borrower-first and happens to work only
  // because its first sector match is the right one. This is the pattern
  // to copy for anything new.)
  const findUnderReview = (
    sectorFragment: string,
    preferredBorrowerName?: string,
  ) => {
    const inSector = demoData.loans
      .filter((l) => l.status === "under-review")
      .map((l) => ({
        loan: l,
        borrower: demoData.borrowers.find((b) => b.id === l.borrowerId),
      }))
      .filter(({ borrower }) =>
        borrower?.nrbSector?.toLowerCase().includes(sectorFragment),
      )
      // Deterministic: the same loan is chosen on every seed run.
      .sort((a, b) => a.loan.id.localeCompare(b.loan.id));

    const match =
      (preferredBorrowerName
        ? inSector.find(({ borrower }) =>
            borrower?.name
              ?.toLowerCase()
              .includes(preferredBorrowerName.toLowerCase()),
          )
        : undefined) ?? inSector[0];

    return {
      loanId: match?.loan.id ?? null,
      borrowerId: match?.borrower?.id ?? null,
    };
  };

  const { loanId: HYDRO_PF_LOAN_ID, borrowerId: HYDRO_PF_BORROWER_ID } =
    findUnderReview("hydropower");
  // Prefer Kantipur: it is the loan the demo narrative already refers to.
  // Falls back to any under-review hospitality loan if the synthesizer
  // stops producing it.
  const { loanId: HOTEL_LOAN_ID, borrowerId: HOTEL_BORROWER_ID } =
    findUnderReview("hospitality", "Kantipur");

  const targetLoanIds: string[] = [CEMENT_LOAN_ID, HYDRO_LOAN_ID];
  if (BRICK_LOAN_ID) targetLoanIds.push(BRICK_LOAN_ID);
  if (HYDRO_PF_LOAN_ID) targetLoanIds.push(HYDRO_PF_LOAN_ID);
  if (HOTEL_LOAN_ID) targetLoanIds.push(HOTEL_LOAN_ID);
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
      "bfi_hydro_doc_status",
      "bfi_cap_items",
      "bfi_covenants",
      "bfi_monitoring_reports",
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

    // 1b) Wipe evidence attachments tied to the demo loans. Attachments
    // aren't loan-scoped by column (entity_id can be a cap_item.id,
    // covenant.id, monitoring_report.id, etc.), so we blanket-wipe every
    // ESDD / PF / PCAF attachment referencing the demo loan ids plus
    // every attachment on the CAP items / covenants / monitoring reports
    // that were just deleted above (cascade-on-parent isn't set up).
    // Simplest: wipe every attachment for the tenant that references any
    // of the surface types we're about to re-seed.
    {
      const { error } = await supabase
        .from("bfi_evidence_attachments")
        .delete()
        .eq("bank_id", tenant.id);
      if (error) {
        // Table may not exist yet if the migration hasn't been run — that's
        // OK, treat as non-fatal so older DBs still seed.
        console.warn(
          `[${tenant.id}] Evidence attachment wipe skipped: ${error.message}`,
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
        // Derived, not asserted: 2 'c' answers with a top section mean of
        // exactly 2.00 gives HIGH. EXTREME needs 3 'c' answers or a mean of
        // 2.5 (lib/regulatory/esdd/scoring.ts). This previously read
        // "extreme", which contradicted both the answers and the rationale
        // sentence directly below it.
        computed_risk_class: "high",
        computed_recommendation: "approve-with-conditions",
        escalation_flag: true,
        computed_rationale:
          "Two Section 3 questions received 'c' answers (labour practices, community health & safety), which sets the Environmental and Social Risk Rating to HIGH. Per NRB ESRM Guideline 2022 §7.3.6, all transactions rated MEDIUM or HIGH (ESRR) are escalated to the one-level higher related credit approval authority. Recommend approval only with binding covenants on the flagged items plus quarterly monitoring.",
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

    // 5b) Insert non-escalated ESDD state + screening for the brick SME
    // loan (the small-loan-in-critical-sector walkthrough path). Skipped
    // silently if the synthesizer didn't produce a brick borrower this
    // build.
    let brickResponsesLen = 0;
    let brickScreeningsLen = 0;
    if (BRICK_LOAN_ID && BRICK_BORROWER_ID) {
      // Wipe prior rows for this loan too.
      for (const table of [
        "bfi_esdd_responses",
        "bfi_esrm_screenings",
      ] as const) {
        await supabase
          .from(table)
          .delete()
          .eq("bank_id", tenant.id)
          .eq("loan_id", BRICK_LOAN_ID);
      }
      const brickRows = BRICK_ESDD_RESPONSES.map((r) => ({
        bank_id: tenant.id,
        loan_id: BRICK_LOAN_ID,
        borrower_id: BRICK_BORROWER_ID,
        officer_id: officer.id,
        question_id: r.questionId,
        answer: r.answer,
        remarks: r.remarks,
      }));
      {
        const { error } = await supabase
          .from("bfi_esdd_responses")
          .insert(brickRows);
        if (error) {
          return NextResponse.json(
            { error: `[${tenant.id}] Brick ESDD insert failed: ${error.message}` },
            { status: 500 },
          );
        }
      }
      const brickSnapshot: Record<
        string,
        { answer: string; remarks: string | null; capturedAt: string; officerId: string }
      > = {};
      for (const r of BRICK_ESDD_RESPONSES) {
        brickSnapshot[r.questionId] = {
          answer: r.answer,
          remarks: r.remarks,
          capturedAt: now,
          officerId: officer.id,
        };
      }
      {
        const { error } = await supabase.from("bfi_esrm_screenings").insert({
          bank_id: tenant.id,
          loan_id: BRICK_LOAN_ID,
          borrower_id: BRICK_BORROWER_ID,
          officer_id: officer.id,
          computed_risk_class: "medium",
          computed_recommendation: "approve-with-conditions",
          // MEDIUM escalates under NRB ESRM Guideline 2022 §7.3.6 even with
          // no 'c' answers. This loan is the demo's worked example of that:
          // every answer is 'a' or 'b', yet it still goes one level up.
          escalation_flag: true,
          computed_rationale:
            "Small brick SME loan. Critical-sector routing per NRB ESRM Guideline 2022 §5 (brick is on the 10-sector critical list) so the full Annex 5 checklist applies even at small loan size. No 'c' answers recorded, but several 'b' answers (eco-sensitive siting, kiln air emissions, climate risk, seasonal migrant labour) set the Environmental and Social Risk Rating to MEDIUM. Per NRB ESRM Guideline 2022 §7.3.6, MEDIUM and HIGH both escalate to the one-level higher related credit approval authority. Recommend approval with the modernisation retrofit commitment recorded as a covenant.",
          esdd_snapshot: brickSnapshot,
        });
        if (error) {
          return NextResponse.json(
            { error: `[${tenant.id}] Brick screening insert failed: ${error.message}` },
            { status: 500 },
          );
        }
      }
      brickResponsesLen = brickRows.length;
      brickScreeningsLen = 1;
    }

    // 5c) The two additional escalating screenings. Shared helper rather
    // than a third and fourth copy of the brick block above.
    const seedScreening = async (
      loanId: string,
      borrowerId: string,
      responses: Array<{ questionId: string; answer: string; remarks: string | null }>,
      riskClass: "low" | "medium" | "high",
      rationale: string,
    ) => {
      for (const table of ["bfi_esdd_responses", "bfi_esrm_screenings"] as const) {
        await supabase
          .from(table)
          .delete()
          .eq("bank_id", tenant.id)
          .eq("loan_id", loanId);
      }
      const rows = responses.map((r) => ({
        bank_id: tenant.id,
        loan_id: loanId,
        borrower_id: borrowerId,
        officer_id: officer.id,
        question_id: r.questionId,
        answer: r.answer,
        remarks: r.remarks,
      }));
      const { error: respError } = await supabase
        .from("bfi_esdd_responses")
        .insert(rows);
      if (respError) return `ESDD insert (${loanId}) failed: ${respError.message}`;

      const snapshot: Record<
        string,
        { answer: string; remarks: string | null; capturedAt: string; officerId: string }
      > = {};
      for (const r of responses) {
        snapshot[r.questionId] = {
          answer: r.answer,
          remarks: r.remarks,
          capturedAt: now,
          officerId: officer.id,
        };
      }
      const { error: scrError } = await supabase
        .from("bfi_esrm_screenings")
        .insert({
          bank_id: tenant.id,
          loan_id: loanId,
          borrower_id: borrowerId,
          officer_id: officer.id,
          computed_risk_class: riskClass,
          computed_recommendation:
            riskClass === "low" ? "approve" : "approve-with-conditions",
          // NRB ESRM Guideline 2022 s7.3.6 — MEDIUM and HIGH both escalate.
          escalation_flag: riskClass !== "low",
          computed_rationale: rationale,
          esdd_snapshot: snapshot,
        });
      if (scrError) return `Screening insert (${loanId}) failed: ${scrError.message}`;
      return null;
    };

    let extraScreeningsLen = 0;
    if (HYDRO_PF_LOAN_ID && HYDRO_PF_BORROWER_ID) {
      const err = await seedScreening(
        HYDRO_PF_LOAN_ID,
        HYDRO_PF_BORROWER_ID,
        HYDRO_PF_ESDD_RESPONSES,
        "high",
        "Run-of-river hydropower project finance. Two 'c' answers — land acquisition with physical resettlement (Annex 5 Q1.4, 23 households affected, 9 displaced, two compensation appeals open) and community health and safety (Annex 5 Q3.3, unannounced sluice releases with no downstream warning system) — set the Environmental and Social Risk Rating to HIGH. Per NRB ESRM Guideline 2022 §7.3.6, MEDIUM and HIGH both escalate to the one-level higher related credit approval authority. Recommend approval conditional on a downstream siren system, closure of the outstanding Resettlement Action Plan appeals, and quarterly environmental-flow reporting.",
      );
      if (err) {
        return NextResponse.json({ error: `[${tenant.id}] ${err}` }, { status: 500 });
      }
      extraScreeningsLen += 1;
    }
    if (HOTEL_LOAN_ID && HOTEL_BORROWER_ID) {
      const err = await seedScreening(
        HOTEL_LOAN_ID,
        HOTEL_BORROWER_ID,
        HOTEL_ESDD_RESPONSES,
        "medium",
        "Hospitality working capital. No 'c' answers, but the full EHS section scored 'b' — genset emissions with no monitoring, kitchen and greywater effluent to sewer without pre-treatment, partial waste segregation, and tanker-dependent dry-season water supply — alongside incomplete fire detection in the older block. That sets the Environmental and Social Risk Rating to MEDIUM. Per NRB ESRM Guideline 2022 §7.3.6, a MEDIUM rating escalates to the one-level higher related credit approval authority even with no 'c' answers recorded. Recommend approval with the effluent pre-treatment and fire-detection upgrades recorded as covenants.",
      );
      if (err) {
        return NextResponse.json({ error: `[${tenant.id}] ${err}` }, { status: 500 });
      }
      extraScreeningsLen += 1;
    }

    // 6) Assign both seeded loans to the officer so the manager tour
    // shows owners and so the officer's queue has both under "In review".
    // Cement is the escalated case (drives the escalation banner); hydro
    // is the Green-taxonomy case (drives the taxonomy walkthrough — the
    // tour step "the manager clicks into a hydro borrower" needs an
    // assigned loan to click into). Brick is the small-critical loan
    // if the synthesizer produced one this build.
    const assignmentLoanIds = [CEMENT_LOAN_ID, HYDRO_LOAN_ID];
    if (BRICK_LOAN_ID) assignmentLoanIds.push(BRICK_LOAN_ID);
    if (HYDRO_PF_LOAN_ID) assignmentLoanIds.push(HYDRO_PF_LOAN_ID);
    if (HOTEL_LOAN_ID) assignmentLoanIds.push(HOTEL_LOAN_ID);
    for (const loanId of assignmentLoanIds) {
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

    // 6b) Bulk-classify every commercial + corporate loan (excluding the
    // two hand-crafted rows) so the NRB Green Finance Taxonomy PDF /
    // xlsx exports and the NRBSIS Annex 4b filing show realistic
    // aggregates instead of "1 Green, 1 Amber". Uses the synthesizer's
    // per-loan `nrbTaxonomy` colour (which already applies plausible
    // sector logic) as the source of truth for auto-classification.
    // Activity id resolved via suggestActivitiesForSector; loans without
    // a matching activity are skipped rather than persisted as junk.
    let bulkClassifiedCount = 0;
    {
      // Purge prior bulk-seed rows from this run's target range so re-runs
      // don't pile up duplicates. Preserves the hand-crafted Hongshi +
      // Himal Power rows (different loan IDs).
      const commercialCorporateLoans = demoData.loans.filter(
        (l) =>
          (l.category?.startsWith("commercial-") ||
            l.category?.startsWith("corporate-")) &&
          l.id !== CEMENT_LOAN_ID &&
          l.id !== HYDRO_LOAN_ID,
      );
      const bulkLoanIds = commercialCorporateLoans.map((l) => l.id);
      if (bulkLoanIds.length > 0) {
        // Wipe in chunks — Supabase `in()` handles up to ~1000 comfortably.
        const CHUNK = 500;
        for (let i = 0; i < bulkLoanIds.length; i += CHUNK) {
          const slice = bulkLoanIds.slice(i, i + CHUNK);
          const { error } = await supabase
            .from("bfi_taxonomy_assessments")
            .delete()
            .eq("bank_id", tenant.id)
            .in("loan_id", slice);
          if (error) {
            return NextResponse.json(
              { error: `[${tenant.id}] Bulk taxonomy wipe failed: ${error.message}` },
              { status: 500 },
            );
          }
        }
      }

      // Build insert rows.
      const bulkRows: Array<Record<string, unknown>> = [];
      for (const loan of commercialCorporateLoans) {
        const borrower = demoData.borrowers.find(
          (b) => b.id === loan.borrowerId,
        );
        if (!borrower) continue;
        const activities = suggestActivitiesForSector(borrower.nrbSector);
        const activityId = activities[0]?.id ?? null;
        if (!activityId) continue; // no activity match — leave unclassified
        // Trust the synthesizer's colour. It already handles the special
        // cases (cement never Green, fossil always Red, hydro Green when
        // small, etc.). See lib/data/portfolio.ts taxonomyForLoan.
        const color = loan.nrbTaxonomy; // 'green' | 'amber' | 'red' | 'unclassified'
        if (color === "unclassified") continue; // don't persist unclassified
        bulkRows.push({
          bank_id: tenant.id,
          loan_id: loan.id,
          borrower_id: loan.borrowerId,
          officer_id: officer.id,
          activity_id: activityId,
          criterion_answers: {},
          computed_color: color,
          computed_rationale:
            "Auto-classified from borrower sector + NRB Green Finance Taxonomy 2024 sector logic. Not officer-reviewed — bulk-seed pass for annual filing aggregates. Individual officer verification pending for exposures selected for detailed review.",
          citation: "NRB GFT 2024 (auto-classification per sector default)",
        });
      }

      // Insert in chunks. Supabase POST limits payload size but 500-row
      // chunks stay well under the default cap.
      const INSERT_CHUNK = 500;
      for (let i = 0; i < bulkRows.length; i += INSERT_CHUNK) {
        const slice = bulkRows.slice(i, i + INSERT_CHUNK);
        const { error } = await supabase
          .from("bfi_taxonomy_assessments")
          .insert(slice);
        if (error) {
          return NextResponse.json(
            { error: `[${tenant.id}] Bulk taxonomy insert failed (chunk ${i}): ${error.message}` },
            { status: 500 },
          );
        }
      }
      bulkClassifiedCount = bulkRows.length;
    }

    // 6c) Seed PCAF Data Availability overrides so the PCAF collection
    // panel on the borrower workbench has real analyst-confirmed state.
    // Hongshi shows Score 1 (verified reporting); Himal Power shows
    // Score 3 (physical activity × emission factor). Wiped + re-inserted
    // on every seed run.
    let pcafAvailabilityCount = 0;
    {
      for (const seed of PCAF_AVAILABILITY_SEEDS) {
        const borrowerId =
          seed.borrowerKey === "cement" ? CEMENT_BORROWER_ID : HYDRO_BORROWER_ID;
        const { error: delErr } = await supabase
          .from("bfi_pcaf_availability")
          .delete()
          .eq("bank_id", tenant.id)
          .eq("borrower_id", borrowerId);
        if (delErr) {
          return NextResponse.json(
            { error: `[${tenant.id}] PCAF availability wipe (${seed.borrowerKey}) failed: ${delErr.message}` },
            { status: 500 },
          );
        }
        const { error: insErr } = await supabase
          .from("bfi_pcaf_availability")
          .insert({
            bank_id: tenant.id,
            borrower_id: borrowerId,
            ...seed.flags,
            evidence_note: seed.evidence_note,
            pcaf_citation: seed.pcaf_citation,
            captured_by: officer.id,
          });
        if (insErr) {
          return NextResponse.json(
            { error: `[${tenant.id}] PCAF availability insert (${seed.borrowerKey}) failed: ${insErr.message}` },
            { status: 500 },
          );
        }
        pcafAvailabilityCount += 1;
      }
    }

    // 6d) Seed the tenant settings row. Default tenant gets all defaults
    // (empty settings blob — resolveSettings() fills from DEFAULT_SETTINGS
    // at read time). Laxmi Sunrise gets Section 3 remarks required per
    // Willard's stated ask. Any additional tenant-specific overrides
    // land in this table over time.
    const tenantSettingsBlob: Record<string, unknown> =
      tenant.id === "laxmi_sunrise"
        ? {
            esrm: {
              remarksRequired: {
                section3: true,
              },
            },
          }
        : {};
    let tenantSettingsCount = 0;
    {
      const { error } = await supabase
        .from("bfi_tenant_settings")
        .upsert(
          {
            bank_id: tenant.id,
            settings: tenantSettingsBlob,
            updated_by: officer.id,
          },
          { onConflict: "bank_id" },
        );
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Tenant settings upsert failed: ${error.message}` },
          { status: 500 },
        );
      }
      tenantSettingsCount = 1;
    }

    // 7) Insert NRB Circular 22 Annex 2 doc-matrix statuses for the
    // Himal Power hydropower loan. Gives the hydro documentation panel
    // something concrete to render at demo time.
    const hydroDocRows = HYDRO_DOC_STATUSES.map((s) => ({
      bank_id: tenant.id,
      loan_id: HYDRO_LOAN_ID,
      borrower_id: HYDRO_BORROWER_ID,
      officer_id: officer.id,
      document_id: s.documentId,
      status: s.status,
      notes: s.notes,
    }));
    {
      const { error } = await supabase
        .from("bfi_hydro_doc_status")
        .upsert(hydroDocRows, { onConflict: "bank_id,loan_id,document_id" });
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Hydro doc-status insert failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    // 8) Seed the escalated cement loan's Corrective Action Plan +
    // covenants + one past monitoring cycle so the CAP panel has real
    // state at demo time. Uses realistic dates keyed off `now` so the
    // reminder engine (P26) has a mix of overdue / due-soon / not-yet
    // items to surface.
    const now_dt = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, days: number) => {
      const c = new Date(d);
      c.setDate(c.getDate() + days);
      return c;
    };
    const addMonthsFn = (d: Date, months: number) => {
      const c = new Date(d);
      c.setMonth(c.getMonth() + months);
      return c;
    };

    const capRows = [
      // CAP item 1 — labour practices (in progress, 90 days out)
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        area_of_concern:
          "Labour practices — unsafe contract-worker conditions flagged by union reps (ESDD Q 3.2 answered 'c').",
        corrective_action:
          "Establish contractor H&S protocol + monthly worker H&S audits + third-party OHS certification (ISO 45001 or equivalent) covering all contract crews on the kiln, packing and quarry lines.",
        deadline_date: iso(addDays(now_dt, 90)),
        completion_indicator:
          "Third-party OHS audit report submitted and reviewed by the Bank; contractor protocol signed by all contract-crew leads.",
        responsible_party: "Client HR + third-party auditor",
        cost_npr: 2500000,
        status: "in_progress",
        linked_esdd_question_id: "annex5.3.2",
        created_by: officer.id,
      },
      // CAP item 2 — community H&S traffic (overdue, deadline in the past)
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        area_of_concern:
          "Community H&S — recurring complaints on heavy-vehicle traffic through Biratnagar city limits (ESDD Q 3.3 answered 'c').",
        corrective_action:
          "Committed traffic-safety measures — deceleration signage on approaches, a dedicated fenced lane through city limits, and formal community consultation on route timing.",
        deadline_date: iso(addDays(now_dt, -45)),
        completion_indicator:
          "Signed community MoU + traffic-safety plan approved by the local ward office and evidence of signage installation on site.",
        responsible_party:
          "Client operations + ward-level engagement lead",
        cost_npr: 4200000,
        // Store as in_progress so the GET-side derivation flips it to
        // overdue based on the past deadline (mirrors what a real
        // officer's row would look like right before the reminder).
        status: "in_progress",
        linked_esdd_question_id: "annex5.3.3",
        created_by: officer.id,
      },
      // CAP item 3 — quarry rehabilitation (not started, 180 days out)
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        area_of_concern:
          "Quarry rehabilitation — 2-year rehab lag on legacy quarry blocks flagged in taxonomy DNSH.",
        corrective_action:
          "Catch-up rehabilitation plan for legacy quarry blocks — 2 hectares within 6 months and a species-return survey by an external forestry consultant.",
        deadline_date: iso(addDays(now_dt, 180)),
        completion_indicator:
          "2 hectares rehabilitated and species-return survey report on file.",
        responsible_party:
          "Client environment team + external forestry consultant",
        cost_npr: 8000000,
        status: "not_started",
        linked_esdd_question_id: null,
        created_by: officer.id,
      },
    ];
    const insertedCapItemIds: string[] = [];
    {
      const { data, error } = await supabase
        .from("bfi_cap_items")
        .insert(capRows)
        .select("id");
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] CAP item insert failed: ${error.message}` },
          { status: 500 },
        );
      }
      for (const row of data ?? []) {
        insertedCapItemIds.push(row.id as string);
      }
    }

    const covenantRows = [
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        covenant_type: "positive",
        clause_text:
          "The Borrower shall submit to the Bank a quarterly Environmental and Social (E&S) performance report covering compliance with the E&S requirements attached to this facility, including progress against the Corrective Action Plan and any material E&S incidents during the reporting period.",
        deadline_date: null,
        status: "active",
        library_template_id: "positive.quarterly-es-report",
        created_by: officer.id,
      },
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        covenant_type: "negative",
        clause_text:
          "The Borrower shall not commence, expand or continue any operations within any protected forest area, national park, wildlife reserve, conservation area, buffer zone or other legally designated critical habitat, without the prior written consent of the Bank and the relevant Government authority.",
        deadline_date: null,
        status: "active",
        library_template_id: "negative.no-operations-protected-area",
        created_by: officer.id,
      },
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        covenant_type: "condition_precedent",
        clause_text:
          "As a condition precedent to disbursement of the next tranche, the Borrower shall provide the Bank with certified evidence of third-party Occupational Health & Safety certification (ISO 45001 or equivalent) covering the kiln, packing and quarry operations.",
        deadline_date: iso(addDays(now_dt, 90)),
        status: "active",
        library_template_id: "condition_precedent.permits-on-file",
        created_by: officer.id,
      },
      {
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        covenant_type: "event_of_default",
        clause_text:
          "Any confirmed instance of child labour or forced labour at any facility owned or operated by the Borrower, or any subcontractor engaged in the financed activities, shall constitute an Event of Default. The Borrower shall have thirty (30) days from written notification by the Bank to fully remediate the finding, failing which the Bank may cancel the facility and declare all amounts owed immediately due and payable.",
        deadline_date: null,
        status: "active",
        library_template_id: "event_of_default.child-forced-labor",
        created_by: officer.id,
      },
    ];
    {
      const { error } = await supabase
        .from("bfi_covenants")
        .insert(covenantRows);
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Covenant insert failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    // One past monitoring cycle so the panel has history + next_due_date
    // ~30 days out (P26 will surface it as "Due this month").
    const monReportingEnd = addMonthsFn(now_dt, -3);
    const monReportingStart = addMonthsFn(now_dt, -6);
    const monNextDue = addDays(now_dt, 30);
    const monChecklist: Record<string, { response: string; flag: string }> = {
      "annex10.1": { response: `${iso(monReportingStart)} → ${iso(monReportingEnd)}`, flag: "ok" },
      "annex10.2": { response: "Operation stage — kiln + packing lines running at nameplate capacity.", flag: "ok" },
      "annex10.3": { response: "No location changes; Khimti-II tie-in still pending amendment.", flag: "ok" },
      "annex10.4": {
        response:
          "Labour CAP on track (in progress); quarry rehab CAP not yet started (deadline within timeframe); community H&S traffic-safety plan behind schedule — vendor not selected as of period end.",
        flag: "issue",
      },
      "annex10.5": { response: "No spills or explosions reported. One minor near-miss (packing line pallet drop) logged with root cause + remediation.", flag: "ok" },
      "annex10.6": { response: "No new regulatory fines during the period.", flag: "ok" },
      "annex10.7": {
        response:
          "Two minor recordable injuries on packing line (both LTI < 3 days). Root cause: ergonomic. Corrective PPE + procedure change implemented.",
        flag: "issue",
      },
      "annex10.8": { response: "No new E&S risks beyond those already tracked in the CAP.", flag: "ok" },
      "annex10.9": { response: "Pollution Control Certificate valid through 2027-06; Fire Safety valid through 2026-11; NS cement certifications current.", flag: "ok" },
      "annex10.10": { response: "ISO 14001 current; SA8000 not held (recommended as part of the OHS CAP).", flag: "ok" },
      "annex10.11": {
        response:
          "Ongoing community complaints on heavy-vehicle traffic through Biratnagar — see CAP item 2. Client held one community meeting during the period but no route-timing MoU signed.",
        flag: "issue",
      },
      "annex10.12": { response: "Stakeholder consultation limited to the traffic complaint referenced above.", flag: "ok" },
      "annex10.13": { response: "Waste-heat recovery cogen unit operated at 92% availability during the period.", flag: "ok" },
    };
    {
      const { error } = await supabase.from("bfi_monitoring_reports").insert({
        bank_id: tenant.id,
        loan_id: CEMENT_LOAN_ID,
        borrower_id: CEMENT_BORROWER_ID,
        reporting_period_start: iso(monReportingStart),
        reporting_period_end: iso(monReportingEnd),
        next_due_date: iso(monNextDue),
        frequency_months: 3,
        covenant_compliance_status: "partial",
        cap_compliance_status: "partial",
        notes:
          "Two CAP items on track (labour, quarry); community H&S traffic-safety plan behind schedule; requires escalation to credit committee if next reporting cycle shows no progress.",
        checklist_snapshot: monChecklist,
        submitted_by: officer.id,
      });
      if (error) {
        return NextResponse.json(
          { error: `[${tenant.id}] Monitoring report insert failed: ${error.message}` },
          { status: 500 },
        );
      }
    }

    // 9) Seed a couple of demo evidence attachments so the evidence
    // panel isn't empty on first demo. One tiny PDF on the first
    // Hongshi CAP item (labour audit corrective action) + one plain
    // text file on the Himal Power ESDD Section 3 (Q 3.1 community
    // consultation) remarks. Table may not exist on older DBs — errors
    // are treated as non-fatal so seeding still succeeds.
    let evidenceAttachmentsCount = 0;
    {
      // Minimal but valid single-page PDF (~430 bytes). Rendered as a
      // blank page by any reader — the point is that it downloads and
      // opens as a real PDF, not that it contains audit content.
      const fakePdf = Buffer.from(
        [
          "%PDF-1.4",
          "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
          "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
          "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<<>>>>endobj",
          "4 0 obj<</Length 44>>stream",
          "BT /F1 12 Tf 72 720 Td (Q3.2 labour audit CAP) Tj ET",
          "endstream endobj",
          "xref",
          "0 5",
          "0000000000 65535 f",
          "0000000010 00000 n",
          "0000000053 00000 n",
          "0000000099 00000 n",
          "0000000173 00000 n",
          "trailer<</Size 5/Root 1 0 R>>",
          "startxref",
          "268",
          "%%EOF",
          "",
        ].join("\n"),
        "utf8",
      );
      const fakeTxt = Buffer.from(
        [
          "Himal Power — Khimti site visit note, 2026-03-14",
          "-----------------------------------------------",
          "Visited ward office. Reviewed the community consultation log",
          "maintained by the environment team. Sample MoU with downstream",
          "user committee reviewed on site — signed 2025-11.",
          "",
          "No outstanding grievances on the current register.",
          "Next quarterly consultation scheduled for 2026-06.",
          "",
          "— T. Rana, ESG officer",
        ].join("\n"),
        "utf8",
      );

      const attachmentRows: Array<Record<string, unknown>> = [];
      // Hongshi CAP item 1 (labour) attachment — PDF.
      if (insertedCapItemIds[0]) {
        attachmentRows.push({
          bank_id: tenant.id,
          entity_type: "cap_item",
          entity_id: insertedCapItemIds[0],
          field_key: "evidence",
          filename: "hongshi-labour-audit-corrective-action.pdf",
          mime_type: "application/pdf",
          size_bytes: fakePdf.byteLength,
          data: "\\x" + fakePdf.toString("hex"),
          uploaded_by: officer.id,
        });
      }
      // Himal Power ESDD Section 3 Q 3.1 (community consultation)
      // attachment — plain text.
      attachmentRows.push({
        bank_id: tenant.id,
        entity_type: "esdd",
        entity_id: HYDRO_LOAN_ID,
        field_key: "annex5.3.1",
        filename: "himal-power-community-consultation-note.txt",
        mime_type: "text/plain",
        size_bytes: fakeTxt.byteLength,
        data: "\\x" + fakeTxt.toString("hex"),
        uploaded_by: officer.id,
      });

      if (attachmentRows.length > 0) {
        const { error } = await supabase
          .from("bfi_evidence_attachments")
          .insert(attachmentRows);
        if (error) {
          console.warn(
            `[${tenant.id}] Evidence attachment seed skipped: ${error.message}`,
          );
        } else {
          evidenceAttachmentsCount = attachmentRows.length;
        }
      }
    }

    perTenantResults.push({
      tenant: tenant.id,
      officer: officer.id,
      seeded: {
        esddResponses: responseRows.length + brickResponsesLen,
        esrmScreenings: 1 + brickScreeningsLen + extraScreeningsLen,
        taxonomyAssessments: 2 + bulkClassifiedCount,
        bulkClassifiedCount,
        loanAssignments: BRICK_LOAN_ID ? 3 : 2,
        hydroDocStatuses: hydroDocRows.length,
        tenantSettings: tenantSettingsCount,
        pcafAvailability: pcafAvailabilityCount,
        capItems: capRows.length,
        covenants: covenantRows.length,
        monitoringReports: 1,
        evidenceAttachments: evidenceAttachmentsCount,
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
      brick: BRICK_LOAN_ID,
    },
  });
}
