/**
 * POST /api/taxonomy/assessments
 *
 *   Body: { loanId, borrowerId, activityId, criterionAnswers }
 *   Runs criterionAnswers through the activity's classify() function,
 *   inserts the derived color + rationale + citation into
 *   bfi_taxonomy_assessments. Response echoes the derivation.
 *
 * GET /api/taxonomy/assessments?loanId=X
 *   Returns the latest assessment for the loan (by captured_at desc).
 *
 * Both paths require resolved tenant + officer.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { findActivityById } from "@/lib/regulatory/taxonomy/activities";

export const dynamic = "force-dynamic";

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
      { error: "Officer must be selected before saving an assessment." },
      { status: 401 },
    );
  }

  let body: {
    loanId?: string;
    borrowerId?: string;
    activityId?: string;
    criterionAnswers?: Record<string, unknown>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { loanId, borrowerId, activityId } = body;
  const answers = body.criterionAnswers ?? {};
  if (!loanId || !borrowerId || !activityId) {
    return NextResponse.json(
      { error: "loanId, borrowerId, and activityId are required." },
      { status: 400 },
    );
  }
  const activity = findActivityById(activityId);
  if (!activity) {
    return NextResponse.json(
      { error: `Unknown activityId: ${activityId}` },
      { status: 400 },
    );
  }

  const derivation = activity.classify(answers);

  const { data: inserted, error } = await supabase
    .from("bfi_taxonomy_assessments")
    .insert({
      bank_id: tenant.id,
      loan_id: loanId,
      borrower_id: borrowerId,
      officer_id: officer.id,
      activity_id: activityId,
      criterion_answers: answers,
      computed_color: derivation.color,
      computed_rationale: derivation.rationale,
      citation: derivation.citation,
    })
    .select("id, captured_at")
    .single();
  if (error) {
    return NextResponse.json(
      { error: `Assessment insert failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    assessment: {
      id: inserted.id,
      capturedAt: inserted.captured_at,
      loanId,
      borrowerId,
      activityId,
      activityName: activity.name,
      officer: { id: officer.id, name: officer.name, role: officer.role },
      color: derivation.color,
      rationale: derivation.rationale,
      citation: derivation.citation,
      dnshFailures: derivation.dnshFailures ?? [],
    },
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
    .from("bfi_taxonomy_assessments")
    .select(
      "id, activity_id, criterion_answers, computed_color, computed_rationale, citation, captured_at, officer_id",
    )
    .eq("bank_id", tenant.id)
    .eq("loan_id", loanId)
    .order("captured_at", { ascending: false })
    .limit(1);
  if (error) {
    return NextResponse.json(
      { error: `Query failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    loanId,
    latest: data && data[0] ? data[0] : null,
  });
}
