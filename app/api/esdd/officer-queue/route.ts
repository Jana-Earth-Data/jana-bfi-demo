/**
 * GET /api/esdd/officer-queue
 *
 * Loan-oriented view of the signed-in officer's work. One row per loan
 * that carries the officer's ESDD state AND (when applicable) the
 * loan's taxonomy state. The officer's work isn't split by flow — it's
 * split by loan status.
 *
 * Response shape:
 *   {
 *     officer:         { id, name, role },
 *     needsAttention:  LoanCard[],   // anything mandatory is incomplete or escalated
 *     inReview:        LoanCard[],   // both required flows saved; awaiting manager/committee
 *     recentlyClosed:  LoanCard[],   // loans no longer under-review (stub for now)
 *   }
 *
 * LoanCard = one row per loan with combined ESDD + Taxonomy state and a
 * short reason string explaining why the card sits in its section.
 *
 * Assignment logic:
 *   - When the officer has any loans assigned via bfi_loan_assignments,
 *     "awaiting" candidates are drawn from their assignments only.
 *   - Otherwise (early demo state), fall back to the top-N under-review
 *     loans so the queue is never empty.
 */

import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import { applicationQueue } from "@/lib/data/portfolio-query";
import { fullChecklist } from "@/lib/regulatory/esdd/annex5-questions";
import { isTaxonomyExpected } from "@/lib/regulatory/taxonomy/applicability";
import { findActivityById } from "@/lib/regulatory/taxonomy/activities";
import { isProjectFinanceLoan } from "@/lib/regulatory/esdd/pf-loan-gate";
import { ANNEX5B_ALL } from "@/lib/regulatory/esdd/annex5b-pf-questions";
import { inferEmissionsFlag } from "@/lib/regulatory/climate/infer";

export const dynamic = "force-dynamic";

const AWAITING_SLICE = 20; // fallback top-N when no assignments exist

type RiskClass = "low" | "medium" | "high" | "extreme";
type TaxColor = "green" | "amber" | "red" | "unclassified";

export type LoanCard = {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  lastActivityAt: string | null;
  reason: string;
  esdd: {
    answered: number;
    total: number;
    riskClass: RiskClass | null;
    escalated: boolean;
  };
  taxonomy: {
    applicable: boolean;
    color: TaxColor | null;
    activityId: string | null;
    activityName: string | null;
  };
  /**
   * NRB ESRM 2022 §4.3 climate flag — inferred from the borrower's
   * estimated annual emissions and reduction-target status. The loan
   * card badge fires when `aboveThreshold && !reductionTargetOnFile`.
   */
  climate: {
    aboveThreshold: boolean;
    reductionTargetOnFile: boolean;
    estimatedAnnualTco2e: number;
  };
  /**
   * NRB ESRM 2022 Annex 5b — Project Finance Screening Questionnaire
   * status. `required` is true only for Project Finance loans; on all
   * other loans the whole flow is skipped and the values are inert.
   *
   * `itemsTotal` is emitted as a constant (148 = ANNEX5B_ALL.length)
   * so the client doesn't have to import the catalog just to render
   * "Continue N/148" on the loan card.
   */
  pfScreening: {
    required: boolean;
    itemsAnswered: number;
    itemsTotal: number;
    riskClass: "low" | "medium" | "high" | "critical" | null;
    completed: boolean;
  };
  /**
   * PCAF Global GHG Standard Part A §5 data-availability confirmation.
   * Required on every loan under NFRS. The demo represents the four
   * flags as a single row in bfi_pcaf_availability (per-borrower); once
   * the row exists the four flags have been confirmed together, so
   * flagsConfirmed jumps 0 → 4 on first save.
   */
  pcafAvailability: {
    flagsConfirmed: number;
    flagsTotal: 4;
    completed: boolean;
  };
  /**
   * NRB Circular 22 §7.3.5 CAP + covenants + monitoring status.
   *
   * Populated for every candidate loan, but the loan card only renders
   * the CAP CTA when the loan's ESRR risk class is Medium / High /
   * Extreme (§7.3.5 does not require a CAP for Low-risk loans).
   *
   * `total`     — count of bfi_cap_items rows for this loan
   * `completed` — subset with status = 'completed'
   * `overdue`   — subset with status != 'completed' AND deadline < today
   *               (matches the projection GET /api/cap/[loanId] applies)
   */
  cap: {
    total: number;
    completed: number;
    overdue: number;
  };
};

export async function GET() {
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
      { error: "Officer must be selected before viewing the queue." },
      { status: 401 },
    );
  }

  // Pull demo loans + borrowers upfront so we can look up meta by id.
  const data = await getBfiDemoData();
  const loanById = new Map(data.loans.map((l) => [l.id, l]));
  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));

  // ------------------------------------------------------------------
  // 1. Officer's ESDD activity, grouped per loan.
  // ------------------------------------------------------------------
  const { data: rawResponses, error: respErr } = await supabase
    .from("bfi_esdd_responses")
    .select("loan_id, borrower_id, question_id, captured_at")
    .eq("bank_id", tenant.id)
    .eq("officer_id", officer.id)
    .order("captured_at", { ascending: false });
  if (respErr) {
    return NextResponse.json(
      { error: `Response query failed: ${respErr.message}` },
      { status: 500 },
    );
  }
  type Agg = {
    loanId: string;
    borrowerId: string;
    distinctQuestionIds: Set<string>;
    lastActivityAt: string;
  };
  const byLoan = new Map<string, Agg>();
  for (const r of rawResponses ?? []) {
    const existing = byLoan.get(r.loan_id);
    if (existing) {
      existing.distinctQuestionIds.add(r.question_id);
    } else {
      byLoan.set(r.loan_id, {
        loanId: r.loan_id,
        borrowerId: r.borrower_id,
        distinctQuestionIds: new Set([r.question_id]),
        lastActivityAt: r.captured_at,
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. Latest ESRM screening per loan (tenant-wide — screenings are
  //    attributed to whoever saved them, but the flow is bank-wide).
  // ------------------------------------------------------------------
  const touchedLoanIds = Array.from(byLoan.keys());
  const { data: screenings, error: scrErr } = await supabase
    .from("bfi_esrm_screenings")
    .select("loan_id, computed_risk_class, escalation_flag, captured_at")
    .eq("bank_id", tenant.id)
    .in("loan_id", touchedLoanIds.concat(["__never__"]))
    .order("captured_at", { ascending: false });
  if (scrErr) {
    return NextResponse.json(
      { error: `Screening query failed: ${scrErr.message}` },
      { status: 500 },
    );
  }
  const screeningByLoan = new Map<
    string,
    { riskClass: RiskClass; escalated: boolean; capturedAt: string }
  >();
  for (const s of screenings ?? []) {
    if (screeningByLoan.has(s.loan_id)) continue;
    screeningByLoan.set(s.loan_id, {
      riskClass: s.computed_risk_class as RiskClass,
      escalated: s.escalation_flag,
      capturedAt: s.captured_at,
    });
  }

  // ------------------------------------------------------------------
  // 3. Assignments — pull ALL assignments for this tenant so we know
  //    which loans have an owner (any officer) versus which are
  //    unassigned and free to pick up.
  // ------------------------------------------------------------------
  const { data: allAssigns } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_id, officer_id")
    .eq("bank_id", tenant.id);
  const assignedLoanIds = new Set<string>();
  const myAssignedLoanIds = new Set<string>();
  for (const a of allAssigns ?? []) {
    assignedLoanIds.add(a.loan_id);
    if (a.officer_id === officer.id) myAssignedLoanIds.add(a.loan_id);
  }

  // ------------------------------------------------------------------
  // 4. Determine the candidate loan set for this officer. Three
  //    complementary sources — a loan appearing in any of them
  //    belongs on this officer's queue:
  //
  //    (a) Every loan they've personally touched
  //        (their attribution + prior work)
  //    (b) Every loan currently assigned to them
  //        (their explicit ownership)
  //    (c) Every under-review loan that is NOT assigned to anyone
  //        (available to pick up — otherwise unassigned work is
  //        invisible after the first assignment lands)
  //
  //    (c) is the fix for "Sujata's queue emptied out after seed
  //    assigned her one loan" — without it, the moment any officer
  //    gets even one assignment their view of the free pool
  //    disappears.
  // ------------------------------------------------------------------
  const candidateLoanIds = new Set<string>();
  for (const id of byLoan.keys()) candidateLoanIds.add(id);
  for (const id of myAssignedLoanIds) candidateLoanIds.add(id);
  const underReview = applicationQueue(data, AWAITING_SLICE * 4);
  for (const app of underReview) {
    if (!assignedLoanIds.has(app.loan.id)) {
      candidateLoanIds.add(app.loan.id);
    }
  }

  // ------------------------------------------------------------------
  // 5. Taxonomy assessments for the candidate set (tenant-wide latest).
  // ------------------------------------------------------------------
  const candidateArray = Array.from(candidateLoanIds);
  const { data: taxRows, error: taxErr } =
    candidateArray.length > 0
      ? await supabase
          .from("bfi_taxonomy_assessments")
          .select("loan_id, activity_id, computed_color, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
          .order("captured_at", { ascending: false })
      : { data: [], error: null };
  if (taxErr) {
    return NextResponse.json(
      { error: `Taxonomy query failed: ${taxErr.message}` },
      { status: 500 },
    );
  }
  const taxByLoan = new Map<
    string,
    { activityId: string; color: TaxColor; capturedAt: string }
  >();
  for (const t of taxRows ?? []) {
    if (taxByLoan.has(t.loan_id)) continue;
    taxByLoan.set(t.loan_id, {
      activityId: t.activity_id,
      color: t.computed_color as TaxColor,
      capturedAt: t.captured_at,
    });
  }

  // ------------------------------------------------------------------
  // 5b. Annex 5b PF-screening state for the candidate set.
  //
  // Two queries:
  //   (a) count distinct item_ids per loan on bfi_pf_screening_responses
  //       (via full row fetch since Supabase JS lacks GROUP BY)
  //   (b) latest bfi_pf_screening_results row per loan
  // ------------------------------------------------------------------
  const pfTotalItems = ANNEX5B_ALL.length;
  const { data: pfRespRows, error: pfRespErr } =
    candidateArray.length > 0
      ? await supabase
          .from("bfi_pf_screening_responses")
          .select("loan_id, item_id, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
          .order("captured_at", { ascending: false })
      : { data: [], error: null };
  if (pfRespErr) {
    return NextResponse.json(
      { error: `PF response query failed: ${pfRespErr.message}` },
      { status: 500 },
    );
  }
  const pfAnsweredByLoan = new Map<string, Set<string>>();
  const pfLastActivityByLoan = new Map<string, string>();
  for (const row of pfRespRows ?? []) {
    let set = pfAnsweredByLoan.get(row.loan_id);
    if (!set) {
      set = new Set<string>();
      pfAnsweredByLoan.set(row.loan_id, set);
      pfLastActivityByLoan.set(row.loan_id, row.captured_at);
    }
    set.add(row.item_id);
  }
  const { data: pfResults, error: pfResErr } =
    candidateArray.length > 0
      ? await supabase
          .from("bfi_pf_screening_results")
          .select("loan_id, computed_risk_class, items_flagged, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
          .order("captured_at", { ascending: false })
      : { data: [], error: null };
  if (pfResErr) {
    return NextResponse.json(
      { error: `PF result query failed: ${pfResErr.message}` },
      { status: 500 },
    );
  }
  const pfResultByLoan = new Map<
    string,
    { riskClass: "low" | "medium" | "high" | "critical"; capturedAt: string }
  >();
  for (const r of pfResults ?? []) {
    if (pfResultByLoan.has(r.loan_id)) continue;
    pfResultByLoan.set(r.loan_id, {
      riskClass: r.computed_risk_class as
        | "low"
        | "medium"
        | "high"
        | "critical",
      capturedAt: r.captured_at,
    });
  }

  // ------------------------------------------------------------------
  // 5c. PCAF data-availability confirmation (per BORROWER, not per
  // loan). One row in bfi_pcaf_availability means the officer has
  // saved the four §5 flags together for that borrower. Batched into a
  // single tenant-scoped query for every borrower in the candidate set
  // to avoid an N+1.
  // ------------------------------------------------------------------
  const candidateBorrowerIds = Array.from(
    new Set(
      Array.from(candidateLoanIds)
        .map((id) => loanById.get(id)?.borrowerId)
        .filter((v): v is string => typeof v === "string"),
    ),
  );
  const { data: pcafRows, error: pcafErr } =
    candidateBorrowerIds.length > 0
      ? await supabase
          .from("bfi_pcaf_availability")
          .select("borrower_id")
          .eq("bank_id", tenant.id)
          .in("borrower_id", candidateBorrowerIds)
      : { data: [], error: null };
  if (pcafErr) {
    return NextResponse.json(
      { error: `PCAF availability query failed: ${pcafErr.message}` },
      { status: 500 },
    );
  }
  const pcafConfirmedBorrowerIds = new Set<string>();
  for (const row of pcafRows ?? []) {
    pcafConfirmedBorrowerIds.add(row.borrower_id);
  }

  // ------------------------------------------------------------------
  // 5d. CAP items per loan (P44). One batched query for the whole
  // candidate set — count total / completed / overdue per loan so the
  // loan card can label its CTA "Start CAP" / "Continue N/M" /
  // "Review CAP" without an N+1. Overdue projection matches the same
  // rule GET /api/cap/[loanId] applies at read time (status !=
  // 'completed' AND deadline_date < today).
  // ------------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  const { data: capRows, error: capErr } =
    candidateArray.length > 0
      ? await supabase
          .from("bfi_cap_items")
          .select("loan_id, status, deadline_date")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
      : { data: [], error: null };
  if (capErr) {
    return NextResponse.json(
      { error: `CAP item query failed: ${capErr.message}` },
      { status: 500 },
    );
  }
  type CapAgg = { total: number; completed: number; overdue: number };
  const capByLoan = new Map<string, CapAgg>();
  for (const row of capRows ?? []) {
    const agg = capByLoan.get(row.loan_id) ?? {
      total: 0,
      completed: 0,
      overdue: 0,
    };
    agg.total += 1;
    if (row.status === "completed") {
      agg.completed += 1;
    } else if (row.deadline_date && row.deadline_date < today) {
      agg.overdue += 1;
    }
    capByLoan.set(row.loan_id, agg);
  }

  // ------------------------------------------------------------------
  // 6. Build a LoanCard for every candidate loan, then bucket.
  // ------------------------------------------------------------------
  const cards: LoanCard[] = [];
  for (const loanId of candidateLoanIds) {
    const loan = loanById.get(loanId);
    if (!loan) continue;
    const borrower = borrowerById.get(loan.borrowerId);
    if (!borrower) continue;

    // Circular 22: 12-question sector-agnostic checklist. No supplement.
    const total = fullChecklist().length;
    const esddAgg = byLoan.get(loanId);
    const answered = esddAgg?.distinctQuestionIds.size ?? 0;
    const screening = screeningByLoan.get(loanId);
    const taxApplicable = isTaxonomyExpected(borrower.nrbSector);
    const tax = taxByLoan.get(loanId);
    const activityName = tax
      ? findActivityById(tax.activityId)?.name ?? null
      : null;

    const esddDone = screening !== undefined;
    const taxDone = tax !== undefined;
    const escalated = screening?.escalated ?? false;

    // PF screening (Annex 5b) applicability + completion state.
    const pfRequired = isProjectFinanceLoan(loan);
    const pfAnsweredSet = pfAnsweredByLoan.get(loanId);
    const pfAnswered = pfAnsweredSet?.size ?? 0;
    const pfResult = pfResultByLoan.get(loanId);
    const pfDone = pfResult !== undefined;

    // Reason string for the card header — human summary of what needs
    // to happen next. Priority ordering matches how the card gets bucketed.
    // Annex 5b PF screening state weaves in only for Project-Finance loans:
    // a PF loan is NOT ready-for-review until the Annex 5b screening
    // completes.
    let reason = "";
    if (escalated) {
      reason = "Escalated to credit committee";
    } else if (!esddDone && answered === 0) {
      reason = "ESDD checklist not started";
    } else if (!esddDone && answered > 0) {
      reason = `ESDD checklist ${answered}/${total} answered`;
    } else if (pfRequired && !pfDone) {
      // ESDD is done, but this is a Project-Finance loan and Annex 5b is
      // still open — flag PF screening as the next required step.
      reason =
        pfAnswered === 0
          ? "PF screening pending (Annex 5b not started)"
          : `PF screening pending (${pfAnswered}/${pfTotalItems} Annex 5b items answered)`;
    } else if (esddDone && taxApplicable && !taxDone) {
      reason = "ESDD complete — taxonomy classification pending";
    } else {
      reason = "Ready for review";
    }

    const climateFlag = inferEmissionsFlag(borrower);

    cards.push({
      loanId,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      sector: borrower.nrbSector,
      outstandingNpr: loan.outstandingNpr,
      lastActivityAt:
        esddAgg?.lastActivityAt ??
        pfLastActivityByLoan.get(loanId) ??
        tax?.capturedAt ??
        screening?.capturedAt ??
        null,
      reason,
      esdd: {
        answered,
        total,
        riskClass: screening?.riskClass ?? null,
        escalated,
      },
      taxonomy: {
        applicable: taxApplicable,
        color: tax?.color ?? null,
        activityId: tax?.activityId ?? null,
        activityName,
      },
      climate: {
        aboveThreshold: climateFlag.exceedsReportingThreshold,
        reductionTargetOnFile: climateFlag.reductionTargetOnFile,
        estimatedAnnualTco2e: climateFlag.estimatedAnnualTco2e,
      },
      pfScreening: {
        required: pfRequired,
        itemsAnswered: pfAnswered,
        itemsTotal: pfTotalItems,
        riskClass: pfResult?.riskClass ?? null,
        completed: pfDone,
      },
      pcafAvailability: {
        // The four §5 flags are saved as a single row per borrower —
        // the row's presence means the officer has confirmed the set.
        flagsConfirmed: pcafConfirmedBorrowerIds.has(borrower.id) ? 4 : 0,
        flagsTotal: 4,
        completed: pcafConfirmedBorrowerIds.has(borrower.id),
      },
      cap: capByLoan.get(loanId) ?? { total: 0, completed: 0, overdue: 0 },
    });
  }

  const needsAttention: LoanCard[] = [];
  const inReview: LoanCard[] = [];
  const recentlyClosed: LoanCard[] = []; // stub — needs a loan-status change model

  for (const c of cards) {
    const esddDone = c.esdd.riskClass !== null;
    const taxOk = !c.taxonomy.applicable || c.taxonomy.color !== null;
    // Annex 5b PF screening: for Project-Finance loans, the loan is not
    // ready-for-review until the Annex 5b screening is complete AND has
    // not been auto-escalated to CRITICAL. NRB ESRM 2022 requires both
    // the sector-agnostic Annex 5 flow AND the Annex 5b PF questionnaire.
    const pfOk = !c.pfScreening.required || c.pfScreening.completed;
    const pfCritical =
      c.pfScreening.required && c.pfScreening.riskClass === "critical";
    if (c.esdd.escalated || pfCritical) {
      needsAttention.push(c);
    } else if (esddDone && taxOk && pfOk) {
      inReview.push(c);
    } else {
      needsAttention.push(c);
    }
  }

  // Ordering: needs-attention by last-activity desc (recent first),
  // then in-review by last-activity desc (most recent completion first).
  needsAttention.sort((a, b) => {
    // Escalated bubbles to top.
    if (a.esdd.escalated !== b.esdd.escalated)
      return a.esdd.escalated ? -1 : 1;
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });
  inReview.sort((a, b) => {
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });

  // ------------------------------------------------------------------
  // P36 — split the cards into two officer-facing sections:
  //
  //   myLoans          = loans owned by this officer (assigned via
  //                      bfi_loan_assignments) OR touched by this
  //                      officer (has attributed ESDD activity). Every
  //                      compliance CTA is available.
  //   availableToClaim = loans currently unassigned and untouched by
  //                      this officer. Renders as a simple row with an
  //                      Open CTA — clicking navigates to the wizard,
  //                      which auto-claims on load.
  //
  // A loan the officer has touched but not yet been auto-claimed for
  // (should be rare given P34/P36) stays in myLoans.
  // ------------------------------------------------------------------
  const myLoans: LoanCard[] = [];
  const availableToClaim: LoanCard[] = [];
  for (const c of cards) {
    const owned = myAssignedLoanIds.has(c.loanId);
    const touched = byLoan.has(c.loanId);
    if (owned || touched) {
      myLoans.push(c);
    } else if (!assignedLoanIds.has(c.loanId)) {
      availableToClaim.push(c);
    }
    // Loans assigned to a different officer are intentionally excluded
    // from both sections — the officer picker / manager reassignment
    // paths are how those become visible.
  }
  // My loans: escalated first, then most-recently-active first.
  myLoans.sort((a, b) => {
    if (a.esdd.escalated !== b.esdd.escalated)
      return a.esdd.escalated ? -1 : 1;
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });
  // Available: newest applications first (proxy via lastActivityAt);
  // this is stable-ish for the demo without a loan-created timestamp.
  availableToClaim.sort((a, b) => {
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at) || a.borrowerName.localeCompare(b.borrowerName);
  });

  return NextResponse.json({
    ok: true,
    officer: { id: officer.id, name: officer.name, role: officer.role },
    // New split view (P36).
    myLoans,
    availableToClaim,
    // Legacy fields — kept for callers that haven't migrated to the
    // split view. Compute unchanged.
    needsAttention,
    inReview,
    recentlyClosed,
  });
}
