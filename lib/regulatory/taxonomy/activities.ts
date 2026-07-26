/**
 * NRB Green Finance Taxonomy (October 2024) — activity catalog.
 *
 * The source doc is 153 pages and structures the taxonomy by economic
 * sector (Agriculture, Renewable Energy, Buildings, Transport, Water,
 * Industry) with per-activity Green (Transformative) / Amber
 * (Transitional) / Red classification and Do No Significant Harm (DNSH)
 * checks.
 *
 * This file encodes 10 representative activities covering the Nepal
 * cases most banks will underwrite: hydropower (small / medium / large),
 * utility-scale solar, cement with WHR, green commercial buildings,
 * organic agriculture, EVs, fossil-generation (auto-red), and
 * irrigation efficiency. Each activity has:
 *   - id             : stable identifier used on captured rows
 *   - name           : human-readable name shown in the wizard
 *   - nrbCitation    : section reference into the source document
 *   - sectorLabel    : NRB economic sector heading
 *   - applicableTo   : Borrower.nrbSector patterns this activity fits
 *   - dnshCheckIds   : DNSH checks from lib/regulatory/taxonomy/dnsh.ts
 *                       that apply to the activity (shared library)
 *   - activityCriteria: activity-specific questions (permits, capacity,
 *                       efficiency thresholds, etc.) — NOT DNSH
 *   - criteria       : the full list the wizard asks (activityCriteria
 *                       + resolved DNSH criteria), computed automatically
 *   - classify       : pure function that turns criterion answers into a
 *                       color + rationale + citation, using evaluateDnsh
 *                       for shared checks and inline logic for the rest
 *
 * DNSH refactor (Phase 6a): before this refactor each classifier hand-
 * copied its own DNSH questions. See lib/regulatory/taxonomy/dnsh.ts for
 * the motivation and the shared library.
 *
 * Follow-up compliance session: refine the criterion wording, add the
 * remaining ~15 activities (wind, small hydro under 1 MW, bagasse
 * cogeneration, textiles with ETP, waste-to-energy, etc.), and encode
 * verbatim NRB criterion language. See design_docs/COMPLIANCE_SESSION_HANDOFF.md.
 */

import type {
  TaxonomyActivity,
  TaxonomyClassification,
  TaxonomyColor,
  TaxonomyCriterion,
} from "./types";
import { evaluateDnsh, getDnshCriteria } from "./dnsh";

// Re-export shared types so existing consumers (which import from
// activities.ts) don't need to update their imports.
export type {
  TaxonomyActivity,
  TaxonomyClassification,
  TaxonomyColor,
  TaxonomyCriterion,
};

// Small helpers used by the individual classifiers.
const yn = (a: Record<string, unknown>, id: string): boolean => a[id] === true;
const num = (a: Record<string, unknown>, id: string): number | null => {
  const v = a[id];
  return typeof v === "number" ? v : null;
};

// ---------------------------------------------------------------------------
// defineActivity() — builds a TaxonomyActivity from a spec that keeps
// activity-specific criteria separate from DNSH check ids. The resolved
// `criteria` list combines both in stable order so the wizard asks them
// all.
// ---------------------------------------------------------------------------

type ActivitySpec = {
  id: string;
  name: string;
  sectorLabel: string;
  nrbCitation: string;
  applicableTo: string[];
  /** Activity-specific criteria (permits, capacity, efficiency thresholds). */
  activityCriteria: TaxonomyCriterion[];
  /** DNSH check ids from the central library that apply to this activity. */
  dnshCheckIds: string[];
  classify: (answers: Record<string, unknown>) => TaxonomyClassification;
};

function defineActivity(spec: ActivitySpec): TaxonomyActivity {
  return {
    id: spec.id,
    name: spec.name,
    sectorLabel: spec.sectorLabel,
    nrbCitation: spec.nrbCitation,
    applicableTo: spec.applicableTo,
    dnshCheckIds: spec.dnshCheckIds,
    criteria: [
      ...spec.activityCriteria,
      ...getDnshCriteria(spec.dnshCheckIds),
    ],
    classify: spec.classify,
  };
}

// ---------------------------------------------------------------------------
// Activity catalog
// ---------------------------------------------------------------------------

export const TAXONOMY_ACTIVITIES: TaxonomyActivity[] = [
  // -------------------------------------------------------------------------
  // Renewable Energy — Hydropower (small, up to 25 MW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "hydro-small",
    name: "Hydropower — small (up to 25 MW)",
    sectorLabel: "Renewable Energy",
    nrbCitation: "NRB GFT 2024, Ch. 2 / Annex 1 Renewable Energy",
    applicableTo: ["hydropower", "renewable"],
    activityCriteria: [
      {
        id: "installed_capacity_mw",
        type: "numeric",
        unit: "MW",
        prompt: "Installed capacity of the plant (MW)",
        helpText:
          "For run-of-river schemes report nameplate capacity. NRB treats hydropower up to 25 MW as small hydro under the taxonomy.",
      },
      {
        id: "iee_or_eia_current",
        type: "yes_no",
        prompt:
          "Does the plant hold a current Initial Environmental Examination (IEE) or Environmental Impact Assessment (EIA) approval?",
      },
    ],
    dnshCheckIds: ["environmental_flow", "resettlement_discharged"],
    classify: (a) => {
      const mw = num(a, "installed_capacity_mw");
      const iee = yn(a, "iee_or_eia_current");
      const dnsh = evaluateDnsh(
        ["environmental_flow", "resettlement_discharged"],
        a,
      );
      if (mw !== null && mw > 25) {
        return {
          color: "unclassified",
          rationale:
            "This wizard covers small hydro up to 25 MW. Go back to the activity picker and choose Hydropower — medium (25 to 100 MW) or Hydropower — large (over 100 MW) as appropriate; those wizards apply the correct DNSH checks.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      if (!iee) {
        return {
          color: "red",
          rationale:
            "Missing IEE / EIA approval disqualifies the activity from taxonomy alignment. Recommend the borrower obtain the approval before drawing conclusions.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Small hydro is a green-eligible activity but the DNSH checks below are not fully passed. Approve as amber (transitional) with conditions on the flagged items.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy · DNSH",
          dnshFailures: dnsh.failures,
        };
      }
      return {
        color: "green",
        rationale: `Small hydropower plant (${mw ?? "capacity not entered"} MW) with current IEE/EIA approval, maintained environmental flow, and cleared resettlement obligations. Aligns with the NRB Green Finance Taxonomy under Renewable Energy — Hydropower.`,
        citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Renewable Energy — Hydropower (medium, 25 to 100 MW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "hydro-medium",
    name: "Hydropower — medium (25 to 100 MW)",
    sectorLabel: "Renewable Energy",
    nrbCitation: "NRB GFT 2024, Ch. 2 / Annex 1 Renewable Energy",
    applicableTo: ["hydropower", "renewable"],
    activityCriteria: [
      {
        id: "installed_capacity_mw",
        type: "numeric",
        unit: "MW",
        prompt: "Installed capacity of the plant (MW)",
        helpText:
          "Medium hydro under NRB GFT covers 25 to 100 MW. Plants outside this range should be re-classified against the small (< 25 MW) or large (> 100 MW) wizard.",
      },
      {
        id: "iee_or_eia_current",
        type: "yes_no",
        prompt:
          "Does the plant hold a current Environmental Impact Assessment (EIA) approval?",
        helpText:
          "Medium hydro requires a full EIA under Nepal's Environment Protection Rules — an IEE alone is not sufficient.",
      },
    ],
    dnshCheckIds: [
      "environmental_flow",
      "resettlement_discharged",
      "biodiversity_offset",
    ],
    classify: (a) => {
      const mw = num(a, "installed_capacity_mw");
      const eia = yn(a, "iee_or_eia_current");
      const dnsh = evaluateDnsh(
        ["environmental_flow", "resettlement_discharged", "biodiversity_offset"],
        a,
      );
      if (mw !== null && (mw <= 25 || mw > 100)) {
        return {
          color: "unclassified",
          rationale:
            mw <= 25
              ? "This wizard covers medium hydro (25 to 100 MW). Re-run under the small-hydro activity."
              : "This wizard covers medium hydro (25 to 100 MW). Re-run under the large-hydro activity.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      if (!eia) {
        return {
          color: "red",
          rationale:
            "Medium hydro (25 to 100 MW) requires a full EIA under Nepal's Environment Protection Rules. Missing EIA disqualifies alignment. Recommend the borrower obtain the approval before drawing conclusions.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Medium hydro is a green-eligible activity but the DNSH checks below are not fully passed. Approve as amber (transitional) with conditions on the flagged items.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy · DNSH",
          dnshFailures: dnsh.failures,
        };
      }
      return {
        color: "green",
        rationale: `Medium hydropower plant (${mw ?? "capacity not entered"} MW) with current EIA approval, maintained environmental flow, cleared resettlement obligations, and biodiversity mitigation operational. Aligns with the NRB Green Finance Taxonomy under Renewable Energy — Hydropower.`,
        citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Renewable Energy — Hydropower (large, over 100 MW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "hydro-large",
    name: "Hydropower — large (over 100 MW)",
    sectorLabel: "Renewable Energy",
    nrbCitation: "NRB GFT 2024, Ch. 2 / Annex 1 Renewable Energy",
    applicableTo: ["hydropower", "renewable"],
    activityCriteria: [
      {
        id: "installed_capacity_mw",
        type: "numeric",
        unit: "MW",
        prompt: "Installed capacity of the plant (MW)",
        helpText:
          "Large hydro under NRB GFT covers plants above 100 MW. These typically include storage / peaking-run-of-river projects on the Bagmati, Karnali, or Koshi basins.",
      },
      {
        id: "eia_and_sea_current",
        type: "yes_no",
        prompt:
          "Is a full EIA in force AND (where applicable) a Strategic Environmental Assessment or basin-level cumulative-impact study?",
        helpText:
          "Large hydro is expected to demonstrate consideration of cumulative basin-level impacts, not just project-level EIA.",
      },
    ],
    dnshCheckIds: [
      "environmental_flow",
      "resettlement_discharged",
      "cumulative_basin_impact",
      "seismic_assessment",
    ],
    classify: (a) => {
      const mw = num(a, "installed_capacity_mw");
      const eia = yn(a, "eia_and_sea_current");
      const dnsh = evaluateDnsh(
        [
          "environmental_flow",
          "resettlement_discharged",
          "cumulative_basin_impact",
          "seismic_assessment",
        ],
        a,
      );
      if (mw !== null && mw <= 100) {
        return {
          color: "unclassified",
          rationale:
            "This wizard covers large hydro (over 100 MW). Re-run under the small or medium-hydro activity.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      if (!eia) {
        return {
          color: "red",
          rationale:
            "Large hydro requires a full EIA and — for projects with material basin-level impact — a Strategic Environmental Assessment. Missing either disqualifies alignment.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Large hydro is a green-eligible activity but the DNSH checks below are not fully passed. Approve as amber (transitional) with conditions on the flagged items. For large hydro, an escalation to credit committee is recommended regardless of the count of unmet DNSH items.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy · DNSH",
          dnshFailures: dnsh.failures,
        };
      }
      return {
        color: "green",
        rationale: `Large hydropower plant (${mw ?? "capacity not entered"} MW) with current EIA/SEA approval, maintained environmental flow, cleared resettlement / benefit-sharing obligations, addressed cumulative basin impacts, and updated seismic assessment. Aligns with the NRB Green Finance Taxonomy under Renewable Energy — Hydropower.`,
        citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Renewable Energy — Solar (utility scale)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "solar-utility",
    name: "Solar — utility-scale generation",
    sectorLabel: "Renewable Energy",
    nrbCitation: "NRB GFT 2024, Ch. 2 Renewable Energy",
    applicableTo: ["solar", "renewable"],
    activityCriteria: [
      {
        id: "installed_capacity_mw",
        type: "numeric",
        unit: "MW",
        prompt: "Installed capacity (MW)",
      },
      {
        id: "grid_interconnection_approved",
        type: "yes_no",
        prompt:
          "Has grid interconnection been approved by the Nepal Electricity Authority (NEA)?",
      },
    ],
    dnshCheckIds: ["land_use_conflict"],
    classify: (a) => {
      const gridOk = yn(a, "grid_interconnection_approved");
      const dnsh = evaluateDnsh(["land_use_conflict"], a);
      if (!dnsh.passed) {
        return {
          color: "red",
          rationale:
            "Land-use conflict or siting on a protected area / prime agricultural land disqualifies the activity per DNSH.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy · DNSH",
          dnshFailures: dnsh.failures,
        };
      }
      if (!gridOk) {
        return {
          color: "amber",
          rationale:
            "Solar generation is green-eligible but grid interconnection approval is pending. Amber (transitional) until NEA sign-off is received.",
          citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
        };
      }
      return {
        color: "green",
        rationale:
          "Utility-scale solar generation on a non-conflicted site with NEA-approved grid interconnection. Fully aligns with the NRB Green Finance Taxonomy under Renewable Energy.",
        citation: "NRB GFT 2024, Ch. 2 Renewable Energy",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Industry — Cement with Waste Heat Recovery
  // -------------------------------------------------------------------------
  defineActivity({
    id: "cement-whr",
    name: "Cement plant — with Waste Heat Recovery",
    sectorLabel: "Industry",
    nrbCitation: "NRB GFT 2024, Ch. 2 Industry — Cement",
    applicableTo: ["cement", "manufacturing"],
    activityCriteria: [
      {
        id: "whr_operational",
        type: "yes_no",
        prompt:
          "Is the Waste Heat Recovery (WHR) system installed and operational?",
      },
      {
        id: "kiln_pm_within_limits",
        type: "yes_no",
        prompt:
          "Are kiln stack particulate emissions within the limits set by the Environment Protection Rules?",
      },
      {
        id: "alternative_fuel_share_pct",
        type: "numeric",
        unit: "%",
        prompt: "Share of alternative or biomass fuel in the fuel mix (%)",
        helpText:
          "NRB treats co-processing of biomass or refuse-derived fuel as a transitional decarbonisation lever.",
      },
    ],
    dnshCheckIds: ["quarry_rehabilitation"],
    classify: (a) => {
      const whr = yn(a, "whr_operational");
      const pmOk = yn(a, "kiln_pm_within_limits");
      const altFuelPct = num(a, "alternative_fuel_share_pct") ?? 0;
      const dnsh = evaluateDnsh(["quarry_rehabilitation"], a);
      if (!pmOk) {
        return {
          color: "red",
          rationale:
            "Kiln stack emissions above the Environment Protection Rules limit disqualify the activity per DNSH.",
          citation: "NRB GFT 2024, Ch. 2 Industry — Cement · DNSH",
        };
      }
      if (!whr) {
        return {
          color: "red",
          rationale:
            "Cement production without Waste Heat Recovery is classified Red under the NRB taxonomy. Recommend financing WHR retrofits before reclassifying.",
          citation: "NRB GFT 2024, Ch. 2 Industry — Cement",
        };
      }
      if (altFuelPct >= 15) {
        return {
          color: "amber",
          rationale: `Cement plant with operational WHR, kiln emissions compliant, and ${altFuelPct}% alternative fuel share. Classified as Amber (transitional) — cement remains a hard-to-abate sector so full Green requires further alternative-fuel substitution.`,
          citation: "NRB GFT 2024, Ch. 2 Industry — Cement",
          dnshFailures: dnsh.passed ? undefined : dnsh.failures,
        };
      }
      return {
        color: "amber",
        rationale:
          "Cement plant with WHR and compliant emissions but low alternative-fuel share. Classified as Amber (transitional). Increasing biomass / RDF co-processing above 15% is the pathway toward stronger alignment.",
        citation: "NRB GFT 2024, Ch. 2 Industry — Cement",
        dnshFailures: dnsh.passed ? undefined : dnsh.failures,
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Buildings — Green commercial
  // -------------------------------------------------------------------------
  defineActivity({
    id: "green-buildings",
    name: "Commercial buildings — green retrofit or new construction",
    sectorLabel: "Buildings",
    nrbCitation: "NRB GFT 2024, Ch. 2 Buildings",
    applicableTo: ["real estate", "construction", "building"],
    activityCriteria: [
      {
        id: "certification",
        type: "yes_no",
        prompt:
          "Is the building certified under IFC EDGE, LEED, or GRIHA (or higher)?",
      },
      {
        id: "energy_saving_pct",
        type: "numeric",
        unit: "%",
        prompt:
          "Projected energy savings vs. code-baseline (%). NRB treats ≥ 20 percent as green-aligned.",
      },
      {
        id: "water_saving_pct",
        type: "numeric",
        unit: "%",
        prompt: "Projected water savings vs. baseline (%)",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const cert = yn(a, "certification");
      const energyPct = num(a, "energy_saving_pct") ?? 0;
      const waterPct = num(a, "water_saving_pct") ?? 0;
      if (cert && energyPct >= 20) {
        return {
          color: "green",
          rationale: `Certified green building with ${energyPct}% energy savings and ${waterPct}% water savings. Fully aligns with the NRB Green Finance Taxonomy under Buildings.`,
          citation: "NRB GFT 2024, Ch. 2 Buildings",
        };
      }
      if (energyPct >= 20 || cert) {
        return {
          color: "amber",
          rationale:
            "Meets one of the two threshold criteria (certification OR ≥20% energy savings). Amber (transitional) until both are demonstrated.",
          citation: "NRB GFT 2024, Ch. 2 Buildings",
        };
      }
      return {
        color: "red",
        rationale:
          "Standard commercial construction with no certification or demonstrated energy savings does not meet the NRB green threshold. Classified Red.",
        citation: "NRB GFT 2024, Ch. 2 Buildings",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Agriculture — organic / climate-smart
  // -------------------------------------------------------------------------
  defineActivity({
    id: "organic-agri",
    name: "Organic / climate-smart agriculture",
    sectorLabel: "Agriculture and Food Security",
    nrbCitation: "NRB GFT 2024, Ch. 2 Annex 1 §1 Agriculture",
    applicableTo: ["agriculture"],
    activityCriteria: [
      {
        id: "organic_certified",
        type: "yes_no",
        prompt:
          "Is the farm / product certified organic by a recognized certifier?",
      },
      {
        id: "solar_irrigation",
        type: "yes_no",
        prompt: "Does the operation use solar-lifted or gravity irrigation?",
      },
      {
        id: "no_synthetic_agrochems",
        type: "yes_no",
        prompt:
          "Does the operation avoid synthetic pesticides and inorganic fertilizers?",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const cert = yn(a, "organic_certified");
      const solar = yn(a, "solar_irrigation");
      const noChems = yn(a, "no_synthetic_agrochems");
      if (cert && noChems) {
        return {
          color: "green",
          rationale:
            "Certified organic operation avoiding synthetic agrochemicals. Aligns with NRB Agriculture green criteria — 'water smart' and 'nutrient smart' practices.",
          citation: "NRB GFT 2024, Ch. 2 Annex 1 §1",
        };
      }
      if (noChems || solar) {
        return {
          color: "amber",
          rationale:
            "Practicing partial climate-smart agriculture (solar irrigation or reduced agrochemicals) but not certified organic. Amber (transitional) — encourage progression to certification.",
          citation: "NRB GFT 2024, Ch. 2 Annex 1 §1",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Standard conventional agriculture. Not classified under the green taxonomy without a demonstrable climate-smart or organic practice.",
        citation: "NRB GFT 2024, Ch. 2 Annex 1 §1",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Transport — Electric vehicles
  // -------------------------------------------------------------------------
  defineActivity({
    id: "ev-transport",
    name: "Electric vehicles and charging infrastructure",
    sectorLabel: "Transport",
    nrbCitation: "NRB GFT 2024, Ch. 2 Transport",
    applicableTo: ["transport", "vehicle", "automotive"],
    activityCriteria: [
      {
        id: "battery_electric",
        type: "yes_no",
        prompt:
          "Is the financed asset a battery-electric vehicle (not hybrid, not plug-in hybrid)?",
      },
      {
        id: "charging_infrastructure",
        type: "yes_no",
        prompt:
          "Does the financing include or come alongside dedicated charging infrastructure?",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const bev = yn(a, "battery_electric");
      const charging = yn(a, "charging_infrastructure");
      if (bev) {
        return {
          color: "green",
          rationale:
            "Battery-electric vehicle. Aligns fully with the NRB Green Finance Taxonomy under Transport." +
            (charging
              ? " Bundled charging infrastructure strengthens the alignment."
              : ""),
          citation: "NRB GFT 2024, Ch. 2 Transport",
        };
      }
      return {
        color: "amber",
        rationale:
          "Hybrid or plug-in hybrid vehicles are classified as Amber (transitional). Fully electric vehicles meet the green criteria; hybrids are treated as an interim measure only.",
        citation: "NRB GFT 2024, Ch. 2 Transport",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // Coal / fossil-fired generation — automatically Red
  // -------------------------------------------------------------------------
  defineActivity({
    id: "fossil-generation",
    name: "Fossil-fuel-fired power generation",
    sectorLabel: "Energy",
    nrbCitation: "NRB GFT 2024, Ch. 2 Exclusions",
    applicableTo: ["coal", "diesel", "fossil"],
    activityCriteria: [
      {
        id: "confirms_fossil",
        type: "yes_no",
        prompt: "Confirm the primary generation source is coal, oil, or gas.",
      },
    ],
    dnshCheckIds: [],
    classify: () => ({
      color: "red",
      rationale:
        "Fossil-fuel-fired power generation is explicitly excluded from the NRB Green Finance Taxonomy. Automatic Red classification.",
      citation: "NRB GFT 2024, Ch. 2 Exclusions",
    }),
  }),

  // -------------------------------------------------------------------------
  // Water — irrigation efficiency
  // -------------------------------------------------------------------------
  defineActivity({
    id: "irrigation-efficiency",
    name: "High-efficiency irrigation systems",
    sectorLabel: "Water and Wastewater",
    nrbCitation: "NRB GFT 2024, Ch. 2 §1.15 Irrigation",
    applicableTo: ["irrigation", "agriculture"],
    activityCriteria: [
      {
        id: "drip_or_sprinkler",
        type: "yes_no",
        prompt:
          "Does the system use drip irrigation, micro-sprinklers, or solar-lifted piped irrigation?",
      },
      {
        id: "rainwater_harvest",
        type: "yes_no",
        prompt:
          "Does the system incorporate rainwater harvesting or aquifer recharge?",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const drip = yn(a, "drip_or_sprinkler");
      const rain = yn(a, "rainwater_harvest");
      if (drip && rain) {
        return {
          color: "green",
          rationale:
            "High-efficiency drip / micro-sprinkler irrigation combined with rainwater harvesting. Aligns with NRB Water and Wastewater green criteria.",
          citation: "NRB GFT 2024, Ch. 2 §1.15",
        };
      }
      if (drip || rain) {
        return {
          color: "amber",
          rationale:
            "Meets one of the two water-smart criteria. Amber (transitional).",
          citation: "NRB GFT 2024, Ch. 2 §1.15",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Standard flood or canal irrigation does not meet the water-smart threshold under the NRB taxonomy.",
        citation: "NRB GFT 2024, Ch. 2 §1.15",
      };
    },
  }),
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findActivityById(id: string): TaxonomyActivity | null {
  return TAXONOMY_ACTIVITIES.find((a) => a.id === id) ?? null;
}

/**
 * Suggest activities that fit a given NRB sector. Used by the wizard to
 * pre-filter the activity picker to activities that are likely relevant
 * to the loan's borrower.
 */
export function suggestActivitiesForSector(nrbSector: string): TaxonomyActivity[] {
  const s = nrbSector.toLowerCase();
  return TAXONOMY_ACTIVITIES.filter((a) =>
    a.applicableTo.some((pattern) => s.includes(pattern.toLowerCase())),
  );
}
