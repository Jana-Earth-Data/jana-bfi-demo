/**
 * Decide whether NRB Green Finance Taxonomy classification is expected
 * for a given loan / borrower.
 *
 * Rule of thumb: a loan is "taxonomy-expected" if the borrower's sector
 * maps to at least one activity in the taxonomy catalog. This covers
 * every sector NRB explicitly names in the taxonomy (renewables,
 * industry with transitional pathways, buildings, transport, water,
 * agriculture).
 *
 * Non-eligible sectors (services, retail, hospitality, personal loans)
 * skip the taxonomy panel entirely — an officer can still override on
 * the loan itself if the borrower has requested green tagging, but the
 * default keeps taxonomy noise off loans where it is not meaningful.
 */

import {
  suggestActivitiesForSector,
  TAXONOMY_ACTIVITIES,
} from "@/lib/regulatory/taxonomy/activities";

export function isTaxonomyExpected(nrbSector: string | null | undefined): boolean {
  if (!nrbSector) return false;
  return suggestActivitiesForSector(nrbSector).length > 0;
}

/**
 * Returns the short taxonomy applicability label used in loan-cards.
 * Kept separate from isTaxonomyExpected so the UI copy can evolve
 * without touching the boolean logic.
 */
export function taxonomyApplicabilityLabel(
  nrbSector: string | null | undefined,
): string {
  if (isTaxonomyExpected(nrbSector)) return "Taxonomy applicable";
  return "Not taxonomy-eligible";
}

// Re-export for consumers that want to enumerate activity names once
// per session (e.g. for a "why is this applicable?" tooltip).
export { TAXONOMY_ACTIVITIES };
