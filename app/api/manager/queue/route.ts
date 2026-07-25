/**
 * GET /api/manager/queue
 *
 * Manager view of the whole under-review book. One row per loan with:
 *   - loan + borrower + sector + outstanding
 *   - ESDD progress (answered / total)
 *   - latest ESRM screening (risk class, escalation flag) if saved
 *   - current owner (from bfi_loan_assignments) if assigned
 *
 * No pagination in v1 — Nepal-scale demo books stay under a few hundred
 * loans. If real-world usage grows past that we'll page here.
 */

import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import { applicationQueue } from "@/lib/data/portfolio-query";
import { fullChecklist } from "@/lib/regulatory/esdd/annex5-questions";
import { sectorSlugFor } from "@/lib/regulatory/esdd/sector-slug";

export const dynamic = "force-dynamic";

export type ManagerQueueRow = {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  branch: string | null;
  outstandingNpr: number;
  answered: number;
  total: number;
  ownerOfficerId: string | null;
  ownerOfficerName: string | null;
  riskClass: "low" | "medium" | "high" | "extreme" | null;
  escalated: boolean;
  screeningAt: string | null;
  lastEsddActivityAt: string | null;
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

  // Pull ALL under-review loans for the tenant. applicationQueue() gives us
  // the same ordering the current ESRM tab uses (newest first).
  const data = await getBfiDemoData();
  const apps = applicationQueue(data, 500);

  const loanIds = apps.map((a) => a.loan.id);
  if (loanIds.length === 0) {
    return NextResponse.json({
      ok: true,
      rows: [] as ManagerQueueRow[],
      escalatedCount: 0,
    });
  }

  // Progress: distinct question ids answered per loan.
  const { data: rawResponses, error: respErr } = await supabase
    .from("bfi_esdd_responses")
    .select("loan_id, question_id, captured_at")
    .eq("bank_id", tenant.id)
    .in("loan_id", loanIds);
  if (respErr) {
    return NextResponse.json(
      { error: `Response query failed: ${respErr.message}` },
      { status: 500 },
    );
  }
  const answeredByLoan = new Map<
    string,
    { distinct: Set<string>; latest: string }
  >();
  for (const r of rawResponses ?? []) {
    const existing = answeredByLoan.get(r.loan_id);
    if (existing) {
      existing.distinct.add(r.question_id);
      if (r.captured_at > existing.latest) existing.latest = r.captured_at;
    } else {
      answeredByLoan.set(r.loan_id, {
        distinct: new Set([r.question_id]),
        latest: r.captured_at,
      });
    }
  }

  // Latest screening per loan.
  const { data: screenings, error: scrErr } = await supabase
    .from("bfi_esrm_screenings")
    .select("loan_id, computed_risk_class, escalation_flag, captured_at")
    .eq("bank_id", tenant.id)
    .in("loan_id", loanIds)
    .order("captured_at", { ascending: false });
  if (scrErr) {
    return NextResponse.json(
      { error: `Screening query failed: ${scrErr.message}` },
      { status: 500 },
    );
  }
  const screeningByLoan = new Map<
    string,
    {
      riskClass: ManagerQueueRow["riskClass"];
      escalated: boolean;
      capturedAt: string;
    }
  >();
  for (const s of screenings ?? []) {
    if (screeningByLoan.has(s.loan_id)) continue;
    screeningByLoan.set(s.loan_id, {
      riskClass: s.computed_risk_class as ManagerQueueRow["riskClass"],
      escalated: s.escalation_flag,
      capturedAt: s.captured_at,
    });
  }

  // Assignments per loan.
  const { data: assigns, error: assignErr } = await supabase
    .from("bfi_loan_assignments")
    .select("loan_id, officer_id")
    .eq("bank_id", tenant.id)
    .in("loan_id", loanIds);
  if (assignErr) {
    return NextResponse.json(
      { error: `Assignment query failed: ${assignErr.message}` },
      { status: 500 },
    );
  }
  const ownerByLoan = new Map<string, string>();
  for (const a of assigns ?? []) ownerByLoan.set(a.loan_id, a.officer_id);

  const officerIds = Array.from(new Set(ownerByLoan.values()));
  const officerNameById = new Map<string, string>();
  if (officerIds.length > 0) {
    const { data: officers } = await supabase
      .from("bfi_officers")
      .select("id, name")
      .eq("bank_id", tenant.id)
      .in("id", officerIds);
    for (const o of officers ?? []) officerNameById.set(o.id, o.name);
  }

  const rows: ManagerQueueRow[] = apps.map((app) => {
    const sectorSlug = sectorSlugFor(app.borrower.nrbSector);
    const total = fullChecklist(sectorSlug).length;
    const progress = answeredByLoan.get(app.loan.id);
    const screening = screeningByLoan.get(app.loan.id);
    const ownerId = ownerByLoan.get(app.loan.id) ?? null;
    return {
      loanId: app.loan.id,
      borrowerId: app.borrower.id,
      borrowerName: app.borrower.name,
      sector: app.borrower.nrbSector,
      branch: app.loan.branch ?? null,
      outstandingNpr: app.loan.outstandingNpr,
      answered: progress?.distinct.size ?? 0,
      total,
      ownerOfficerId: ownerId,
      ownerOfficerName: ownerId
        ? officerNameById.get(ownerId) ?? ownerId
        : null,
      riskClass: screening?.riskClass ?? null,
      escalated: screening?.escalated ?? false,
      screeningAt: screening?.capturedAt ?? null,
      lastEsddActivityAt: progress?.latest ?? null,
    };
  });

  const escalatedCount = rows.filter((r) => r.escalated).length;

  return NextResponse.json({ ok: true, rows, escalatedCount });
}

