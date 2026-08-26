/**
 * The zero state — a bank with no loan book loaded yet.
 *
 * This is not a placeholder or a fallback. It is the correct and expected
 * state of a live deployment before core-banking import exists: the bank has
 * signed up, nothing has been ingested, and the honest answer to "what are
 * your financed emissions" is that we do not know yet.
 *
 * It exists because the alternative is worse. Without it, a build with no
 * demo layer would have nothing to return from getBfiDemoData(), and the
 * pressure would be to keep the synthesizer around "just for the empty case"
 * -- which is exactly how fabricated loans end up in a production bundle.
 * Giving the live path a real answer removes the reason to reach for the
 * fake one.
 *
 * Everything here is genuinely zero or empty. No sample rows, no illustrative
 * borrower, nothing that could be mistaken for a real exposure. A reader who
 * sees this data should be in no doubt that the book is empty rather than
 * small.
 */

import type { BfiDemoData, PortfolioSummary } from "@/lib/types/bfi";
import { TREND_YEARS } from "@/lib/reporting/periods";

function emptySummary(): PortfolioSummary {
  return {
    totalLoans: 0,
    totalOutstandingUsd: 0,
    totalOutstandingNpr: 0,
    totalAttributedCo2eTonnes: 0,
    // Not 5. Five is the worst PCAF score, and claiming it would assert that
    // every loan was assessed and found to have the poorest data. Zero loans
    // have no weighted average at all.
    weightedDataQuality: 0,
    taxonomyBreakdown: { green: 0, amber: 0, red: 0, unclassified: 0 },
    taxonomyBreakdownValue: { green: 0, amber: 0, red: 0, unclassified: 0 },
    sectorBreakdown: [],
    dataQualityDistribution: [1, 2, 3, 4, 5].map((score) => ({
      score: score as 1 | 2 | 3 | 4 | 5,
      loanCount: 0,
      outstandingUsd: 0,
      outstandingNpr: 0,
      attributedCo2eTonnes: 0,
    })),
    // The year axis is kept so a chart renders an empty frame rather than
    // collapsing. An absent axis reads as a broken component; a flat zero
    // line reads as no data, which is the truth.
    trend: TREND_YEARS.map((year) => ({
      year,
      totalAttributedCo2eTonnes: 0,
      byTaxonomy: { green: 0, amber: 0, red: 0, unclassified: 0 },
    })),
  };
}

/**
 * A valid, entirely empty portfolio envelope.
 *
 * @param bankName shown in the UI chrome; the tenant is known even when the
 *                 book is not.
 */
export function emptyPortfolio(bankName = "—"): BfiDemoData {
  return {
    meta: {
      bankName,
      isMock: false,
      generatedAt: new Date().toISOString(),
      pcafMethodologyNote:
        "No loan portfolio has been loaded. Financed emissions cannot be " +
        "calculated until the bank's exposures are imported.",
    },
    borrowers: [],
    loans: [],
    attributions: [],
    portfolio: emptySummary(),
  };
}

/** True when the envelope carries no exposures. Drives the UI empty states. */
export function isEmptyPortfolio(data: BfiDemoData): boolean {
  return data.loans.length === 0;
}
