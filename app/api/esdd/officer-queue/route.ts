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
import { sectorSlugFor } from "@/lib/regulatory/esdd/sector-slug";
import { isTaxonomyExpected } from "@/lib/regulatory/taxonomy/applicability";
import { findActivityById } from "@/lib/regulatory/taxonomy/activities";

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
  // 3. Assignments — determines the "awaiting" set.
  // ------------------------------------------------------------------
  const { data: myAssigns } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_id")
    .eq("bank_id", tenant.id)
    .eq("officer_id", officer.id);
  const assignedLoanIds = new Set((myAssigns ?? []).map((a) => a.loan_id));

  // ------------------------------------------------------------------
  // 4. Determine the candidate loan set for this officer:
  //    - Every loan they've touched (from byLoan)
  //    - Every loan currently assigned to them
  //    - Fallback: top-N under-review loans if no assignments and no touches
  // ------------------------------------------------------------------
  const candidateLoanIds = new Set<string>();
  for (const id of byLoan.keys()) candidateLoanIds.add(id);
  for (const id of assignedLoanIds) candidateLoanIds.add(id);

  if (candidateLoanIds.size === 0) {
    const applications = applicationQueue(data, AWAITING_SLICE);
    for (const app of applications) candidateLoanIds.add(app.loan.id);
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
  // 6. Build a LoanCard for every candidate loan, then bucket.
  // ------------------------------------------------------------------
  const cards: LoanCard[] = [];
  for (const loanId of candidateLoanIds) {
    const loan = loanById.get(loanId);
    if (!loan) continue;
    const borrower = borrowerById.get(loan.borrowerId);
    if (!borrower) continue;

    const slug = sectorSlugFor(borrower.nrbSector);
    const total = fullChecklist(slug).length;
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

    // Reason string for the card header — human summary of what needs
    // to happen next. Priority ordering matches how the card gets bucketed.
    let reason = "";
    if (escalated) {
      reason = "Escalated to credit committee";
    } else if (!esddDone && answered === 0) {
      reason = "ESDD checklist not started";
    } else if (!esddDone && answered > 0) {
      reason = `ESDD checklist ${answered}/${total} answered`;
    } else if (esddDone && taxApplicable && !taxDone) {
      reason = "ESDD complete — taxonomy classification pending";
    } else {
      reason = "Ready for review";
    }

    cards.push({
      loanId,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      sector: borrower.nrbSector,
      outstandingNpr: loan.outstandingNpr,
      lastActivityAt:
        esddAgg?.lastActivityAt ?? tax?.capturedAt ?? screening?.capturedAt ?? null,
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
    });
  }

  const needsAttention: LoanCard[] = [];
  const inReview: LoanCard[] = [];
  const recentlyClosed: LoanCard[] = []; // stub — needs a loan-status change model

  for (const c of cards) {
    const esddDone = c.esdd.riskClass !== null;
    const taxOk = !c.taxonomy.applicable || c.taxonomy.color !== null;
    if (c.esdd.escalated) {
      needsAttention.push(c);
    } else if (esddDone && taxOk) {
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

  return NextResponse.json({
    ok: true,
    officer: { id: officer.id, name: officer.name, role: officer.role },
    needsAttention,
    inReview,
    recentlyClosed,
  });
}
