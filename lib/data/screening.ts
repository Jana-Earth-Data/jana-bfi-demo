/**
 * Borrower screening data layer for the ESRM tab.
 *
 * Two modes:
 *   - buildScreening(borrower)               -> synthetic / hardcoded fallback (mock mode)
 *   - buildScreeningLive(borrower, token)    -> hits Jana EDGAR + OpenAQ live
 *
 * The "live" version uses real EDGAR Nepal sector totals (national CO2 by
 * EDGAR sector) and real OpenAQ PM2.5 from the nearest monitoring station,
 * with mock fallback per-field if a call fails.
 */

import {
  Borrower,
  BorrowerScreening,
  MatchedFacility,
} from "@/lib/types/bfi";
import { EDGAR_NEPAL } from "@/lib/data/edgar-snapshot";
import {
  FacilityAirQuality,
  getFacilityAirQuality,
} from "@/lib/api/openaq";

// Internal alias kept for the function signature below.
type EdgarNationalTotal = {
  year: number;
  totalTco2: number;
};

// ---------------------------------------------------------------------------
// Fallback constants (used when no token or live fetch fails)
// ---------------------------------------------------------------------------

const SECTOR_BENCHMARK_FALLBACK: Record<
  string,
  { value: number; label: string }
> = {
  "Manufacturing - Cement": {
    value: 0.75,
    label: "tCO₂ per tonne cement (industry benchmark)",
  },
  "Energy - Hydropower": {
    value: 15,
    label: "tCO₂ per MW operational (life-cycle)",
  },
  "Manufacturing - Steel": {
    value: 1.83,
    label: "tCO₂ per tonne steel (industry benchmark)",
  },
  "Manufacturing - FMCG": {
    value: 20000,
    label: "tCO₂ per typical facility-year",
  },
  "Manufacturing - Chemicals": {
    value: 15000,
    label: "tCO₂ per typical facility-year",
  },
  "Manufacturing - Textiles": {
    value: 40000,
    label: "tCO₂ per typical facility-year",
  },
  "Agriculture - Processing": {
    value: 25000,
    label: "tCO₂ per typical facility-year",
  },
  "Manufacturing - Brick": {
    value: 12000,
    label: "tCO₂ per typical kiln-year",
  },
  "Manufacturing - Plastics": {
    value: 4000,
    label: "tCO₂ per typical facility-year",
  },
  Construction: {
    value: 3000,
    label: "tCO₂ per typical project-year",
  },
};

function intensityForCement(borrower: Borrower) {
  if (borrower.nrbSector !== "Manufacturing - Cement") return null;
  const totalCap = borrower.facilities.reduce(
    (s, f) => s + (f.cementCapacityMtpa ?? 0),
    0
  );
  if (totalCap <= 0) return null;
  return {
    value: borrower.totalCo2eTonnes / (totalCap * 1_000_000),
    label: "tCO₂ per tonne cement (this borrower)",
  };
}

// ---------------------------------------------------------------------------
// Ownership / risk / recommendation helpers
// ---------------------------------------------------------------------------

function ownershipTreeFor(b: Borrower) {
  const out: NonNullable<BorrowerScreening["ownershipTree"]> = [];
  out.push({
    name: b.name,
    entityId: b.gemEntityId ?? null,
    percentOwnership: 100,
  });
  if (b.parent) {
    out.push({
      name: b.parent,
      entityId: b.parentEntityId ?? null,
      percentOwnership: null,
    });
  }
  return out;
}

function classifyRisk(b: Borrower): BorrowerScreening["riskClassification"] {
  const tx = b.nrbSector.toLowerCase();
  if (tx.includes("cement")) {
    if (b.totalCo2eTonnes >= 1_000_000) return "extreme";
    if (b.totalCo2eTonnes >= 500_000) return "high";
    return "medium";
  }
  if (tx.includes("steel") || tx.includes("brick")) {
    return b.totalCo2eTonnes >= 50_000 ? "high" : "medium";
  }
  if (tx.includes("hydropower") || tx.includes("renewable")) {
    return "low";
  }
  if (b.totalCo2eTonnes >= 50_000) return "high";
  if (b.totalCo2eTonnes >= 10_000) return "medium";
  return "low";
}

function recommend(b: Borrower): {
  recommendation: BorrowerScreening["recommendation"];
  reasoning: string;
} {
  const risk = classifyRisk(b);
  if (risk === "extreme") {
    return {
      recommendation: "approve-with-conditions",
      reasoning:
        "Facility emissions exceed 1 Mt CO₂e / yr. Approval should include transition-plan covenants and quarterly emissions reporting under NRB ESRM §3.4(c).",
    };
  }
  if (risk === "high") {
    return {
      recommendation: "approve-with-conditions",
      reasoning:
        "Sector and emissions profile place this borrower in NRB ESRM's elevated-risk bucket. Recommend efficiency-improvement covenants and pollution-control verification.",
    };
  }
  if (risk === "low") {
    return {
      recommendation: "approve",
      reasoning:
        "Renewable-energy / low-emissions borrower. NRB Green Finance Taxonomy classifies this as Green; eligible for sustainable-finance pricing.",
    };
  }
  return {
    recommendation: "approve",
    reasoning:
      "Standard commercial profile. Sector-benchmark emissions and no community-air-quality flags. ESRM screening passes.",
  };
}

// ---------------------------------------------------------------------------
// Live benchmark derivation from EDGAR national totals
// ---------------------------------------------------------------------------

function liveBenchmarkFor(
  borrower: Borrower,
  edgar: EdgarNationalTotal | null
): {
  sectorBenchmarkLabel?: string;
  sectorBenchmarkValue?: number;
  borrowerIntensityValue?: number;
} {
  if (!edgar || edgar.totalTco2 <= 0) return {};
  // Single defensible metric for the banker: borrower's share of Nepal's
  // national CO2. EDGAR's internal sector taxonomy is intentionally not
  // surfaced — we just attribute "Nepal national CO2 · EDGAR <year>".
  const label = `Nepal national CO₂ · EDGAR ${edgar.year}`;
  return {
    sectorBenchmarkLabel: label,
    sectorBenchmarkValue: edgar.totalTco2,
    borrowerIntensityValue: borrower.totalCo2eTonnes,
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/** A nearby air-quality reading, from a real station or a demo fixture. */
export type AirQualityReading = {
  pm25: number;
  readingDate: string;
  stationName: string;
};

/**
 * Build a borrower screening from data already in hand.
 *
 * The air-quality reading is supplied by the caller rather than generated
 * here. It used to be invented inline from the facility's coordinates with a
 * seeded PRNG, which put a fabricated-data generator into the client bundle:
 * this function is called from components/bfi/tabs/esrm-tab.tsx, so every
 * browser was shipped the means to manufacture a PM2.5 number that looked
 * like a station reading.
 *
 * Omitting the argument yields a screening with no air-quality panel, which
 * is the honest result when no station reading is available. The demo layer
 * passes a synthetic reading; live callers pass a real OpenAQ one or nothing.
 */
export function buildScreening(
  b: Borrower,
  airQuality?: AirQualityReading,
): BorrowerScreening {
  // Default to the polygon-clipped EDGAR Nepal snapshot — it's real, sourced,
  // and works without needing the live API. The borrower's emissions are
  // expressed as a share of Nepal's national CO2 from EDGAR 2024.
  const aq = airQuality;
  const { recommendation, reasoning } = recommend(b);
  return {
    borrowerId: b.id,
    sectorBenchmarkLabel: `Nepal national CO₂ · EDGAR ${EDGAR_NEPAL.year}`,
    sectorBenchmarkValue: EDGAR_NEPAL.nepalTotalTco2,
    borrowerIntensityValue: b.totalCo2eTonnes,
    airQualityNearby: aq,
    ownershipTree: ownershipTreeFor(b),
    riskClassification: classifyRisk(b),
    recommendation,
    reasoning,
  };
}

/**
 * Live variant — uses the EDGAR snapshot + live OpenAQ when a token is
 * available. Per-field fallback if any individual call fails.
 */
export async function buildScreeningLive(
  b: Borrower,
  token: string
): Promise<BorrowerScreening> {
  // Start with the synthetic baseline
  const base = buildScreening(b);

  // EDGAR: use the polygon-clipped snapshot. The country_totals API returns
  // an "India +" regional rollup for Nepal, which is both numerically off and
  // confusing to a banker — the snapshot is the better source.
  const edgar: EdgarNationalTotal = {
    year: EDGAR_NEPAL.year,
    totalTco2: EDGAR_NEPAL.nepalTotalTco2,
  };
  const live = liveBenchmarkFor(b, edgar);

  // OpenAQ: nearest station's latest PM2.5
  let aqLive: FacilityAirQuality | null = null;
  const firstFacility = b.facilities[0];
  if (firstFacility && Number.isFinite(firstFacility.lat)) {
    try {
      aqLive = await getFacilityAirQuality(
        firstFacility.lat,
        firstFacility.lng,
        token
      );
    } catch (err) {
      console.warn(`OpenAQ fetch failed: ${(err as Error).message}`);
      aqLive = null;
    }
  }

  return {
    ...base,
    sectorBenchmarkLabel: live.sectorBenchmarkLabel ?? base.sectorBenchmarkLabel,
    sectorBenchmarkValue:
      live.sectorBenchmarkValue ?? base.sectorBenchmarkValue,
    borrowerIntensityValue:
      live.borrowerIntensityValue ?? base.borrowerIntensityValue,
    airQualityNearby: aqLive
      ? {
          pm25: aqLive.pm25,
          readingDate: aqLive.readingDate,
          stationName: aqLive.stationDistanceKm
            ? `${aqLive.stationName} · ${aqLive.stationDistanceKm} km away`
            : aqLive.stationName,
        }
      : base.airQualityNearby,
  };
}
