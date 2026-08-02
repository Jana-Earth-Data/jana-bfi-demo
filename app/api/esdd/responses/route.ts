/**
 * POST /api/esdd/responses
 *   Body: { loanId, borrowerId, questionId, answer: "a"|"b"|"c"|"d", remarks? }
 *   Inserts a fresh row into bfi_esdd_responses. Immutable append-only —
 *   revisiting a question inserts a new row with a later captured_at, and
 *   the latest per (bank_id, loan_id, question_id) is the current answer.
 *   This gives us a free audit trail.
 *
 * GET /api/esdd/responses?loanId=X
 *   Returns the LATEST row per question_id for the given loan, scoped to
 *   the current tenant. Used by the wizard to resume a partially-completed
 *   checklist and by the review screen to render the answered state.
 *
 * Both paths require:
 *   - A resolved tenant (from the jana_demo_tenant cookie).
 *   - A resolved officer (from the jana_demo_officer cookie). Answers must
 *     be attributed to a specific officer.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["a", "b", "c", "d"]);

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
      { error: "Officer must be selected before recording answers." },
      { status: 401 },
    );
  }

  let body: {
    loanId?: string;
    borrowerId?: string;
    questionId?: string;
    answer?: string;
    remarks?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { loanId, borrowerId, questionId, answer } = body;
  const remarks = body.remarks?.trim() || null;

  if (!loanId || !borrowerId || !questionId || !answer) {
    return NextResponse.json(
      {
        error:
          "loanId, borrowerId, questionId and answer are all required fields.",
      },
      { status: 400 },
    );
  }
  if (!VALID_ANSWERS.has(answer)) {
    return NextResponse.json(
      { error: "answer must be one of 'a', 'b', 'c', 'd'." },
      { status: 400 },
    );
  }

  // Owner-only edit (P36). Reject writes from a non-owner even if their
  // UI is stale. Unassigned loans fall through to the existing auto-
  // claim block below.
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  const { data, error } = await supabase
    .from("bfi_esdd_responses")
    .insert({
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      officer_id: officer.id,
      question_id: questionId,
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

  // ------------------------------------------------------------------
  // First-toucher owns it: after a successful ESDD save, upsert an
  // assignment row IFF none exists yet. Without this, the Manager view
  // (which reads only from bfi_loan_assignments) shows the loan as
  // unassigned even though the officer is clearly working on it. This
  // path is deliberately non-blocking — any failure here MUST NOT fail
  // the primary response insert, which the officer's UI depends on.
  // ------------------------------------------------------------------
  try {
    const { data: existing } = await supabase
      .from("bfi_loan_assignments")
      .select("id")
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .maybeSingle();
    if (!existing) {
      const { error: assignErr } = await supabase
        .from("bfi_loan_assignments")
        .insert({
          bank_id: tenant.id,
          loan_id: loanId,
          officer_id: officer.id,
          assigned_by: officer.id,
          assigned_at: new Date().toISOString(),
        });
      if (assignErr) {
        console.warn(
          "[esdd/responses] auto-claim assignment insert failed (non-fatal):",
          assignErr.message,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[esdd/responses] auto-claim assignment lookup failed (non-fatal):",
      err,
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

  // Pull all rows for (bank, loan), newest first. Client picks up the
  // latest per question_id.
  const { data, error } = await supabase
    .from("bfi_esdd_responses")
    .select("id, question_id, answer, remarks, captured_at, officer_id")
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .order("captured_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Query failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Reduce to latest per question. `data` is already sorted newest-first,
  // so the first row we see for each questionId wins.
  const latest = new Map<
    string,
    {
      questionId: string;
      answer: string;
      remarks: string | null;
      capturedAt: string;
      officerId: string;
    }
  >();
  for (const row of data ?? []) {
    if (!latest.has(row.question_id)) {
      latest.set(row.question_id, {
        questionId: row.question_id,
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

/**
 * DELETE /api/esdd/responses?loanId=X
 *
 * Discard every response row this officer has recorded for this loan.
 * Used by the wizard's "Exit without saving" action. Deletion is scoped
 * to (bank_id, loan_id, officer_id) — other officers' work on the same
 * loan (if any) is untouched, and saved ESRM screenings that snapshot
 * the responses remain intact.
 */
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

  // Owner-only edit (P36). A non-owner shouldn't be able to nuke the
  // owner's answers via URL crafting.
  const denied = await assertOwnerOrRespond(loanId, officer, tenant);
  if (denied) return denied;

  const { error, count } = await supabase
    .from("bfi_esdd_responses")
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
