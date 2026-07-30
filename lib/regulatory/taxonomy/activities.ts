/**
 * NRB Green Finance Taxonomy (2024) — activity catalog.
 *
 * The source doc is 153 pages and structures the taxonomy at two levels:
 *   - Annex 1 (pp. 35-49) — 8 thematic "common ground rule" sectors.
 *   - Annex 2 (pp. 50-139) — 17 SIS-aligned economic sectors with per
 *     sub-sector Green (Transformative) / Amber (Transitional) / Red
 *     classifications and inline "red bullets" that act as DNSH tests.
 *
 * Every activity below anchors to a specific Annex 2 sub-sector with a
 * page-anchored citation of the form
 *   "NRB GFT 2024, Annex 2 §7.1 (Table 11, pp. 104-105)"
 * so the wizard PDF export gives auditors a verifiable pointer.
 *
 * Each activity has:
 *   - id             : stable identifier used on saved rows in Supabase.
 *   - name           : human-readable name shown in the wizard.
 *   - nrbCitation    : page-anchored citation into the source document.
 *   - sectorLabel    : NRB SIS sector heading (Annex 4b, p. 144).
 *   - applicableTo   : Borrower.nrbSector patterns this activity fits.
 *   - dnshCheckIds   : DNSH checks from lib/regulatory/taxonomy/dnsh.ts
 *                       that apply to the activity (shared library).
 *   - activityCriteria: activity-specific questions (permits, capacity,
 *                       efficiency thresholds, etc.) — NOT DNSH.
 *   - criteria       : the full list the wizard asks (activityCriteria
 *                       + resolved DNSH criteria), computed automatically.
 *   - classify       : pure function that turns criterion answers into a
 *                       color + rationale + citation.
 *
 * Legacy activity IDs (hydro-small / hydro-medium / hydro-large,
 * ev-transport) are resolved via `findActivityById` aliasing so
 * previously-saved Supabase assessments still open cleanly. See the
 * LEGACY_ID_ALIASES map at the bottom of this file.
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
  // §7.1 Hydroelectricity Production — one activity, keyed on NRB's
  // technical thresholds (run-of-river / power density / lifecycle GHG).
  // The legacy hydro-small / hydro-medium / hydro-large IDs used MW
  // capacity bands; those are NOT in the NRB taxonomy. Alias resolves
  // saved assessments back to this activity via findActivityById().
  // -------------------------------------------------------------------------
  defineActivity({
    id: "hydro",
    name: "Hydroelectricity production",
    sectorLabel: "Power, Gas and Water",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §7.1 Hydroelectricity Production (Table 11, pp. 104-105)",
    applicableTo: ["hydropower", "renewable", "hydro"],
    activityCriteria: [
      {
        id: "installed_capacity_mw",
        type: "numeric",
        unit: "MW",
        prompt: "Installed capacity of the plant (MW)",
        helpText:
          "NRB does not classify hydro by MW capacity. Capacity is captured for reporting only; classification depends on the run-of-river / power-density / lifecycle-GHG criteria below.",
      },
      {
        id: "run_of_river_no_reservoir",
        type: "yes_no",
        prompt:
          "Is the plant run-of-river with no artificial reservoir? (NRB §7.1 Green criterion (a))",
        helpText:
          "One of two alternative technical gates for Green classification — plants meeting either this OR the > 5 W/m² power density test qualify.",
      },
      {
        id: "power_density_above_5",
        type: "yes_no",
        prompt:
          "Is the plant's power density above 5 W/m²? (NRB §7.1 Green criterion (b))",
        helpText:
          "Alternative technical gate to run-of-river. Power density = installed capacity divided by reservoir surface area.",
      },
      {
        id: "lifecycle_gco2e_per_kwh",
        type: "numeric",
        unit: "gCO2e/kWh",
        prompt:
          "Verified lifecycle GHG emissions from generation, entire facility (gCO2e/kWh)",
        helpText:
          "NRB §7.1 Green: < 100 gCO2e/kWh. Amber: 100-425 gCO2e/kWh. Must be calculated using ISO 14067:2018, ISO 14064-1:2018 or the G-res tool, and verified by an independent third party.",
      },
      {
        id: "eia_or_iee_current",
        type: "yes_no",
        prompt:
          "Is a current EIA or IEE in force per Nepal's Environment Protection Act 2019 and Environment Protection Rules 2020?",
        helpText:
          "NRB §7.1 Red: 'Hydropower generation not meeting mitigation standards as well EIA/IEE and ESG standards.'",
      },
      {
        id: "avoids_protected_and_disaster_zones",
        type: "yes_no",
        prompt:
          "Does the site AVOID protected areas, biodiversity hotspots, and disaster-prone areas (per VRA and disaster mapping)?",
        helpText:
          "NRB §7.1 Red: 'Hydroelectricity production in protected areas, biodiversity hotspot areas and disaster-prone areas as identified by VRA and disaster mapping.'",
      },
    ],
    dnshCheckIds: [
      "environmental_flow",
      "resettlement_discharged",
      "biodiversity_offset",
      "seismic_assessment",
    ],
    classify: (a) => {
      const runOfRiver = yn(a, "run_of_river_no_reservoir");
      const powerDensityOk = yn(a, "power_density_above_5");
      const lca = num(a, "lifecycle_gco2e_per_kwh");
      const eia = yn(a, "eia_or_iee_current");
      const avoidsRedZones = yn(a, "avoids_protected_and_disaster_zones");
      const dnsh = evaluateDnsh(
        [
          "environmental_flow",
          "resettlement_discharged",
          "biodiversity_offset",
          "seismic_assessment",
        ],
        a,
      );

      // Hard reds first — §7.1 red bullets.
      if (!avoidsRedZones) {
        return {
          color: "red",
          rationale:
            "Site overlaps a protected area, biodiversity hotspot, or disaster-prone zone identified by VRA / disaster mapping. NRB §7.1 red bullet applies.",
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 105 — Red)",
        };
      }
      if (!eia) {
        return {
          color: "red",
          rationale:
            "No current EIA or IEE. NRB §7.1 red bullet 'not meeting mitigation standards as well EIA/IEE and ESG standards.'",
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 105 — Red)",
        };
      }

      // Technical gate — run-of-river OR power density > 5 W/m².
      const technicalGatePassed = runOfRiver || powerDensityOk;
      if (!technicalGatePassed) {
        return {
          color: "red",
          rationale:
            "Plant is neither run-of-river (no artificial reservoir) nor above 5 W/m² power density. NRB §7.1 Green/Amber both require one of these technical gates.",
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, pp. 104-105 — Green criteria (a)/(b))",
        };
      }

      if (lca === null) {
        return {
          color: "unclassified",
          rationale:
            "Verified lifecycle GHG emissions (gCO2e/kWh) not entered. NRB §7.1 requires an ISO 14067 / ISO 14064-1 / G-res tool third-party-verified figure to classify.",
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 104 — Green criterion (c))",
        };
      }

      if (lca >= 425) {
        return {
          color: "red",
          rationale: `Verified lifecycle GHG at ${lca} gCO2e/kWh exceeds the NRB §7.1 Amber ceiling of 425 gCO2e/kWh. Classified Red.`,
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 105 — Amber upper bound)",
        };
      }

      if (lca >= 100) {
        // Amber band — 100 to <425 gCO2e/kWh.
        if (!dnsh.passed) {
          return {
            color: "amber",
            rationale: `Lifecycle GHG at ${lca} gCO2e/kWh sits in the NRB §7.1 Amber band (100-425). DNSH checks below are not fully passed; approve as Amber (transitional) with remedial conditions on the flagged items.`,
            citation:
              "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 105 — Amber) + Table 1 DNSH (p. 22)",
            dnshFailures: dnsh.failures,
          };
        }
        return {
          color: "amber",
          rationale: `Lifecycle GHG at ${lca} gCO2e/kWh sits in the NRB §7.1 Amber band (100-425). Technical gates and DNSH passed. Amber (transitional).`,
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 105 — Amber)",
        };
      }

      // Green band — < 100 gCO2e/kWh.
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale: `Lifecycle GHG at ${lca} gCO2e/kWh meets the NRB §7.1 Green ceiling of 100 gCO2e/kWh, but DNSH checks below are not fully passed. Approve as Amber (transitional) with remedial conditions.`,
          citation:
            "NRB GFT 2024, Annex 2 §7.1 (Table 11, p. 104 — Green) + Table 1 DNSH (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      return {
        color: "green",
        rationale: `Hydro plant meets NRB §7.1 Green: run-of-river or > 5 W/m² power density + verified lifecycle GHG at ${lca} gCO2e/kWh (< 100 ceiling) + EIA/IEE current + site outside protected / disaster zones. DNSH checks passed.`,
        citation:
          "NRB GFT 2024, Annex 2 §7.1 (Table 11, pp. 104-105 — Green)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §7.3 Wind Energy — NEW
  // -------------------------------------------------------------------------
  defineActivity({
    id: "wind-energy",
    name: "Wind energy generation",
    sectorLabel: "Power, Gas and Water",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §7.3 Wind Energy (Table 11, pp. 106-107)",
    applicableTo: ["wind", "renewable", "power"],
    activityCriteria: [
      {
        id: "installed_capacity_mw",
        type: "numeric",
        unit: "MW",
        prompt: "Installed capacity (MW)",
      },
      {
        id: "bird_biodiversity_study_completed",
        type: "yes_no",
        prompt:
          "Have studies been carried out to minimise risks to birds, livelihoods, and the environment?",
        helpText:
          "NRB §7.3 Green requires 'corresponding studies to minimise risks for birds, livelihoods, environment'. Red: 'Wind energy plant triggers threat to biodiversity including birds, livelihoods, and the environment.'",
      },
      {
        id: "energy_efficient_clean_tech",
        type: "yes_no",
        prompt:
          "Does the facility use energy-efficient wind technology (clean tech, no fossil-fired backup as primary)?",
      },
      {
        id: "includes_battery_storage",
        type: "yes_no",
        prompt:
          "Does the project include or pair with wind-energy storage / battery facilities?",
        helpText:
          "NRB §7.3 Amber includes 'wind-energy storage facilities with mitigation' and small-community MSME low-carbon systems.",
      },
    ],
    dnshCheckIds: ["land_use_conflict"],
    classify: (a) => {
      const study = yn(a, "bird_biodiversity_study_completed");
      const cleanTech = yn(a, "energy_efficient_clean_tech");
      const storage = yn(a, "includes_battery_storage");
      const dnsh = evaluateDnsh(["land_use_conflict"], a);

      if (!study) {
        return {
          color: "red",
          rationale:
            "Missing bird / biodiversity / livelihood study triggers NRB §7.3 red bullet ('threat to biodiversity including birds, livelihoods, and the environment').",
          citation:
            "NRB GFT 2024, Annex 2 §7.3 (Table 11, p. 107 — Red)",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Wind generation is green-eligible under NRB §7.3 but DNSH checks below flag potential land-use conflict. Approve as Amber (transitional) with remedial conditions.",
          citation:
            "NRB GFT 2024, Annex 2 §7.3 (Table 11, pp. 106-107) + Table 1 DNSH (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (cleanTech) {
        return {
          color: "green",
          rationale:
            "Energy-efficient wind facility with completed bird / livelihood / environmental study and no land-use conflict. NRB §7.3 Green." +
            (storage ? " Battery storage strengthens alignment." : ""),
          citation:
            "NRB GFT 2024, Annex 2 §7.3 (Table 11, pp. 106-107 — Green)",
        };
      }
      return {
        color: "amber",
        rationale:
          "Wind facility completes the biodiversity study but does not fully meet the clean / energy-efficient tech criterion. Amber (transitional).",
        citation:
          "NRB GFT 2024, Annex 2 §7.3 (Table 11, pp. 106-107 — Amber)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §7.4 Solar Energy — utility-scale generation
  // -------------------------------------------------------------------------
  defineActivity({
    id: "solar-utility",
    name: "Solar — utility-scale generation",
    sectorLabel: "Power, Gas and Water",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §7.4 Solar Energy (Table 11, p. 107)",
    applicableTo: ["solar", "renewable", "power"],
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
      {
        id: "pv_component_meets_nrb_efficiency",
        type: "yes_no",
        prompt:
          "Do PV cells/modules meet the NRB §7.4 footnote 337 efficiency minimums (poly-Si cell ≥ 19%; mono-Si cell ≥ 21%; poly module ≥ 17%; mono module ≥ 17.8%)?",
        helpText:
          "Verbatim NRB minimums at §7.4 footnote 337, p. 107. Also caps degradation: poly/mono first-year ≤ 2.5% / 3%; per year ≤ 0.7%; 25-year cumulative ≤ 20%.",
      },
      {
        id: "battery_recycling_plan",
        type: "yes_no",
        prompt:
          "Does the project include a battery recycling and waste-disposal plan?",
        helpText:
          "NRB §7.4 Amber: 'solar plants with battery recycling & waste-disposal plans'.",
      },
    ],
    dnshCheckIds: ["land_use_conflict"],
    classify: (a) => {
      const gridOk = yn(a, "grid_interconnection_approved");
      const pvOk = yn(a, "pv_component_meets_nrb_efficiency");
      const battery = yn(a, "battery_recycling_plan");
      const dnsh = evaluateDnsh(["land_use_conflict"], a);
      if (!dnsh.passed) {
        return {
          color: "red",
          rationale:
            "Site overlaps protected area / prime agricultural land / IUCN Red-List habitat. NRB §7.4 red bullet: 'Solar plants that involve significant land use that results in losses in ecosystems and biodiversity.'",
          citation:
            "NRB GFT 2024, Annex 2 §7.4 (Table 11, p. 107 — Red)",
          dnshFailures: dnsh.failures,
        };
      }
      if (!pvOk) {
        return {
          color: "amber",
          rationale:
            "PV component efficiencies do not meet NRB §7.4 footnote 337 minimums. Amber (transitional) — retrofit to compliant panels required for full Green.",
          citation:
            "NRB GFT 2024, Annex 2 §7.4 (Table 11, p. 107, footnote 337)",
        };
      }
      if (!gridOk) {
        return {
          color: "amber",
          rationale:
            "Solar generation is green-eligible under NRB §7.4 but grid interconnection is pending. Amber (transitional) until NEA sign-off.",
          citation:
            "NRB GFT 2024, Annex 2 §7.4 (Table 11, p. 107)",
        };
      }
      return {
        color: "green",
        rationale:
          "Utility-scale solar on a non-conflicted site with NRB-compliant PV components and NEA-approved grid interconnection." +
          (battery
            ? " Battery recycling / waste-disposal plan in place strengthens alignment."
            : ""),
        citation:
          "NRB GFT 2024, Annex 2 §7.4 (Table 11, p. 107 — Green)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §5.11 Cement / §5.18 Clinker — NO Green column. Amber max.
  // Renamed from "cement-whr" (which claimed WHR as an NRB Green criterion,
  // which is not verbatim in the taxonomy). Old id resolves via alias.
  // -------------------------------------------------------------------------
  defineActivity({
    id: "cement-whr",
    name: "Cement production — transitional (dry kiln + clinker substitution)",
    sectorLabel: "Non-food Production Related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §5.11 Cement (pp. 97-98); §5.18 Clinker (p. 99)",
    applicableTo: ["cement", "manufacturing", "clinker"],
    activityCriteria: [
      {
        id: "dry_process_kiln",
        type: "yes_no",
        prompt:
          "Does the production facility use dry-process kilns with reduced clinker content?",
        helpText:
          "NRB §5.11 Amber verbatim: 'Production facilities, incorporating dry processes, reduced clinker content.'",
      },
      {
        id: "alt_fuel_or_low_carbon_kiln",
        type: "yes_no",
        prompt:
          "Does the operator use Hybrid Hoffman Kilns (HHK), Tunnel Kilns (TK), Compressed Stabilized Earth Blocks (CSEB) tech, or clinker substitution / alternative fuels?",
        helpText:
          "NRB §5.11 Amber verbatim: 'Installation of Hybrid Hoffman Kilns (HHK), Tunnel Kilns (TK), and Compressed Stabilized Earth Blocks (CSEB) technologies to replace traditional brick kilns'. §5.18 Amber: 'Improving energy efficiency; Switching to alternative fuels; Clinker substitution'.",
      },
      {
        id: "efficient_kiln_60pct_masonry_share",
        type: "yes_no",
        prompt:
          "Do concrete hollow blocks / interlocking blocks / cellular concrete / efficient-kiln clay bricks make up at least 60% of total masonry-wall output?",
        helpText:
          "NRB §5.11 Amber verbatim: 'Promotion of Concrete Hollow Blocks / Interlocking Concrete Block / lightweight Cellular Concrete / Clay Brick of Auto Brick factory with efficient kiln. (At least 60% of total Masonry wall)'.",
      },
      {
        id: "whr_operational",
        type: "yes_no",
        prompt:
          "Is a Waste Heat Recovery (WHR) system installed and operational?",
        helpText:
          "Jana editorial — NOT verbatim from NRB. WHR is consistent with the spirit of NRB §5.11 dry-process / low-emission language and IFC EHS Guidelines for cement, but the NRB taxonomy does not name WHR as an Amber criterion.",
      },
      {
        id: "alternative_fuel_share_pct",
        type: "numeric",
        unit: "%",
        prompt: "Share of alternative or biomass fuel in the fuel mix (%)",
        helpText:
          "NRB §5.18 Amber cites 'Switching to alternative fuels' as a clinker-decarbonisation lever.",
      },
    ],
    dnshCheckIds: ["air_emissions_compliance", "quarry_rehabilitation"],
    classify: (a) => {
      const dry = yn(a, "dry_process_kiln");
      const altFuelKiln = yn(a, "alt_fuel_or_low_carbon_kiln");
      const efficientMasonry = yn(a, "efficient_kiln_60pct_masonry_share");
      const whr = yn(a, "whr_operational");
      const altFuelPct = num(a, "alternative_fuel_share_pct") ?? 0;
      const dnsh = evaluateDnsh(
        ["air_emissions_compliance", "quarry_rehabilitation"],
        a,
      );

      // Cement has NO Green column in NRB Annex 2 §5.11 — max is Amber.
      // Hard Red gates first.
      if (!dnsh.passed) {
        return {
          color: "red",
          rationale:
            "NRB §5.11 red bullet cites 'dust, noise, GHG (esp. CO2) contamination' and §5.18 reds 'High polluting and does not meet environment standards'. Failing DNSH checks below classifies Red.",
          citation:
            "NRB GFT 2024, Annex 2 §5.11 (p. 98 — Red) + §5.18 (p. 99 — Red)",
          dnshFailures: dnsh.failures,
        };
      }

      // Amber gate — at least one of the NRB §5.11 Amber levers must be
      // in place. WHR alone is Jana editorial and cannot carry the
      // classification.
      const nrbAmberLever = dry || altFuelKiln || efficientMasonry;
      if (!nrbAmberLever) {
        return {
          color: "red",
          rationale:
            "None of the NRB §5.11 Amber levers (dry-process kilns / low-carbon kiln tech HHK-TK-CSEB / efficient-kiln masonry ≥ 60% share) are in place. Cement without any Amber lever classifies Red.",
          citation:
            "NRB GFT 2024, Annex 2 §5.11 (pp. 97-98 — Amber criteria)",
        };
      }

      // Cement has no Green column — best possible outcome is Amber.
      const details: string[] = [];
      if (dry) details.push("dry-process kiln + reduced clinker");
      if (altFuelKiln) details.push("HHK/TK/CSEB or clinker substitution");
      if (efficientMasonry) details.push("efficient-kiln masonry ≥ 60% share");
      if (whr) details.push("WHR operational (Jana editorial, not NRB-named)");
      if (altFuelPct > 0)
        details.push(`${altFuelPct}% alternative fuel share`);

      return {
        color: "amber",
        rationale: `Cement production classified Amber (transitional). NRB §5.11 has NO Green column — cement is a hard-to-abate sector and the best possible outcome under the taxonomy is Amber. Levers in place: ${details.join(
          "; ",
        )}. DNSH checks passed.`,
        citation:
          "NRB GFT 2024, Annex 2 §5.11 (Table 9, pp. 97-98 — Amber only)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §6.1 / §6.2 / §12.1 / §12.2 — Green Buildings (residential + commercial)
  // Removed the 20% energy-savings numeric threshold — that is EDGE-internal,
  // not an NRB criterion. Kept as helper text only.
  // -------------------------------------------------------------------------
  defineActivity({
    id: "green-buildings",
    name: "Green buildings — retrofit or new construction",
    sectorLabel: "Construction",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §6.1 (p. 100), §6.2 (pp. 100-101), §12.1 (p. 131), §12.2 (pp. 131-132)",
    applicableTo: ["real estate", "construction", "building"],
    activityCriteria: [
      {
        id: "certified_leed_edge_cbi",
        type: "yes_no",
        prompt:
          "Is the building certified under LEED, IFC EDGE, or Climate Bonds Initiative (CBI) residential/commercial criteria?",
        helpText:
          "NRB §6.1/§6.2 accepts these named certification pathways plus 'other internationally recognized green construction codes'. EDGE internally uses a 20% energy-savings threshold but NRB does not restate that as an NRB criterion.",
      },
      {
        id: "meets_dudbc_codes",
        type: "yes_no",
        prompt:
          "Does the design comply with DUDBC Nepal Green Building Guidelines / Green Building Codes?",
        helpText:
          "NRB §6.1 footnote 303: 'Nepal Green Building Guidelines and Green Building Codes of the Department of Urban Development and Building Construction (DUDBC) — under preparation.'",
      },
      {
        id: "site_avoids_iucn_arable_disaster",
        type: "yes_no",
        prompt:
          "Does the site AVOID IUCN Red-List habitats, arable / high-fertility soil, disaster-prone areas, and cultural/religious cities?",
        helpText:
          "NRB §6.1 / §6.2 / §12.1 red bullets: construction on IUCN Red-List habitats, arable soil, disaster-prone areas, cultural cities, or 'carbon-intensive real estate' is Red.",
      },
      {
        id: "considers_orientation_hazards_habitat",
        type: "yes_no",
        prompt:
          "Does the design consider site selection, orientation, access roads, and conservation of hazards / trees / waterways / animal habitats?",
        helpText:
          "NRB §6.1 Amber criteria list these design considerations verbatim.",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const certified = yn(a, "certified_leed_edge_cbi");
      const dudbc = yn(a, "meets_dudbc_codes");
      const siteOk = yn(a, "site_avoids_iucn_arable_disaster");
      const designConsidered = yn(a, "considers_orientation_hazards_habitat");

      if (!siteOk) {
        return {
          color: "red",
          rationale:
            "Site sits on an IUCN Red-List habitat / arable soil / disaster-prone area / cultural or religious city. NRB §6.1 / §12.1 red bullets apply.",
          citation:
            "NRB GFT 2024, Annex 2 §6.1 (p. 100) + §12.1 (p. 131 — Red)",
        };
      }
      if (certified || dudbc) {
        return {
          color: "green",
          rationale: `Building certified under ${
            certified ? "LEED / IFC EDGE / CBI" : "DUDBC Nepal Green Building Codes"
          } and site is outside protected / arable / hazard zones. NRB §6.1/§6.2/§12.1/§12.2 Green.`,
          citation:
            "NRB GFT 2024, Annex 2 §6.1 (p. 100) + §6.2 (p. 101 — Green)",
        };
      }
      if (designConsidered) {
        return {
          color: "amber",
          rationale:
            "Design meets NRB §6.1 Amber considerations (site selection, orientation, hazard / habitat conservation) but no formal LEED / EDGE / CBI / DUDBC certification. Amber (transitional) — encourage progression to certification.",
          citation:
            "NRB GFT 2024, Annex 2 §6.1 (p. 100 — Amber) + §6.2 (pp. 100-101 — Amber)",
        };
      }
      return {
        color: "red",
        rationale:
          "Standard construction with no certification, no DUDBC compliance, and no Amber design considerations. NRB §6.1 Red: 'non-compliance with codes'.",
        citation:
          "NRB GFT 2024, Annex 2 §6.1 (p. 100 — Red)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §1.1 Crops & Vegetables — organic / climate-smart agriculture
  // Sector label corrected to NRB SIS row 1 "Agriculture and Forest related".
  // -------------------------------------------------------------------------
  defineActivity({
    id: "organic-agri",
    name: "Organic / climate-smart agriculture",
    sectorLabel: "Agriculture and Forest related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §1.1 Crops and Vegetables (Table 5, pp. 50-55)",
    applicableTo: ["agriculture", "crops", "farming", "food security"],
    activityCriteria: [
      {
        id: "organic_certified",
        type: "yes_no",
        prompt:
          "Is the farm / product certified organic by a recognized certifier (e.g. USDA NOP, ProCert UK)?",
        helpText:
          "NRB §1.1 Green list names USDA NOP and ProCert UK at footnote 30/150 as recognised certifiers.",
      },
      {
        id: "solar_irrigation",
        type: "yes_no",
        prompt: "Does the operation use solar-lifted or gravity irrigation?",
      },
      {
        id: "climate_smart_practices",
        type: "yes_no",
        prompt:
          "Does the operation practise NRB 'water-smart / energy-smart / nutrient-smart / soil-smart' agriculture (SRI, zero-tillage, precision nutrient management, climate-resilient seeds, ICT-based agro-advisories, solar-dryer processing, or agri-voltaic)?",
        helpText:
          "NRB §1.1 Green criteria enumerate these practices verbatim.",
      },
      {
        id: "no_synthetic_agrochems",
        type: "yes_no",
        prompt:
          "Does the operation avoid synthetic pesticides and inorganic fertilizers (and the restricted pesticides — Aldrin, BHC, Chlordane, DDT — per §1.10)?",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const cert = yn(a, "organic_certified");
      const solar = yn(a, "solar_irrigation");
      const climateSmart = yn(a, "climate_smart_practices");
      const noChems = yn(a, "no_synthetic_agrochems");
      if (cert && noChems) {
        return {
          color: "green",
          rationale:
            "Certified organic operation avoiding synthetic agrochemicals. Aligns with NRB §1.1 Green criteria (water-smart / nutrient-smart practices + recognised organic certification).",
          citation:
            "NRB GFT 2024, Annex 2 §1.1 (Table 5, pp. 50-55 — Green)",
        };
      }
      if (climateSmart || solar || noChems) {
        return {
          color: "amber",
          rationale:
            "Practising partial climate-smart agriculture (solar irrigation, climate-smart or reduced-agrochemical practices) but not certified organic. NRB §1.1 Amber (transitional) — encourage progression to certification.",
          citation:
            "NRB GFT 2024, Annex 2 §1.1 (Table 5, pp. 50-55 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Standard conventional agriculture. Not classified under the taxonomy without a demonstrable climate-smart or organic practice.",
        citation:
          "NRB GFT 2024, Annex 2 §1.1 (Table 5, pp. 50-55)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §1.11 Animal Husbandry / Slaughterhouse — dairy / meat (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "dairy-livestock",
    name: "Dairy / animal husbandry",
    sectorLabel: "Agriculture and Forest related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §1.11 Animal Husbandry / Slaughterhouse (Table 5, pp. 65-68)",
    applicableTo: ["dairy", "livestock", "animal husbandry", "agriculture"],
    activityCriteria: [
      {
        id: "improved_low_emission_breeds",
        type: "yes_no",
        prompt:
          "Are the herds improved / climate-resilient / low-methane breeds with rotational or improved grazing?",
      },
      {
        id: "manure_management_biogas",
        type: "yes_no",
        prompt:
          "Is manure managed (covered lagoon / composting / biogas) and does the operation use clean energy for barn / cooling / milk-chilling?",
        helpText:
          "NRB §1.11 Green includes clean-energy adoption and manure management for GHG reduction.",
      },
      {
        id: "slaughterhouse_effluent_ok",
        type: "yes_no",
        prompt:
          "If a slaughterhouse: is effluent captured and treated to Nepal effluent standards; are hygiene / animal-welfare standards met?",
      },
      {
        id: "grazing_avoids_forest_conversion",
        type: "yes_no",
        prompt:
          "Does the operation AVOID converting forest / protected land for pasture and AVOID over-grazing?",
      },
    ],
    dnshCheckIds: ["effluent_treatment"],
    classify: (a) => {
      const breeds = yn(a, "improved_low_emission_breeds");
      const manure = yn(a, "manure_management_biogas");
      const slaughter = yn(a, "slaughterhouse_effluent_ok");
      const noForestConversion = yn(a, "grazing_avoids_forest_conversion");
      const dnsh = evaluateDnsh(["effluent_treatment"], a);
      if (!noForestConversion) {
        return {
          color: "red",
          rationale:
            "Operation converts forest / protected land for pasture, or over-grazes. NRB §1.11 red-flag on ecosystem degradation.",
          citation:
            "NRB GFT 2024, Annex 2 §1.11 (Table 5, pp. 65-68 — Red)",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Livestock / dairy DNSH check on effluent not passed. Amber (transitional) with remedial conditions.",
          citation:
            "NRB GFT 2024, Annex 2 §1.11 (Table 5, pp. 65-68) + Table 1 DNSH objective P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (breeds && manure && slaughter) {
        return {
          color: "green",
          rationale:
            "Improved low-methane breeds, manure management / biogas, and compliant slaughterhouse effluent + hygiene. NRB §1.11 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §1.11 (Table 5, pp. 65-68 — Green)",
        };
      }
      if (breeds || manure || slaughter) {
        return {
          color: "amber",
          rationale:
            "Some but not all NRB §1.11 Green levers in place. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §1.11 (Table 5, pp. 65-68 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Baseline conventional livestock / dairy without documented Green levers.",
        citation:
          "NRB GFT 2024, Annex 2 §1.11 (Table 5, pp. 65-68)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §1.12 Poultry (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "poultry",
    name: "Poultry farming",
    sectorLabel: "Agriculture and Forest related",
    nrbCitation: "NRB GFT 2024, Annex 2 §1.12 Poultry (Table 5, pp. 69-70)",
    applicableTo: ["poultry", "agriculture", "livestock"],
    activityCriteria: [
      {
        id: "biosecure_climate_resilient_housing",
        type: "yes_no",
        prompt:
          "Are birds housed in bio-secure, climate-resilient sheds with efficient ventilation / cooling?",
      },
      {
        id: "manure_recovery_or_biogas",
        type: "yes_no",
        prompt:
          "Is poultry litter recovered for composting / organic fertilizer / biogas rather than disposed of untreated?",
      },
      {
        id: "clean_energy_farm",
        type: "yes_no",
        prompt:
          "Does the farm use clean energy (solar for lighting / cooling / brooding)?",
      },
    ],
    dnshCheckIds: ["effluent_treatment"],
    classify: (a) => {
      const housing = yn(a, "biosecure_climate_resilient_housing");
      const manure = yn(a, "manure_recovery_or_biogas");
      const clean = yn(a, "clean_energy_farm");
      const dnsh = evaluateDnsh(["effluent_treatment"], a);
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Poultry effluent DNSH check not passed. Amber (transitional) with remedial conditions.",
          citation:
            "NRB GFT 2024, Annex 2 §1.12 (Table 5, pp. 69-70) + Table 1 DNSH objective P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (housing && manure && clean) {
        return {
          color: "green",
          rationale:
            "Bio-secure climate-resilient housing + poultry litter recovered + clean-energy farm operations. NRB §1.12 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §1.12 (Table 5, pp. 69-70 — Green)",
        };
      }
      if (housing || manure || clean) {
        return {
          color: "amber",
          rationale:
            "Some NRB §1.12 Green levers in place but not all. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §1.12 (Table 5, pp. 69-70 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale: "Baseline conventional poultry — no Green levers.",
        citation: "NRB GFT 2024, Annex 2 §1.12 (Table 5, pp. 69-70)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §2.1 Fishery / aquaculture (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "aquaculture",
    name: "Fishery / aquaculture",
    sectorLabel: "Fishery Related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §2.1 Fishery Related (Table 6, pp. 77-79)",
    applicableTo: ["fishery", "aquaculture", "fish"],
    activityCriteria: [
      {
        id: "closed_or_recirculating_system",
        type: "yes_no",
        prompt:
          "Is the operation a closed / recirculating aquaculture system (RAS) or otherwise water-efficient?",
      },
      {
        id: "native_or_certified_species",
        type: "yes_no",
        prompt:
          "Are farmed species native / non-invasive and (where applicable) certified sustainable?",
      },
      {
        id: "wetland_and_habitat_avoided",
        type: "yes_no",
        prompt:
          "Does the operation AVOID converting natural wetlands, mangroves, or protected aquatic habitats?",
      },
    ],
    dnshCheckIds: ["effluent_treatment"],
    classify: (a) => {
      const rec = yn(a, "closed_or_recirculating_system");
      const native = yn(a, "native_or_certified_species");
      const habitat = yn(a, "wetland_and_habitat_avoided");
      const dnsh = evaluateDnsh(["effluent_treatment"], a);
      if (!habitat) {
        return {
          color: "red",
          rationale:
            "Operation converts natural wetlands / mangroves / protected aquatic habitat. NRB §2.1 Red on ecosystem loss.",
          citation:
            "NRB GFT 2024, Annex 2 §2.1 (Table 6, pp. 77-79 — Red)",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Aquaculture effluent DNSH check not passed. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §2.1 (Table 6, pp. 77-79) + Table 1 DNSH objective P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (rec && native) {
        return {
          color: "green",
          rationale:
            "Closed / recirculating aquaculture with native or certified sustainable species and no protected-habitat conversion. NRB §2.1 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §2.1 (Table 6, pp. 77-79 — Green)",
        };
      }
      return {
        color: "amber",
        rationale:
          "Meets one but not both of the water-efficiency / native-species criteria. Amber (transitional).",
        citation:
          "NRB GFT 2024, Annex 2 §2.1 (Table 6, pp. 77-79 — Amber)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §4.1 Food Processing (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "food-processing",
    name: "Food processing (packaging and processing)",
    sectorLabel: "Agriculture, Forestry & Beverage Production Related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §4.1 Food Processing (Table 8, pp. 84-85)",
    applicableTo: [
      "food",
      "food processing",
      "agriculture - processing",
      "manufacturing - fmcg",
      "beverage",
    ],
    activityCriteria: [
      {
        id: "energy_water_efficient",
        type: "yes_no",
        prompt:
          "Does the plant use energy-efficient / water-efficient / low-emission processing (e.g. clean boilers, heat recovery, reduced water)?",
      },
      {
        id: "certified_food_safety",
        type: "yes_no",
        prompt:
          "Does the plant meet national and international food-safety and hygiene standards (e.g. HACCP / ISO 22000 / FSSAI-equivalent)?",
      },
      {
        id: "packaging_recycled_biodegradable",
        type: "yes_no",
        prompt:
          "Does packaging use recyclable / biodegradable materials, reducing single-use plastic?",
      },
    ],
    dnshCheckIds: ["effluent_treatment", "air_emissions_compliance"],
    classify: (a) => {
      const eff = yn(a, "energy_water_efficient");
      const cert = yn(a, "certified_food_safety");
      const pack = yn(a, "packaging_recycled_biodegradable");
      const dnsh = evaluateDnsh(
        ["effluent_treatment", "air_emissions_compliance"],
        a,
      );
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Food-processing DNSH checks on effluent / air emissions not fully passed. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §4.1 (Table 8, pp. 84-85) + Table 1 DNSH objectives P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (eff && cert) {
        return {
          color: "green",
          rationale:
            "Energy / water-efficient food processing + certified food safety" +
            (pack ? " + recyclable packaging" : "") +
            ". NRB §4.1 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §4.1 (Table 8, pp. 84-85 — Green)",
        };
      }
      if (eff || cert || pack) {
        return {
          color: "amber",
          rationale:
            "Some NRB §4.1 Green levers in place but not all. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §4.1 (Table 8, pp. 84-85 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Standard conventional food processing without documented Green levers.",
        citation: "NRB GFT 2024, Annex 2 §4.1 (Table 8, pp. 84-85)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §5.2 Textile Production and Garments (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "textile-garments",
    name: "Textile production and garments",
    sectorLabel: "Non-food Production Related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §5.2 Textile Production and Garments (Table 9, pp. 92-93)",
    applicableTo: ["textile", "garment", "manufacturing - textiles"],
    activityCriteria: [
      {
        id: "sustainable_fibres",
        type: "yes_no",
        prompt:
          "Are fibres sustainable (organic cotton, certified cashmere / wool / yak, recycled fibres, hemp) rather than conventional / synthetic?",
        helpText:
          "NRB §5.2 Green criteria reference certified cashmere / wool / yak fibre standards.",
      },
      {
        id: "eco_dyeing_and_low_water",
        type: "yes_no",
        prompt:
          "Does the plant use eco-friendly (low-water, low-chemical) dyeing / finishing processes with functioning ETP?",
      },
      {
        id: "avoids_microplastic_release",
        type: "yes_no",
        prompt:
          "Does the operation avoid unmitigated microplastic release into water?",
        helpText:
          "NRB §5.2 red-flags microplastic release from synthetic textile processing.",
      },
    ],
    dnshCheckIds: ["effluent_treatment"],
    classify: (a) => {
      const fibres = yn(a, "sustainable_fibres");
      const dye = yn(a, "eco_dyeing_and_low_water");
      const microplastic = yn(a, "avoids_microplastic_release");
      const dnsh = evaluateDnsh(["effluent_treatment"], a);
      if (!microplastic) {
        return {
          color: "red",
          rationale:
            "Unmitigated microplastic release into water — NRB §5.2 red bullet applies.",
          citation:
            "NRB GFT 2024, Annex 2 §5.2 (Table 9, pp. 92-93 — Red)",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "red",
          rationale:
            "Textile-dyeing effluent DNSH check failed. NRB §5.2 red bullet on untreated dye effluent applies.",
          citation:
            "NRB GFT 2024, Annex 2 §5.2 (Table 9, pp. 92-93 — Red) + Table 1 DNSH objective P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (fibres && dye) {
        return {
          color: "green",
          rationale:
            "Sustainable fibres + eco-dyeing + treated effluent + no microplastic release. NRB §5.2 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §5.2 (Table 9, pp. 92-93 — Green)",
        };
      }
      return {
        color: "amber",
        rationale:
          "Meets some but not all NRB §5.2 Green criteria (sustainable fibres + eco-dyeing). Amber (transitional).",
        citation:
          "NRB GFT 2024, Annex 2 §5.2 (Table 9, pp. 92-93 — Amber)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §17.2 Consumption Loan — Personal EV
  // Split from the previous ev-transport activity so personal consumption
  // EVs cite the Consumption Loan sub-sector (correct NRB anchor).
  // Old id `ev-transport` resolves via alias to `ev-consumer`.
  // -------------------------------------------------------------------------
  defineActivity({
    id: "ev-consumer",
    name: "Personal electric vehicle (consumption loan)",
    sectorLabel: "Consumption Loan",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §17.2 Hire Purchase Vehicle — Personal Consumption (Table 21, p. 139)",
    applicableTo: [
      "consumption",
      "personal",
      "consumer",
      "vehicle",
      "automotive",
    ],
    activityCriteria: [
      {
        id: "battery_electric",
        type: "yes_no",
        prompt:
          "Is the financed asset a battery-electric vehicle, e-scooter, or e-bicycle (not hybrid)?",
        helpText:
          "NRB §17.2 Green verbatim: 'Purchase of Electric Vehicles (EV motor, E-scooters including bicycle). (M); Conversion of petrol/diesel vehicles to an electric vehicle'.",
      },
      {
        id: "hybrid_engine",
        type: "yes_no",
        prompt:
          "Alternatively, is the financed asset a hybrid-engine vehicle (hybrid car / jeep)?",
        helpText:
          "NRB §17.2 Amber: 'Purchase and/or operation of vehicles for hybrid-engine vehicles'.",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const bev = yn(a, "battery_electric");
      const hybrid = yn(a, "hybrid_engine");
      if (bev) {
        return {
          color: "green",
          rationale:
            "Battery-electric personal vehicle / e-scooter / e-bicycle. NRB §17.2 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §17.2 (Table 21, p. 139 — Green)",
        };
      }
      if (hybrid) {
        return {
          color: "amber",
          rationale:
            "Hybrid-engine personal vehicle. NRB §17.2 Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §17.2 (Table 21, p. 139 — Amber)",
        };
      }
      return {
        color: "red",
        rationale:
          "NRB §17.2 Red: 'Purchase of fossil fuel-run vehicles powered by diesel, gas, and petrol.'",
        citation: "NRB GFT 2024, Annex 2 §17.2 (Table 21, p. 139 — Red)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §7.6 EV Charging Infrastructure / §9.10 Mass Transit BEV / §9.1 Fleet
  // Commercial fleet + charging infrastructure lives here.
  // -------------------------------------------------------------------------
  defineActivity({
    id: "ev-commercial",
    name: "Commercial EV fleet / charging infrastructure / mass transit",
    sectorLabel: "Transport, Communication and Public Utilities",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §7.6 (p. 108); §9.10 Mass Public Transportation (pp. 124-125); §9.1 (p. 119)",
    applicableTo: [
      "transport",
      "vehicle",
      "automotive",
      "fleet",
      "commercial",
      "mass transit",
    ],
    activityCriteria: [
      {
        id: "battery_electric_fleet",
        type: "yes_no",
        prompt:
          "Is the financed fleet fully battery-electric (or hydrogen) — no direct emissions?",
        helpText:
          "NRB §9.10 Green: 'all mass public vehicles with no direct emissions (electric or hydrogen); electric BRT; public walking and cycling.'",
      },
      {
        id: "charging_uses_renewable",
        type: "yes_no",
        prompt:
          "If charging infrastructure: does it rely on renewable energy (hydro / solar / wind) rather than fossil-fired grid?",
        helpText:
          "NRB §7.6 Red: 'Charging stations that rely on fossil-fuel-based energy sources (coal, heavy fuel oil)'. Green: renewable-fed charging.",
      },
      {
        id: "hybrid_or_efficient_fossil",
        type: "yes_no",
        prompt:
          "Alternatively, is the fleet hybrid or efficient fossil-fuel vehicles meeting a universal gCO2/p-km threshold?",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const bev = yn(a, "battery_electric_fleet");
      const renewCharging = yn(a, "charging_uses_renewable");
      const hybrid = yn(a, "hybrid_or_efficient_fossil");
      if (bev && renewCharging) {
        return {
          color: "green",
          rationale:
            "Battery-electric / hydrogen commercial fleet paired with renewable-fed charging. NRB §7.6 Green + §9.10 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §7.6 (p. 108 — Green) + §9.10 (pp. 124-125 — Green)",
        };
      }
      if (bev) {
        return {
          color: "amber",
          rationale:
            "Battery-electric fleet but charging infrastructure relies on fossil-fired grid. NRB §7.6 Red flag on fossil-fed charging — classify Amber (transitional) pending renewable charging.",
          citation:
            "NRB GFT 2024, Annex 2 §7.6 (p. 108) + §9.10 (pp. 124-125)",
        };
      }
      if (hybrid) {
        return {
          color: "amber",
          rationale:
            "Hybrid or efficient fossil-fuel fleet. NRB §9.10 Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §9.10 (Table 13, pp. 124-125 — Amber)",
        };
      }
      return {
        color: "red",
        rationale:
          "Manufacture / operation of passenger vehicles powered by fossil fuels. NRB §9.10 Red.",
        citation:
          "NRB GFT 2024, Annex 2 §9.10 (Table 13, pp. 124-125 — Red)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §7.5 Other Electricity & Energy Production — auto-red for fossil.
  // -------------------------------------------------------------------------
  defineActivity({
    id: "fossil-generation",
    name: "Fossil-fuel-fired power generation",
    sectorLabel: "Power, Gas and Water",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §7.5 Other Electricity & Energy Production (Table 11, p. 108)",
    applicableTo: ["coal", "diesel", "fossil", "power"],
    activityCriteria: [
      {
        id: "confirms_fossil",
        type: "yes_no",
        prompt:
          "Confirm the primary generation source is coal, oil (including heavy fuel oil), or gas.",
      },
    ],
    dnshCheckIds: [],
    classify: () => ({
      color: "red",
      rationale:
        "NRB §7.5 Red verbatim: 'Energy generation from fossil-fuel-based power plants such as coal, and heavy fuel oil.'",
      citation:
        "NRB GFT 2024, Annex 2 §7.5 (Table 11, p. 108 — Red)",
    }),
  }),

  // -------------------------------------------------------------------------
  // §1.15 Irrigation — expanded to full NRB green list.
  // -------------------------------------------------------------------------
  defineActivity({
    id: "irrigation-efficiency",
    name: "High-efficiency irrigation systems",
    sectorLabel: "Agriculture and Forest related",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §1.15 Irrigation (Table 5, pp. 71-72)",
    applicableTo: ["irrigation", "agriculture"],
    activityCriteria: [
      {
        id: "drip_sprinkler_solar_lift",
        type: "yes_no",
        prompt:
          "Does the system use drip, micro-sprinkler, solar-lift, wind pump, gravity-flow canal, or pressurised piped irrigation with remote sensing?",
        helpText:
          "NRB §1.15 Green list, verbatim: 'Installation and operation of high-efficiency irrigation systems such as Rainwater harvesting systems/ stored-rainwater-based irrigation, drip irrigation systems, sprinkler irrigation, Solar lifting system – solar powered pump irrigation, wind pumps, gravity flow canal (A, M, N)'.",
      },
      {
        id: "rainwater_or_recharge",
        type: "yes_no",
        prompt:
          "Does the system incorporate rainwater harvesting, managed aquifer recharge, or catchment management?",
      },
      {
        id: "smart_or_programmed",
        type: "yes_no",
        prompt:
          "Does the system use smart / sensor-based / programmed dawn-dusk irrigation with meteorological information?",
      },
      {
        id: "avoids_diesel_and_deep_boring",
        type: "yes_no",
        prompt:
          "Does the system AVOID diesel pumps, deep boring, and shallow tube-wells in water-scarce (low water-table) areas, and stay within recharge rate?",
        helpText:
          "NRB §1.15 Red bullets, verbatim: 'Irrigation system that uses Diesel pumps'; 'Deep boring'; 'Use of shallow tube wells in water-scarce areas where the water table is low'; 'extraction rate > recharge rate'.",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const efficient = yn(a, "drip_sprinkler_solar_lift");
      const recharge = yn(a, "rainwater_or_recharge");
      const smart = yn(a, "smart_or_programmed");
      const noBadPractice = yn(a, "avoids_diesel_and_deep_boring");
      if (!noBadPractice) {
        return {
          color: "red",
          rationale:
            "Uses diesel pumps / deep boring / shallow tube-wells in low-water-table areas / extraction > recharge. NRB §1.15 red bullets apply.",
          citation:
            "NRB GFT 2024, Annex 2 §1.15 (Table 5, pp. 71-72 — Red)",
        };
      }
      const greenLevers = [efficient, recharge, smart].filter(Boolean).length;
      if (efficient && (recharge || smart)) {
        return {
          color: "green",
          rationale:
            "High-efficiency irrigation (drip / micro-sprinkler / solar-lift / wind-pump / gravity-flow) combined with rainwater harvesting or smart control. NRB §1.15 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §1.15 (Table 5, pp. 71-72 — Green)",
        };
      }
      if (greenLevers >= 1) {
        return {
          color: "amber",
          rationale:
            "Meets one of the NRB §1.15 Green / Amber levers. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §1.15 (Table 5, pp. 71-72 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Standard flood or canal irrigation does not meet the water-smart threshold under NRB §1.15.",
        citation: "NRB GFT 2024, Annex 2 §1.15 (Table 5, pp. 71-72)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §15.2 Waste Management / Wastewater (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "waste-management",
    name: "Waste management, drainage, sanitation",
    sectorLabel: "Health Care and Waste Management",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §15.2 Waste Management; Drainage; Sanitation (Table 19, pp. 137-138)",
    applicableTo: [
      "waste management",
      "waste",
      "utilities - waste management",
      "sanitation",
    ],
    activityCriteria: [
      {
        id: "segregation_and_recycling",
        type: "yes_no",
        prompt:
          "Does the operation segregate waste at source and recover / recycle / compost material?",
      },
      {
        id: "sanitary_landfill_or_wte",
        type: "yes_no",
        prompt:
          "Is residual waste disposed via a sanitary landfill with leachate control, or via waste-to-energy with emissions capture?",
      },
      {
        id: "hazardous_waste_managed",
        type: "yes_no",
        prompt:
          "Is hazardous / medical waste segregated and treated per Nepal EPR / medical-waste standards?",
      },
    ],
    dnshCheckIds: ["effluent_treatment", "air_emissions_compliance"],
    classify: (a) => {
      const seg = yn(a, "segregation_and_recycling");
      const disposal = yn(a, "sanitary_landfill_or_wte");
      const hazMgmt = yn(a, "hazardous_waste_managed");
      const dnsh = evaluateDnsh(
        ["effluent_treatment", "air_emissions_compliance"],
        a,
      );
      if (!hazMgmt) {
        return {
          color: "red",
          rationale:
            "Hazardous / medical waste not segregated and treated. NRB §15.2 red flag.",
          citation:
            "NRB GFT 2024, Annex 2 §15.2 (Table 19, pp. 137-138 — Red)",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Waste-management DNSH checks (effluent / air) not fully passed. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §15.2 + Table 1 DNSH objective P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (seg && disposal) {
        return {
          color: "green",
          rationale:
            "Source-segregation + recycling + sanitary disposal or WTE with emissions capture + hazardous waste managed. NRB §15.2 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §15.2 (Table 19, pp. 137-138 — Green)",
        };
      }
      return {
        color: "amber",
        rationale:
          "Some but not all NRB §15.2 Green levers in place. Amber (transitional).",
        citation:
          "NRB GFT 2024, Annex 2 §15.2 (Table 19, pp. 137-138 — Amber)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §13.2 Hotel / Tourism (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "hotel-tourism",
    name: "Hotel and tourism services",
    sectorLabel: "Tourism Service",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §13.2 Hotel (Including Other Service) (Table 17, p. 134)",
    applicableTo: ["hospitality - tourism", "hotel", "tourism", "hospitality"],
    activityCriteria: [
      {
        id: "clean_energy_and_efficiency",
        type: "yes_no",
        prompt:
          "Does the property use clean energy (solar / hydro) and energy-efficiency measures (LED / smart HVAC / hot-water heat recovery)?",
      },
      {
        id: "water_efficiency_wastewater",
        type: "yes_no",
        prompt:
          "Are water-efficiency measures (low-flow / rainwater / reuse) in place, and is wastewater treated before discharge?",
      },
      {
        id: "waste_and_plastic_reduction",
        type: "yes_no",
        prompt:
          "Does the operation minimise single-use plastic and segregate / recycle waste?",
      },
      {
        id: "site_avoids_protected_areas",
        type: "yes_no",
        prompt:
          "Does the property AVOID protected areas / IUCN Red-List habitats / cultural-heritage-sensitive sites without safeguards?",
      },
    ],
    dnshCheckIds: ["effluent_treatment"],
    classify: (a) => {
      const cleanEnergy = yn(a, "clean_energy_and_efficiency");
      const water = yn(a, "water_efficiency_wastewater");
      const waste = yn(a, "waste_and_plastic_reduction");
      const siteOk = yn(a, "site_avoids_protected_areas");
      const dnsh = evaluateDnsh(["effluent_treatment"], a);
      if (!siteOk) {
        return {
          color: "red",
          rationale:
            "Property overlaps protected area / IUCN Red-List habitat / sensitive cultural site without safeguards. NRB §13.2 Red.",
          citation:
            "NRB GFT 2024, Annex 2 §13.2 (Table 17, p. 134 — Red)",
        };
      }
      if (!dnsh.passed) {
        return {
          color: "amber",
          rationale:
            "Hotel effluent DNSH check not passed. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §13.2 (Table 17, p. 134) + Table 1 DNSH objective P (p. 22)",
          dnshFailures: dnsh.failures,
        };
      }
      if (cleanEnergy && water && waste) {
        return {
          color: "green",
          rationale:
            "Clean-energy hotel with water efficiency, treated wastewater, and waste / plastic reduction on a non-conflicted site. NRB §13.2 Green (nature-based tourism aligned).",
          citation:
            "NRB GFT 2024, Annex 2 §13.2 (Table 17, p. 134 — Green)",
        };
      }
      if (cleanEnergy || water || waste) {
        return {
          color: "amber",
          rationale:
            "Some NRB §13.2 Green levers in place but not all. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §13.2 (Table 17, p. 134 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Baseline hotel operation without documented Green levers.",
        citation: "NRB GFT 2024, Annex 2 §13.2 (Table 17, p. 134)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §17.4 Residential Personal Home Loan (≤ Rs. 15 million) (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "personal-home-loan",
    name: "Residential personal home loan (≤ Rs. 15 million)",
    sectorLabel: "Consumption Loan",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §17.4 Residential Personal Home Loan (Up to Rs. 15 million) (Table 21, p. 139)",
    applicableTo: ["consumption", "personal", "home", "residential", "retail"],
    activityCriteria: [
      {
        id: "loan_amount_npr_million",
        type: "numeric",
        unit: "NPR million",
        prompt: "Loan amount (NPR million)",
        helpText:
          "NRB §17.4 caps this activity at Rs. 15 million. Loans above the cap should be classified under §12.1 Residential Real Estate instead.",
      },
      {
        id: "green_certified_home",
        type: "yes_no",
        prompt:
          "Is the home certified under EDGE / LEED / CBI residential or DUDBC Nepal Green Building Codes?",
      },
      {
        id: "solar_water_efficient",
        type: "yes_no",
        prompt:
          "Does the home use solar hot water / PV and water-efficiency fixtures?",
      },
      {
        id: "site_outside_hazard_zones",
        type: "yes_no",
        prompt:
          "Is the home outside disaster-prone areas / IUCN Red-List habitats / arable / cultural sites?",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const loanAmt = num(a, "loan_amount_npr_million");
      const cert = yn(a, "green_certified_home");
      const solar = yn(a, "solar_water_efficient");
      const siteOk = yn(a, "site_outside_hazard_zones");
      if (loanAmt !== null && loanAmt > 15) {
        return {
          color: "unclassified",
          rationale: `Loan amount NPR ${loanAmt}M exceeds the NRB §17.4 Consumption Loan cap of Rs. 15 million. Re-classify under §12.1 Residential Real Estate (green-buildings wizard).`,
          citation:
            "NRB GFT 2024, Annex 2 §17.4 (Table 21, p. 139 — cap: Rs. 15 million)",
        };
      }
      if (!siteOk) {
        return {
          color: "red",
          rationale:
            "Home on disaster-prone / IUCN Red-List / arable / cultural site. NRB §12.1 red bullets apply by reference.",
          citation:
            "NRB GFT 2024, Annex 2 §17.4 (Table 21, p. 139) + §12.1 (p. 131 — Red)",
        };
      }
      if (cert) {
        return {
          color: "green",
          rationale:
            "Green-certified home (EDGE / LEED / CBI / DUDBC) within the NPR 15 million §17.4 cap and outside hazard zones. NRB §17.4 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §17.4 (Table 21, p. 139 — Green)",
        };
      }
      if (solar) {
        return {
          color: "amber",
          rationale:
            "Home uses solar hot water / PV and water-efficient fixtures but no formal green certification. NRB §17.4 Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §17.4 (Table 21, p. 139 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Baseline residential home loan — no documented Green / Amber levers. Not classified under the taxonomy.",
        citation: "NRB GFT 2024, Annex 2 §17.4 (Table 21, p. 139)",
      };
    },
  }),

  // -------------------------------------------------------------------------
  // §11.1 Green Financial Intermediation (NEW)
  // -------------------------------------------------------------------------
  defineActivity({
    id: "green-financial-intermediation",
    name: "Green financial intermediation (blended finance / green bonds / green insurance)",
    sectorLabel: "Finance, Insurance",
    nrbCitation:
      "NRB GFT 2024, Annex 2 §11.1 Financial Intermediation (Table 15, pp. 128-130)",
    applicableTo: [
      "finance",
      "insurance",
      "financial intermediation",
      "financial services",
      "bond",
    ],
    activityCriteria: [
      {
        id: "proceeds_to_green_amber",
        type: "yes_no",
        prompt:
          "Are proceeds ring-fenced to on-lend / underwrite Green or Amber activities in this taxonomy?",
      },
      {
        id: "excludes_carbon_intensive",
        type: "yes_no",
        prompt:
          "Does the instrument EXCLUDE fossil-fuel / carbon-intensive / environmentally poor-standard activities per NRB §11.1 Red?",
        helpText:
          "NRB §11.1 Red verbatim: 'Any Banking and Financial institutions (insurance of fossil fuel-based activities), capital markets (merchant banks), insurance companies and pension funds, trust funds or other funds activities that are carbon intensive, have environmentally poor standards, and cause significant damage to human health, climate, and ecosystems or categorised under excluded/ red are considered as financing in red activities.'",
      },
      {
        id: "icma_gbp_aligned",
        type: "yes_no",
        prompt:
          "For green bonds: is the instrument aligned with ICMA Green Bond Principles (use of proceeds, project selection, management of proceeds, reporting)?",
        helpText:
          "NRB s. 3.5.3 (pp. 33-34) requires ICMA GBP alignment for green-labelled instruments.",
      },
    ],
    dnshCheckIds: [],
    classify: (a) => {
      const green = yn(a, "proceeds_to_green_amber");
      const excludes = yn(a, "excludes_carbon_intensive");
      const icma = yn(a, "icma_gbp_aligned");
      if (!excludes) {
        return {
          color: "red",
          rationale:
            "Instrument does not exclude fossil-fuel / carbon-intensive activities. NRB §11.1 Red applies.",
          citation:
            "NRB GFT 2024, Annex 2 §11.1 (Table 15, pp. 128-130 — Red)",
        };
      }
      if (green && icma) {
        return {
          color: "green",
          rationale:
            "Green-labelled financial instrument with ring-fenced proceeds to Green/Amber activities, excluding carbon-intensive activities, and ICMA GBP-aligned reporting. NRB §11.1 Green.",
          citation:
            "NRB GFT 2024, Annex 2 §11.1 (Table 15, pp. 128-130 — Green) + s. 3.5.3 (pp. 33-34)",
        };
      }
      if (green) {
        return {
          color: "amber",
          rationale:
            "Proceeds ring-fenced to Green/Amber activities but no ICMA GBP alignment declared. Amber (transitional).",
          citation:
            "NRB GFT 2024, Annex 2 §11.1 (Table 15, pp. 128-130 — Amber)",
        };
      }
      return {
        color: "unclassified",
        rationale:
          "Generic financial intermediation without ring-fenced green proceeds — outside the taxonomy Green/Amber scope.",
        citation:
          "NRB GFT 2024, Annex 2 §11.1 (Table 15, pp. 128-130)",
      };
    },
  }),
];

// ---------------------------------------------------------------------------
// Legacy id aliasing
// ---------------------------------------------------------------------------

/**
 * Legacy activity IDs that have been consolidated / renamed. Preserving
 * these here means previously saved bfi_taxonomy_assessments rows still
 * resolve to a current activity when the wizard reopens.
 *
 * Legacy id "hydro-small" / "hydro-medium" / "hydro-large" → "hydro"
 *   (MW capacity bands were never in NRB; the taxonomy uses run-of-river
 *   + power-density + lifecycle-GHG criteria — one activity, one wizard.)
 *
 * Legacy id "ev-transport" → "ev-consumer"
 *   (The original blanket EV activity has been split; personal EV loans
 *   belong under NRB §17.2 Consumption Loan. Commercial / fleet EVs
 *   should use the new "ev-commercial" activity explicitly.)
 */
const LEGACY_ID_ALIASES: Record<string, string> = {
  "hydro-small": "hydro",
  "hydro-medium": "hydro",
  "hydro-large": "hydro",
  "ev-transport": "ev-consumer",
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function findActivityById(id: string): TaxonomyActivity | null {
  const direct = TAXONOMY_ACTIVITIES.find((a) => a.id === id);
  if (direct) return direct;
  const aliased = LEGACY_ID_ALIASES[id];
  if (aliased) {
    return TAXONOMY_ACTIVITIES.find((a) => a.id === aliased) ?? null;
  }
  return null;
}

/**
 * Suggest activities that fit a given NRB sector. Used by the wizard to
 * pre-filter the activity picker to activities that are likely relevant
 * to the loan's borrower. See lib/regulatory/taxonomy/applicability.ts
 * for the full sector-mapping logic.
 */
export function suggestActivitiesForSector(nrbSector: string): TaxonomyActivity[] {
  const s = nrbSector.toLowerCase();
  return TAXONOMY_ACTIVITIES.filter((a) =>
    a.applicableTo.some((pattern) => s.includes(pattern.toLowerCase())),
  );
}
