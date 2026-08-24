/**
 * Fabricated findings — hand-picked answers that no evidence supports.
 *
 * Moved out of lib/regulatory/pcaf/scoring.ts, which is otherwise a faithful
 * implementation of the PCAF Part A §5 decision tree with paragraph-level
 * citations. These name lists were the one thing in that file that was not
 * derived from the standard, and they were consequential: matching a
 * substring here is what put a borrower at the top of the disclosure
 * histogram.
 *
 * Why that mattered enough to move
 * --------------------------------
 * The lists produce a claim -- "this borrower publishes third-party-verified
 * emissions" -- that nobody verified. A real bank would establish that by
 * opening the annual report and finding an assurance statement, which is what
 * lib/regulatory/pcaf/evidence-matrix.ts now provides. Leaving fabricated
 * answers compiled into the regulatory engine meant a live deployment would
 * inherit them, silently granting five named borrowers a data-quality score
 * they had not earned.
 *
 * They also failed in the other direction: every borrower NOT on the list read
 * as "does not publish emissions", which biased the whole book toward Score 5
 * and understated the bank's real data quality -- the exact figure the product
 * is sold on.
 *
 * The rule this establishes: lib/regulatory/** contains no fabricated content.
 * Regulatory modules encode the standard and operate on whatever they are
 * handed. Anything invented is injected from here, and a live build has
 * nothing to inject.
 */

import { mulberry32, rangeFloat } from "@/lib/data/util";

/**
 * Borrowers treated as publishing third-party-verified emissions
 * (PCAF Option 1a, Score 1).
 *
 * Matched by lower-cased substring against the borrower name so the fixture
 * survives re-ordering of the entity catalogue.
 */
export const PCAF_NAME_FIXTURES_VERIFIED: string[] = [
  // Publicly listed, one of the larger dry-process producers. Chosen as the
  // demo's Score 1 exemplar so the disclosure histogram has a top end.
  // Whether the company actually commissions assurance is not asserted here.
  "ghorahi",
];

/**
 * Borrowers treated as publishing unverified emissions
 * (PCAF Option 1b, Score 2).
 *
 * Plausible for the NEPSE-listed subset, whose annual reports often carry
 * scope 1 and 2 without ISO 14064 verification -- but plausible is not the
 * same as established, which is why this is a fixture and not a finding.
 */
export const PCAF_NAME_FIXTURES_UNVERIFIED: string[] = [
  "arghakhanchi",
  "hetauda cement",
  "butwal power",
];

// ---------------------------------------------------------------------------
// Synthetic air quality
// ---------------------------------------------------------------------------

/**
 * A plausible PM2.5 reading derived from a facility's coordinates.
 *
 * Moved out of lib/data/screening.ts, where it ran inline inside
 * buildScreening(). That function is called from a client component, so the
 * generator was being shipped to every browser -- the means to manufacture a
 * number that renders identically to a real OpenAQ station reading.
 *
 * Deterministic on the coordinates so the demo is stable between runs. The
 * latitude bands loosely track the real north-south gradient across Nepal:
 * the Terai is worse than the hills. That makes it plausible, not true.
 */
export function synthAirQuality(facility: {
  lat: number;
  lng: number;
  municipality?: string | null;
}): { pm25: number; readingDate: string; stationName: string } {
  const seedX = Math.floor(facility.lat * 1000);
  const seedY = Math.floor(facility.lng * 1000);
  const r = mulberry32(((seedX ^ seedY) | 1) >>> 0);
  const baseline = facility.lat < 27.5 ? 120 : facility.lat < 28 ? 80 : 50;
  return {
    pm25: Math.round(baseline + rangeFloat(-25, 60, r)),
    readingDate: "2025-11-01",
    stationName: facility.municipality
      ? `${facility.municipality} reference station`
      : "Nearest OpenAQ station",
  };
}
