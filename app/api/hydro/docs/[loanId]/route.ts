/**
 * GET /api/hydro/docs/[loanId]
 *
 * Returns the NRB Circular 22 Annex 2 hydropower documentation matrix
 * for the given loan:
 *   - the borrower's capacity (MW) derived from the demo entity data
 *   - the resulting capacity band ("under-1mw" | "1-to-50mw" | "over-50mw")
 *   - the list of required documents (verbatim from Annex 2)
 *   - current status per document (from bfi_hydro_doc_status)
 *
 * 404 when the loan does not exist. The endpoint is safe to call for
 * non-hydro loans — it returns { applicable: false } so the UI panel can
 * hide itself without a second round-trip.
 *
 * Verbatim source: NRB ESRM Guideline 2022 Annex 2 (printed p. 27).
 */

import { NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";

import { resolveCurrentTenant } from "@/lib/tenants";
import {
  HYDRO_DOCUMENTS,
  HydroDocument,
  HydroDocumentStatus,
  hydroCapacityBand,
  HYDRO_CAPACITY_BAND_ASSESSMENT,
  HYDRO_CAPACITY_BAND_LABEL,
  requiredDocumentsForCapacity,
} from "@/lib/regulatory/hydro/doc-matrix";
import { getBorrowerHydroCapacityMw } from "@/lib/regulatory/hydro/capacity";
import { getCaptureClient } from "@/lib/data/capture-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ loanId: string }> };

type StatusRow = {
  document_id: string;
  status: HydroDocumentStatus;
  notes: string | null;
  updated_at: string;
  officer_id: string;
};

type DocumentResponse = {
  id: string;
  name: string;
  citation: string;
  required: boolean;
  status: HydroDocumentStatus;
  notes: string | null;
  updatedAt: string | null;
  officerId: string | null;
};

function isHydroSector(nrbSector: string): boolean {
  return nrbSector.toLowerCase().includes("hydropower");
}

async function loadStatuses(
  bankId: string,
  loanId: string,
): Promise<Map<string, StatusRow>> {
  const supabase = await getCaptureClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("bfi_hydro_doc_status")
    .select("document_id, status, notes, updated_at, officer_id")
    .eq("bank_id", bankId)
    .eq("loan_id", loanId);
  if (error) {
    console.warn("[hydro/docs] status lookup failed:", error.message);
    return new Map();
  }
  const map = new Map<string, StatusRow>();
  for (const row of (data ?? []) as StatusRow[]) {
    map.set(row.document_id, row);
  }
  return map;
}

export async function GET(_req: Request, { params }: Params) {
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

  // Non-hydro loans get a short response so the client can hide the
  // panel without a second round-trip.
  if (!isHydroSector(borrower.nrbSector)) {
    return NextResponse.json({
      ok: true,
      applicable: false,
      loanId,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      nrbSector: borrower.nrbSector,
    });
  }

  const capacityMw = getBorrowerHydroCapacityMw(borrower);
  const band = hydroCapacityBand(capacityMw);
  const required = requiredDocumentsForCapacity(capacityMw);
  const requiredIds = new Set(required.map((d) => d.id));

  const tenant = await resolveCurrentTenant();
  const statuses = await loadStatuses(tenant.id, loanId);

  // Build the response by walking every catalogue doc so the client can
  // render `not-required` docs greyed out if it wants to (the panel by
  // default filters to required-only).
  const documents: DocumentResponse[] = HYDRO_DOCUMENTS.map((d: HydroDocument) => {
    const row = statuses.get(d.id);
    const isRequired = requiredIds.has(d.id);
    const defaultStatus: HydroDocumentStatus = isRequired
      ? "not-collected"
      : "not-required";
    return {
      id: d.id,
      name: d.name,
      citation: d.citation,
      required: isRequired,
      status: row?.status ?? defaultStatus,
      notes: row?.notes ?? null,
      updatedAt: row?.updated_at ?? null,
      officerId: row?.officer_id ?? null,
    };
  });

  const requiredDocs = documents.filter((d) => d.required);
  const verifiedCount = requiredDocs.filter((d) => d.status === "verified").length;
  const completionPct = requiredDocs.length > 0
    ? verifiedCount / requiredDocs.length
    : 0;

  return NextResponse.json({
    ok: true,
    applicable: true,
    loanId,
    borrowerId: borrower.id,
    borrowerName: borrower.name,
    nrbSector: borrower.nrbSector,
    capacityMw,
    capacityBand: band,
    capacityBandLabel: HYDRO_CAPACITY_BAND_LABEL[band],
    capacityBandAssessment: HYDRO_CAPACITY_BAND_ASSESSMENT[band],
    documents,
    completion: {
      verified: verifiedCount,
      required: requiredDocs.length,
      percent: completionPct,
    },
    citation: "NRB ESRM Guideline 2022 Annex 2 (printed p. 27)",
  });
}
