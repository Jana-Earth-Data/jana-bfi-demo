/**
 * BFI Demo - Financed Emissions Types
 *
 * Models the loan officer view: loans on the left, matched Climate TRACE
 * facilities on the right, PCAF attribution calculation connecting them.
 *
 * Extended for the three-tier dashboard (ESRM / Taxonomy / NFRS) on top of
 * a full ~80K-loan synthesized portfolio rooted in real Nepal entities.
 */

export type StatusKind = "live" | "mock";

// ---------------------------------------------------------------------------
// Loan categorisation
// ---------------------------------------------------------------------------

/**
 * Loan category - drives portfolio funnel scoping.
 * `retail-*` and `sme-*` are typically out-of-scope for facility-level PCAF.
 * `commercial-*` and `corporate-*` are where facility data attaches.
 */
export type LoanCategory =
  | "retail-mortgage"
  | "retail-personal"
  | "retail-education"
  | "retail-vehicle"
  | "sme-working-capital"
  | "sme-trade-finance"
  | "sme-term-loan"
  | "commercial-term-loan"
  | "commercial-working-capital"
  | "commercial-project-finance"
  | "corporate-syndicated"
  | "corporate-project-finance";

export type BusinessUnit =
  | "Retail"
  | "SME"
  | "Corporate"
  | "Project Finance";

export type Branch = {
  code: string;
  name: string;
  city: string;
  province: string;
};

/**
 * The PCAF-relevant data tier a borrower qualifies for.
 * Climate TRACE match = facility (best). Sector benchmark = EDGAR-derived.
 * Revenue estimate = national sector averages. n/a = retail / out-of-scope.
 */
export type BorrowerDataTier =
  | "facility"
  | "sector-benchmark"
  | "revenue-estimate"
  | "n/a";

export type BorrowerKind = "corporate" | "sme" | "retail-pool";

// ---------------------------------------------------------------------------
// Borrower and facility matching
// ---------------------------------------------------------------------------

/** A Climate TRACE facility matched to a bank borrower */
export type MatchedFacility = {
  /** Climate TRACE asset ID or GEM plant ID */
  assetId: string;
  /** Facility name (English) */
  facilityName: string;
  /** Local-language name (Nepali, etc.) */
  facilityNameLocal?: string | null;
  /** Climate TRACE / sector name (e.g. "power", "manufacturing") */
  sector: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Total annual CO2e in tonnes (most recent year) */
  annualCo2eTonnes: number;
  /** Year of the most-recent emissions figure */
  emissionsYear: number;
  /** Optional multi-year time series for NFRS trend disclosure */
  emissionsByYear?: { year: number; co2eTonnes: number }[];
  /** Geographic context */
  municipality?: string | null;
  subnationalUnit?: string | null;
  /** Cement-only enrichment from GCCT */
  cementCapacityMtpa?: number | null;
  /** GEM plant ID if available */
  gemPlantId?: string | null;
  /** GEM wiki page if available */
  wikiPage?: string | null;
  /** How the match was made */
  matchMethod: "manual" | "name-match" | "geocoded";
  /** Confidence in the match (0-1) */
  matchConfidence: number;
};

/** A bank borrower with one or more matched facilities */
export type Borrower = {
  id: string;
  name: string;
  kind?: BorrowerKind;
  /** NRB sector classification */
  nrbSector: string;
  /** Estimated enterprise value in USD (for PCAF attribution) */
  enterpriseValueUsd: number;
  /** Source of the enterprise value estimate */
  evSource: "public-filing" | "estimated" | "proxy";
  /** PCAF data tier this borrower qualifies for */
  dataTier?: BorrowerDataTier;
  /** Parent / ultimate owner if known */
  parent?: string | null;
  parentEntityId?: string | null;
  /** GEM entity ID if known */
  gemEntityId?: string | null;
  publiclyListed?: boolean;
  /** Headquarters / primary facility city */
  municipality?: string | null;
  subnationalUnit?: string | null;
  /** Matched Climate TRACE / GCCT facilities */
  facilities: MatchedFacility[];
  /** Total emissions across all matched facilities (most recent year) */
  totalCo2eTonnes: number;
};

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export type LoanStatus =
  | "active"
  | "disbursed"
  | "under-review"
  | "approved"
  | "declined";

export type NrbTaxonomyColor = "green" | "amber" | "red" | "unclassified";

export type Loan = {
  id: string;
  /** Borrower reference */
  borrowerId: string;
  /** Loan product name (human-readable) */
  product: string;
  /** Machine-readable loan category */
  category?: LoanCategory;
  /** Business unit (for portfolio segmentation) */
  businessUnit?: BusinessUnit;
  /** Branch that originated the loan */
  branch?: string;
  branchCode?: string;
  /** Outstanding amount in NPR */
  outstandingNpr: number;
  /** Outstanding amount in USD (for PCAF calc) */
  outstandingUsd: number;
  /** Disbursement date (ISO 8601) */
  disbursedDate: string;
  /** Maturity date (ISO 8601) */
  maturityDate: string;
  /** Loan status */
  status: LoanStatus;
  /** NRB Green Finance Taxonomy classification */
  nrbTaxonomy: NrbTaxonomyColor;
  /** Purpose / use of proceeds */
  purpose: string;
};

// ---------------------------------------------------------------------------
// PCAF calculation
// ---------------------------------------------------------------------------

export type PcafMethodology =
  | "facility-attributed"     // Score 2 - CT facility + public EV
  | "satellite-emissions"     // Score 3 - CT facility + estimated EV
  | "sector-benchmark"        // Score 4 - EDGAR sector intensity
  | "revenue-based-estimate"  // Score 5 - national sector average
  | "out-of-scope";           // retail - not in financed emissions scope

/** PCAF Scope 3 Category 15 - financed emissions attribution */
export type PcafAttribution = {
  loanId: string;
  borrowerId: string;
  methodology?: PcafMethodology;
  /** Attribution factor = outstanding / enterprise value */
  attributionFactor: number;
  /** Attributed emissions = attribution factor x borrower total emissions */
  attributedCo2eTonnes: number;
  /** PCAF data quality score (1=best, 5=worst) */
  dataQualityScore: 1 | 2 | 3 | 4 | 5;
  /** Explanation of the quality score */
  qualityNote: string;
  /**
   * PCAF option letter (1a, 1b, 2a, 2b, 3a, 3b, 3c) per §4/§5 rubric.
   * Populated by `lib/regulatory/pcaf/scoring.ts` compute engine.
   */
  pcafOption?: "1a" | "1b" | "2a" | "2b" | "3a" | "3b" | "3c";
  /**
   * PCAF Part A 3rd Edition §5.x asset class this loan was routed to.
   * See `lib/regulatory/pcaf/types.ts` for the enum.
   */
  pcafAssetClass?:
    | "listed-equity-corporate-bonds"
    | "business-loans-unlisted-equity"
    | "project-finance"
    | "commercial-real-estate"
    | "mortgages"
    | "motor-vehicle-loans"
    | "use-of-proceeds-structures"
    | "securitisation-structured-products"
    | "sovereign-debt"
    | "sub-sovereign-debt"
    | "out-of-scope";
  /**
   * PCAF paragraph citation — surfaced in tooltips + auditor exports.
   * Format: "PCAF Part A 3rd Edition §5.2 · Option 2b (physical production × sector EF)"
   */
  pcafCitation?: string;
  /** Data source lineage that unlocked this score. */
  pcafDataSource?: string;
};

// ---------------------------------------------------------------------------
// Portfolio summary
// ---------------------------------------------------------------------------

export type TaxonomyBreakdown = {
  green: number;
  amber: number;
  red: number;
  unclassified: number;
};

export type PortfolioFunnel = {
  totalLoans: number;
  inScopeLoans: number;
  facilityMatchedLoans: number;
  /** Count of unique borrowers with facility-tier data appearing in the loan book */
  facilityMatchedBorrowers: number;
  totalOutstandingNpr: number;
  inScopeOutstandingNpr: number;
  facilityMatchedOutstandingNpr: number;
};

export type DataQualityDistribution = Array<{
  score: 1 | 2 | 3 | 4 | 5;
  loanCount: number;
  outstandingUsd: number;
  outstandingNpr: number;
  attributedCo2eTonnes: number;
}>;

export type PortfolioTrendPoint = {
  year: number;
  totalAttributedCo2eTonnes: number;
  byTaxonomy: TaxonomyBreakdown;
};

export type PortfolioSummary = {
  totalLoans: number;
  totalOutstandingUsd: number;
  totalOutstandingNpr: number;
  totalAttributedCo2eTonnes: number;
  /** Weighted average data quality across in-scope loans */
  weightedDataQuality: number;
  /** Breakdown by NRB taxonomy color (count) */
  taxonomyBreakdown: TaxonomyBreakdown;
  /** Same breakdown but weighted by outstanding NPR */
  taxonomyBreakdownValue?: TaxonomyBreakdown;
  /** Breakdown by sector */
  sectorBreakdown: Array<{
    sector: string;
    attributedCo2e: number;
    loanCount: number;
    outstandingNpr?: number;
  }>;
  /** New optional fields powering the three-tier dashboard */
  funnel?: PortfolioFunnel;
  dataQualityDistribution?: DataQualityDistribution;
  trend?: PortfolioTrendPoint[];
};

// ---------------------------------------------------------------------------
// ESRM screening (Tab 1)
// ---------------------------------------------------------------------------

export type BorrowerScreening = {
  borrowerId: string;
  /** EDGAR sector emissions intensity (tCO2e per unit output) for comparison */
  sectorBenchmarkLabel?: string;
  sectorBenchmarkValue?: number;
  /** Borrower's intensity for comparison */
  borrowerIntensityValue?: number;
  /** OpenAQ reading near the facility */
  airQualityNearby?: {
    pm25: number;
    readingDate: string;
    stationName: string;
  };
  /** Ownership chain */
  ownershipTree?: Array<{
    name: string;
    entityId?: string | null;
    percentOwnership?: number | null;
  }>;
  /** Recommendation surfaced by the data layer */
  riskClassification?: "low" | "medium" | "high" | "extreme";
  recommendation?: "approve" | "approve-with-conditions" | "decline";
  reasoning?: string;
};

// ---------------------------------------------------------------------------
// Top-level dashboard data
// ---------------------------------------------------------------------------

export type BfiDemoMeta = {
  bankName: string;
  isMock: boolean;
  generatedAt: string;
  pcafMethodologyNote: string;
  asOfDate?: string;
  /**
   * Runtime tenant identity injected by app/page.tsx from the current
   * tenant cookie. Everything downstream reads these fields to render the
   * correct bank name, logo, and brand palette.
   */
  tenantId?: string;
  tenantLogoPath?: string;
};

export type BfiDemoData = {
  meta: BfiDemoMeta;
  borrowers: Borrower[];
  loans: Loan[];
  attributions: PcafAttribution[];
  portfolio: PortfolioSummary;
};
