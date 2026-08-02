/**
 * GET /api/portfolio/taxonomy-summary
 *
 * Aggregates the tenant's saved NRB Green Finance Taxonomy assessments
 * into a Green / Amber / Red / Unclassified roll-up for the NFRS
 * disclosure tab. Only the latest assessment per (bank_id, loan_id) is
 * counted.
 *
 * Enrichment:
 *   - NPR outstanding per loan comes from the in-memory demo portfolio
 *     (getBfiDemoData()) so the response matches the loan book shown
 *     elsewhere in the demo.
 *   - Human-readable activity names come from the taxonomy activity
 *     catalog (findActivityById).
 *
 * Extra: `totalUnclassifiedApplicable` counts loans in taxonomy-eligible
 * sectors that have NO saved assessment — so the disclosure can flag
 * "N loans in eligible sectors not yet classified" without conflating
 * unclassified-by-rule with unclassified-because-not-yet-reviewed.
 *
 * Scoped by tenant via resolveCurrentTenant() → bank_id.
 */

import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import { findActivityById } from "@/lib/regulatory/taxonomy/activities";
import { isTaxonomyExpected } from "@/lib/regulatory/taxonomy/applicability";
import type { NrbTaxonomyColor } from "@/lib/types/bfi";

export const dynamic = "force-dynamic";

type BucketKey = "green" | "amber" | "red" | "unclassified";

type ActivityBreakdown = {
  activityId: string;
  activityName: string;
  count: number;
  nprTotal: number;
};

type BucketTotal = {
  count: number;
  nprTotal: number;
  activityBreakdown: ActivityBreakdown[];
};

type PortfolioScope = {
  totalLoans: number;
  totalOutstandingNpr: number;
  retailLoans: number;
  retailOutstandingNpr: number;
  inScopeLoans: number;
  inScopeOutstandingNpr: number;
  classifiedLoans: number;
  classifiedOutstandingNpr: number;
};

type TaxonomySummaryResponse = {
  ok: true;
  tenant: { id: string; displayName: string };
  scope: PortfolioScope;
  totals: Record<BucketKey, BucketTotal>;
  totalClassified: number;
  totalUnclassifiedApplicable: number;
};

function emptyTotals(): Record<BucketKey, BucketTotal> {
  return {
    green: { count: 0, nprTotal: 0, activityBreakdown: [] },
    amber: { count: 0, nprTotal: 0, activityBreakdown: [] },
    red: { count: 0, nprTotal: 0, activityBreakdown: [] },
    unclassified: { count: 0, nprTotal: 0, activityBreakdown: [] },
  };
}

function normaliseColor(v: string | null | undefined): BucketKey {
  if (v === "green" || v === "amber" || v === "red") return v;
  return "unclassified";
}

export async function GET() {
  const tenant = await resolveCurrentTenant();
  const supabase = getSupabaseAdmin();

  // Loan book — needed for NPR outstanding and taxonomy-eligibility lookup.
  const data = await getBfiDemoData();
  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));

  // NPR outstanding per loan id — pulled from the same in-memory portfolio
  // used elsewhere. Assessments reference loan ids that exist in this book.
  const nprByLoan = new Map<string, number>();
  const sectorByLoan = new Map<string, string>();
  for (const loan of data.loans) {
    nprByLoan.set(loan.id, loan.outstandingNpr);
    const borrower = borrowerById.get(loan.borrowerId);
    if (borrower) sectorByLoan.set(loan.id, borrower.nrbSector);
  }

  // Load latest assessment per (bank_id, loan_id). Supabase pagination cap
  // for a single fetch is 1000; the demo portfolios stay well under that.
  // If a tenant ever exceeds it we can page — but the NFRS disclosure is
  // never rendered from a partial roll-up, so we take the whole set.
  let latestByLoan = new Map<
    string,
    { activityId: string; color: BucketKey }
  >();

  const missingSupabase = !supabase;
  if (supabase) {
    const { data: rows, error } = await supabase
      .from("bfi_taxonomy_assessments")
      .select("loan_id, activity_id, computed_color, captured_at")
      .eq("bank_id", tenant.id)
      .order("captured_at", { ascending: false });
    if (error) {
      console.error(
        "[portfolio/taxonomy-summary] Supabase query failed:",
        error.message,
      );
      return NextResponse.json(
        { error: `Assessment query failed: ${error.message}` },
        { status: 500 },
      );
    }
    // First row per loan_id is the latest (order desc).
    for (const row of rows ?? []) {
      if (latestByLoan.has(row.loan_id)) continue;
      latestByLoan.set(row.loan_id, {
        activityId: row.activity_id,
        color: normaliseColor(row.computed_color as NrbTaxonomyColor),
      });
    }
  } else {
    // Local dev without Supabase env vars — return an honest empty
    // summary so the tab still renders instead of throwing 500.
    latestByLoan = new Map();
  }

  const totals = emptyTotals();

  // Bucket assessed loans, tracking per-activity counts + NPR sums.
  // Use nested maps first, then materialise into the array shape at the end.
  const activityAgg: Record<
    BucketKey,
    Map<string, { name: string; count: number; nprTotal: number }>
  > = {
    green: new Map(),
    amber: new Map(),
    red: new Map(),
    unclassified: new Map(),
  };

  for (const [loanId, assessment] of latestByLoan) {
    const bucket = assessment.color;
    const npr = nprByLoan.get(loanId) ?? 0;
    totals[bucket].count += 1;
    totals[bucket].nprTotal += npr;

    const activity = findActivityById(assessment.activityId);
    const activityName = activity?.name ?? assessment.activityId;
    const perActivity = activityAgg[bucket];
    const prev = perActivity.get(assessment.activityId);
    if (prev) {
      prev.count += 1;
      prev.nprTotal += npr;
    } else {
      perActivity.set(assessment.activityId, {
        name: activityName,
        count: 1,
        nprTotal: npr,
      });
    }
  }

  // Sweep the book: roll every in-scope loan without a saved
  // assessment into the Unclassified bucket, and compute the
  // portfolio-scope hierarchy. Retail loans (personal, mortgage,
  // education, vehicle) sit outside taxonomy scope per NRB Oct 2024.
  const scope: PortfolioScope = {
    totalLoans: 0,
    totalOutstandingNpr: 0,
    retailLoans: 0,
    retailOutstandingNpr: 0,
    inScopeLoans: 0,
    inScopeOutstandingNpr: 0,
    classifiedLoans: 0,
    classifiedOutstandingNpr: 0,
  };
  for (const loan of data.loans) {
    scope.totalLoans += 1;
    scope.totalOutstandingNpr += loan.outstandingNpr;
    const isRetail = loan.category?.startsWith("retail-") ?? false;
    if (isRetail) {
      scope.retailLoans += 1;
      scope.retailOutstandingNpr += loan.outstandingNpr;
      continue;
    }
    scope.inScopeLoans += 1;
    scope.inScopeOutstandingNpr += loan.outstandingNpr;
    if (latestByLoan.has(loan.id)) {
      scope.classifiedLoans += 1;
      scope.classifiedOutstandingNpr += loan.outstandingNpr;
    } else {
      totals.unclassified.count += 1;
      totals.unclassified.nprTotal += loan.outstandingNpr;
    }
  }

  // Materialise the activity breakdown arrays, largest exposure first.
  // Unclassified stays as an empty array per the response contract — a
  // loan with no assessment doesn't have an activity to attribute to.
  (Object.keys(activityAgg) as BucketKey[]).forEach((bucket) => {
    if (bucket === "unclassified") return;
    const list: ActivityBreakdown[] = Array.from(activityAgg[bucket].entries())
      .map(([activityId, v]) => ({
        activityId,
        activityName: v.name,
        count: v.count,
        nprTotal: v.nprTotal,
      }))
      .sort((a, b) => b.nprTotal - a.nprTotal);
    totals[bucket].activityBreakdown = list;
  });

  // Loans in taxonomy-eligible sectors that have NOT been assessed yet.
  // This is the disclosure's "known unknowns" bucket.
  let totalUnclassifiedApplicable = 0;
  for (const loan of data.loans) {
    if (latestByLoan.has(loan.id)) continue;
    const sector = sectorByLoan.get(loan.id);
    if (isTaxonomyExpected(sector)) totalUnclassifiedApplicable += 1;
  }

  const totalClassified =
    totals.green.count +
    totals.amber.count +
    totals.red.count +
    totals.unclassified.count;

  const body: TaxonomySummaryResponse = {
    ok: true,
    tenant: { id: tenant.id, displayName: tenant.branding.displayName },
    scope,
    totals,
    totalClassified,
    totalUnclassifiedApplicable,
  };

  // Signal to the client whether the roll-up came from a real backing
  // store or from the empty-fallback path, so demo runs without env vars
  // don't silently look like "no one has classified anything yet".
  const headers = new Headers();
  if (missingSupabase) headers.set("x-data-source", "empty-no-supabase");
  return NextResponse.json(body, { headers });
}
