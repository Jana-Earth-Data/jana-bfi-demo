/**
 * NRB Green Finance Taxonomy — Do No Significant Harm (DNSH) check library.
 *
 * The DNSH principle (borrowed from the EU taxonomy and adopted by NRB in
 * the October 2024 taxonomy) says an activity cannot count as Green /
 * Amber for one environmental objective if it materially harms another —
 * water, biodiversity, community, climate adaptation, circular economy,
 * or pollution.
 *
 * Before this refactor each activity's classifier hand-copied its own
 * DNSH questions (small hydro asked about environmental flow +
 * resettlement, medium hydro re-asked the same plus biodiversity offset,
 * large hydro re-asked all three plus cumulative impact + seismic
 * assessment). Same underlying concept, hand-copied across classifiers,
 * with drift risk on wording and citations.
 *
 * The central store below defines each DNSH check ONCE. Activities
 * declare which checks apply via `dnshCheckIds`. Consequences:
 *
 *   - Wording changes propagate to every activity that uses the check.
 *   - No drift between activities on the same underlying concept.
 *   - Adding a new activity picks DNSH checks from a menu instead of
 *     re-writing them.
 *   - The compliance verbatim pass reviews one canonical library
 *     instead of duplicated question text scattered across classifiers.
 *
 * Criterion IDs (dnsh_*) are the keys used in saved answers on
 * bfi_taxonomy_assessments.criterion_answers. Do NOT rename existing
 * criterion IDs without a data migration — saved rows reference these
 * strings.
 */

import type { TaxonomyCriterion } from "./types";

export type DnshCategory =
  | "water"
  | "biodiversity"
  | "community"
  | "climate_adaptation"
  | "circular_economy"
  | "pollution";

export type DnshCheck = {
  id: string;
  label: string;
  category: DnshCategory;
  criterion: TaxonomyCriterion;
  failureReason: string;
  citation: string;
};

export const DNSH_CHECKS: Record<string, DnshCheck> = {
  // ------------------------------------------------------------------
  // Water
  // ------------------------------------------------------------------
  environmental_flow: {
    id: "environmental_flow",
    label: "Environmental downstream flow maintained",
    category: "water",
    criterion: {
      id: "dnsh_environmental_flow",
      type: "yes_no",
      prompt:
        "Is the environmental release / downstream flow maintained per the project's licence conditions?",
      helpText:
        "Significant harm to downstream water bodies is disqualifying. Verify that the metered release matches the licence percentage.",
    },
    failureReason: "Environmental downstream flow not maintained",
    citation: "NRB GFT 2024 · DNSH · Water",
  },

  // ------------------------------------------------------------------
  // Community / Social
  // ------------------------------------------------------------------
  resettlement_discharged: {
    id: "resettlement_discharged",
    label: "Resettlement and community obligations discharged",
    category: "community",
    criterion: {
      id: "dnsh_resettlement_discharged",
      type: "yes_no",
      prompt:
        "Have all resettlement, land compensation, and community-benefit obligations agreed at licence time been discharged?",
      helpText:
        "Includes local shareholding, royalty-sharing, and any MoUs with affected VDCs / rural municipalities.",
    },
    failureReason: "Resettlement / community compensation obligations outstanding",
    citation: "NRB GFT 2024 · DNSH · Social",
  },

  // ------------------------------------------------------------------
  // Biodiversity
  // ------------------------------------------------------------------
  biodiversity_offset: {
    id: "biodiversity_offset",
    label: "Biodiversity offset / fish passage operational",
    category: "biodiversity",
    criterion: {
      id: "dnsh_biodiversity_offset",
      type: "yes_no",
      prompt:
        "Where the environmental study identified a biodiversity impact (migratory species, protected habitat), is the required offset or mitigation (e.g. fish passage) built and operational?",
      helpText:
        "If the EIA/IEE identified no significant biodiversity impact, answer Yes. If an impact was identified and mitigation is not in place, answer No.",
    },
    failureReason: "Required biodiversity offset / fish-passage measure not operational",
    citation: "NRB GFT 2024 · DNSH · Biodiversity",
  },
  cumulative_basin_impact: {
    id: "cumulative_basin_impact",
    label: "Cumulative basin-level impacts addressed",
    category: "biodiversity",
    criterion: {
      id: "dnsh_cumulative_basin_impact",
      type: "yes_no",
      prompt:
        "Have cumulative impacts on the river system (sediment transport, migratory fish, downstream users) been addressed per the EIA / SEA recommendations?",
      helpText:
        "Expected for large hydro on shared basins where multiple projects operate. Typically covered by a Strategic Environmental Assessment.",
    },
    failureReason: "Cumulative basin-level impacts not addressed",
    citation: "NRB GFT 2024 · DNSH · Biodiversity",
  },
  quarry_rehabilitation: {
    id: "quarry_rehabilitation",
    label: "Quarry rehabilitation plan approved and executing",
    category: "biodiversity",
    criterion: {
      id: "dnsh_quarry_rehabilitation",
      type: "yes_no",
      prompt:
        "Does the operator have and follow an approved quarry rehabilitation plan?",
      helpText:
        "Rehabilitation is a condition of most limestone leases in Nepal. Verify against the Department of Mines and Geology file.",
    },
    failureReason: "Approved quarry rehabilitation plan missing",
    citation: "NRB GFT 2024 · DNSH · Biodiversity",
  },

  // ------------------------------------------------------------------
  // Climate adaptation
  // ------------------------------------------------------------------
  seismic_assessment: {
    id: "seismic_assessment",
    label: "Seismic / landslide hazard assessment current",
    category: "climate_adaptation",
    criterion: {
      id: "dnsh_seismic_assessment",
      type: "yes_no",
      prompt:
        "Have seismic and landslide hazard assessments been updated post-2015 (or since the last major regional event) and has the design been updated accordingly?",
      helpText:
        "Nepal is a high-seismic-hazard country. Post-2015 earthquake and post-2021 Melamchi flood, updated hazard assessments are expected.",
    },
    failureReason: "Seismic / landslide hazard assessment not updated post-2015",
    citation: "NRB GFT 2024 · DNSH · Climate adaptation",
  },

  // ------------------------------------------------------------------
  // Pollution
  // ------------------------------------------------------------------
  land_use_conflict: {
    id: "land_use_conflict",
    label: "Land-use conflict avoided (protected / prime-agri / community)",
    category: "biodiversity",
    criterion: {
      id: "dnsh_land_use_conflict",
      type: "yes_no",
      prompt:
        "Does the site avoid protected areas, prime agricultural land, and areas with community land conflict?",
      helpText:
        "Siting on a protected area or contested land is a DNSH failure regardless of the project's climate benefits.",
    },
    failureReason: "Land-use conflict — site overlaps protected / prime-agri / disputed land",
    citation: "NRB GFT 2024 · DNSH · Biodiversity",
  },
};

// ---------------------------------------------------------------------------
// Helpers used by activity classifiers and the wizard renderer.
// ---------------------------------------------------------------------------

export type DnshEvaluation = {
  passed: boolean;
  failures: string[]; // human-readable failure reasons for rationale text
  failedCheckIds: string[]; // structured — for downstream analytics
};

/**
 * Evaluate a list of DNSH checks against a set of officer answers.
 * Returns pass/fail plus the list of failure reasons.
 */
export function evaluateDnsh(
  checkIds: string[],
  answers: Record<string, unknown>,
): DnshEvaluation {
  const failures: string[] = [];
  const failedCheckIds: string[] = [];
  for (const id of checkIds) {
    const check = DNSH_CHECKS[id];
    if (!check) continue;
    const answerId = check.criterion.id;
    if (check.criterion.type === "yes_no") {
      if (answers[answerId] !== true) {
        failures.push(check.failureReason);
        failedCheckIds.push(id);
      }
    }
    // Numeric DNSH checks are not currently modelled but could be added
    // here (e.g. groundwater-abstraction under-limit).
  }
  return { passed: failures.length === 0, failures, failedCheckIds };
}

/**
 * Materialise DNSH criteria for a set of check ids, in stable order.
 * Used by defineActivity() to append DNSH questions to each activity's
 * criteria list so the wizard asks them alongside activity-specific
 * questions.
 */
export function getDnshCriteria(checkIds: string[]): TaxonomyCriterion[] {
  return checkIds
    .map((id) => DNSH_CHECKS[id]?.criterion)
    .filter((c): c is TaxonomyCriterion => c !== undefined);
}
