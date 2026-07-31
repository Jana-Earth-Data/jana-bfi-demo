/**
 * Derive a hydropower borrower's total installed capacity (MW) so the
 * Annex 2 documentation matrix can pick the correct capacity band.
 *
 * The Borrower type does not carry `capacityMw` directly — capacity lives
 * per operating station in `data/hydropower-operators-npl.json`. We match
 * by operator name (borrower.name) against that snapshot and sum the
 * station capacities. Falls back to 0 when the borrower is not in the
 * hydro snapshot, which drops the band to "under-1mw" (the officer can
 * still record status against the small-hydro DEOD-info document).
 *
 * Verbatim source for the doc matrix: NRB Circular 22 Annex 2 (ESRM
 * Guideline PDF p. 25).
 */

import hydroSnapshot from "@/data/hydropower-operators-npl.json";
import type { Borrower } from "@/lib/types/bfi";

type HydroOperator = (typeof hydroSnapshot.operators)[number];

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+limited$/i, "").replace(/\s+/g, " ").trim();
}

/**
 * Sum installed capacity (MW) across every operating station registered
 * for the hydropower operator whose name matches this borrower.
 *
 * Match rules (in priority order):
 *   1. Exact case-insensitive name match against operator.name.
 *   2. Normalised match (trailing "Limited" stripped, whitespace collapsed).
 *   3. Substring match either direction (operator name contained in
 *      borrower name, or vice versa) — handles "Himal Power" vs.
 *      "Himal Power Limited".
 */
export function getBorrowerHydroCapacityMw(borrower: Borrower): number {
  const target = borrower.name;
  const targetLower = target.toLowerCase();
  const targetNorm = normalise(target);
  const operators = hydroSnapshot.operators as HydroOperator[];

  // 1) exact case-insensitive
  let op = operators.find((o) => o.name.toLowerCase() === targetLower);
  // 2) normalised
  if (!op) op = operators.find((o) => normalise(o.name) === targetNorm);
  // 3) substring
  if (!op) {
    op = operators.find((o) => {
      const oLower = o.name.toLowerCase();
      return oLower.includes(targetLower) || targetLower.includes(oLower);
    });
  }
  if (!op) return 0;

  return op.operatingStations.reduce((s, x) => s + x.capacityMw, 0);
}
