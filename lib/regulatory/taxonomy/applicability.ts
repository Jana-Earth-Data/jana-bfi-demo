/**
 * Decide whether NRB Green Finance Taxonomy classification is expected
 * for a given loan / borrower.
 *
 * Rule of thumb: a loan is "taxonomy-expected" if the borrower's sector
 * maps to at least one activity in the taxonomy catalog. This covers
 * every sector NRB explicitly names in Annex 2 (renewables, transitional
 * industry, buildings, transport, water, agriculture, waste, hospitality,
 * consumer / retail with a green product tie-in).
 *
 * Sector labels come from the demo data's `borrower.nrbSector` field,
 * which uses colon-free "Category - Detail" strings (see
 * lib/data/entities.ts). We match these against the activity
 * `applicableTo` patterns via substring search plus an explicit
 * fallback map for a few labels that don't have a natural substring
 * overlap with an activity key (e.g. "Manufacturing - Brick" → cement
 * transitional; "Manufacturing - Steel" → not currently in the
 * catalogue but flagged as taxonomy-eligible for expected-coverage
 * behaviour).
 */

import {
  suggestActivitiesForSector as suggestByPattern,
  TAXONOMY_ACTIVITIES,
  type TaxonomyActivity,
} from "@/lib/regulatory/taxonomy/activities";

/**
 * Extra sector → activity id hints for demo-data sector labels that
 * don't overlap textually with any activity's `applicableTo` patterns.
 * Add sparingly — the primary matcher is the substring test on
 * `applicableTo`.
 */
const SECTOR_HINTS: Array<{ match: RegExp; activityIds: string[] }> = [
  // Cement / brick / clinker → the transitional cement wizard.
  { match: /manufacturing\s*-\s*(cement|brick|clinker)/i, activityIds: ["cement-whr"] },
  // Steel / plastics / chemicals — no dedicated activity yet, but the
  // portfolio should still surface as taxonomy-eligible so an officer
  // can pick the closest activity manually.
  {
    match: /manufacturing\s*-\s*(steel|plastics|chemicals)/i,
    activityIds: ["cement-whr"],
  },
  // Textiles → dedicated §5.2 activity.
  { match: /manufacturing\s*-\s*textiles/i, activityIds: ["textile-garments"] },
  // FMCG / food & beverage / agriculture processing → §4.1 food processing.
  {
    match: /manufacturing\s*-\s*fmcg|beverage|food/i,
    activityIds: ["food-processing"],
  },
  { match: /agriculture\s*-\s*processing/i, activityIds: ["food-processing"] },
  // Hydropower / renewable energy.
  { match: /energy\s*-\s*hydro/i, activityIds: ["hydro"] },
  { match: /energy\s*-\s*solar/i, activityIds: ["solar-utility"] },
  { match: /energy\s*-\s*wind/i, activityIds: ["wind-energy"] },
  // Waste utilities.
  {
    match: /utilities\s*-\s*waste|waste management/i,
    activityIds: ["waste-management"],
  },
  // Hospitality / tourism.
  {
    match: /hospitality\s*-\s*tourism|tourism/i,
    activityIds: ["hotel-tourism"],
  },
  // Transport & storage — commercial fleet EV path.
  { match: /transport\s*&?\s*storage|transport/i, activityIds: ["ev-commercial"] },
  // Real estate → green buildings.
  { match: /real estate/i, activityIds: ["green-buildings"] },
  { match: /construction/i, activityIds: ["green-buildings"] },
  // Consumption / personal (retail) → personal EV or personal home loan.
  {
    match: /^retail$|consumption|personal/i,
    activityIds: ["ev-consumer", "personal-home-loan"],
  },
  // Financial services.
  {
    match: /finance|insurance|financial/i,
    activityIds: ["green-financial-intermediation"],
  },
];

function activitiesFromHints(nrbSector: string): TaxonomyActivity[] {
  const acc: TaxonomyActivity[] = [];
  for (const hint of SECTOR_HINTS) {
    if (!hint.match.test(nrbSector)) continue;
    for (const id of hint.activityIds) {
      const a = TAXONOMY_ACTIVITIES.find((x) => x.id === id);
      if (a && !acc.includes(a)) acc.push(a);
    }
  }
  return acc;
}

/**
 * Sector-aware activity suggester used by the wizard's activity picker
 * to pre-filter to the most relevant activities. Combines two sources:
 *   1. Substring match against each activity's `applicableTo` list.
 *   2. Explicit hint table for demo-data labels that don't share a
 *      substring with any activity key.
 */
export function suggestActivitiesForSector(
  nrbSector: string,
): TaxonomyActivity[] {
  const byPattern = suggestByPattern(nrbSector);
  const byHint = activitiesFromHints(nrbSector);
  const merged: TaxonomyActivity[] = [...byPattern];
  for (const a of byHint) {
    if (!merged.includes(a)) merged.push(a);
  }
  return merged;
}

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
