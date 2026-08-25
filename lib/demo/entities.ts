/**
 * Borrower catalog built from the committed data snapshots.
 *
 * Three tiers of real-rooted entities:
 *   1. Cement plant operators (GCCT, July 2025) - facility tier, GEM data
 *   2. Hydropower operators (curated)            - facility tier, near-zero emissions
 *   3. Other industrial entities (curated)        - facility tier or sector-benchmark
 *
 * Plus one synthesized SME pool for the small-business slice of the portfolio
 * (these are sector-benchmark or revenue-estimate tier).
 */

import cementSnapshot from "@/data/cement-plants-npl.json";
import hydroSnapshot from "@/data/hydropower-operators-npl.json";
import industrialSnapshot from "@/data/industrial-entities-npl.json";
import ctSnapshot from "@/data/ct-nepal-2024.json";
import {
  Borrower,
  BorrowerDataTier,
  BorrowerKind,
  MatchedFacility,
} from "@/lib/types/bfi";
import { mulberry32, rangeFloat } from "@/lib/demo/synth-util";

// ---------------------------------------------------------------------------
// Real Climate TRACE 2024 facility index — keyed by 4-decimal lat/lon
// ---------------------------------------------------------------------------

type CtFacility = {
  assetId: string;
  lat: number;
  lng: number;
  sector: string;
  co2e2024Tonnes: number;
  tier: "L" | "M" | "H";
};

function ctKey(lat: number, lng: number): string {
  // 0.001° ≈ ~111m precision; round to 3 decimals for robust GCCT↔CT matching.
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

const CT_2024_INDEX = (() => {
  const map = new Map<string, CtFacility>();
  for (const f of ctSnapshot.facilities as CtFacility[]) {
    map.set(ctKey(f.lat, f.lng), f);
  }
  return map;
})();

/**
 * Look up the matching Climate TRACE 2024 facility for a GCCT plant.
 * Tries the exact rounded key first, then a 1-cell neighbourhood search
 * (handles tiny coordinate drift between GCCT and CT).
 */
function findCtMatch(lat: number, lng: number): CtFacility | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const exact = CT_2024_INDEX.get(ctKey(lat, lng));
  if (exact) return exact;
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) {
      if (dLat === 0 && dLng === 0) continue;
      const candidate = CT_2024_INDEX.get(
        ctKey(lat + dLat * 0.001, lng + dLng * 0.001)
      );
      if (candidate) return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cement plant emissions estimation
// ---------------------------------------------------------------------------
// Industry baseline: ~0.75 tCO2 per tonne of cement (clinker-driven).
// Utilisation deterministically varied 0.65-0.92 per plant (seeded by GEM ID).

const CEMENT_TCO2_PER_TONNE = 0.75;

function utilizationForPlant(gemPlantId: string): number {
  // Stable hash of GEM Plant ID
  let h = 0;
  for (let i = 0; i < gemPlantId.length; i++) {
    h = ((h << 5) - h + gemPlantId.charCodeAt(i)) | 0;
  }
  const r = mulberry32(h);
  return rangeFloat(0.65, 0.92, r);
}

/**
 * Build a 5-year emissions series anchored on a real 2024 value.
 * Back-casts 2021-2023 with mild downward drift (industry was growing) +
 * forward-cast 2025 as ~10/12 partial. Used when we have a verified CT
 * 2024 number for the facility.
 */
function buildAnchoredSeries(
  anchor2024: number,
  seed: number
): { year: number; co2eTonnes: number }[] {
  const r = mulberry32(seed);
  return [2021, 2022, 2023, 2024, 2025].map((y) => {
    if (y === 2024) {
      return { year: y, co2eTonnes: anchor2024 };
    }
    if (y === 2025) {
      const noise = rangeFloat(0.93, 1.07, r);
      return {
        year: y,
        co2eTonnes: Math.round(anchor2024 * (10 / 12) * noise),
      };
    }
    // 2021-2023: back-cast with mild downward drift (industry growth)
    const yearsBack = 2024 - y;
    const drift = 1 - yearsBack * rangeFloat(0.005, 0.025, r);
    const noise = rangeFloat(0.93, 1.07, r);
    return { year: y, co2eTonnes: Math.round(anchor2024 * drift * noise) };
  });
}

function multiYearEmissions(
  baseAnnual: number,
  seed: number
): { year: number; co2eTonnes: number }[] {
  const r = mulberry32(seed);
  // 5-year series 2021-2025 with mild upward drift + noise.
  // 2025 is intentionally lower (partial year, Climate TRACE coverage through October).
  const years = [2021, 2022, 2023, 2024, 2025];
  return years.map((y, i) => {
    const drift = 1 + i * rangeFloat(0.005, 0.025, r); // 0.5%-2.5%/yr
    const noise = rangeFloat(0.93, 1.07, r);
    const partial = y === 2025 ? 10 / 12 : 1; // 10 months
    return {
      year: y,
      co2eTonnes: Math.round(baseAnnual * drift * noise * partial),
    };
  });
}

// ---------------------------------------------------------------------------
// Cement borrowers (grouped by owner)
// ---------------------------------------------------------------------------

type CementPlant = (typeof cementSnapshot.plants)[number];

function cementBorrowers(): Borrower[] {
  const byOwner = new Map<string, CementPlant[]>();
  for (const p of cementSnapshot.plants as CementPlant[]) {
    if (!p.owner) continue;
    const k = p.owner;
    if (!byOwner.has(k)) byOwner.set(k, []);
    byOwner.get(k)!.push(p);
  }

  const out: Borrower[] = [];
  let i = 0;
  for (const [owner, plants] of byOwner) {
    i++;
    const facilities: MatchedFacility[] = plants.map((p) => {
      const util = p.gemPlantId ? utilizationForPlant(p.gemPlantId) : 0.8;
      const cap = p.cementCapacityMtpa ?? 0.3;
      const seed = p.gemPlantId
        ? Number.parseInt(p.gemPlantId.replace(/\D/g, "").slice(-8) || "1", 10)
        : 1;

      // Look up real Climate TRACE 2024 emissions by lat/lon (within ~100m).
      // If found, use the real number; otherwise fall back to capacity-based estimate.
      const ctMatch =
        p.lat != null && p.lng != null ? findCtMatch(p.lat, p.lng) : null;
      const estimateAnnual = Math.round(
        cap * 1_000_000 * util * CEMENT_TCO2_PER_TONNE
      );
      const realAnnual = ctMatch?.co2e2024Tonnes ?? null;
      const annual = realAnnual ?? estimateAnnual;

      // Multi-year trend anchored on the 2024 value: if we have the real
      // 2024 number, treat it as the anchor and back-cast 2021-2023 with mild
      // drift + noise. 2025 stays partial (~10/12).
      const series = ctMatch
        ? buildAnchoredSeries(annual, seed)
        : multiYearEmissions(annual, seed);

      return {
        assetId: ctMatch?.assetId ?? p.gemPlantId ?? `GCCT-${i}`,
        facilityName: p.name ?? "Cement Plant",
        facilityNameLocal: p.nameLocal,
        sector: "manufacturing-cement",
        lat: p.lat ?? 0,
        lng: p.lng ?? 0,
        annualCo2eTonnes: annual,
        emissionsYear: ctMatch ? 2024 : 2023,
        emissionsByYear: series,
        municipality: p.municipality,
        subnationalUnit: p.subnationalUnit,
        cementCapacityMtpa: p.cementCapacityMtpa,
        gemPlantId: p.gemPlantId,
        wikiPage: p.wikiPage,
        matchMethod: ctMatch ? "manual" : "manual",
        matchConfidence: ctMatch ? 0.99 : 0.7,
      };
    });

    const totalCo2e = facilities.reduce((s, f) => s + f.annualCo2eTonnes, 0);
    const totalCap = plants.reduce(
      (s, p) => s + (p.cementCapacityMtpa ?? 0),
      0
    );
    // Enterprise value heuristic: $150M per Mt/yr cement capacity (industry rule of thumb).
    const evUsd = Math.max(5_000_000, Math.round(totalCap * 150_000_000));

    // Parent / public-listed flags from snapshot
    const first = plants[0];
    const publiclyListed =
      owner.toLowerCase().includes("ghorahi") ||
      owner.toLowerCase().includes("arghakhanchi") ||
      owner.toLowerCase().includes("hetauda cement");

    out.push({
      id: `B-CEM-${String(i).padStart(3, "0")}`,
      name: owner,
      kind: "corporate",
      nrbSector: "Manufacturing - Cement",
      enterpriseValueUsd: evUsd,
      evSource: publiclyListed ? "public-filing" : "estimated",
      dataTier: "facility",
      parent: first.parent,
      parentEntityId: first.parentEntityId,
      gemEntityId: first.ownerEntityId,
      publiclyListed,
      municipality: first.municipality,
      subnationalUnit: first.subnationalUnit,
      facilities,
      totalCo2eTonnes: totalCo2e,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hydropower borrowers
// ---------------------------------------------------------------------------

type HydroOperator = (typeof hydroSnapshot.operators)[number];

function hydroBorrowers(): Borrower[] {
  const out: Borrower[] = [];
  (hydroSnapshot.operators as HydroOperator[]).forEach((op, i) => {
    const facilities: MatchedFacility[] = op.operatingStations.map((s, j) => {
      // Hydropower direct ops emissions estimated from operating capacity
      // (~15 tCO2/MW/yr lifecycle attribution). Climate TRACE does NOT
      // currently track Nepal hydropower at facility level — this number
      // is a sector-benchmark estimate from installed capacity, not a
      // measured emission. The facility name, coordinates, and capacity
      // are real (sourced from operator filings + public registries).
      const baseAnnual = Math.round(s.capacityMw * 15);
      const seed = (i + 1) * 1000 + j;
      return {
        assetId: `HYDRO-${op.shortName.replace(/\s/g, "")}-${j + 1}`,
        facilityName: s.name,
        sector: "power-hydro",
        lat: s.lat,
        lng: s.lng,
        annualCo2eTonnes: baseAnnual,
        emissionsYear: 2023,
        emissionsByYear: multiYearEmissions(baseAnnual, seed),
        matchMethod: "manual",
        matchConfidence: 0.9,
      };
    });
    const totalCo2e = facilities.reduce((s, f) => s + f.annualCo2eTonnes, 0);
    const totalCap = op.operatingStations.reduce((s, x) => s + x.capacityMw, 0);
    // Hydro EV heuristic: $2M per MW (lower than developed-world due to lower capex).
    const evUsd = Math.max(8_000_000, totalCap * 2_000_000);
    const publiclyListed = op.ownership === "publicly-listed";

    out.push({
      id: `B-HYD-${String(i + 1).padStart(3, "0")}`,
      name: op.name,
      kind: "corporate",
      nrbSector: "Energy - Hydropower",
      enterpriseValueUsd: evUsd,
      evSource: publiclyListed ? "public-filing" : "estimated",
      // Sector-benchmark tier, NOT facility tier: Climate TRACE does not
      // cover Nepal hydropower at facility level (verified directly against
      // the Jana platform), so we route hydropower attribution through the
      // sector-benchmark PCAF branch and label it Score 4.
      dataTier: "sector-benchmark",
      parent: null,
      publiclyListed,
      facilities,
      totalCo2eTonnes: totalCo2e,
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Other industrial borrowers (sector-benchmark tier)
// ---------------------------------------------------------------------------

type IndustrialEntity = (typeof industrialSnapshot.entities)[number];

const INDUSTRIAL_EMISSIONS_BY_SECTOR: Record<string, [number, number]> = {
  "manufacturing-fmcg": [8_000, 30_000],
  "manufacturing-chemicals": [5_000, 25_000],
  "manufacturing-steel": [20_000, 120_000],
  "manufacturing-textiles": [15_000, 80_000],
  "agriculture-processing": [10_000, 60_000],
};

const INDUSTRIAL_NRB_SECTOR: Record<string, string> = {
  "manufacturing-fmcg": "Manufacturing - FMCG",
  "manufacturing-chemicals": "Manufacturing - Chemicals",
  "manufacturing-steel": "Manufacturing - Steel",
  "manufacturing-textiles": "Manufacturing - Textiles",
  "agriculture-processing": "Agriculture - Processing",
};

function industrialBorrowers(): Borrower[] {
  const out: Borrower[] = [];
  (industrialSnapshot.entities as IndustrialEntity[]).forEach((e, i) => {
    const range = INDUSTRIAL_EMISSIONS_BY_SECTOR[e.sector] ?? [5_000, 25_000];
    const r = mulberry32(0xa1d0 + i);
    const baseAnnual = Math.round(rangeFloat(range[0], range[1], r));
    const facilities: MatchedFacility[] = e.facilities.map((f, j) => ({
      assetId: `IND-${i + 1}-${j + 1}`,
      facilityName: f.name,
      sector: e.sector,
      lat: f.lat,
      lng: f.lng,
      annualCo2eTonnes: Math.round(baseAnnual / e.facilities.length),
      emissionsYear: 2023,
      emissionsByYear: multiYearEmissions(
        Math.round(baseAnnual / e.facilities.length),
        0xb000 + i * 10 + j
      ),
      matchMethod: "name-match",
      matchConfidence: 0.7,
    }));
    const publiclyListed = e.ownership === "publicly-listed";
    // Industrial EV: very rough $40M-$200M
    const evUsd = Math.round(rangeFloat(40_000_000, 200_000_000, r));

    out.push({
      id: `B-IND-${String(i + 1).padStart(3, "0")}`,
      name: e.name,
      kind: "corporate",
      nrbSector: INDUSTRIAL_NRB_SECTOR[e.sector] ?? "Manufacturing - Other",
      enterpriseValueUsd: evUsd,
      evSource: publiclyListed ? "public-filing" : "estimated",
      // Some have facility coordinates (counts as facility tier with name match),
      // others rely on sector benchmarks only.
      dataTier: facilities.length > 0 ? "facility" : "sector-benchmark",
      parent: e.parent,
      publiclyListed,
      facilities,
      totalCo2eTonnes: baseAnnual,
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// CT-facility-matched borrowers (non-manufacturing)
// ---------------------------------------------------------------------------
//
// The 213 Climate TRACE Nepal facilities are not all cement plants. There are
// 28 buildings, 46 transportation, 16 waste, and 98 agriculture admin zones.
// Banks lend against the operators of buildings, transport hubs and waste
// utilities (the agriculture admin zones are regional rollups, not real
// borrowers, so we skip them).
//
// For every Medium or High tier CT facility outside manufacturing and
// agriculture, we synthesize a borrower at that exact location with the
// real CT 2024 emissions. Name and sector are derived from CT sector +
// a stable deterministic name pool. Result: ~50 additional facility-tier
// borrowers across hospitality, logistics, waste-utility, and real-estate
// sectors.

type CtBorrowerConfig = {
  ctSector: "buildings" | "transportation" | "waste";
  nrbSector: string;
  idPrefix: string;
  // Two name pools so we can interleave (e.g., hotels vs property developers
  // both come from "buildings" CT sector).
  primaryPool: { suffix: string; nrbSector: string };
  secondaryPool?: { suffix: string; nrbSector: string };
  /** Split ratio if secondary pool present (0..1). */
  secondaryShare?: number;
};

const CT_BORROWER_CONFIGS: CtBorrowerConfig[] = [
  {
    ctSector: "buildings",
    nrbSector: "Hospitality - Tourism",
    idPrefix: "B-HOSP",
    primaryPool: { suffix: "Hotels Pvt Ltd", nrbSector: "Hospitality - Tourism" },
    secondaryPool: {
      suffix: "Properties Pvt Ltd",
      nrbSector: "Real Estate - Commercial",
    },
    secondaryShare: 0.5,
  },
  {
    ctSector: "transportation",
    nrbSector: "Transport & Storage",
    idPrefix: "B-LOG",
    primaryPool: {
      suffix: "Logistics Pvt Ltd",
      nrbSector: "Transport & Storage",
    },
    secondaryPool: {
      suffix: "Transport Co Pvt Ltd",
      nrbSector: "Transport & Storage",
    },
    secondaryShare: 0.35,
  },
  {
    ctSector: "waste",
    nrbSector: "Utilities - Waste Management",
    idPrefix: "B-WASTE",
    primaryPool: {
      suffix: "Sanitation Pvt Ltd",
      nrbSector: "Utilities - Waste Management",
    },
  },
];

const NAME_PREFIXES = [
  "Annapurna",
  "Himalayan",
  "Sagarmatha",
  "Kantipur",
  "Gandaki",
  "Kosi",
  "Karnali",
  "Bagmati",
  "Lumbini",
  "Mechi",
  "Trishuli",
  "Pokhara",
  "Pashupati",
  "Manakamana",
  "Dhaulagiri",
  "Machhapuchhre",
  "Everest",
  "Janaki",
  "Bhrikuti",
  "Marsyangdi",
  "Sunkoshi",
  "Birendra",
  "Tarai",
  "Trident",
  "Capital",
] as const;

function municipalityFromCoords(lat: number, lng: number): string | null {
  // Rough mapping by lat/lng → known city clusters in Nepal
  const places: Array<{
    name: string;
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }> = [
    { name: "Kathmandu", minLat: 27.65, maxLat: 27.78, minLng: 85.27, maxLng: 85.40 },
    { name: "Pokhara",   minLat: 28.18, maxLat: 28.28, minLng: 83.95, maxLng: 84.08 },
    { name: "Biratnagar", minLat: 26.43, maxLat: 26.53, minLng: 87.25, maxLng: 87.36 },
    { name: "Birgunj",   minLat: 27.00, maxLat: 27.08, minLng: 84.85, maxLng: 84.93 },
    { name: "Butwal",    minLat: 27.66, maxLat: 27.74, minLng: 83.42, maxLng: 83.50 },
    { name: "Nepalgunj", minLat: 28.05, maxLat: 28.12, minLng: 81.60, maxLng: 81.68 },
    { name: "Dharan",    minLat: 26.78, maxLat: 26.86, minLng: 87.25, maxLng: 87.32 },
    { name: "Hetauda",   minLat: 27.40, maxLat: 27.46, minLng: 85.00, maxLng: 85.08 },
    { name: "Janakpur",  minLat: 26.70, maxLat: 26.78, minLng: 85.90, maxLng: 85.98 },
    { name: "Bharatpur", minLat: 27.66, maxLat: 27.72, minLng: 84.40, maxLng: 84.46 },
  ];
  for (const p of places) {
    if (
      lat >= p.minLat &&
      lat <= p.maxLat &&
      lng >= p.minLng &&
      lng <= p.maxLng
    ) {
      return p.name;
    }
  }
  return null;
}

function ctMatchedBorrowers(): Borrower[] {
  const out: Borrower[] = [];
  const facilities = (ctSnapshot.facilities as CtFacility[])
    .filter((f) => f.tier === "H" || f.tier === "M")
    .filter(
      (f) =>
        f.sector === "buildings" ||
        f.sector === "transportation" ||
        f.sector === "waste"
    );

  // Order by emissions desc for stable indexing
  facilities.sort((a, b) => b.co2e2024Tonnes - a.co2e2024Tonnes);

  facilities.forEach((f, idx) => {
    const cfg = CT_BORROWER_CONFIGS.find((c) => c.ctSector === f.sector)!;
    const r = mulberry32(0xd000 + idx);

    // Pick which pool the borrower comes from
    const useSecondary =
      !!cfg.secondaryPool &&
      cfg.secondaryShare != null &&
      r() < cfg.secondaryShare;
    const pool = useSecondary ? cfg.secondaryPool! : cfg.primaryPool;

    const prefix = NAME_PREFIXES[idx % NAME_PREFIXES.length];
    const muni = municipalityFromCoords(f.lat, f.lng);
    const namePart = muni
      ? `${prefix} ${muni} ${pool.suffix.split(" ")[0]} Pvt Ltd`
      : `${prefix} ${pool.suffix}`;

    // Attribution scale: a CT transportation / buildings / waste facility
    // represents a regional zone or shared infrastructure, not a single
    // company's operations. We attribute 15-25% of the facility's annual
    // CO2e to this synthesized borrower, modeling them as one of several
    // operators on the asset (one hotel chain among many in a district,
    // one fleet on a transport corridor, one utility on a regional landfill).
    const attributionShare = rangeFloat(0.15, 0.25, r);
    const attributed2024 = Math.round(f.co2e2024Tonnes * attributionShare);

    // EV heuristic: scale to attributed emissions (rougher than cement,
    // since the capital intensity of a hotel vs landfill vs cargo hub
    // varies wildly). Same caveat the rest of the demo carries: this is
    // illustrative; the bank would use their own credit-system EV.
    const evUsd = Math.round(
      rangeFloat(15_000_000, 80_000_000, r) +
        attributed2024 * rangeFloat(20, 80, r)
    );

    const series = (function () {
      const r2 = mulberry32(0xd100 + idx);
      return [2021, 2022, 2023, 2024, 2025].map((y) => {
        if (y === 2024) return { year: y, co2eTonnes: attributed2024 };
        if (y === 2025) {
          return {
            year: y,
            co2eTonnes: Math.round(
              attributed2024 * (10 / 12) * rangeFloat(0.93, 1.07, r2)
            ),
          };
        }
        const yearsBack = 2024 - y;
        const drift = 1 - yearsBack * rangeFloat(0.005, 0.025, r2);
        const noise = rangeFloat(0.93, 1.07, r2);
        return {
          year: y,
          co2eTonnes: Math.round(attributed2024 * drift * noise),
        };
      });
    })();

    out.push({
      id: `${cfg.idPrefix}-${String(idx + 1).padStart(3, "0")}`,
      name: namePart,
      kind: "corporate",
      nrbSector: pool.nrbSector,
      enterpriseValueUsd: evUsd,
      evSource: "estimated",
      dataTier: "facility",
      municipality: muni,
      facilities: [
        {
          assetId: `CT-${f.assetId}`,
          facilityName: namePart,
          sector: `${f.sector}-${pool.suffix.toLowerCase().replace(/ /g, "-")}`,
          lat: f.lat,
          lng: f.lng,
          annualCo2eTonnes: attributed2024,
          emissionsYear: 2024,
          emissionsByYear: series,
          matchMethod: "geocoded",
          matchConfidence: 0.95,
        },
      ],
      totalCo2eTonnes: attributed2024,
    });
  });

  return out;
}

// ---------------------------------------------------------------------------
// Synthesized SME pool
// ---------------------------------------------------------------------------
// Realistic Nepali firm names by sector. Used as a "borrower pool" — many SME
// loans are assigned to these synthetic entities (PCAF Score 4-5).

const SME_PREFIXES = [
  "Annapurna",
  "Himalayan",
  "Sagarmatha",
  "Kantipur",
  "Gandaki",
  "Kosi",
  "Karnali",
  "Bagmati",
  "Lumbini",
  "Mechi",
  "Trishuli",
  "Marsyangdi",
  "Pashupati",
  "Manakamana",
  "Janaki",
  "Bishal",
  "Shubha",
  "Sangam",
  "Everest",
  "Dhaulagiri",
  "Machhapuchhre",
  "Surya",
  "Chandra",
  "Pratima",
  "Goma",
  "Tarai",
  "Kosi Valley",
  "Sunkoshi",
  "Birendra",
  "Janata",
];

const SME_SECTORS: Array<{
  suffix: string;
  nrbSector: string;
  taxonomyLikely: "amber" | "red" | "unclassified" | "green";
  emissionsRange: [number, number];
  evRange: [number, number];
}> = [
  {
    suffix: "Trading Pvt Ltd",
    nrbSector: "Wholesale & Retail Trade",
    taxonomyLikely: "unclassified",
    emissionsRange: [50, 800],
    evRange: [200_000, 2_000_000],
  },
  {
    suffix: "Construction Co Pvt Ltd",
    nrbSector: "Construction",
    taxonomyLikely: "amber",
    emissionsRange: [500, 5_000],
    evRange: [500_000, 8_000_000],
  },
  {
    suffix: "Garments Pvt Ltd",
    nrbSector: "Manufacturing - Textiles",
    taxonomyLikely: "amber",
    emissionsRange: [800, 6_000],
    evRange: [400_000, 4_000_000],
  },
  {
    suffix: "Brick Industries Pvt Ltd",
    nrbSector: "Manufacturing - Brick",
    taxonomyLikely: "red",
    emissionsRange: [3_000, 25_000],
    evRange: [200_000, 2_500_000],
  },
  {
    suffix: "Food Products Pvt Ltd",
    nrbSector: "Agriculture - Processing",
    taxonomyLikely: "amber",
    emissionsRange: [200, 3_000],
    evRange: [400_000, 5_000_000],
  },
  {
    suffix: "Logistics Pvt Ltd",
    nrbSector: "Transport & Storage",
    taxonomyLikely: "amber",
    emissionsRange: [500, 4_500],
    evRange: [300_000, 4_000_000],
  },
  {
    suffix: "Hotels Pvt Ltd",
    nrbSector: "Hospitality - Tourism",
    taxonomyLikely: "unclassified",
    emissionsRange: [100, 1_500],
    evRange: [800_000, 12_000_000],
  },
  {
    suffix: "Agro Pvt Ltd",
    nrbSector: "Agriculture - Processing",
    taxonomyLikely: "amber",
    emissionsRange: [80, 800],
    evRange: [200_000, 1_500_000],
  },
  {
    suffix: "Energy Pvt Ltd",
    nrbSector: "Energy - Hydropower",
    taxonomyLikely: "green",
    emissionsRange: [10, 200],
    evRange: [800_000, 25_000_000],
  },
  {
    suffix: "Plastics Industries Pvt Ltd",
    nrbSector: "Manufacturing - Plastics",
    taxonomyLikely: "amber",
    emissionsRange: [600, 5_000],
    evRange: [400_000, 4_500_000],
  },
];

export type SmeBorrower = Borrower & { _taxonomyLikely: string };

function smeBorrowers(count: number, seed: number): SmeBorrower[] {
  const r = mulberry32(seed);
  const out: SmeBorrower[] = [];
  for (let i = 0; i < count; i++) {
    const prefix = SME_PREFIXES[Math.floor(r() * SME_PREFIXES.length)];
    const sector = SME_SECTORS[Math.floor(r() * SME_SECTORS.length)];
    const name = `${prefix} ${sector.suffix}`;
    const [eMin, eMax] = sector.emissionsRange;
    const [evMin, evMax] = sector.evRange;
    const annualCo2e = Math.round(rangeFloat(eMin, eMax, r));
    out.push({
      id: `B-SME-${String(i + 1).padStart(5, "0")}`,
      name,
      kind: "sme",
      nrbSector: sector.nrbSector,
      enterpriseValueUsd: Math.round(rangeFloat(evMin, evMax, r)),
      evSource: "proxy",
      dataTier: "sector-benchmark",
      facilities: [],
      totalCo2eTonnes: annualCo2e,
      _taxonomyLikely: sector.taxonomyLikely,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Retail pool — single placeholder borrower for all retail loans
// ---------------------------------------------------------------------------

const RETAIL_POOL: Borrower = {
  id: "B-RETAIL-POOL",
  name: "Retail Loan Pool",
  kind: "retail-pool",
  nrbSector: "Retail",
  enterpriseValueUsd: 0,
  evSource: "proxy",
  dataTier: "n/a",
  facilities: [],
  totalCo2eTonnes: 0,
};

// ---------------------------------------------------------------------------
// Catalog assembly + memoization
// ---------------------------------------------------------------------------

export type BorrowerCatalog = {
  retailPool: Borrower;
  cement: Borrower[];
  hydro: Borrower[];
  industrial: Borrower[];
  /** Hotels, logistics, waste, real-estate — created at CT non-mfg M+H facilities */
  ctMatchedNonMfg: Borrower[];
  sme: SmeBorrower[];
  /** All non-retail borrowers in one list */
  all: Borrower[];
  byId: Map<string, Borrower>;
};

let catalogCache: BorrowerCatalog | null = null;

export function getBorrowerCatalog(): BorrowerCatalog {
  if (catalogCache) return catalogCache;
  const cement = cementBorrowers();
  const hydro = hydroBorrowers();
  const industrial = industrialBorrowers();
  const ctMatchedNonMfg = ctMatchedBorrowers();
  const sme = smeBorrowers(180, 0xc0ffee);
  const all = [...cement, ...hydro, ...industrial, ...ctMatchedNonMfg, ...sme];
  const byId = new Map<string, Borrower>([
    [RETAIL_POOL.id, RETAIL_POOL],
    ...all.map((b) => [b.id, b] as const),
  ]);
  catalogCache = {
    retailPool: RETAIL_POOL,
    cement,
    hydro,
    industrial,
    ctMatchedNonMfg,
    sme,
    all,
    byId,
  };
  return catalogCache;
}
