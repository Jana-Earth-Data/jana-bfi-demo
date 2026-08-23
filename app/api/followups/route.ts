/**
 * GET /api/followups
 *
 * The reminder / follow-up queue for the signed-in officer. Computes on
 * read — no separate cron. Scans two data sources for the loans this
 * officer is on the hook for and buckets what's coming due.
 *
 * NRB source authority:
 *   - NRB ESRM Guideline 2022 §7.3.5 — time-bound Corrective Action Plans (Annex 8)
 *     and E&S covenants (Annex 9) are required for medium+ risk loans.
 *     Deadlines aren't optional.
 *   - NRB ESRM Guideline 2022 §7.3.7 — periodic monitoring per Annex 10; frequency
 *     driven by ESRR + CAP status.
 *   - NRB ESRM Guideline 2022 §8 — Relationship Manager / Loan Officer is the
 *     assigned role for pre-disbursement action follow-up and monitoring.
 *
 * Buckets:
 *   overdue         → deadline / next_due_date < today (past)
 *   dueThisWeek     → today <= dueDate <= today + 7 days
 *   dueThisMonth    → today + 7 < dueDate <= today + 30 days
 *
 * Response shape:
 *   {
 *     officer:      { id, name, role },
 *     overdue:      FollowupCard[],
 *     dueThisWeek:  FollowupCard[],
 *     dueThisMonth: FollowupCard[],
 *     totalCount:   number,
 *   }
 */

import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";

export const dynamic = "force-dynamic";

export type FollowupType = "cap-item" | "monitoring-report";

export type FollowupCard = {
  followupType: FollowupType;
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  /** ISO date (yyyy-mm-dd). */
  dueDate: string;
  /** Negative = overdue by |n| days; positive = n days until due; 0 = today. */
  daysUntilDue: number;
  /** CAP-only fields; null for monitoring-report cards. */
  cap: {
    itemId: string;
    areaOfConcern: string;
    correctiveAction: string;
    responsibleParty: string;
    status: string;
    linkedEsddQuestionId: string | null;
  } | null;
  /** Monitoring-only fields; null for cap-item cards. */
  monitoring: {
    reportId: string;
    frequencyMonths: number;
    lastPeriodEnd: string | null;
    lastCovenantCompliance: string | null;
    lastCapCompliance: string | null;
  } | null;
};

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

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
      { error: "Officer must be selected before viewing follow-ups." },
      { status: 401 },
    );
  }

  // Pull demo data for borrower/loan enrichment.
  const data = await getBfiDemoData();
  const loanById = new Map(data.loans.map((l) => [l.id, l]));
  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));

  // 1) Loans assigned to this officer.
  const { data: assigns, error: aErr } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_id")
    .eq("bank_id", tenant.id)
    .eq("officer_id", officer.id);
  if (aErr) {
    return NextResponse.json(
      { error: `Assignment lookup failed: ${aErr.message}` },
      { status: 500 },
    );
  }
  const officerLoanIds = (assigns ?? []).map((a) => a.loan_id);
  if (officerLoanIds.length === 0) {
    return NextResponse.json({
      ok: true,
      officer: { id: officer.id, name: officer.name, role: officer.role },
      overdue: [],
      dueThisWeek: [],
      dueThisMonth: [],
      totalCount: 0,
    });
  }

  // Today at 00:00 UTC — we compare dates as ISO yyyy-mm-dd so timezone
  // is irrelevant; we're bucketing on calendar days.
  const todayIso = new Date().toISOString().slice(0, 10);
  const in30Iso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 2) Open CAP items with deadline <= today+30 (includes overdue).
  const { data: capRows, error: cErr } = await supabase
    .from("bfi_cap_items")
    .select(
      "id, loan_id, borrower_id, area_of_concern, corrective_action, responsible_party, status, deadline_date, linked_esdd_question_id",
    )
    .eq("bank_id", tenant.id)
    .in("loan_id", officerLoanIds)
    .neq("status", "completed")
    .lte("deadline_date", in30Iso)
    .order("deadline_date", { ascending: true });
  if (cErr) {
    return NextResponse.json(
      { error: `CAP query failed: ${cErr.message}` },
      { status: 500 },
    );
  }

  // 3) Monitoring reports with next_due_date <= today+30 (includes overdue).
  const { data: monRows, error: mErr } = await supabase
    .from("bfi_monitoring_reports")
    .select(
      "id, loan_id, borrower_id, next_due_date, frequency_months, reporting_period_end, covenant_compliance_status, cap_compliance_status",
    )
    .eq("bank_id", tenant.id)
    .in("loan_id", officerLoanIds)
    .lte("next_due_date", in30Iso)
    .order("next_due_date", { ascending: true });
  if (mErr) {
    return NextResponse.json(
      { error: `Monitoring query failed: ${mErr.message}` },
      { status: 500 },
    );
  }

  // 4) Build FollowupCard[] from both sources.
  const all: FollowupCard[] = [];

  for (const c of capRows ?? []) {
    const loan = loanById.get(c.loan_id);
    const borrower = borrowerById.get(c.borrower_id);
    if (!loan || !borrower) continue;
    all.push({
      followupType: "cap-item",
      loanId: c.loan_id,
      borrowerId: c.borrower_id,
      borrowerName: borrower.name,
      sector: borrower.nrbSector,
      outstandingNpr: loan.outstandingNpr,
      dueDate: c.deadline_date,
      daysUntilDue: daysBetween(todayIso, c.deadline_date),
      cap: {
        itemId: c.id,
        areaOfConcern: c.area_of_concern,
        correctiveAction: c.corrective_action,
        responsibleParty: c.responsible_party,
        status: c.status,
        linkedEsddQuestionId: c.linked_esdd_question_id ?? null,
      },
      monitoring: null,
    });
  }

  for (const m of monRows ?? []) {
    const loan = loanById.get(m.loan_id);
    const borrower = borrowerById.get(m.borrower_id);
    if (!loan || !borrower) continue;
    all.push({
      followupType: "monitoring-report",
      loanId: m.loan_id,
      borrowerId: m.borrower_id,
      borrowerName: borrower.name,
      sector: borrower.nrbSector,
      outstandingNpr: loan.outstandingNpr,
      dueDate: m.next_due_date,
      daysUntilDue: daysBetween(todayIso, m.next_due_date),
      cap: null,
      monitoring: {
        reportId: m.id,
        frequencyMonths: m.frequency_months,
        lastPeriodEnd: m.reporting_period_end ?? null,
        lastCovenantCompliance: m.covenant_compliance_status ?? null,
        lastCapCompliance: m.cap_compliance_status ?? null,
      },
    });
  }

  // 5) Bucket by date band.
  const overdue: FollowupCard[] = [];
  const dueThisWeek: FollowupCard[] = [];
  const dueThisMonth: FollowupCard[] = [];
  for (const f of all) {
    if (f.daysUntilDue < 0) overdue.push(f);
    else if (f.daysUntilDue <= 7) dueThisWeek.push(f);
    else dueThisMonth.push(f);
  }

  // Overdue: most-overdue first (largest negative). Others: sooner first.
  overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  dueThisWeek.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  dueThisMonth.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return NextResponse.json({
    ok: true,
    officer: { id: officer.id, name: officer.name, role: officer.role },
    overdue,
    dueThisWeek,
    dueThisMonth,
    totalCount: overdue.length + dueThisWeek.length + dueThisMonth.length,
  });
}
