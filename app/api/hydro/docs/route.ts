/**
 * POST /api/hydro/docs
 *
 *   Body: { loanId, borrowerId, documentId, status, notes? }
 *
 *   Upserts a row in bfi_hydro_doc_status keyed on
 *   (bank_id, loan_id, document_id). The row's `updated_at` bumps via
 *   the trigger in scripts/supabase-hydro-docs.sql.
 *
 * Verbatim source: NRB Circular 22 Annex 2 (ESRM Guideline PDF p. 25).
 * Only document ids present in lib/regulatory/hydro/doc-matrix.ts are
 * accepted — an unknown id returns 400.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import {
  HYDRO_DOCUMENT_STATUSES,
  findHydroDocument,
  type HydroDocumentStatus,
} from "@/lib/regulatory/hydro/doc-matrix";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<HydroDocumentStatus>([
  "not-required",
  ...HYDRO_DOCUMENT_STATUSES,
]);

export async function POST(request: NextRequest) {
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
      { error: "Officer must be selected before updating a document status." },
      { status: 401 },
    );
  }

  let body: {
    loanId?: string;
    borrowerId?: string;
    documentId?: string;
    status?: string;
    notes?: string | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { loanId, borrowerId, documentId, status } = body;
  const notes = body.notes?.trim() || null;

  if (!loanId || !borrowerId || !documentId || !status) {
    return NextResponse.json(
      {
        error:
          "loanId, borrowerId, documentId and status are all required fields.",
      },
      { status: 400 },
    );
  }
  if (!findHydroDocument(documentId)) {
    return NextResponse.json(
      {
        error:
          `Unknown documentId: ${documentId}. Must be one of the ids in lib/regulatory/hydro/doc-matrix.ts.`,
      },
      { status: 400 },
    );
  }
  if (!VALID_STATUSES.has(status as HydroDocumentStatus)) {
    return NextResponse.json(
      {
        error:
          `Invalid status: ${status}. Must be one of ${Array.from(VALID_STATUSES).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("bfi_hydro_doc_status")
    .upsert(
      {
        bank_id: tenant.id,
        loan_id: loanId,
        borrower_id: borrowerId,
        officer_id: officer.id,
        document_id: documentId,
        status,
        notes,
      },
      { onConflict: "bank_id,loan_id,document_id" },
    )
    .select("id, status, notes, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Upsert failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    documentId,
    status: data.status,
    notes: data.notes,
    updatedAt: data.updated_at,
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
}
