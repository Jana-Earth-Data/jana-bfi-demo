/**
 * BFI Demo Mock Data
 *
 * Realistic Nepal facilities based on Climate TRACE asset data.
 * Enterprise values are estimates - clearly labeled as such.
 * This is demo data for sales conversations, not production analytics.
 *
 * Exchange rate: 1 USD = 133.5 NPR (approximate, May 2026)
 */

import {
  BfiDemoData,
  Borrower,
  Loan,
  PcafAttribution,
  PortfolioSummary,
} from "@/lib/types/bfi";

const NPR_PER_USD = 133.5;

// ---------------------------------------------------------------------------
// Borrowers with matched Climate TRACE facilities
// ---------------------------------------------------------------------------

const borrowers: Borrower[] = [
  {
    id: "B001",
    name: "Hongshi Shivam Cement Pvt. Ltd.",
    nrbSector: "Manufacturing - Cement",
    enterpriseValueUsd: 85_000_000,
    evSource: "estimated",
    facilities: [
      {
        assetId: "CT-NPL-CEM-001",
        facilityName: "Hongshi Shivam Cement Plant",
        sector: "manufacturing",
        lat: 27.62,
        lng: 84.43,
        annualCo2eTonnes: 1_245_000,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.95,
      },
    ],
    totalCo2eTonnes: 1_245_000,
  },
  {
    id: "B002",
    name: "Chilime Hydropower Company Ltd.",
    nrbSector: "Energy - Hydropower",
    enterpriseValueUsd: 120_000_000,
    evSource: "public-filing",
    facilities: [
      {
        assetId: "CT-NPL-PWR-001",
        facilityName: "Chilime Hydropower Station (22 MW)",
        sector: "power",
        lat: 28.17,
        lng: 85.31,
        annualCo2eTonnes: 2_800,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.92,
      },
    ],
    totalCo2eTonnes: 2_800,
  },
  {
    id: "B003",
    name: "Himal Cement Company Ltd.",
    nrbSector: "Manufacturing - Cement",
    enterpriseValueUsd: 45_000_000,
    evSource: "estimated",
    facilities: [
      {
        assetId: "CT-NPL-CEM-002",
        facilityName: "Himal Cement Factory, Kathmandu",
        sector: "manufacturing",
        lat: 27.68,
        lng: 85.28,
        annualCo2eTonnes: 520_000,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.88,
      },
    ],
    totalCo2eTonnes: 520_000,
  },
  {
    id: "B004",
    name: "Bottlers Nepal (Terai) Ltd.",
    nrbSector: "Manufacturing - Beverages",
    enterpriseValueUsd: 60_000_000,
    evSource: "public-filing",
    facilities: [
      {
        assetId: "CT-NPL-MFG-001",
        facilityName: "Bottlers Nepal Terai Plant",
        sector: "manufacturing",
        lat: 27.57,
        lng: 83.59,
        annualCo2eTonnes: 18_500,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.85,
      },
    ],
    totalCo2eTonnes: 18_500,
  },
  {
    id: "B005",
    name: "Butwal Power Company Ltd.",
    nrbSector: "Energy - Hydropower",
    enterpriseValueUsd: 200_000_000,
    evSource: "public-filing",
    facilities: [
      {
        assetId: "CT-NPL-PWR-002",
        facilityName: "Jhimruk Hydropower Station (12.3 MW)",
        sector: "power",
        lat: 28.27,
        lng: 82.84,
        annualCo2eTonnes: 1_500,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.9,
      },
      {
        assetId: "CT-NPL-PWR-003",
        facilityName: "Andhikhola Hydropower Station (9.4 MW)",
        sector: "power",
        lat: 28.28,
        lng: 83.57,
        annualCo2eTonnes: 1_100,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.88,
      },
    ],
    totalCo2eTonnes: 2_600,
  },
  {
    id: "B006",
    name: "Unilever Nepal Ltd.",
    nrbSector: "Manufacturing - FMCG",
    enterpriseValueUsd: 150_000_000,
    evSource: "proxy",
    facilities: [
      {
        assetId: "CT-NPL-MFG-002",
        facilityName: "Unilever Nepal Factory, Hetauda",
        sector: "manufacturing",
        lat: 27.43,
        lng: 85.03,
        annualCo2eTonnes: 12_000,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.82,
      },
    ],
    totalCo2eTonnes: 12_000,
  },
  {
    id: "B007",
    name: "Nepal Electricity Authority",
    nrbSector: "Energy - Thermal",
    enterpriseValueUsd: 500_000_000,
    evSource: "estimated",
    facilities: [
      {
        assetId: "CT-NPL-PWR-004",
        facilityName: "Hetauda Power Station (14.4 MW diesel)",
        sector: "power",
        lat: 27.43,
        lng: 85.02,
        annualCo2eTonnes: 45_000,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.95,
      },
      {
        assetId: "CT-NPL-PWR-005",
        facilityName: "Multifuel Power Plant Duhabi (39 MW)",
        sector: "power",
        lat: 26.74,
        lng: 87.26,
        annualCo2eTonnes: 98_000,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.93,
      },
    ],
    totalCo2eTonnes: 143_000,
  },
  {
    id: "B008",
    name: "Shree Ram Sugar Mills Ltd.",
    nrbSector: "Agriculture - Processing",
    enterpriseValueUsd: 25_000_000,
    evSource: "estimated",
    facilities: [
      {
        assetId: "CT-NPL-AGR-001",
        facilityName: "Shree Ram Sugar Mill, Birgunj",
        sector: "agriculture",
        lat: 27.01,
        lng: 84.88,
        annualCo2eTonnes: 35_000,
        emissionsYear: 2023,
        matchMethod: "manual",
        matchConfidence: 0.78,
      },
    ],
    totalCo2eTonnes: 35_000,
  },
];

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

const loans: Loan[] = [
  {
    id: "L001",
    borrowerId: "B001",
    product: "Term Loan - Industrial",
    outstandingNpr: 2_500_000_000,
    outstandingUsd: 2_500_000_000 / NPR_PER_USD,
    disbursedDate: "2022-06-15",
    maturityDate: "2029-06-15",
    status: "active",
    nrbTaxonomy: "red",
    purpose: "Cement plant capacity expansion",
  },
  {
    id: "L002",
    borrowerId: "B002",
    product: "Project Finance - Renewable",
    outstandingNpr: 1_800_000_000,
    outstandingUsd: 1_800_000_000 / NPR_PER_USD,
    disbursedDate: "2021-03-01",
    maturityDate: "2036-03-01",
    status: "active",
    nrbTaxonomy: "green",
    purpose: "Hydropower station development",
  },
  {
    id: "L003",
    borrowerId: "B003",
    product: "Working Capital - Industrial",
    outstandingNpr: 800_000_000,
    outstandingUsd: 800_000_000 / NPR_PER_USD,
    disbursedDate: "2024-01-10",
    maturityDate: "2025-12-31",
    status: "active",
    nrbTaxonomy: "red",
    purpose: "Raw material procurement for cement production",
  },
  {
    id: "L004",
    borrowerId: "B004",
    product: "Term Loan - Manufacturing",
    outstandingNpr: 600_000_000,
    outstandingUsd: 600_000_000 / NPR_PER_USD,
    disbursedDate: "2023-08-20",
    maturityDate: "2028-08-20",
    status: "active",
    nrbTaxonomy: "amber",
    purpose: "Bottling line modernization",
  },
  {
    id: "L005",
    borrowerId: "B005",
    product: "Project Finance - Renewable",
    outstandingNpr: 3_200_000_000,
    outstandingUsd: 3_200_000_000 / NPR_PER_USD,
    disbursedDate: "2020-09-01",
    maturityDate: "2035-09-01",
    status: "active",
    nrbTaxonomy: "green",
    purpose: "Multi-project hydropower development",
  },
  {
    id: "L006",
    borrowerId: "B006",
    product: "Working Capital - FMCG",
    outstandingNpr: 450_000_000,
    outstandingUsd: 450_000_000 / NPR_PER_USD,
    disbursedDate: "2024-04-01",
    maturityDate: "2025-09-30",
    status: "active",
    nrbTaxonomy: "amber",
    purpose: "Seasonal inventory financing",
  },
  {
    id: "L007",
    borrowerId: "B007",
    product: "Sovereign Guarantee - Energy",
    outstandingNpr: 5_000_000_000,
    outstandingUsd: 5_000_000_000 / NPR_PER_USD,
    disbursedDate: "2019-01-15",
    maturityDate: "2034-01-15",
    status: "active",
    nrbTaxonomy: "red",
    purpose: "Thermal/diesel power infrastructure",
  },
  {
    id: "L008",
    borrowerId: "B008",
    product: "Agricultural Term Loan",
    outstandingNpr: 350_000_000,
    outstandingUsd: 350_000_000 / NPR_PER_USD,
    disbursedDate: "2023-11-01",
    maturityDate: "2028-11-01",
    status: "active",
    nrbTaxonomy: "amber",
    purpose: "Sugar mill equipment upgrade",
  },
  {
    id: "L009",
    borrowerId: "B001",
    product: "Working Capital - Industrial",
    outstandingNpr: 1_200_000_000,
    outstandingUsd: 1_200_000_000 / NPR_PER_USD,
    disbursedDate: "2024-02-01",
    maturityDate: "2025-07-31",
    status: "active",
    nrbTaxonomy: "red",
    purpose: "Cement raw material and fuel procurement",
  },
  {
    id: "L010",
    borrowerId: "B002",
    product: "Green Bond Proceeds",
    outstandingNpr: 500_000_000,
    outstandingUsd: 500_000_000 / NPR_PER_USD,
    disbursedDate: "2024-06-01",
    maturityDate: "2031-06-01",
    status: "disbursed",
    nrbTaxonomy: "green",
    purpose: "Capacity addition - new run-of-river project",
  },
];

// ---------------------------------------------------------------------------
// PCAF attributions (calculated)
// ---------------------------------------------------------------------------

function calcAttribution(loan: Loan, borrower: Borrower): PcafAttribution {
  const attributionFactor = loan.outstandingUsd / borrower.enterpriseValueUsd;
  const attributedCo2eTonnes = attributionFactor * borrower.totalCo2eTonnes;

  // PCAF quality score based on data source
  let dataQualityScore: 1 | 2 | 3 | 4 | 5;
  let qualityNote: string;

  if (borrower.evSource === "public-filing" && borrower.facilities[0]?.matchConfidence > 0.9) {
    dataQualityScore = 2;
    qualityNote = "Verified emissions + public financial data";
  } else if (borrower.evSource === "public-filing") {
    dataQualityScore = 3;
    qualityNote = "Public financial data, satellite-derived emissions";
  } else if (borrower.evSource === "estimated") {
    dataQualityScore = 4;
    qualityNote = "Estimated enterprise value, satellite-derived emissions";
  } else {
    dataQualityScore = 4;
    qualityNote = "Proxy enterprise value, satellite-derived emissions";
  }

  return {
    loanId: loan.id,
    borrowerId: borrower.id,
    attributionFactor,
    attributedCo2eTonnes: Math.round(attributedCo2eTonnes),
    dataQualityScore,
    qualityNote,
  };
}

const borrowerMap = new Map(borrowers.map((b) => [b.id, b]));

const attributions: PcafAttribution[] = loans.map((loan) => {
  const borrower = borrowerMap.get(loan.borrowerId)!;
  return calcAttribution(loan, borrower);
});

// ---------------------------------------------------------------------------
// Portfolio summary
// ---------------------------------------------------------------------------

function buildPortfolioSummary(): PortfolioSummary {
  const totalLoans = loans.length;
  const totalOutstandingNpr = loans.reduce((s, l) => s + l.outstandingNpr, 0);
  const totalOutstandingUsd = loans.reduce((s, l) => s + l.outstandingUsd, 0);
  const totalAttributedCo2eTonnes = attributions.reduce((s, a) => s + a.attributedCo2eTonnes, 0);

  // Weighted average quality (weighted by attributed emissions)
  const weightedSum = attributions.reduce(
    (s, a) => s + a.dataQualityScore * a.attributedCo2eTonnes,
    0
  );
  const weightedDataQuality =
    totalAttributedCo2eTonnes > 0
      ? Math.round((weightedSum / totalAttributedCo2eTonnes) * 10) / 10
      : 0;

  // Taxonomy breakdown (count of loans)
  const taxonomyBreakdown = { green: 0, amber: 0, red: 0, unclassified: 0 };
  loans.forEach((l) => {
    taxonomyBreakdown[l.nrbTaxonomy]++;
  });

  // Sector breakdown
  const sectorMap = new Map<string, { co2e: number; count: number }>();
  loans.forEach((loan) => {
    const borrower = borrowerMap.get(loan.borrowerId)!;
    const attr = attributions.find((a) => a.loanId === loan.id)!;
    const prev = sectorMap.get(borrower.nrbSector) ?? { co2e: 0, count: 0 };
    sectorMap.set(borrower.nrbSector, {
      co2e: prev.co2e + attr.attributedCo2eTonnes,
      count: prev.count + 1,
    });
  });

  const sectorBreakdown = Array.from(sectorMap.entries())
    .map(([sector, { co2e, count }]) => ({
      sector,
      attributedCo2e: Math.round(co2e),
      loanCount: count,
    }))
    .sort((a, b) => b.attributedCo2e - a.attributedCo2e);

  return {
    totalLoans,
    totalOutstandingUsd: Math.round(totalOutstandingUsd),
    totalOutstandingNpr,
    totalAttributedCo2eTonnes: Math.round(totalAttributedCo2eTonnes),
    weightedDataQuality,
    taxonomyBreakdown,
    sectorBreakdown,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const bfiDemoMock: BfiDemoData = {
  meta: {
    bankName: "Nepal Demo Bank",
    isMock: true,
    generatedAt: new Date().toISOString(),
    pcafMethodologyNote:
      "Financed emissions calculated using PCAF methodology (Scope 3, Category 15). " +
      "Attribution factor = loan outstanding / enterprise value. " +
      "Emissions sourced from Climate TRACE satellite-derived facility data. " +
      "Enterprise values are estimates unless marked as public filings. " +
      "Jana matched borrowers to Climate TRACE facilities manually for this demo - " +
      "in production, this matching is a consulting engagement.",
  },
  borrowers,
  loans,
  attributions,
  portfolio: buildPortfolioSummary(),
};
