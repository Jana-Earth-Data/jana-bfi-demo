/**
 * POST /api/pf-screening/responses
 *   Body: { loanId, borrowerId, itemId, ifcPS, answer: "yes"|"no"|"n/a", remarks? }
 *   Inserts a fresh row into bfi_pf_screening_responses. Immutable append-only —
 *   revisiting an item inserts a new row with a later captured_at, and the
 *   latest per (bank_id, loan_id, item_id) is the current answer.
 *
 * GET /api/pf-screening/responses?loanId=X
 *   Returns the LATEST row per item_id for the given loan, scoped to the
 *   current tenant.
 *
 * DELETE /api/pf-screening/responses?loanId=X
 *   Discards every PF response the current officer has recorded for this
 *   loan (mirrors the ESDD wizard's Exit-without-saving behaviour).
 *
 * Every path requires a resolved tenant + officer.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["yes", "no", "n/a"]);
const VALID_PS = new Set(["PS1", "PS2", "PS3", "PS4", "PS5", "PS6", "PS7", "PS8"]);

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
      { error: "Officer must be selected before recording PF answers." },
      { status: 401 },
    );
  }

  let body: {
    loanId?: string;
    borrowerId?: string;
    itemId?: string;
    ifcPS?: string;
    answer?: string;
    remarks?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { loanId, borrowerId, itemId, ifcPS, answer } = body;
  const remarks = body.remarks?.trim() || null;

  if (!loanId || !borrowerId || !itemId || !ifcPS || !answer) {
    return NextResponse.json(
      {
        error:
          "loanId, borrowerId, itemId, ifcPS and answer are all required fields.",
      },
      { status: 400 },
    );
  }
  if (!VALID_ANSWERS.has(answer)) {
    return NextResponse.json(
      { error: "answer must be one of 'yes', 'no', 'n/a'." },
      { status: 400 },
    );
  }
  if (!VALID_PS.has(ifcPS)) {
    return NextResponse.json(
      { error: "ifcPS must be one of PS1..PS8." },
      { status: 400 },
    );
  }

  // Owner-only edit (P36).
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  const { data, error } = await supabase
    .from("bfi_pf_screening_responses")
    .insert({
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      officer_id: officer.id,
      item_id: itemId,
      ifc_ps: ifcPS,
      answer,
      remarks,
    })
    .select("id, captured_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Insert failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    capturedAt: data.captured_at,
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();
  const loanId = request.nextUrl.searchParams.get("loanId");
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId query parameter is required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("bfi_pf_screening_responses")
    .select("id, item_id, ifc_ps, answer, remarks, captured_at, officer_id")
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .order("captured_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Query failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Reduce to latest per item_id.
  const latest = new Map<
    string,
    {
      itemId: string;
      ifcPS: string;
      answer: string;
      remarks: string | null;
      capturedAt: string;
      officerId: string;
    }
  >();
  for (const row of data ?? []) {
    if (!latest.has(row.item_id)) {
      latest.set(row.item_id, {
        itemId: row.item_id,
        ifcPS: row.ifc_ps,
        answer: row.answer,
        remarks: row.remarks,
        capturedAt: row.captured_at,
        officerId: row.officer_id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    loanId,
    responses: Array.from(latest.values()),
  });
}

export async function DELETE(request: NextRequest) {
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
      { error: "Officer must be selected before discarding answers." },
      { status: 401 },
    );
  }
  const loanId = request.nextUrl.searchParams.get("loanId");
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId query parameter is required." },
      { status: 400 },
    );
  }

  // Owner-only edit (P36).
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  const { error, count } = await supabase
    .from("bfi_pf_screening_responses")
    .delete({ count: "exact" })
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .eq("officer_id", officer.id);
  if (error) {
    return NextResponse.json(
      { error: `Delete failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    loanId,
    deleted: count ?? 0,
  });
}
