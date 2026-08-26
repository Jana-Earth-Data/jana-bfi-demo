/**
 * GET  /api/pcaf/evidence/[loanId]
 * POST /api/pcaf/evidence/[loanId]
 *
 * The document review behind a loan's PCAF data-availability flags.
 *
 * Keyed by LOAN rather than borrower even though most of the evidence is
 * borrower-level, because the caller is always looking at a loan and the
 * loan is what decides scope: PCAF Part A §5.3 attributes project-finance
 * emissions to the project, so production and energy records belong to the
 * financed asset rather than the company. The route resolves that per
 * document via evidenceScopeKey() and returns one merged view, so the panel
 * never has to know which rows came from which scope.
 *
 * GET returns, for each document in the catalogue: the recorded status, the
 * reporting year, the scope its row was read from, and the flag it would
 * establish. Plus the resolved availability those documents produce when
 * combined with inference, and the basis for each flag, so the panel can say
 * why an answer is what it is.
 *
 * Files are NOT loan-scoped and are not touched here — they live in
 * bfi_evidence_attachments under the borrower, so one upload serves every
 * loan. See evidenceAttachmentKey().
 */

import { NextRequest, NextResponse } from "next/server";
import { demoPcafNameFixtures } from "@/lib/demo/provider";
import { getBfiDemoData } from "@/lib/api/bfi";

import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";
import { getCaptureClient } from "@/lib/data/capture-client";
import {
  PCAF_EVIDENCE_DOCUMENTS,
  PCAF_EVIDENCE_BY_ID,
  PCAF_EVIDENCE_STATUSES,
  type PcafEvidenceRecord,
  type PcafEvidenceStatus,
  evidenceAttachmentKey,
  evidenceScopeKey,
  evidenceProgress,
  recordFor,
  resolveAvailability,
} from "@/lib/regulatory/pcaf/evidence-matrix";
import {
  assetClassForLoanCategory,
  inferPcafAvailability,
} from "@/lib/regulatory/pcaf/scoring";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ loanId: string }> };

type EvidenceRow = {
  document_id: string;
  loan_id: string | null;
  status: PcafEvidenceStatus;
  reporting_year: number | null;
  notes: string | null;
  updated_at: string | null;
  officer_id: string | null;
};

function rowToRecord(r: EvidenceRow): PcafEvidenceRecord {
  return {
    documentId: r.document_id,
    loanId: r.loan_id,
    status: r.status,
    reportingYear: r.reporting_year,
    notes: r.notes,
    updatedAt: r.updated_at,
    updatedBy: r.officer_id,
  };
}

/**
 * The year the disclosure is being prepared for. Evidence covering an
 * earlier year is stale and stops supporting its claim.
 *
 * Held here as a single named value rather than scattered `new Date()` calls
 * so that making it a bank setting later is one edit. A bank preparing its
 * FY2025 return in early 2026 will need to set this explicitly rather than
 * inherit the wall clock.
 */
function disclosureYear(): number {
  return new Date().getUTCFullYear();
}

async function loadContext(loanId: string) {
  const data = await getBfiDemoData();
  const loan = data.loans.find((l) => l.id === loanId);
  if (!loan) return null;
  const borrower = data.borrowers.find((b) => b.id === loan.borrowerId);
  if (!borrower) return null;
  const assetClass = assetClassForLoanCategory(loan.category);
  return {
    loan,
    borrower,
    isProjectFinance: assetClass === "project-finance",
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { loanId } = await params;
  const supabase = await getCaptureClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const tenant = await resolveCurrentTenant();

  const ctx = await loadContext(loanId);
  if (!ctx) {
    return NextResponse.json({ error: `Loan ${loanId} not found.` }, { status: 404 });
  }
  const { loan, borrower, isProjectFinance } = ctx;

  // Read every row for the borrower, both scopes. Cheaper than two queries
  // and lets recordFor() pick per document.
  const { data: rows, error } = await supabase
    .from("bfi_pcaf_evidence_docs")
    .select("document_id, loan_id, status, reporting_year, notes, updated_at, officer_id")
    .eq("bank_id", tenant.id)
    .eq("borrower_id", borrower.id);

  if (error) {
    return NextResponse.json(
      { error: `Evidence query failed: ${error.message}` },
      { status: 500 },
    );
  }

  const records = (rows ?? []).map(rowToRecord);
  const year = disclosureYear();
  const inferred = inferPcafAvailability(
    borrower,
    loan.category,
    await demoPcafNameFixtures(),
  );
  const resolved = resolveAvailability(inferred, records, year, {
    loanId,
    isProjectFinance,
  });

  const documents = PCAF_EVIDENCE_DOCUMENTS.map((doc) => {
    const rec = recordFor(doc, records, loanId, isProjectFinance);
    return {
      id: doc.id,
      name: doc.name,
      lookFor: doc.lookFor,
      establishes: doc.establishes,
      supportsOption: doc.supportsOption,
      citation: doc.citation,
      scope: doc.scope,
      /** Null means this row is stored against the borrower, not this loan. */
      scopedToLoanId: evidenceScopeKey(doc, loanId, isProjectFinance),
      attachmentFieldKey: evidenceAttachmentKey(doc),
      status: rec?.status ?? "not-collected",
      reportingYear: rec?.reportingYear ?? null,
      notes: rec?.notes ?? null,
      updatedAt: rec?.updatedAt ?? null,
      updatedBy: rec?.updatedBy ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    loanId,
    borrowerId: borrower.id,
    isProjectFinance,
    disclosureYear: year,
    statuses: PCAF_EVIDENCE_STATUSES,
    documents,
    inferredFlags: inferred,
    resolvedFlags: resolved.flags,
    basis: resolved.basis,
    progress: evidenceProgress(records),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { loanId } = await params;
  const supabase = await getCaptureClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return NextResponse.json(
      { error: "Officer must be selected before recording evidence." },
      { status: 401 },
    );
  }

  // Owner-only edit (P36), same rule as every other capture surface.
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { documentId, status, reportingYear, notes } = (body ?? {}) as {
    documentId?: string;
    status?: PcafEvidenceStatus;
    reportingYear?: number | null;
    notes?: string | null;
  };

  const doc = documentId ? PCAF_EVIDENCE_BY_ID[documentId] : undefined;
  if (!doc) {
    return NextResponse.json(
      { error: `Unknown documentId: ${String(documentId)}` },
      { status: 400 },
    );
  }
  if (!status || !PCAF_EVIDENCE_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${PCAF_EVIDENCE_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }
  if (
    reportingYear !== null &&
    reportingYear !== undefined &&
    (!Number.isInteger(reportingYear) || reportingYear < 1990 || reportingYear > 2100)
  ) {
    return NextResponse.json(
      { error: "reportingYear must be an integer between 1990 and 2100, or null." },
      { status: 400 },
    );
  }
  // A verified document with no year cannot be aged, so it would silently
  // support its claim forever. Refuse rather than accept an assertion that
  // can never go stale.
  if (status === "verified" && (reportingYear === null || reportingYear === undefined)) {
    return NextResponse.json(
      {
        error:
          "A verified document must record the reporting year it covers, so it can be aged against the disclosure year.",
      },
      { status: 400 },
    );
  }

  const ctx = await loadContext(loanId);
  if (!ctx) {
    return NextResponse.json({ error: `Loan ${loanId} not found.` }, { status: 404 });
  }
  const { borrower, isProjectFinance } = ctx;
  const scopedLoanId = evidenceScopeKey(doc, loanId, isProjectFinance);

  // Two partial unique indexes back this table (one per scope), so the
  // conflict target has to name the columns of whichever applies.
  const onConflict = scopedLoanId
    ? "bank_id,borrower_id,document_id,loan_id"
    : "bank_id,borrower_id,document_id";

  const { error } = await supabase
    .from("bfi_pcaf_evidence_docs")
    .upsert(
      {
        bank_id: tenant.id,
        borrower_id: borrower.id,
        loan_id: scopedLoanId,
        document_id: doc.id,
        officer_id: officer.id,
        status,
        reporting_year: reportingYear ?? null,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict },
    );

  if (error) {
    return NextResponse.json(
      { error: `Evidence save failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Return the freshly resolved view so the panel can show the flag move
  // without a second round-trip — the point of the whole exercise is that
  // recording evidence visibly changes the answer.
  return GET(request, { params: Promise.resolve({ loanId }) } as Params);
}
