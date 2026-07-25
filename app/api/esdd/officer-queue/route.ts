/**
 * GET /api/esdd/officer-queue
 *
 * Returns the current officer's pending ESRM work list, drawn from two
 * sources:
 *   1. In-progress: distinct loans this officer has ESDD responses for,
 *      with response count and last activity timestamp.
 *   2. Awaiting start: top N under-review loans (from the demo data)
 *      that this officer has NOT started yet.
 *
 * Loans that already have a saved ESRM screening in bfi_esrm_screenings
 * are marked `state = "complete"` so the queue can visually distinguish
 * finished work from in-progress work.
 *
 * Requires resolved tenant + officer. Returns 401 if no officer is set.
 */

import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import { applicationQueue } from "@/lib/data/portfolio-query";
import { fullChecklist } from "@/lib/regulatory/esdd/annex5-questions";
import { sectorSlugFor } from "@/lib/regulatory/esdd/sector-slug";

export const dynamic = "force-dynamic";

const AWAITING_SLICE = 20; // top N under-review loans to surface

export type OfficerQueueRow = {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  answered: number;
  total: number;
  state: "complete" | "in-progress" | "awaiting";
  lastActivityAt: string | null;
  riskClass?: "low" | "medium" | "high" | "extreme" | null;
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

  // 1. Pull this officer's ESDD activity, grouped per loan.
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
      // captured_at was ordered desc so the first row we see is newest.
    } else {
      byLoan.set(r.loan_id, {
        loanId: r.loan_id,
        borrowerId: r.borrower_id,
        distinctQuestionIds: new Set([r.question_id]),
        lastActivityAt: r.captured_at,
      });
    }
  }

  // 2. Pull saved ESRM screenings so we can mark "complete" rows.
  const { data: screenings, error: scrErr } = await supabase
    .from("bfi_esrm_screenings")
    .select("loan_id, computed_risk_class, captured_at")
    .eq("bank_id", tenant.id)
    .in("loan_id", Array.from(byLoan.keys()).concat(["__never__"]))
    .order("captured_at", { ascending: false });
  if (scrErr) {
    return NextResponse.json(
      { error: `Screening query failed: ${scrErr.message}` },
      { status: 500 },
    );
  }
  const screeningByLoan = new Map<
    string,
    { riskClass: string; capturedAt: string }
  >();
  for (const s of screenings ?? []) {
    if (!screeningByLoan.has(s.loan_id)) {
      screeningByLoan.set(s.loan_id, {
        riskClass: s.computed_risk_class,
        capturedAt: s.captured_at,
      });
    }
  }

  // 3. Load the demo data to look up loan + borrower + sector detail.
  const data = await getBfiDemoData();
  const loanById = new Map(data.loans.map((l) => [l.id, l]));
  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));

  // 4. Build in-progress + complete rows from the officer's response set.
  const rows: OfficerQueueRow[] = [];
  for (const agg of byLoan.values()) {
    const loan = loanById.get(agg.loanId);
    const borrower = borrowerById.get(agg.borrowerId);
    if (!loan || !borrower) continue;
    const sectorSlug = sectorSlugFor(borrower.nrbSector);
    const total = fullChecklist(sectorSlug).length;
    const screening = screeningByLoan.get(agg.loanId);
    rows.push({
      loanId: agg.loanId,
      borrowerId: agg.borrowerId,
      borrowerName: borrower.name,
      sector: borrower.nrbSector,
      outstandingNpr: loan.outstandingNpr,
      answered: agg.distinctQuestionIds.size,
      total,
      state: screening
        ? "complete"
        : agg.distinctQuestionIds.size >= total
          ? "in-progress" // Answered all but not yet saved
          : "in-progress",
      lastActivityAt: agg.lastActivityAt,
      riskClass: (screening?.riskClass ?? null) as OfficerQueueRow["riskClass"],
    });
  }

  // 5. Fold in loans awaiting this officer's review.
  //
  //    Preferred source: bfi_loan_assignments where officer_id = this
  //    officer AND the officer has NOT touched the loan yet. This makes
  //    "awaiting" mean "assigned to me but I haven't started."
  //
  //    Fallback: if there are no assignments in the tenant yet (early
  //    demo state), fall back to the top-N under-review loans so the
  //    queue is not empty on first render.
  const touched = new Set(rows.map((r) => r.loanId));
  const applications = applicationQueue(data, AWAITING_SLICE * 4);
  const awaiting: OfficerQueueRow[] = [];

  const { data: myAssigns } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_id")
    .eq("bank_id", tenant.id)
    .eq("officer_id", officer.id);
  const assignedLoanIds = new Set((myAssigns ?? []).map((a) => a.loan_id));

  if (assignedLoanIds.size > 0) {
    for (const app of applications) {
      if (touched.has(app.loan.id)) continue;
      if (!assignedLoanIds.has(app.loan.id)) continue;
      const sectorSlug = sectorSlugFor(app.borrower.nrbSector);
      awaiting.push({
        loanId: app.loan.id,
        borrowerId: app.borrower.id,
        borrowerName: app.borrower.name,
        sector: app.borrower.nrbSector,
        outstandingNpr: app.loan.outstandingNpr,
        answered: 0,
        total: fullChecklist(sectorSlug).length,
        state: "awaiting",
        lastActivityAt: null,
      });
    }
  } else {
    for (const app of applications) {
      if (touched.has(app.loan.id)) continue;
      const sectorSlug = sectorSlugFor(app.borrower.nrbSector);
      awaiting.push({
        loanId: app.loan.id,
        borrowerId: app.borrower.id,
        borrowerName: app.borrower.name,
        sector: app.borrower.nrbSector,
        outstandingNpr: app.loan.outstandingNpr,
        answered: 0,
        total: fullChecklist(sectorSlug).length,
        state: "awaiting",
        lastActivityAt: null,
      });
      if (awaiting.length >= AWAITING_SLICE) break;
    }
  }

  // Sort: in-progress and complete first (by last activity desc), then
  // awaiting (by outstanding desc — biggest exposures first).
  rows.sort((a, b) => {
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });
  awaiting.sort((a, b) => b.outstandingNpr - a.outstandingNpr);

  return NextResponse.json({
    ok: true,
    officer: { id: officer.id, name: officer.name, role: officer.role },
    inProgress: rows.filter((r) => r.state === "in-progress"),
    complete: rows.filter((r) => r.state === "complete"),
    awaiting,
  });
}

