/**
 * Do No Significant Harm (DNSH) — Jana synthesis of NRB Table 1 (p. 22)
 * + activity red bullets, for wizard implementation. Named checks
 * (`environmental_flow`, `resettlement_discharged`, …) are OUR labels,
 * not NRB's.
 *
 * The NRB Green Finance Taxonomy (2024) does not enumerate a discrete
 * library of "named" DNSH checks. Instead it expresses DNSH as:
 *
 *   1. The four "significant harm" *conditions* in Table 1 (s. 2.3,
 *      p. 22) — one condition per environmental objective A / M / N / P.
 *   2. Explicit *red bullets* in each activity's Annex 2 cell (e.g.
 *      §7.1 hydro "in protected areas, biodiversity hotspot areas and
 *      disaster-prone areas"; §7.4 solar "significant land use that
 *      results in losses in ecosystems and biodiversity").
 *   3. A shared "Social and Inclusion Aspects" test (s. 2.3, p. 23) with
 *      three protections: human rights; forced-labour / children's-rights;
 *      inclusive treatment of vulnerable / marginalized communities.
 *
 * Every DNSH check below is tagged with (a) the NRB core objective it
 * defends against, and (b) the specific page anchor in Annex 2 or Table 1
 * that the check derives from. The check IDs (dnsh_*) are stable and
 * used as answer keys on `bfi_taxonomy_assessments.criterion_answers`.
 * Do NOT rename existing criterion IDs without a data migration — saved
 * rows reference these strings.
 */

import type { NrbObjective, TaxonomyCriterion } from "./types";

/**
 * NRB Table 1 "conditions for causing significant harm" — verbatim per
 * s. 2.3, p. 22. Referenced by every DNSH check as the authoritative
 * upstream test.
 */
export const NRB_OBJECTIVES: Record<
  NrbObjective,
  { code: NrbObjective; name: string; harmCondition: string; citation: string }
> = {
  A: {
    code: "A",
    name: "Climate Change Adaptation",
    harmCondition:
      "Where that activity leads to an increased adverse impact of the current climate and the expected future climate, on the activity itself or on people, nature or assets including maladaptation practices.",
    citation: "NRB GFT 2024 · Table 1 (s. 2.3, p. 22)",
  },
  M: {
    code: "M",
    name: "Climate Change Mitigation",
    harmCondition:
      "Where that activity leads to significant greenhouse gas emissions.",
    citation: "NRB GFT 2024 · Table 1 (s. 2.3, p. 22)",
  },
  N: {
    code: "N",
    name: "Natural Resource Management and Conservation",
    harmCondition:
      "Activity is detrimental to the good condition and resilience of the ecosystem; the conservation status of habitat and species; and the ecological potential of the natural resources.",
    citation: "NRB GFT 2024 · Table 1 (s. 2.3, p. 22)",
  },
  P: {
    code: "P",
    name: "Pollution Prevention and Control",
    harmCondition:
      "Where the activity leads to a significant increase in emissions of pollutants into air, water or land as compared with the situation before the activity started.",
    citation: "NRB GFT 2024 · Table 1 (s. 2.3, p. 22)",
  },
};

/**
 * The three Social & Inclusion protections (s. 2.3, p. 23). Not encoded
 * as individual DNSH checks below, but activities can cite this constant
 * where a red bullet reflects a social/inclusion concern (e.g. §7.1
 * hydro resettlement).
 */
export const NRB_SOCIAL_INCLUSION = {
  citation: "NRB GFT 2024 · Social and Inclusion Aspects (s. 2.3, p. 23)",
  protections: [
    "Protection of human rights",
    "Prevention from forced labour and protection of children's rights",
    "Inclusive and targeted measures for local communities, prioritising vulnerable and marginalized populations",
  ],
};

/**
 * DNSH category — kept as our internal grouping so the wizard can
 * cluster checks by theme. Each category maps loosely to one of the
 * four NRB objectives via the `objective` field on each DnshCheck.
 */
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
  /** NRB Core Objective (A / M / N / P) this check defends against. */
  objective: NrbObjective;
  criterion: TaxonomyCriterion;
  failureReason: string;
  /** Full page-anchored citation into Annex 2 red bullets or Table 1. */
  citation: string;
};

export const DNSH_CHECKS: Record<string, DnshCheck> = {
  // ------------------------------------------------------------------
  // Water — derived from §7.1 hydro Green language (EIA/IEE current)
  // and §7.8 Water red bullets (over-extraction beyond recharge).
  // Table 1 objective N: detrimental to ecological potential of the
  // natural resources.
  // ------------------------------------------------------------------
  environmental_flow: {
    id: "environmental_flow",
    label: "Environmental downstream flow maintained",
    category: "water",
    objective: "N",
    criterion: {
      id: "dnsh_environmental_flow",
      type: "yes_no",
      prompt:
        "Is the environmental release / downstream flow maintained per the project's licence conditions?",
      helpText:
        "Significant harm to downstream water bodies is disqualifying under NRB Table 1 objective N. Verify that the metered release matches the licence percentage.",
    },
    failureReason: "Environmental downstream flow not maintained",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §7.1 Hydroelectricity (p. 104) EIA/IEE requirement and Table 1 objective N (p. 22)",
  },

  // ------------------------------------------------------------------
  // Community / Social — derived from §7.1 ESAP requirement in the
  // hydro Green cell plus the Social & Inclusion Aspects test (p. 23).
  // ------------------------------------------------------------------
  resettlement_discharged: {
    id: "resettlement_discharged",
    label: "Resettlement and community obligations discharged",
    category: "community",
    objective: "N",
    criterion: {
      id: "dnsh_resettlement_discharged",
      type: "yes_no",
      prompt:
        "Have all resettlement, land compensation, and community-benefit obligations agreed at licence time been discharged?",
      helpText:
        "Includes local shareholding, royalty-sharing, and any MoUs with affected rural municipalities. NRB requires an Environmental and Social Action Plan (ESAP) at §7.1.",
    },
    failureReason:
      "Resettlement / community compensation obligations outstanding",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §7.1 (ESAP requirement, p. 105) + Social & Inclusion Aspects (s. 2.3, p. 23)",
  },

  // ------------------------------------------------------------------
  // Biodiversity — §7.1 red bullet (biodiversity hotspot avoidance) +
  // §7.4 red bullet (ecosystem/biodiversity losses).
  // Table 1 objective N.
  // ------------------------------------------------------------------
  biodiversity_offset: {
    id: "biodiversity_offset",
    label: "Biodiversity offset / fish passage operational",
    category: "biodiversity",
    objective: "N",
    criterion: {
      id: "dnsh_biodiversity_offset",
      type: "yes_no",
      prompt:
        "Where the environmental study identified a biodiversity impact (migratory species, protected habitat), is the required offset or mitigation (e.g. fish passage) built and operational?",
      helpText:
        "If the EIA/IEE identified no significant biodiversity impact, answer Yes. If an impact was identified and mitigation is not in place, answer No.",
    },
    failureReason:
      "Required biodiversity offset / fish-passage measure not operational",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §7.1 red bullet (biodiversity hotspots, p. 105) + Table 1 objective N (p. 22)",
  },
  cumulative_basin_impact: {
    id: "cumulative_basin_impact",
    label: "Cumulative basin-level impacts addressed",
    category: "biodiversity",
    objective: "N",
    criterion: {
      id: "dnsh_cumulative_basin_impact",
      type: "yes_no",
      prompt:
        "Have cumulative impacts on the river system (sediment transport, migratory fish, downstream users) been addressed per the EIA / SEA recommendations?",
      helpText:
        "Not verbatim from NRB — Jana editorial from IHA / Climate Bonds Initiative hydropower criteria referenced by NRB at §7.1 footnote 331 (p. 105).",
    },
    failureReason: "Cumulative basin-level impacts not addressed",
    citation:
      "Jana editorial · derived from NRB GFT 2024 · Annex 2 §7.1 footnote 331 (CBI/IHA reference, p. 105)",
  },
  quarry_rehabilitation: {
    id: "quarry_rehabilitation",
    label: "Quarry rehabilitation plan approved and executing",
    category: "biodiversity",
    objective: "N",
    criterion: {
      id: "dnsh_quarry_rehabilitation",
      type: "yes_no",
      prompt:
        "Does the operator have and follow an approved quarry rehabilitation plan?",
      helpText:
        "Rehabilitation is a condition of most limestone leases in Nepal. Verify against the Department of Mines and Geology file.",
    },
    failureReason: "Approved quarry rehabilitation plan missing",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §3.3 Limestone red bullets (pp. 81-82) + Table 1 objective N (p. 22)",
  },

  // ------------------------------------------------------------------
  // Climate adaptation — Nepal-context Jana editorial, not verbatim in
  // NRB. Table 1 objective A: adverse impact on the activity itself or
  // on people from expected future climate.
  // ------------------------------------------------------------------
  seismic_assessment: {
    id: "seismic_assessment",
    label: "Seismic / landslide hazard assessment current",
    category: "climate_adaptation",
    objective: "A",
    criterion: {
      id: "dnsh_seismic_assessment",
      type: "yes_no",
      prompt:
        "Have seismic and landslide hazard assessments been updated post-2015 (or since the last major regional event) and has the design been updated accordingly?",
      helpText:
        "Not verbatim from NRB — Jana editorial from Nepal EPA / EPR and post-2015 hazard practice. Nepal is a high-seismic-hazard country.",
    },
    failureReason: "Seismic / landslide hazard assessment not updated post-2015",
    citation:
      "Jana editorial · derived from NRB GFT 2024 · Table 1 objective A (p. 22) + Nepal Environment Protection Act 2019 hazard practice",
  },

  // ------------------------------------------------------------------
  // Land-use conflict — §7.4 Solar red bullet ("significant land use
  // that results in losses in ecosystems and biodiversity") + §12.1
  // Real Estate red bullet (IUCN Red List).
  // Table 1 objective N.
  // ------------------------------------------------------------------
  land_use_conflict: {
    id: "land_use_conflict",
    label: "Land-use conflict avoided (protected / prime-agri / community)",
    category: "biodiversity",
    objective: "N",
    criterion: {
      id: "dnsh_land_use_conflict",
      type: "yes_no",
      prompt:
        "Does the site avoid protected areas, prime agricultural land, IUCN Red-List habitats, and areas with community land conflict?",
      helpText:
        "Siting on a protected area or contested land is a DNSH failure regardless of the project's climate benefits.",
    },
    failureReason:
      "Land-use conflict — site overlaps protected / prime-agri / disputed land",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §7.4 Solar red bullet (p. 107) + §12.1 Real Estate red bullet (p. 131)",
  },

  // ------------------------------------------------------------------
  // Effluent / wastewater treatment — derived from §5.2 Textile red
  // bullets (dye effluent) and §15.2 Waste Management Green criteria
  // (wastewater treatment). Table 1 objective P.
  // ------------------------------------------------------------------
  effluent_treatment: {
    id: "effluent_treatment",
    label: "Effluent / wastewater treated to regulatory standard",
    category: "pollution",
    objective: "P",
    criterion: {
      id: "dnsh_effluent_treatment",
      type: "yes_no",
      prompt:
        "Is process effluent treated (e.g. functioning ETP) and does the discharge meet the Nepal effluent standards under the Environment Protection Rules?",
      helpText:
        "Discharging untreated dye, tannery, food-processing, or paper effluent into rivers is a DNSH failure under objective P.",
    },
    failureReason: "Effluent / wastewater not treated to regulatory standard",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §5.2 Textile red bullets (p. 93) + §15.2 Waste Management (p. 137) + Table 1 objective P (p. 22)",
  },

  // ------------------------------------------------------------------
  // Air emissions compliance — brick, cement, clinker sectors.
  // Derived from §5.11 Cement red bullets ("dust, noise, GHG (esp.
  // CO2) contamination") and §5.18 Clinker red bullet ("high polluting
  // and does not meet environment standards"). Table 1 objective P.
  // ------------------------------------------------------------------
  air_emissions_compliance: {
    id: "air_emissions_compliance",
    label: "Stack air emissions within Environment Protection Rules limits",
    category: "pollution",
    objective: "P",
    criterion: {
      id: "dnsh_air_emissions_compliance",
      type: "yes_no",
      prompt:
        "Are kiln / stack particulate matter and gaseous emissions within the limits set by the Environment Protection Rules?",
      helpText:
        "Applies to cement, clinker, brick, boiler-based food processing. Verify against DoEnv / MoEnv stack monitoring reports.",
    },
    failureReason:
      "Stack air emissions exceed Environment Protection Rules limits",
    citation:
      "Jana check derived from NRB GFT 2024 · Annex 2 §5.11 Cement red bullets (p. 98) + §5.18 Clinker (p. 99) + Table 1 objective P (p. 22)",
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
