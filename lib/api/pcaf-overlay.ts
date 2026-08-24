/**
 * Officer PCAF overlay — makes reviewed data-availability reach the number.
 *
 * The problem
 * -----------
 * Every PCAF data-quality score in the disclosed totals is computed by
 * pcafFor() inside lib/data/portfolio.ts, which runs at BUILD time:
 * scripts/precompute-portfolio.ts calls getPortfolio(), gzips the result and
 * ships a static file. That file is tenant-agnostic and cannot read anything
 * an officer does.
 *
 * So an officer could work through the PCAF availability panel, confirm every
 * flag against evidence, save it, and the headline financed-emissions figure
 * and weighted data-quality score would not move. The bank does the review
 * and discloses a number computed as though they had not. In the demo that is
 * invisible, because the portfolio is synthetic and the panel is a
 * walkthrough. In a deployment it is the product quietly failing at its
 * purpose.
 *
 * The approach
 * ------------
 * lib/api/bfi.ts already establishes the pattern: take the precomputed base,
 * overlay something known at request time, recompute the affected
 * attributions, rebuild the summary. That is how live Climate TRACE emissions
 * reach the totals. This module does the same for officer input.
 *
 * Deliberately narrow. It re-scores ONLY the loans whose borrower has a saved
 * availability row, and leaves the other ~80,000 untouched. The precompute
 * exists because synthesising the book took roughly fifty seconds; an overlay
 * that walked every loan would hand that cost back on every request.
 *
 * What it does not do
 * -------------------
 * It does not change attributed tonnes. The PCAF score describes how well the
 * emissions are known, not how large they are: moving a borrower from Score 5
 * to Score 3 says the same tonnage now rests on measured production rather
 * than a sector average. Attribution factor and attributed CO2e are
 * untouched, so only the data-quality figures move.
 */

import type {
  BfiDemoData,
  Borrower,
  Loan,
  PcafAttribution,
} from "@/lib/types/bfi";
import type { PcafDataAvailability } from "@/lib/regulatory/pcaf/types";
import {
  assetClassForLoanCategory,
  computePcafScore,
  inferPcafAvailability,
  resolvePcafAvailability,
} from "@/lib/regulatory/pcaf/scoring";
import { recomputeSummary } from "@/lib/api/bfi";

/** Flag columns as stored on bfi_pcaf_availability. */
const FLAG_COLUMNS = [
  "borrower_publishes_verified",
  "borrower_publishes_unverified",
  "energy_consumption_data_available",
  "physical_activity_data_available",
  "revenue_data_available",
  "sector_average_only",
  "out_of_scope",
] as const;

type AvailabilityRow = Record<(typeof FLAG_COLUMNS)[number], boolean> & {
  borrower_id: string;
};

function rowToFlags(row: AvailabilityRow): PcafDataAvailability {
  return {
    borrower_publishes_verified: row.borrower_publishes_verified,
    borrower_publishes_unverified: row.borrower_publishes_unverified,
    energy_consumption_data_available: row.energy_consumption_data_available,
    physical_activity_data_available: row.physical_activity_data_available,
    revenue_data_available: row.revenue_data_available,
    sector_average_only: row.sector_average_only,
    out_of_scope: row.out_of_scope,
  };
}

export type OverlayResult = {
  data: BfiDemoData;
  /** Loans whose data-quality score changed. Empty when nothing was reviewed. */
  rescoredLoanIds: string[];
  /** Borrowers with a saved availability row, reviewed or not. */
  reviewedBorrowerCount: number;
  /**
   * False when the availability read failed. The caller should say the
   * disclosure is unadjusted rather than present it as officer-reviewed --
   * silently returning the un-overlaid number would misattribute a machine
   * estimate to a human review.
   */
  overlayApplied: boolean;
};

/**
 * Re-score the loans of every borrower with saved officer availability.
 *
 * `supabase` is passed in rather than imported so this stays testable and so
 * the caller owns the tenant scoping decision -- reading another bank's
 * availability into this bank's disclosure would be a data-isolation bug, not
 * merely a wrong number.
 */
export async function applyOfficerPcafOverlay(
  data: BfiDemoData,
  tenantId: string,
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: AvailabilityRow[] | null; error: { message: string } | null }>;
      };
    };
  },
): Promise<OverlayResult> {
  const { data: rows, error } = await supabase
    .from("bfi_pcaf_availability")
    .select(["borrower_id", ...FLAG_COLUMNS].join(", "))
    .eq("bank_id", tenantId);

  if (error) {
    // Loud, and flagged to the caller. An overlay that fails quietly would
    // hand back the build-time number while the UI claims it reflects the
    // officer's review.
    console.error(
      "[pcaf-overlay] availability read failed; disclosure left unadjusted:",
      error.message,
    );
    return {
      data,
      rescoredLoanIds: [],
      reviewedBorrowerCount: 0,
      overlayApplied: false,
    };
  }

  const savedByBorrower = new Map<string, PcafDataAvailability>();
  for (const row of rows ?? []) {
    savedByBorrower.set(row.borrower_id, rowToFlags(row));
  }
  if (savedByBorrower.size === 0) {
    return {
      data,
      rescoredLoanIds: [],
      reviewedBorrowerCount: 0,
      overlayApplied: true,
    };
  }

  const borrowerById = new Map<string, Borrower>(
    data.borrowers.map((b) => [b.id, b]),
  );
  const attrByLoan = new Map<string, PcafAttribution>(
    data.attributions.map((a) => [a.loanId, a]),
  );

  const rescoredLoanIds: string[] = [];
  const nextAttributions: PcafAttribution[] = data.attributions.map((a) => a);
  const indexByLoan = new Map(
    data.attributions.map((a, i) => [a.loanId, i] as const),
  );

  // Walk loans once, but only do work for the reviewed borrowers.
  for (const loan of data.loans as Loan[]) {
    const saved = savedByBorrower.get(loan.borrowerId);
    if (!saved) continue;

    const borrower = borrowerById.get(loan.borrowerId);
    const prev = attrByLoan.get(loan.id);
    const idx = indexByLoan.get(loan.id);
    if (!borrower || !prev || idx === undefined) continue;

    // Same merge the availability panel shows the officer, so the score here
    // matches the one they were looking at when they saved.
    const inferred = inferPcafAvailability(borrower, loan.category);
    const resolved = resolvePcafAvailability(inferred, saved);

    const assetClass = assetClassForLoanCategory(loan.category);
    const computed = computePcafScore(
      loan,
      borrower,
      null,
      resolved,
      assetClass,
    );

    if (computed.score === prev.dataQualityScore) continue;

    nextAttributions[idx] = {
      ...prev,
      // Attribution is untouched: the score says how well the emissions are
      // known, not how large they are.
      dataQualityScore: computed.score,
      qualityNote: computed.method,
      pcafOption: computed.option,
    };
    rescoredLoanIds.push(loan.id);
  }

  if (rescoredLoanIds.length === 0) {
    return {
      data,
      rescoredLoanIds: [],
      reviewedBorrowerCount: savedByBorrower.size,
      overlayApplied: true,
    };
  }

  // Rebuild the aggregates through the same function the live-emissions
  // overlay uses. Writing a third aggregator here would add another member to
  // the buildSummary / recomputeSummary pair that already has to be kept in
  // step by hand.
  const portfolio = recomputeSummary(
    data.loans,
    data.borrowers,
    nextAttributions,
  );

  return {
    data: {
      ...data,
      attributions: nextAttributions,
      portfolio,
      meta: {
        ...data.meta,
        generatedAt: new Date().toISOString(),
      },
    },
    rescoredLoanIds,
    reviewedBorrowerCount: savedByBorrower.size,
    overlayApplied: true,
  };
}
