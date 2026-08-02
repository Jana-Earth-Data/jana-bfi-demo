/**
 * BFI Data Fetching Layer
 *
 *  - Mock mode (`NEXT_PUBLIC_DEMO_USE_MOCKS=true` or no token):
 *      returns the synthesized 80K-loan portfolio rooted in real Nepal entities.
 *  - Live mode (token present):
 *      overlays real Climate TRACE Nepal facility emissions onto the synthesized
 *      borrowers via name-pattern matching, then recomputes PCAF + summary.
 *
 * The loan and borrower data is always from the synthesizer (banks don't expose
 * loan books via API). What goes LIVE is the facility emissions.
 */

import { apiFetchAll } from "@/lib/api/client";
import { getPortfolio, invalidatePortfolioCache } from "@/lib/data/portfolio";
import {
  BfiDemoData,
  Borrower,
  MatchedFacility,
  PcafAttribution,
  PortfolioSummary,
  PortfolioTrendPoint,
  TaxonomyBreakdown,
  Loan,
} from "@/lib/types/bfi";

const FORCE_MOCKS = process.env.NEXT_PUBLIC_DEMO_USE_MOCKS === "true";

// ---------------------------------------------------------------------------
// Climate TRACE API types
// ---------------------------------------------------------------------------

type ClimateTraceEmission = {
  asset_id?: string;
  asset_name?: string;
  start_time?: string;
  co2e_tonnes?: number | string;
  sector_name?: string;
  lat?: number;
  lon?: number;
};

function toNumeric(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Facility matching: take a Climate TRACE asset_name and pick the synthesized
// borrower facility it should overlay onto.
// ---------------------------------------------------------------------------

type MatchIndex = {
  /** facilityName lower-cased -> {borrowerId, facilityIndex} */
  byFacilityName: Map<string, { borrowerId: string; facilityIndex: number }>;
  /** owner / borrower name lower-cased substring -> borrowerId */
  byBorrowerName: Map<string, string>;
};

function buildMatchIndex(borrowers: Borrower[]): MatchIndex {
  const byFacilityName = new Map<
    string,
    { borrowerId: string; facilityIndex: number }
  >();
  const byBorrowerName = new Map<string, string>();
  for (const b of borrowers) {
    // Keep substring keys around for fuzzy matches
    const owner = b.name.toLowerCase();
    byBorrowerName.set(owner, b.id);
    // First word as a coarser key (e.g. "Hongshi-Shivam Cement Pvt Ltd" -> "hongshi")
    const first = owner.split(/[\s-]+/)[0];
    if (first && first.length > 3) byBorrowerName.set(first, b.id);

    b.facilities.forEach((f, i) => {
      byFacilityName.set(f.facilityName.toLowerCase(), {
        borrowerId: b.id,
        facilityIndex: i,
      });
    });
  }
  return { byFacilityName, byBorrowerName };
}

function findMatch(
  assetName: string,
  index: MatchIndex
): { borrowerId: string; facilityIndex: number } | null {
  const name = assetName.toLowerCase();
  // Exact facility name match
  const exact = index.byFacilityName.get(name);
  if (exact) return exact;
  // Substring against facility names
  for (const [k, v] of index.byFacilityName) {
    if (name.includes(k) || k.includes(name)) return v;
  }
  // Owner-name substring → first facility of that borrower
  for (const [k, bid] of index.byBorrowerName) {
    if (name.includes(k)) return { borrowerId: bid, facilityIndex: 0 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live fetch + overlay
// ---------------------------------------------------------------------------

type LiveEmissionsForYear = {
  year: number;
  byFacilityKey: Map<
    string,
    { borrowerId: string; facilityIndex: number; co2e: number }
  >;
};

async function fetchYear(
  year: number,
  token: string
): Promise<ClimateTraceEmission[]> {
  const { results } = await apiFetchAll<ClimateTraceEmission>(
    "/api/v1/data-sources/climatetrace/emissions/",
    {
      params: {
        country_iso3: "NPL",
        page_size: 10000,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
      },
      token,
    }
  );
  return results;
}

function overlayLive(
  base: BfiDemoData,
  yearsData: LiveEmissionsForYear[]
): BfiDemoData {
  // Mutate clones, not the cached portfolio
  const borrowers: Borrower[] = base.borrowers.map((b) => ({
    ...b,
    facilities: b.facilities.map((f) => ({
      ...f,
      emissionsByYear: f.emissionsByYear ? [...f.emissionsByYear] : undefined,
    })),
  }));

  // Pre-index facilities by (borrowerId, idx) for write-back
  for (const ye of yearsData) {
    for (const { borrowerId, facilityIndex, co2e } of ye.byFacilityKey.values()) {
      const b = borrowers.find((x) => x.id === borrowerId);
      if (!b) continue;
      const f = b.facilities[facilityIndex];
      if (!f) continue;
      // Update / insert in time series
      const series = f.emissionsByYear ?? [];
      const ix = series.findIndex((p) => p.year === ye.year);
      const rounded = Math.round(co2e);
      if (ix >= 0) series[ix] = { year: ye.year, co2eTonnes: rounded };
      else series.push({ year: ye.year, co2eTonnes: rounded });
      f.emissionsByYear = series;
      // Update most-recent annual figure if this is the latest year
      const maxYear = Math.max(...series.map((p) => p.year));
      if (ye.year === maxYear) {
        f.annualCo2eTonnes = rounded;
        f.emissionsYear = ye.year;
      }
    }
  }
  // Recompute borrower-total CO2e from facilities
  for (const b of borrowers) {
    if (b.facilities.length === 0) continue;
    b.totalCo2eTonnes = b.facilities.reduce(
      (s, f) => s + f.annualCo2eTonnes,
      0
    );
  }

  // Recompute attributions for ALL loans (PCAF depends on borrower totals)
  const byId = new Map(borrowers.map((b) => [b.id, b]));
  const attributions: PcafAttribution[] = base.loans.map((loan) => {
    const b = byId.get(loan.borrowerId)!;
    const prev = base.attributions.find((a) => a.loanId === loan.id)!;
    const ev = Math.max(1, b.enterpriseValueUsd || 1);
    if (
      (loan.category ?? "").startsWith("retail-") ||
      b.kind === "retail-pool"
    ) {
      // out-of-scope stays out-of-scope
      return prev;
    }
    if (b.facilities.length === 0) {
      // sector-benchmark — already correct (no facility tier)
      return prev;
    }
    const af = loan.outstandingUsd / ev;
    return {
      ...prev,
      attributionFactor: af,
      attributedCo2eTonnes: Math.round(af * b.totalCo2eTonnes),
    };
  });

  // Rebuild summary with live attributions
  const portfolio = recomputeSummary(base.loans, borrowers, attributions);

  return {
    meta: {
      ...base.meta,
      isMock: false,
      generatedAt: new Date().toISOString(),
      pcafMethodologyNote:
        "Live: Climate TRACE facility emissions (Nepal) overlaid onto synthesized loan portfolio. " +
        "PCAF Cat. 15 attribution: outstanding USD / enterprise value USD x facility CO2e.",
    },
    borrowers,
    loans: base.loans,
    attributions,
    portfolio,
  };
}

// AGGREGATOR-PAIR: this function mirrors buildSummary() in lib/data/portfolio.ts.
// The two share ~90% of aggregation logic (taxonomy breakdown, sector breakdown,
// data-quality distribution, multi-year trend). Any change to attribution shape,
// sector bucketing, taxonomy bucketing, or trend-per-year logic MUST be applied
// in BOTH functions or mock-mode and live-mode paths will silently diverge.
// The ~10% difference between them handles mock synthesis vs. live overlay
// specifics — do not consolidate without cataloguing each intentional divergence.
// Track consolidation in a post-demo issue.
function recomputeSummary(
  loans: Loan[],
  borrowers: Borrower[],
  attributions: PcafAttribution[]
): PortfolioSummary {
  // Mirror the synthesizer's aggregation logic, but on whatever borrowers we have now.
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));
  const attrByLoan = new Map(attributions.map((a) => [a.loanId, a]));

  const totalLoans = loans.length;
  const totalOutstandingNpr = loans.reduce((s, l) => s + l.outstandingNpr, 0);
  const totalOutstandingUsd = loans.reduce((s, l) => s + l.outstandingUsd, 0);
  const totalAttributedCo2eTonnes = attributions.reduce(
    (s, a) => s + a.attributedCo2eTonnes,
    0
  );

  let weightedSum = 0;
  let weightedDenom = 0;
  for (const a of attributions) {
    if (a.attributedCo2eTonnes <= 0) continue;
    weightedSum += a.dataQualityScore * a.attributedCo2eTonnes;
    weightedDenom += a.attributedCo2eTonnes;
  }
  const weightedDataQuality =
    weightedDenom > 0
      ? Math.round((weightedSum / weightedDenom) * 10) / 10
      : 0;

  const taxonomyBreakdown: TaxonomyBreakdown = {
    green: 0,
    amber: 0,
    red: 0,
    unclassified: 0,
  };
  const taxonomyBreakdownValue: TaxonomyBreakdown = {
    green: 0,
    amber: 0,
    red: 0,
    unclassified: 0,
  };
  for (const l of loans) {
    taxonomyBreakdown[l.nrbTaxonomy]++;
    taxonomyBreakdownValue[l.nrbTaxonomy] += l.outstandingNpr;
  }

  const sectorMap = new Map<
    string,
    { co2e: number; count: number; npr: number }
  >();
  for (const loan of loans) {
    const b = borrowerMap.get(loan.borrowerId);
    if (!b || b.kind === "retail-pool") continue;
    const a = attrByLoan.get(loan.id);
    const prev = sectorMap.get(b.nrbSector) ?? { co2e: 0, count: 0, npr: 0 };
    sectorMap.set(b.nrbSector, {
      co2e: prev.co2e + (a?.attributedCo2eTonnes ?? 0),
      count: prev.count + 1,
      npr: prev.npr + loan.outstandingNpr,
    });
  }
  const sectorBreakdown = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({
      sector,
      attributedCo2e: Math.round(v.co2e),
      loanCount: v.count,
      outstandingNpr: v.npr,
    }))
    .sort((a, b) => b.attributedCo2e - a.attributedCo2e);

  const inScopeLoans = loans.filter(
    (l) => !(l.category ?? "").startsWith("retail-")
  );
  const facilityMatchedLoans = inScopeLoans.filter((l) => {
    const b = borrowerMap.get(l.borrowerId);
    return b && b.dataTier === "facility";
  });
  const inScopeOutstandingNpr = inScopeLoans.reduce(
    (s, l) => s + l.outstandingNpr,
    0
  );
  const facilityMatchedOutstandingNpr = facilityMatchedLoans.reduce(
    (s, l) => s + l.outstandingNpr,
    0
  );

  const dqBuckets = new Map<
    1 | 2 | 3 | 4 | 5,
    {
      count: number;
      outstandingUsd: number;
      outstandingNpr: number;
      co2: number;
    }
  >();
  for (const a of attributions) {
    const prev =
      dqBuckets.get(a.dataQualityScore) ?? {
        count: 0,
        outstandingUsd: 0,
        outstandingNpr: 0,
        co2: 0,
      };
    const loan = loans.find((l) => l.id === a.loanId);
    dqBuckets.set(a.dataQualityScore, {
      count: prev.count + 1,
      outstandingUsd: prev.outstandingUsd + (loan?.outstandingUsd ?? 0),
      outstandingNpr: prev.outstandingNpr + (loan?.outstandingNpr ?? 0),
      co2: prev.co2 + a.attributedCo2eTonnes,
    });
  }
  const dataQualityDistribution = [1, 2, 3, 4, 5].map((s) => {
    const v =
      dqBuckets.get(s as 1 | 2 | 3 | 4 | 5) ?? {
        count: 0,
        outstandingUsd: 0,
        outstandingNpr: 0,
        co2: 0,
      };
    return {
      score: s as 1 | 2 | 3 | 4 | 5,
      loanCount: v.count,
      outstandingUsd: Math.round(v.outstandingUsd),
      outstandingNpr: Math.round(v.outstandingNpr),
      attributedCo2eTonnes: Math.round(v.co2),
    };
  });

  // Trend: aggregate emissionsByYear weighted by attributionFactor.
  // Matches the synthesizer's TREND_YEARS and real Climate TRACE coverage (2021-01..2025-10).
  const trendYears = [2021, 2022, 2023, 2024, 2025];
  const trend: PortfolioTrendPoint[] = trendYears.map((y) => {
    let total = 0;
    const tx: TaxonomyBreakdown = {
      green: 0,
      amber: 0,
      red: 0,
      unclassified: 0,
    };
    for (const loan of loans) {
      const b = borrowerMap.get(loan.borrowerId);
      if (!b) continue;
      const a = attrByLoan.get(loan.id);
      if (!a) continue;
      let yearTotal = 0;
      if (b.kind === "retail-pool") {
        // Retail loans use the revenue-proxy attribution from pcafFor() —
        // flat year-over-year. Include them so the trend chart's
        // Unclassified band matches the Data Quality Distribution panel.
        yearTotal = a.attributedCo2eTonnes;
      } else if (b.facilities.length > 0) {
        let perFacility = 0;
        for (const f of b.facilities) {
          const pt = f.emissionsByYear?.find((p) => p.year === y);
          perFacility += pt?.co2eTonnes ?? f.annualCo2eTonnes;
        }
        yearTotal = a.attributionFactor * perFacility;
      } else {
        yearTotal = a.attributedCo2eTonnes;
      }
      total += yearTotal;
      tx[loan.nrbTaxonomy] += yearTotal;
    }
    return {
      year: y,
      totalAttributedCo2eTonnes: Math.round(total),
      byTaxonomy: {
        green: Math.round(tx.green),
        amber: Math.round(tx.amber),
        red: Math.round(tx.red),
        unclassified: Math.round(tx.unclassified),
      },
    };
  });

  return {
    totalLoans,
    totalOutstandingUsd: Math.round(totalOutstandingUsd),
    totalOutstandingNpr,
    totalAttributedCo2eTonnes: Math.round(totalAttributedCo2eTonnes),
    weightedDataQuality,
    taxonomyBreakdown,
    taxonomyBreakdownValue,
    sectorBreakdown,
    funnel: {
      totalLoans,
      inScopeLoans: inScopeLoans.length,
      facilityMatchedLoans: facilityMatchedLoans.length,
      facilityMatchedBorrowers: new Set(
        facilityMatchedLoans.map((l) => l.borrowerId)
      ).size,
      totalOutstandingNpr,
      inScopeOutstandingNpr,
      facilityMatchedOutstandingNpr,
    },
    dataQualityDistribution,
    trend,
  };
}

async function fetchLiveAndOverlay(
  base: BfiDemoData,
  token: string
): Promise<BfiDemoData> {
  // Pull annual aggregations 2021-2025. The Climate TRACE Nepal data is monthly
  // granularity; fetchYear()'s start/end filter selects all months in the year
  // and the loop in fetchLiveAndOverlay sums them per facility.
  const years = [2021, 2022, 2023, 2024, 2025];
  const index = buildMatchIndex(base.borrowers);

  const yearsData: LiveEmissionsForYear[] = [];
  for (const y of years) {
    const rows = await fetchYear(y, token);
    const byFacilityKey = new Map<
      string,
      { borrowerId: string; facilityIndex: number; co2e: number }
    >();
    for (const row of rows) {
      const name = row.asset_name ?? "";
      if (!name) continue;
      const match = findMatch(name, index);
      if (!match) continue;
      const key = `${match.borrowerId}-${match.facilityIndex}`;
      const prev = byFacilityKey.get(key);
      byFacilityKey.set(key, {
        borrowerId: match.borrowerId,
        facilityIndex: match.facilityIndex,
        co2e: (prev?.co2e ?? 0) + toNumeric(row.co2e_tonnes),
      });
    }
    yearsData.push({ year: y, byFacilityKey });
  }

  return overlayLive(base, yearsData);
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Server-side: get BFI data.
 * - SSR (no token): synthesized portfolio (mock mode).
 * - With token: fetch live Climate TRACE data, overlay onto borrowers.
 */
export async function getBfiDemoData(
  token?: string | null
): Promise<BfiDemoData> {
  const base = getPortfolio();
  if (FORCE_MOCKS || !token) {
    return {
      ...base,
      meta: {
        ...base.meta,
        isMock: true,
        generatedAt: new Date().toISOString(),
      },
    };
  }
  try {
    return await fetchLiveAndOverlay(base, token);
  } catch (error) {
    console.error(
      "Live BFI data fetch failed, falling back to mock:",
      (error as Error).message
    );
    return {
      ...base,
      meta: {
        ...base.meta,
        isMock: true,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Helper for the management/status route - summarises Climate TRACE coverage.
 */
export async function fetchClimateTraceSummary(token: string) {
  const { count, results } = await apiFetchAll<ClimateTraceEmission>(
    "/api/v1/data-sources/climatetrace/emissions/",
    {
      params: {
        country_iso3: "NPL",
        page_size: 10000,
      },
      token,
    }
  );

  const sectors = new Set(results.map((r) => r.sector_name).filter(Boolean));
  const assets = new Set(results.map((r) => r.asset_name).filter(Boolean));

  const base = getPortfolio();
  const index = buildMatchIndex(base.borrowers);
  let matched = 0;
  for (const r of results) {
    if (r.asset_name && findMatch(r.asset_name, index)) matched++;
  }

  return {
    totalRecords: Math.max(count, results.length),
    uniqueAssets: assets.size,
    uniqueSectors: sectors.size,
    matchedAssets: matched,
    portfolioBorrowers: base.borrowers.length,
  };
}

export { invalidatePortfolioCache };
