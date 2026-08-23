/**
 * GET  /api/cap/[loanId] — returns { items, covenants, monitoring } for the
 *                          Corrective Action Plan + Covenants + Monitoring
 *                          capture panel.
 * POST /api/cap/[loanId] — upserts any of the three collections in one call.
 *
 * NRB ESRM Guideline 2022 §7.3.5 (Annex 8 CAP + Annex 9 covenants) + §7.3.7
 * (Annex 10 monitoring). The endpoint returns a short { applicable: false }
 * response for loans whose latest ESRM screening rates them Low — Circular
 * 22 does not require a CAP or covenants for Low-risk loans.
 *
 * Structure mirrors /api/hydro/docs/[loanId] — a single loan-scoped
 * bundle response that the client panel can render without a second
 * round-trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";
import type {
  CapBundle,
  CapItem,
  CapRiskClass,
  ComplianceStatus,
  Covenant,
  CovenantStatus,
  CovenantType,
  MonitoringReport,
} from "@/lib/regulatory/cap/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ loanId: string }> };

const CITATION =
  "NRB ESRM Guideline 2022 §7.3.5 (CAP / covenants) + §7.3.7 (monitoring): Annex 8 / 9 / 10";

const APPLICABLE_RISK_CLASSES = new Set<CapRiskClass>([
  "medium",
  "high",
  "extreme",
]);

// ---------------------------------------------------------------------------
// Row → API mapping helpers (snake_case → camelCase)
// ---------------------------------------------------------------------------

type CapItemRow = {
  id: string;
  bank_id: string;
  loan_id: string;
  borrower_id: string;
  area_of_concern: string;
  corrective_action: string;
  deadline_date: string | null;
  completion_indicator: string | null;
  responsible_party: string | null;
  cost_npr: string | number | null;
  status: CapItem["status"];
  linked_esdd_question_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toCapItem(row: CapItemRow): CapItem {
  return {
    id: row.id,
    bankId: row.bank_id,
    loanId: row.loan_id,
    borrowerId: row.borrower_id,
    areaOfConcern: row.area_of_concern,
    correctiveAction: row.corrective_action,
    deadlineDate: row.deadline_date,
    completionIndicator: row.completion_indicator,
    responsibleParty: row.responsible_party,
    // numeric comes back as string from PostgREST — coerce so the client
    // doesn't have to do the parse.
    costNpr:
      row.cost_npr == null
        ? null
        : typeof row.cost_npr === "string"
          ? Number(row.cost_npr)
          : row.cost_npr,
    status: row.status,
    linkedEsddQuestionId: row.linked_esdd_question_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type CovenantRow = {
  id: string;
  bank_id: string;
  loan_id: string;
  borrower_id: string;
  covenant_type: CovenantType;
  clause_text: string;
  deadline_date: string | null;
  status: CovenantStatus;
  library_template_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toCovenant(row: CovenantRow): Covenant {
  return {
    id: row.id,
    bankId: row.bank_id,
    loanId: row.loan_id,
    borrowerId: row.borrower_id,
    covenantType: row.covenant_type,
    clauseText: row.clause_text,
    deadlineDate: row.deadline_date,
    status: row.status,
    libraryTemplateId: row.library_template_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type MonitoringRow = {
  id: string;
  bank_id: string;
  loan_id: string;
  borrower_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  next_due_date: string;
  frequency_months: 1 | 3 | 6 | 12;
  covenant_compliance_status: ComplianceStatus;
  cap_compliance_status: ComplianceStatus;
  notes: string | null;
  checklist_snapshot: MonitoringReport["checklistSnapshot"];
  submitted_by: string;
  submitted_at: string;
  created_at: string;
};

function toMonitoring(row: MonitoringRow): MonitoringReport {
  return {
    id: row.id,
    bankId: row.bank_id,
    loanId: row.loan_id,
    borrowerId: row.borrower_id,
    reportingPeriodStart: row.reporting_period_start,
    reportingPeriodEnd: row.reporting_period_end,
    nextDueDate: row.next_due_date,
    frequencyMonths: row.frequency_months,
    covenantComplianceStatus: row.covenant_compliance_status,
    capComplianceStatus: row.cap_compliance_status,
    notes: row.notes,
    checklistSnapshot: row.checklist_snapshot ?? {},
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  const { loanId } = await params;
  if (!loanId) {
    return NextResponse.json({ error: "loanId is required" }, { status: 400 });
  }

  const demo = await getBfiDemoData();
  const loan = demo.loans.find((l) => l.id === loanId);
  if (!loan) {
    return NextResponse.json(
      { error: `Loan ${loanId} not found` },
      { status: 404 },
    );
  }
  const borrower = demo.borrowers.find((b) => b.id === loan.borrowerId);
  if (!borrower) {
    return NextResponse.json(
      { error: `Borrower ${loan.borrowerId} not found` },
      { status: 404 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();

  // Determine the loan's ESRR risk class from the latest saved screening.
  // Missing screening → applicable=false so the panel hides itself
  // (defence-in-depth; the workbench also gates on this).
  let riskClass: CapRiskClass | null = null;
  {
    const { data, error } = await supabase
      .from("bfi_esrm_screenings")
      .select("computed_risk_class")
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .order("captured_at", { ascending: false })
      .limit(1);
    if (error) {
      console.warn("[cap] screening lookup failed:", error.message);
    } else if (data && data[0]) {
      riskClass = data[0].computed_risk_class as CapRiskClass;
    }
  }
  const applicable = !!riskClass && APPLICABLE_RISK_CLASSES.has(riskClass);

  // Even when not applicable we still return an empty bundle so the panel
  // can render "not required" state instead of a hard 404.
  const [itemsRes, covRes, monRes] = await Promise.all([
    supabase
      .from("bfi_cap_items")
      .select(
        "id, bank_id, loan_id, borrower_id, area_of_concern, corrective_action, deadline_date, completion_indicator, responsible_party, cost_npr, status, linked_esdd_question_id, created_by, created_at, updated_at",
      )
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .order("created_at", { ascending: true }),
    supabase
      .from("bfi_covenants")
      .select(
        "id, bank_id, loan_id, borrower_id, covenant_type, clause_text, deadline_date, status, library_template_id, created_by, created_at, updated_at",
      )
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .order("created_at", { ascending: true }),
    supabase
      .from("bfi_monitoring_reports")
      .select(
        "id, bank_id, loan_id, borrower_id, reporting_period_start, reporting_period_end, next_due_date, frequency_months, covenant_compliance_status, cap_compliance_status, notes, checklist_snapshot, submitted_by, submitted_at, created_at",
      )
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .order("reporting_period_end", { ascending: false }),
  ]);
  if (itemsRes.error) {
    return NextResponse.json(
      { error: `CAP item query failed: ${itemsRes.error.message}` },
      { status: 500 },
    );
  }
  if (covRes.error) {
    return NextResponse.json(
      { error: `Covenant query failed: ${covRes.error.message}` },
      { status: 500 },
    );
  }
  if (monRes.error) {
    return NextResponse.json(
      { error: `Monitoring query failed: ${monRes.error.message}` },
      { status: 500 },
    );
  }

  // Overdue derivation — status stored on the row wins for a completed
  // item, but any not-completed item with a past deadline is projected as
  // "overdue" in the response so the pill colour matches reality even if
  // the officer hasn't clicked the row since it aged out.
  const today = new Date().toISOString().slice(0, 10);
  const items = ((itemsRes.data ?? []) as CapItemRow[]).map(toCapItem).map(
    (item) => {
      if (
        item.status !== "completed" &&
        item.deadlineDate &&
        item.deadlineDate < today
      ) {
        return { ...item, status: "overdue" as const };
      }
      return item;
    },
  );

  const bundle: CapBundle = {
    ok: true,
    loanId,
    borrowerId: borrower.id,
    borrowerName: borrower.name,
    riskClass,
    applicable,
    items,
    covenants: ((covRes.data ?? []) as CovenantRow[]).map(toCovenant),
    monitoring: ((monRes.data ?? []) as MonitoringRow[]).map(toMonitoring),
    citation: CITATION,
  };

  return NextResponse.json(bundle);
}

// ---------------------------------------------------------------------------
// POST — batch upsert
// ---------------------------------------------------------------------------

const VALID_CAP_STATUS = new Set<CapItem["status"]>([
  "not_started",
  "in_progress",
  "completed",
  "overdue",
]);
const VALID_COVENANT_TYPE = new Set<CovenantType>([
  "positive",
  "negative",
  "condition_precedent",
  "event_of_default",
  "cap_covenant",
]);
const VALID_COVENANT_STATUS = new Set<CovenantStatus>([
  "active",
  "breached",
  "waived",
  "expired",
]);
const VALID_COMPLIANCE = new Set<ComplianceStatus>([
  "fully",
  "partial",
  "not",
  "delayed",
]);
const VALID_FREQUENCY = new Set<number>([1, 3, 6, 12]);

export async function POST(request: NextRequest, { params }: Params) {
  const { loanId } = await params;
  if (!loanId) {
    return NextResponse.json({ error: "loanId is required" }, { status: 400 });
  }

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
      { error: "Officer must be selected before saving CAP data." },
      { status: 401 },
    );
  }

  let body: {
    borrowerId?: string;
    items?: Array<Record<string, unknown>>;
    itemsToDelete?: string[];
    covenants?: Array<Record<string, unknown>>;
    covenantsToDelete?: string[];
    monitoring?: Array<Record<string, unknown>>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { borrowerId } = body;
  if (!borrowerId) {
    return NextResponse.json(
      { error: "borrowerId is required." },
      { status: 400 },
    );
  }

  // Owner-only edit (P36). CAP items, covenants, and monitoring reports
  // are all loan-scoped writes — reject if the current officer is not
  // the loan's assigned owner.
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  // 1) CAP items — insert (no id) or update (with id).
  const itemInserts: Array<Record<string, unknown>> = [];
  const itemUpdates: Array<{ id: string; row: Record<string, unknown> }> = [];
  for (const raw of body.items ?? []) {
    const area = (raw.areaOfConcern as string | undefined)?.trim();
    const action = (raw.correctiveAction as string | undefined)?.trim();
    if (!area || !action) {
      return NextResponse.json(
        {
          error:
            "Each CAP item requires non-empty areaOfConcern and correctiveAction.",
        },
        { status: 400 },
      );
    }
    const status = (raw.status as CapItem["status"] | undefined) ?? "not_started";
    if (!VALID_CAP_STATUS.has(status)) {
      return NextResponse.json(
        { error: `Invalid CAP item status: ${status}` },
        { status: 400 },
      );
    }
    const row: Record<string, unknown> = {
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      area_of_concern: area,
      corrective_action: action,
      deadline_date: (raw.deadlineDate as string | null | undefined) || null,
      completion_indicator:
        ((raw.completionIndicator as string | null | undefined) ?? null) || null,
      responsible_party:
        ((raw.responsibleParty as string | null | undefined) ?? null) || null,
      cost_npr:
        raw.costNpr == null || raw.costNpr === ""
          ? null
          : Number(raw.costNpr),
      // Overdue is a derived state — don't persist it, let the GET derive
      // it from deadline vs today. Persist the officer's underlying
      // intent (in_progress vs not_started vs completed).
      status: status === "overdue" ? "in_progress" : status,
      linked_esdd_question_id:
        ((raw.linkedEsddQuestionId as string | null | undefined) ?? null) ||
        null,
    };
    if (raw.id) {
      itemUpdates.push({ id: raw.id as string, row });
    } else {
      itemInserts.push({ ...row, created_by: officer.id });
    }
  }
  if (itemInserts.length > 0) {
    const { error } = await supabase.from("bfi_cap_items").insert(itemInserts);
    if (error) {
      return NextResponse.json(
        { error: `CAP item insert failed: ${error.message}` },
        { status: 500 },
      );
    }
  }
  for (const u of itemUpdates) {
    const { error } = await supabase
      .from("bfi_cap_items")
      .update(u.row)
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .eq("id", u.id);
    if (error) {
      return NextResponse.json(
        { error: `CAP item update failed: ${error.message}` },
        { status: 500 },
      );
    }
  }
  if ((body.itemsToDelete ?? []).length > 0) {
    const { error } = await supabase
      .from("bfi_cap_items")
      .delete()
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .in("id", body.itemsToDelete!);
    if (error) {
      return NextResponse.json(
        { error: `CAP item delete failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 2) Covenants
  const covInserts: Array<Record<string, unknown>> = [];
  const covUpdates: Array<{ id: string; row: Record<string, unknown> }> = [];
  for (const raw of body.covenants ?? []) {
    const type = raw.covenantType as CovenantType | undefined;
    const text = (raw.clauseText as string | undefined)?.trim();
    if (!type || !VALID_COVENANT_TYPE.has(type)) {
      return NextResponse.json(
        { error: `Invalid covenant type: ${type}` },
        { status: 400 },
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: "Each covenant requires non-empty clauseText." },
        { status: 400 },
      );
    }
    const status = (raw.status as CovenantStatus | undefined) ?? "active";
    if (!VALID_COVENANT_STATUS.has(status)) {
      return NextResponse.json(
        { error: `Invalid covenant status: ${status}` },
        { status: 400 },
      );
    }
    const row: Record<string, unknown> = {
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      covenant_type: type,
      clause_text: text,
      deadline_date: (raw.deadlineDate as string | null | undefined) || null,
      status,
      library_template_id:
        ((raw.libraryTemplateId as string | null | undefined) ?? null) || null,
    };
    if (raw.id) {
      covUpdates.push({ id: raw.id as string, row });
    } else {
      covInserts.push({ ...row, created_by: officer.id });
    }
  }
  if (covInserts.length > 0) {
    const { error } = await supabase.from("bfi_covenants").insert(covInserts);
    if (error) {
      return NextResponse.json(
        { error: `Covenant insert failed: ${error.message}` },
        { status: 500 },
      );
    }
  }
  for (const u of covUpdates) {
    const { error } = await supabase
      .from("bfi_covenants")
      .update(u.row)
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .eq("id", u.id);
    if (error) {
      return NextResponse.json(
        { error: `Covenant update failed: ${error.message}` },
        { status: 500 },
      );
    }
  }
  if ((body.covenantsToDelete ?? []).length > 0) {
    const { error } = await supabase
      .from("bfi_covenants")
      .delete()
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .in("id", body.covenantsToDelete!);
    if (error) {
      return NextResponse.json(
        { error: `Covenant delete failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  // 3) Monitoring cycles — append-only. Each entry inserts a new row.
  const monRows: Array<Record<string, unknown>> = [];
  for (const raw of body.monitoring ?? []) {
    const start = raw.reportingPeriodStart as string | undefined;
    const end = raw.reportingPeriodEnd as string | undefined;
    const nextDue = raw.nextDueDate as string | undefined;
    const freq = Number(raw.frequencyMonths);
    if (!start || !end || !nextDue) {
      return NextResponse.json(
        {
          error:
            "Monitoring cycle requires reportingPeriodStart, reportingPeriodEnd and nextDueDate.",
        },
        { status: 400 },
      );
    }
    if (!VALID_FREQUENCY.has(freq)) {
      return NextResponse.json(
        { error: `frequencyMonths must be 1, 3, 6 or 12 — got ${freq}.` },
        { status: 400 },
      );
    }
    const covCompliance = raw.covenantComplianceStatus as
      | ComplianceStatus
      | undefined;
    const capCompliance = raw.capComplianceStatus as
      | ComplianceStatus
      | undefined;
    if (!covCompliance || !VALID_COMPLIANCE.has(covCompliance)) {
      return NextResponse.json(
        { error: `Invalid covenantComplianceStatus: ${covCompliance}` },
        { status: 400 },
      );
    }
    if (!capCompliance || !VALID_COMPLIANCE.has(capCompliance)) {
      return NextResponse.json(
        { error: `Invalid capComplianceStatus: ${capCompliance}` },
        { status: 400 },
      );
    }
    monRows.push({
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      reporting_period_start: start,
      reporting_period_end: end,
      next_due_date: nextDue,
      frequency_months: freq,
      covenant_compliance_status: covCompliance,
      cap_compliance_status: capCompliance,
      notes: ((raw.notes as string | null | undefined) ?? null) || null,
      checklist_snapshot: raw.checklistSnapshot ?? {},
      submitted_by: officer.id,
    });
  }
  if (monRows.length > 0) {
    const { error } = await supabase
      .from("bfi_monitoring_reports")
      .insert(monRows);
    if (error) {
      return NextResponse.json(
        { error: `Monitoring insert failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: {
      items: itemInserts.length,
      covenants: covInserts.length,
      monitoring: monRows.length,
    },
    updated: {
      items: itemUpdates.length,
      covenants: covUpdates.length,
    },
    deleted: {
      items: (body.itemsToDelete ?? []).length,
      covenants: (body.covenantsToDelete ?? []).length,
    },
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
}
