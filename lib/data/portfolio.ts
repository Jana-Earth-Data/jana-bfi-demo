/**
 * Deterministic ~80K-loan portfolio synthesizer for First Bank of Nepal.
 *
 * Strategy:
 *   - Retail bulk (~70K loans):     mortgage / personal / education / vehicle
 *   - SME middle (~8K loans):        working capital / trade / term — synthesized SME pool
 *   - Commercial slice (~2K loans):  rooted in real cement / hydro / industrial entities
 *   - Large corporate (~50 loans):   large syndicated and project finance to the top emitters
 *
 * The synthesizer is seeded so every run produces the same portfolio. The result
 * is cached in module scope and survives across requests within one server lifetime.
 *
 * For live mode (token present), the facility emissions on cement/hydro/industrial
 * borrowers are replaced with Climate TRACE values fetched from the Jana API.
 */

import {
  Borrower,
  BfiDemoData,
  DataQualityDistribution,
  Loan,
  LoanCategory,
  LoanStatus,
  NrbTaxonomyColor,
  PcafAttribution,
  PcafMethodology,
  PortfolioFunnel,
  PortfolioSummary,
  PortfolioTrendPoint,
  TaxonomyBreakdown,
} from "@/lib/types/bfi";
import {
  AS_OF_DATE,
  BRANCHES,
  TREND_YEARS,
  isoDateOffsetDays,
  logUniform,
  mulberry32,
  nprToUsd,
  pick,
  pickWeighted,
  rangeFloat,
  rangeInt,
  roundNpr,
  usdToNpr,
} from "@/lib/data/util";
import { getBorrowerCatalog, SmeBorrower } from "@/lib/data/entities";
import {
  assetClassForLoanCategory,
  computePcafScore,
  inferPcafAvailability,
} from "@/lib/regulatory/pcaf/scoring";
import { SCORE_FOR_OPTION } from "@/lib/regulatory/pcaf/types";

// ---------------------------------------------------------------------------
// Portfolio scale and mix
// ---------------------------------------------------------------------------

export const PORTFOLIO_SCALE = {
  retailMortgage: 50_000,
  retailPersonal: 12_000,
  retailEducation: 5_000,
  retailVehicle: 3_000,
  smeWorkingCapital: 5_000,
  smeTradeFinance: 2_500,
  smeTermLoan: 1_500,
  // Commercial and large corporate — sized so each of the ~121 facility-tier
  // borrowers receives a realistic 6-10 loans on average (term + working
  // capital + LC line + project finance, etc.), rather than the prior 17/avg.
  commercialTerm: 600,
  commercialWorkingCapital: 300,
  commercialProjectFinance: 100,
  corporateSyndicated: 20,
  corporateProjectFinance: 15,
} as const;

export const PORTFOLIO_TOTAL_COUNT = Object.values(PORTFOLIO_SCALE).reduce(
  (s, n) => s + n,
  0
);

// ---------------------------------------------------------------------------
// Loan amount distributions (in NPR)
// ---------------------------------------------------------------------------

const NPR_RANGES: Record<LoanCategory, [number, number]> = {
  "retail-mortgage": [2_000_000, 15_000_000],
  "retail-personal": [100_000, 2_000_000],
  "retail-education": [200_000, 3_000_000],
  "retail-vehicle": [500_000, 5_000_000],
  "sme-working-capital": [1_000_000, 50_000_000],
  "sme-trade-finance": [500_000, 25_000_000],
  "sme-term-loan": [5_000_000, 100_000_000],
  "commercial-term-loan": [50_000_000, 2_000_000_000],
  "commercial-working-capital": [25_000_000, 500_000_000],
  "commercial-project-finance": [200_000_000, 5_000_000_000],
  "corporate-syndicated": [1_000_000_000, 20_000_000_000],
  "corporate-project-finance": [500_000_000, 30_000_000_000],
};

const LOAN_PRODUCT_NAME: Record<LoanCategory, string> = {
  "retail-mortgage": "Home Loan",
  "retail-personal": "Personal Loan",
  "retail-education": "Education Loan",
  "retail-vehicle": "Auto Loan",
  "sme-working-capital": "SME Working Capital",
  "sme-trade-finance": "SME Trade Finance",
  "sme-term-loan": "SME Term Loan",
  "commercial-term-loan": "Commercial Term Loan",
  "commercial-working-capital": "Commercial Working Capital",
  "commercial-project-finance": "Project Finance",
  "corporate-syndicated": "Syndicated Facility",
  "corporate-project-finance": "Corporate Project Finance",
};

const BUSINESS_UNIT_FOR_CATEGORY: Record<LoanCategory, Loan["businessUnit"]> = {
  "retail-mortgage": "Retail",
  "retail-personal": "Retail",
  "retail-education": "Retail",
  "retail-vehicle": "Retail",
  "sme-working-capital": "SME",
  "sme-trade-finance": "SME",
  "sme-term-loan": "SME",
  "commercial-term-loan": "Corporate",
  "commercial-working-capital": "Corporate",
  "commercial-project-finance": "Project Finance",
  "corporate-syndicated": "Corporate",
  "corporate-project-finance": "Project Finance",
};

// ---------------------------------------------------------------------------
// Taxonomy assignment
// ---------------------------------------------------------------------------

function taxonomyForLoan(
  category: LoanCategory,
  borrower: Borrower
): NrbTaxonomyColor {
  if (
    category === "retail-mortgage" ||
    category === "retail-personal" ||
    category === "retail-education" ||
    category === "retail-vehicle"
  ) {
    return "unclassified";
  }

  const sector = borrower.nrbSector.toLowerCase();
  if (sector.includes("hydropower") || sector.includes("renewable")) {
    return "green";
  }
  if (
    sector.includes("cement") ||
    sector.includes("steel") ||
    sector.includes("brick") ||
    sector.includes("thermal")
  ) {
    return "red";
  }
  if (
    sector.includes("manufacturing") ||
    sector.includes("agriculture") ||
    sector.includes("textile") ||
    sector.includes("construction") ||
    sector.includes("chemical") ||
    sector.includes("plastic") ||
    sector.includes("processing") ||
    // Sectors added with the CT-matched non-mfg borrower expansion.
    // Per NRB Green Finance Taxonomy these are transition activities:
    // waste management contributes to pollution prevention, hospitality and
    // real estate touch energy and resource use, transport touches mitigation.
    sector.includes("transport") ||
    sector.includes("storage") ||
    sector.includes("hospitality") ||
    sector.includes("tourism") ||
    sector.includes("real estate") ||
    sector.includes("waste") ||
    sector.includes("utilities")
  ) {
    return "amber";
  }
  return "unclassified";
}

// ---------------------------------------------------------------------------
// Borrower selection helpers
// ---------------------------------------------------------------------------

function pickCommercialBorrower(
  catalog: ReturnType<typeof getBorrowerCatalog>,
  category: LoanCategory,
  r: () => number
): Borrower {
  // Project finance favours hydro + cement; working capital favours industrial +
  // hotels/logistics/waste; syndicated favours the big emitters.
  const weights = (() => {
    switch (category) {
      case "commercial-project-finance":
      case "corporate-project-finance":
        return [
          { value: "hydro", weight: 5 },
          { value: "cement", weight: 4 },
          { value: "industrial", weight: 1 },
          { value: "ctNonMfg", weight: 2 },
        ];
      case "corporate-syndicated":
        return [
          { value: "cement", weight: 5 },
          { value: "hydro", weight: 3 },
          { value: "industrial", weight: 2 },
          { value: "ctNonMfg", weight: 2 },
        ];
      default:
        return [
          { value: "cement", weight: 3 },
          { value: "hydro", weight: 2 },
          { value: "industrial", weight: 3 },
          { value: "ctNonMfg", weight: 4 },
        ];
    }
  })();
  const tier = pickWeighted(weights, r);
  if (tier === "cement") return pick(catalog.cement, r);
  if (tier === "hydro") return pick(catalog.hydro, r);
  if (tier === "ctNonMfg") {
    // Fall through to industrial if there are no CT non-mfg matches (shouldn't happen)
    return catalog.ctMatchedNonMfg.length > 0
      ? pick(catalog.ctMatchedNonMfg, r)
      : pick(catalog.industrial, r);
  }
  return pick(catalog.industrial, r);
}

function pickSmeBorrower(
  smes: SmeBorrower[],
  r: () => number
): SmeBorrower {
  return pick(smes, r);
}

// ---------------------------------------------------------------------------
// PCAF calculation
// ---------------------------------------------------------------------------

/**
 * Retail sector-average emissions factor (tCO2e per NPR of outstanding).
 *
 * Retail loans (mortgages, personal, education, vehicle) don't have
 * borrower-specific facility data — the bank lends to the retail pool, not
 * to a corporate emitter. PCAF Part A 3rd Edition §5.5.3 (mortgages) and
 * §5.6.3 (motor vehicles) allow a Score-5 revenue/economic-value proxy:
 * outstanding × sector-average emissions per unit of economic activity.
 *
 * Calibrated so the ~330B NPR retail book contributes ~2M tCO2e/yr to the
 * financed-emissions total (roughly the Score 5 bucket already shown in the
 * Data Quality Distribution panel — keeps the NFRS trend chart and the DQ
 * panel telling the same story).
 *
 * If this factor is ever re-tuned, sanity-check by running the demo and
 * confirming (a) the KPI "Total financed emissions" stays under 10M tCO2e
 * and (b) the trend chart's Unclassified band is visible but not dominant.
 */
const RETAIL_TCO2E_PER_NPR = 6e-6;

/**
 * PCAF attribution for one loan.  Delegates the score / option / citation
 * decision to `lib/regulatory/pcaf/scoring.ts` — the PCAF Part A 3rd
 * Edition (Dec 2025) rubric — and keeps the attribution-factor and
 * attributed-tCO2e math here since those are portfolio-shape concerns.
 */
function pcafFor(loan: Loan, borrower: Borrower): PcafAttribution {
  // 1. Determine PCAF asset class + inferred availability flags.
  const assetClass = assetClassForLoanCategory(loan.category);
  const availability = inferPcafAvailability(borrower, loan.category);

  // 2. Run the PCAF §5 decision tree.
  const compute = computePcafScore(loan, borrower, null, availability, assetClass);
  const score = compute.score;
  const option = compute.option;

  // 3. Retail short-circuit — retail-pool borrower (mortgage / personal /
  //    education / vehicle). PCAF Part A §5.5.3 / §5.6.3 / §5.2.3 permits a
  //    Score-5 revenue/economic-value proxy when borrower-specific data is
  //    unavailable. We use attribution factor = 1.0 (the bank fully finances
  //    a personal loan) and per-loan attributed emissions =
  //    outstandingNpr × RETAIL_TCO2E_PER_NPR. Emissions are broadly flat
  //    year-over-year — retail portfolios don't have year-varying facility
  //    data — so the trend aggregators below apply the same value to every
  //    year. This keeps the multi-year trend chart's Unclassified band
  //    consistent with the Data Quality Distribution panel's Score 5 total.
  if (borrower.kind === "retail-pool") {
    const attributed = loan.outstandingNpr * RETAIL_TCO2E_PER_NPR;
    return {
      loanId: loan.id,
      borrowerId: borrower.id,
      methodology: "revenue-based-estimate",
      attributionFactor: 1.0,
      attributedCo2eTonnes: Math.round(attributed),
      dataQualityScore: 5,
      qualityNote:
        "Retail sector-average revenue proxy (PCAF Part A §5.5.3 / §5.6.3 fallback)",
      pcafOption: "3b",
      pcafAssetClass: assetClass,
      pcafCitation:
        "PCAF Part A 3rd Edition §5.5 / §5.6 — economic-activity-based proxy",
      pcafDataSource: "sector-average (retail proxy)",
    };
  }

  // 3a. Non-retail out-of-scope short-circuit — kept for defensive completeness.
  //     Any non-retail loan that computePcafScore flagged as out-of-scope
  //     keeps a zero attribution (score still populated so it appears in the
  //     disclosure histogram).
  if (compute.assetClass === "out-of-scope") {
    return {
      loanId: loan.id,
      borrowerId: borrower.id,
      methodology: "out-of-scope",
      attributionFactor: 0,
      attributedCo2eTonnes: 0,
      dataQualityScore: SCORE_FOR_OPTION[option],
      qualityNote: compute.method,
      pcafOption: option,
      pcafAssetClass: compute.assetClass,
      pcafCitation: compute.citation,
      pcafDataSource: compute.dataSource,
    };
  }

  // 4. Compute the attribution factor (loan / EV) — PCAF Part A §4.2.
  //    Floors mirror the previous implementation so a tiny synthetic EV
  //    can't produce a >100 % share.
  const ev =
    borrower.facilities.length > 0
      ? Math.max(1_000_000, borrower.enterpriseValueUsd)
      : Math.max(50_000, borrower.enterpriseValueUsd);
  const af = loan.outstandingUsd / ev;
  const attributed = af * borrower.totalCo2eTonnes;

  // 5. Pick the legacy `methodology` label — kept for the ESRM tab's
  //    existing badges (facility-attributed vs satellite-emissions vs
  //    sector-benchmark) so the visual language of the tabs is
  //    preserved.  New consumers should use `pcafOption` + `pcafCitation`.
  let methodology: PcafMethodology;
  if (score <= 2) methodology = "facility-attributed";
  else if (score === 3) methodology = borrower.evSource === "public-filing"
    ? "facility-attributed"
    : "satellite-emissions";
  else if (score === 4) methodology = "sector-benchmark";
  else methodology = "revenue-based-estimate";

  return {
    loanId: loan.id,
    borrowerId: borrower.id,
    methodology,
    attributionFactor: af,
    attributedCo2eTonnes: Math.round(attributed),
    dataQualityScore: score,
    qualityNote: compute.method,
    pcafOption: option,
    pcafAssetClass: compute.assetClass,
    pcafCitation: compute.citation,
    pcafDataSource: compute.dataSource,
  };
}

// ---------------------------------------------------------------------------
// Loan generation
// ---------------------------------------------------------------------------

function generateLoansForCategory(
  catalog: ReturnType<typeof getBorrowerCatalog>,
  category: LoanCategory,
  count: number,
  startIndex: number,
  seed: number
): Loan[] {
  const r = mulberry32(seed);
  const [lo, hi] = NPR_RANGES[category];
  const product = LOAN_PRODUCT_NAME[category];
  const businessUnit = BUSINESS_UNIT_FOR_CATEGORY[category];
  const out: Loan[] = [];

  // Cap loan size at 50% of borrower EV. Real banks rarely lend more than
  // half a borrower's enterprise value, and we need this to keep the PCAF
  // attribution factor (loan / EV) below 50% rather than producing the
  // 200-700% nonsense an unconstrained synthesizer would generate.
  const EV_CAP_FRACTION = 0.5;

  for (let i = 0; i < count; i++) {
    // Pick borrower first so we can cap the loan against their EV
    let borrower: Borrower;
    if (category.startsWith("retail-")) {
      borrower = catalog.retailPool;
    } else if (category.startsWith("sme-")) {
      borrower = pickSmeBorrower(catalog.sme, r);
    } else {
      borrower = pickCommercialBorrower(catalog, category, r);
    }

    // Compute an EV-constrained upper bound on the NPR amount. Retail pool
    // borrower has EV=0 (out-of-scope) so we skip the cap there.
    let effectiveHi = hi;
    if (
      borrower.kind !== "retail-pool" &&
      borrower.enterpriseValueUsd > 0
    ) {
      const capNpr = usdToNpr(borrower.enterpriseValueUsd * EV_CAP_FRACTION);
      effectiveHi = Math.min(hi, Math.max(lo, capNpr));
    }
    const npr = roundNpr(logUniform(lo, effectiveHi, r));
    const usd = nprToUsd(npr);

    const disbursedOffset = -rangeInt(30, 365 * 5, r); // up to 5y ago
    const termMonths = (() => {
      if (category.startsWith("retail-mortgage")) return rangeInt(60, 300, r);
      if (category.startsWith("retail-")) return rangeInt(12, 60, r);
      if (category.startsWith("sme-")) return rangeInt(12, 60, r);
      if (category.includes("project-finance")) return rangeInt(60, 240, r);
      return rangeInt(24, 120, r);
    })();
    const maturityOffset = disbursedOffset + termMonths * 30;
    const disbursedDate = isoDateOffsetDays(AS_OF_DATE, disbursedOffset);
    const maturityDate = isoDateOffsetDays(AS_OF_DATE, maturityOffset);

    // ~1.5% of commercial loans in "under-review" for ESRM tab; 0.5% in "approved" pending disbursement.
    let status: LoanStatus = "active";
    const isCommercial =
      category.startsWith("commercial-") || category.startsWith("corporate-");
    if (isCommercial) {
      const x = r();
      if (x < 0.015) status = "under-review";
      else if (x < 0.02) status = "approved";
      else status = "active";
    } else {
      status = "active";
    }

    const taxonomy = taxonomyForLoan(category, borrower);
    const purpose = (() => {
      if (category === "retail-mortgage") return "Primary residence purchase";
      if (category === "retail-personal") return "Personal expenses";
      if (category === "retail-education") return "Tuition and study abroad";
      if (category === "retail-vehicle") return "Vehicle purchase";
      if (category === "sme-working-capital") return "Working capital line";
      if (category === "sme-trade-finance") return "Import LC / trust receipt";
      if (category === "sme-term-loan") return "Machinery / capex";
      if (category === "commercial-term-loan") return "Capacity expansion";
      if (category === "commercial-working-capital") return "Operating liquidity";
      if (category === "commercial-project-finance") return "Greenfield project";
      if (category === "corporate-syndicated") return "General corporate purpose";
      return "Capex / project finance";
    })();

    const branch = BRANCHES[Math.floor(r() * BRANCHES.length)];
    out.push({
      id: `L-${String(startIndex + i + 1).padStart(7, "0")}`,
      borrowerId: borrower.id,
      product,
      category,
      businessUnit,
      branch: branch.name,
      branchCode: branch.code,
      outstandingNpr: npr,
      outstandingUsd: usd,
      disbursedDate,
      maturityDate,
      status,
      nrbTaxonomy: taxonomy,
      purpose,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function emptyTaxonomy(): TaxonomyBreakdown {
  return { green: 0, amber: 0, red: 0, unclassified: 0 };
}

// AGGREGATOR-PAIR: this function mirrors recomputeSummary() in lib/api/bfi.ts.
// The two share ~90% of aggregation logic (taxonomy breakdown, sector breakdown,
// data-quality distribution, multi-year trend). Any change to attribution shape,
// sector bucketing, taxonomy bucketing, or trend-per-year logic MUST be applied
// in BOTH functions or mock-mode and live-mode paths will silently diverge.
// The ~10% difference between them handles mock synthesis vs. live overlay
// specifics — do not consolidate without cataloguing each intentional divergence.
// Track consolidation in a post-demo issue.
function buildSummary(
  loans: Loan[],
  borrowers: Borrower[],
  attributions: PcafAttribution[]
): PortfolioSummary {
  const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));
  const totalLoans = loans.length;
  const totalOutstandingNpr = loans.reduce((s, l) => s + l.outstandingNpr, 0);
  const totalOutstandingUsd = loans.reduce((s, l) => s + l.outstandingUsd, 0);
  const totalAttributedCo2eTonnes = attributions.reduce(
    (s, a) => s + a.attributedCo2eTonnes,
    0
  );

  // Weighted average data quality across loans that produced attributed emissions
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

  const taxonomyBreakdown = emptyTaxonomy();
  const taxonomyBreakdownValue = emptyTaxonomy();
  for (const l of loans) {
    taxonomyBreakdown[l.nrbTaxonomy]++;
    taxonomyBreakdownValue[l.nrbTaxonomy] += l.outstandingNpr;
  }

  // Sector breakdown — only over loans that have a borrower with a real sector (skip retail pool)
  const sectorMap = new Map<
    string,
    { co2e: number; count: number; npr: number }
  >();
  loans.forEach((loan) => {
    const b = borrowerMap.get(loan.borrowerId);
    if (!b || b.kind === "retail-pool") return;
    const a = attributions.find((x) => x.loanId === loan.id);
    const prev = sectorMap.get(b.nrbSector) ?? { co2e: 0, count: 0, npr: 0 };
    sectorMap.set(b.nrbSector, {
      co2e: prev.co2e + (a?.attributedCo2eTonnes ?? 0),
      count: prev.count + 1,
      npr: prev.npr + loan.outstandingNpr,
    });
  });
  const sectorBreakdown = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({
      sector,
      attributedCo2e: Math.round(v.co2e),
      loanCount: v.count,
      outstandingNpr: v.npr,
    }))
    .sort((a, b) => b.attributedCo2e - a.attributedCo2e);

  // Funnel
  const inScopeLoans = loans.filter(
    (l) => !(l.category ?? "").startsWith("retail-")
  );
  const facilityMatchedLoans = inScopeLoans.filter((l) => {
    const b = borrowerMap.get(l.borrowerId);
    return b && (b.dataTier === "facility");
  });
  const inScopeOutstandingNpr = inScopeLoans.reduce(
    (s, l) => s + l.outstandingNpr,
    0
  );
  const facilityMatchedOutstandingNpr = facilityMatchedLoans.reduce(
    (s, l) => s + l.outstandingNpr,
    0
  );
  // Count unique facility-tier borrowers that actually appear in the loan book
  const facilityMatchedBorrowerIds = new Set<string>();
  for (const l of facilityMatchedLoans) {
    facilityMatchedBorrowerIds.add(l.borrowerId);
  }

  const funnel: PortfolioFunnel = {
    totalLoans,
    inScopeLoans: inScopeLoans.length,
    facilityMatchedLoans: facilityMatchedLoans.length,
    facilityMatchedBorrowers: facilityMatchedBorrowerIds.size,
    totalOutstandingNpr,
    inScopeOutstandingNpr,
    facilityMatchedOutstandingNpr,
  };

  // Data quality distribution
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
    const s = a.dataQualityScore;
    const prev =
      dqBuckets.get(s) ?? {
        count: 0,
        outstandingUsd: 0,
        outstandingNpr: 0,
        co2: 0,
      };
    const loan = loans.find((l) => l.id === a.loanId);
    dqBuckets.set(s, {
      count: prev.count + 1,
      outstandingUsd: prev.outstandingUsd + (loan?.outstandingUsd ?? 0),
      outstandingNpr: prev.outstandingNpr + (loan?.outstandingNpr ?? 0),
      co2: prev.co2 + a.attributedCo2eTonnes,
    });
  }
  const dataQualityDistribution: DataQualityDistribution = [1, 2, 3, 4, 5].map(
    (s) => {
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
    }
  );

  // Multi-year trend — aggregate per-year emissions from borrowers' time series,
  // weighted by current attribution factor (a reasonable approximation since
  // exact loan-time-series doesn't exist in this demo).
  const trendMap = new Map<number, TaxonomyBreakdown & { total: number }>();
  for (const year of TREND_YEARS) {
    trendMap.set(year, { ...emptyTaxonomy(), total: 0 });
  }
  // Index attributions by loanId once — .find() per loan is O(N*M) and became
  // hot after retail loans (70k) were folded into the trend below.
  const attrByLoanId = new Map(attributions.map((a) => [a.loanId, a]));
  for (const loan of loans) {
    const b = borrowerMap.get(loan.borrowerId);
    if (!b) continue;
    const a = attrByLoanId.get(loan.id);
    if (!a) continue;
    // Retail (retail-pool) borrowers are attributed via the revenue-proxy in
    // pcafFor() above — flat year-over-year emissions. Include them in the
    // trend so the Unclassified band matches the Data Quality Distribution
    // panel's Score 5 total.
    if (b.kind === "retail-pool") {
      for (const year of TREND_YEARS) {
        const ye = trendMap.get(year)!;
        ye.total += a.attributedCo2eTonnes;
        ye[loan.nrbTaxonomy] += a.attributedCo2eTonnes;
      }
      continue;
    }
    const fac = b.facilities[0];
    const series = fac?.emissionsByYear ?? null;
    for (const year of TREND_YEARS) {
      const ye = trendMap.get(year)!;
      let yearTotal: number;
      if (series) {
        const found = series.find((p) => p.year === year);
        yearTotal = found
          ? a.attributionFactor *
            series.reduce(
              (s, p) => s + (p.year === year ? p.co2eTonnes : 0),
              0
            ) *
            (b.facilities.length || 1) /
            (b.facilities.length || 1)
          : a.attributedCo2eTonnes;
        // sum across all facilities for this year:
        let totalThisYear = 0;
        for (const f of b.facilities) {
          const pt = f.emissionsByYear?.find((p) => p.year === year);
          totalThisYear += pt?.co2eTonnes ?? f.annualCo2eTonnes;
        }
        yearTotal = a.attributionFactor * totalThisYear;
      } else {
        // sector-benchmark — assume flat
        yearTotal = a.attributedCo2eTonnes;
      }
      ye.total += yearTotal;
      ye[loan.nrbTaxonomy] += yearTotal;
    }
  }
  const trend: PortfolioTrendPoint[] = Array.from(trendMap.entries())
    .map(([year, v]) => ({
      year,
      totalAttributedCo2eTonnes: Math.round(v.total),
      byTaxonomy: {
        green: Math.round(v.green),
        amber: Math.round(v.amber),
        red: Math.round(v.red),
        unclassified: Math.round(v.unclassified),
      },
    }))
    .sort((a, b) => a.year - b.year);

  return {
    totalLoans,
    totalOutstandingUsd: Math.round(totalOutstandingUsd),
    totalOutstandingNpr,
    totalAttributedCo2eTonnes: Math.round(totalAttributedCo2eTonnes),
    weightedDataQuality,
    taxonomyBreakdown,
    taxonomyBreakdownValue,
    sectorBreakdown,
    funnel,
    dataQualityDistribution,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Top-level memoized portfolio
// ---------------------------------------------------------------------------

let portfolioCache: BfiDemoData | null = null;

function buildPortfolio(): BfiDemoData {
  const catalog = getBorrowerCatalog();

  // Generate loans by category with a stable per-category seed.
  let cursor = 0;
  const loans: Loan[] = [];
  let seed = 0xb1f0b1f0;
  const cats: LoanCategory[] = [
    "retail-mortgage",
    "retail-personal",
    "retail-education",
    "retail-vehicle",
    "sme-working-capital",
    "sme-trade-finance",
    "sme-term-loan",
    "commercial-term-loan",
    "commercial-working-capital",
    "commercial-project-finance",
    "corporate-syndicated",
    "corporate-project-finance",
  ];
  for (const c of cats) {
    const n = PORTFOLIO_SCALE[
      ({
        "retail-mortgage": "retailMortgage",
        "retail-personal": "retailPersonal",
        "retail-education": "retailEducation",
        "retail-vehicle": "retailVehicle",
        "sme-working-capital": "smeWorkingCapital",
        "sme-trade-finance": "smeTradeFinance",
        "sme-term-loan": "smeTermLoan",
        "commercial-term-loan": "commercialTerm",
        "commercial-working-capital": "commercialWorkingCapital",
        "commercial-project-finance": "commercialProjectFinance",
        "corporate-syndicated": "corporateSyndicated",
        "corporate-project-finance": "corporateProjectFinance",
      } as const)[c]
    ];
    seed = (seed + 0xdeadbeef) | 0;
    loans.push(
      ...generateLoansForCategory(catalog, c, n, cursor, seed >>> 0)
    );
    cursor += n;
  }

  const borrowers = [catalog.retailPool, ...catalog.all];

  // Demo tour hook: ensure at least one Hongshi Shivam Cement loan is in the
  // "under-review" queue so the step 5 narration lands on a borrower with the
  // headline emissions story. Pick the largest by NPR for visibility.
  const hongshi = catalog.cement.find((b) =>
    b.name.toLowerCase().includes("hongshi")
  );
  if (hongshi) {
    const hongshiLoans = loans.filter((l) => l.borrowerId === hongshi.id);
    if (hongshiLoans.length > 0) {
      const biggest = hongshiLoans.reduce((acc, l) =>
        l.outstandingNpr > acc.outstandingNpr ? l : acc
      );
      biggest.status = "under-review";
    }
  }

  // Demo tour hook: ensure at least one SME brick-industry loan is
  // under-review so the "small loan in critical sector" walkthrough
  // path has a concrete loan to demonstrate. Brick is on NRB's
  // critical-sector list per Circular 22 §5, so a small SME loan to a
  // brick borrower should route through the full ESDD checklist (not
  // the fast-path). Picks the largest SME term loan by NPR to the
  // first brick-industry borrower for stable selection.
  const brickBorrower = catalog.sme.find((b) =>
    b.nrbSector.toLowerCase().includes("brick"),
  );
  if (brickBorrower) {
    const brickSmeLoans = loans.filter(
      (l) =>
        l.borrowerId === brickBorrower.id && l.category === "sme-term-loan",
    );
    if (brickSmeLoans.length > 0) {
      const biggest = brickSmeLoans.reduce((acc, l) =>
        l.outstandingNpr > acc.outstandingNpr ? l : acc,
      );
      biggest.status = "under-review";
    }
  }

  // Compute PCAF attributions
  const attributions: PcafAttribution[] = loans.map((l) => {
    const b = catalog.byId.get(l.borrowerId)!;
    return pcafFor(l, b);
  });

  const portfolio = buildSummary(loans, borrowers, attributions);

  return {
    meta: {
      bankName: "First Bank of Nepal",
      isMock: true,
      generatedAt: new Date().toISOString(),
      asOfDate: AS_OF_DATE,
      pcafMethodologyNote:
        "Attribution factor = loan outstanding (USD) / borrower enterprise value (USD). " +
        "Facility-tier borrowers use Climate TRACE / GEM facility emissions. " +
        "SME and synthesized commercial borrowers use EDGAR sector intensity benchmarks.",
    },
    borrowers,
    loans,
    attributions,
    portfolio,
  };
}

/**
 * Get the synthesized portfolio. Memoized across requests within one server process.
 */
export function getPortfolio(): BfiDemoData {
  if (portfolioCache) return portfolioCache;
  portfolioCache = buildPortfolio();
  return portfolioCache;
}

/** For unit tests / live-mode overlays — invalidate the cache. */
export function invalidatePortfolioCache() {
  portfolioCache = null;
}

/** Re-export for downstream callers */
export { usdToNpr, nprToUsd } from "@/lib/data/util";
