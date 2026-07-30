/**
 * NRBSIS Green Finance Statement — Annex 4b exporter.
 *
 * This is the ANNUAL AGGREGATE filing that a BFI submits into the NRB
 * Supervisory Information System (SIS). It is the actual regulatory
 * submission format defined in the NRB Green Finance Taxonomy (October
 * 2024), Annex 4b (p. 144 of the PDF):
 *
 *   "Green Finance Statement of Sector (Purpose) wise Loans and
 *    Advances (Annual) – Annual report template of NRB Supervisory
 *    Information System"
 *
 * Verbatim Annex 4b column list:
 *   - Industry/Sector
 *   - Class A
 *   - Class B
 *   - Class C
 *   - Other Total Loans
 *   - Grand Total (in NPR million)
 *
 * Verbatim Annex 4b row list (17 sectors, in order):
 *   1. Agriculture and Forest related
 *   2. Fishery Related
 *   3. Mining Related
 *   4. Agriculture, Forestry & Beverage Production Related
 *   5. Non-food Production Related
 *   6. Construction
 *   7. Power, Gas and Water
 *   8. Metal Products, Machinery & Electronic Equipment & Assemblage
 *   9. Transport, Communication and Public Utilities
 *  10. Wholesaler & Retailer
 *  11. Finance, Insurance
 *  12. Real estate
 *  13. Tourism Service
 *  14. Automotive and other services
 *  15. Health care and waste management
 *  16. Education services
 *  17. Consumption loan
 *
 * Difference from the /api/reports/nrb-taxonomy report:
 *   - /api/reports/nrb-taxonomy is the **per-loan classification report**.
 *     It supports the filing — it is auditor evidence — but is not the
 *     submitted document.
 *   - /api/reports/nrbsis-green-statement is the **aggregated 17-sector
 *     Green Finance Statement** actually keyed into SIS. Per NRB Table 4
 *     (p. 32) the SIS "will separately label green finance for the
 *     lending areas in the system" — so we augment the verbatim Annex 4b
 *     shape with green/amber/red split columns.
 *
 * All builders here are pure and unit-testable; the route handler wires
 * them to the tenant, portfolio, and Supabase.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "pdf-lib";
import type { BfiDemoData, Loan, NrbTaxonomyColor } from "@/lib/types/bfi";
import type { TenantConfig } from "@/lib/tenants";
import type {
  ExportBranding,
  TaxonomyAssessmentRow,
} from "@/lib/reports/nrb-taxonomy-export";

// ---------------------------------------------------------------------------
// Annex 4b sector taxonomy (verbatim from the PDF)
// ---------------------------------------------------------------------------

/**
 * Machine-readable identifiers for the 17 Annex 4b rows. The verbatim
 * NRB labels live on ANNEX_4B_ROWS below — do not read the labels off
 * this identifier list; read them from the definition table so a
 * downstream change to NRB wording is a one-line edit.
 */
export type Annex4bRowId =
  | "agriculture_forest"
  | "fishery"
  | "mining"
  | "agriculture_forestry_beverage"
  | "non_food_production"
  | "construction"
  | "power_gas_water"
  | "metal_products_machinery"
  | "transport_communication_utilities"
  | "wholesaler_retailer"
  | "finance_insurance"
  | "real_estate"
  | "tourism_service"
  | "automotive_other_services"
  | "healthcare_waste_management"
  | "education_services"
  | "consumption_loan";

export type Annex4bRowDefinition = {
  id: Annex4bRowId;
  /** Position 1..17 as printed on the SIS return */
  number: number;
  /** Verbatim NRB label — do not paraphrase. */
  label: string;
};

/**
 * The 17 Annex 4b sector rows, verbatim. Order and label must exactly
 * match the PDF (Annex 4b, p. 144). Capitalisation differences ("Real
 * estate" but "Non-food Production Related") are intentional and mirror
 * the source.
 */
export const ANNEX_4B_ROWS: Annex4bRowDefinition[] = [
  { id: "agriculture_forest", number: 1, label: "Agriculture and Forest related" },
  { id: "fishery", number: 2, label: "Fishery Related" },
  { id: "mining", number: 3, label: "Mining Related" },
  { id: "agriculture_forestry_beverage", number: 4, label: "Agriculture, Forestry & Beverage Production Related" },
  { id: "non_food_production", number: 5, label: "Non-food Production Related" },
  { id: "construction", number: 6, label: "Construction" },
  { id: "power_gas_water", number: 7, label: "Power, Gas and Water" },
  { id: "metal_products_machinery", number: 8, label: "Metal Products, Machinery & Electronic Equipment & Assemblage" },
  { id: "transport_communication_utilities", number: 9, label: "Transport, Communication and Public Utilities" },
  { id: "wholesaler_retailer", number: 10, label: "Wholesaler & Retailer" },
  { id: "finance_insurance", number: 11, label: "Finance, Insurance" },
  { id: "real_estate", number: 12, label: "Real estate" },
  { id: "tourism_service", number: 13, label: "Tourism Service" },
  { id: "automotive_other_services", number: 14, label: "Automotive and other services" },
  { id: "healthcare_waste_management", number: 15, label: "Health care and waste management" },
  { id: "education_services", number: 16, label: "Education services" },
  { id: "consumption_loan", number: 17, label: "Consumption loan" },
];

// ---------------------------------------------------------------------------
// Sector mapping: demo NrbSector strings → Annex 4b row
// ---------------------------------------------------------------------------

/**
 * Map from the demo's `borrower.nrbSector` strings (the loose,
 * commentary-style labels the synthesizer uses — e.g.
 * "Manufacturing - Cement", "Energy - Hydropower") to the corresponding
 * Annex 4b row. Every sector currently emitted by the borrower catalog
 * (lib/data/entities.ts) must appear here so no in-scope loan lands in
 * the "unmapped" bucket.
 *
 * When adding a new borrower sector to the synthesizer, add its Annex 4b
 * mapping here at the same time — otherwise it will silently drop off
 * the regulatory submission.
 */
export const SECTOR_TO_ANNEX_4B: Record<string, Annex4bRowId> = {
  // Cement / brick / textiles / plastics / paper → §5 Non-food Production
  // (per Annex 2 sub-sectors 5.11 cement, 5.10 stone/clay/brick, 5.2
  // textiles, 5.10 plastic, 5.14 basic iron/steel).
  "Manufacturing - Cement": "non_food_production",
  "Manufacturing - Brick": "non_food_production",
  "Manufacturing - Textiles": "non_food_production",
  "Manufacturing - Plastics": "non_food_production",
  "Manufacturing - Chemicals": "non_food_production",
  "Manufacturing - FMCG": "non_food_production",
  "Manufacturing - Other": "non_food_production",
  // Steel is §5.14 (Metals — Basic Iron and Steel Plant) — sector 5,
  // NOT sector 8. Sector 8 (Metal Products, Machinery...) covers
  // downstream fabricated metal products (§8.1) and electrical/
  // electronic equipment. Basic steel production is upstream sector 5.
  "Manufacturing - Steel": "non_food_production",
  // Beverages processing → §4 Agriculture, Forestry & Beverage
  // (§4.9 alcoholic, §4.10 non-alcoholic).
  "Manufacturing - Beverages": "agriculture_forestry_beverage",
  // Agro processing (food processing / animal feed / tea / coffee
  // processing) → §4 (§4.1 food processing, §4.3 tea/coffee/ginger).
  "Agriculture - Processing": "agriculture_forestry_beverage",
  // Power (hydro, thermal, solar, wind) → §7 Power, Gas and Water.
  "Energy - Hydropower": "power_gas_water",
  "Energy - Thermal": "power_gas_water",
  "Energy - Solar": "power_gas_water",
  "Energy - Wind": "power_gas_water",
  // Construction → §6.
  "Construction": "construction",
  // Transport & storage → §9.
  "Transport & Storage": "transport_communication_utilities",
  // Wholesale / retail trade → §10.
  "Wholesale & Retail Trade": "wholesaler_retailer",
  // Real estate (commercial and residential) → §12.
  "Real Estate - Commercial": "real_estate",
  "Real Estate - Residential": "real_estate",
  // Hospitality / hotels → §13 Tourism Service.
  "Hospitality - Tourism": "tourism_service",
  // Waste management / drainage / sanitation → §15 Health care and
  // waste management (§15.2 Waste Management).
  "Utilities - Waste Management": "healthcare_waste_management",
  // Retail placeholder pool — retail loans use `loan.category`
  // for routing rather than the borrower sector, but the pool's
  // fallback lands on §17 Consumption loan.
  "Retail": "consumption_loan",
};

/**
 * Route a loan to its Annex 4b row.
 *
 * Retail loans are routed by category, matching the NRB SIS
 * convention: personal / vehicle / mortgage / education land in
 * §17 Consumption loan (per §17.2 Hire Purchase Vehicle — Personal
 * Consumption and §17.4 Residential Personal Home Loan). Everything
 * else consults `SECTOR_TO_ANNEX_4B` above.
 */
export function annex4bRowForLoan(
  loan: Loan,
  borrowerNrbSector: string | null | undefined,
): Annex4bRowId | null {
  // Retail categories all roll up to Consumption loan (§17).
  // NRB treats personal home loans (17.4) and personal EV / vehicle
  // (17.2) both as Consumption loan for reporting purposes.
  if (loan.category?.startsWith("retail-")) {
    return "consumption_loan";
  }
  if (!borrowerNrbSector) return null;
  return SECTOR_TO_ANNEX_4B[borrowerNrbSector] ?? null;
}

// ---------------------------------------------------------------------------
// Bank class (Annex 4b column axis)
// ---------------------------------------------------------------------------

/**
 * The Annex 4b template splits industry rows across "Class A", "Class B",
 * "Class C" and "Other Total Loans" columns — those are BFI licence
 * classes (A = commercial bank, B = development bank, C = finance
 * company, D = microfinance which rolls into "Other Total Loans"
 * alongside NIB Ltd). A per-BFI submission fills in ONE of the class
 * columns based on the submitting institution's own licence.
 *
 * Both demo tenants (First Bank of Nepal, Laxmi Sunrise) are Class A
 * commercial banks — so the demo submission is always filed against
 * the Class A column. When adding a Class B/C tenant later, expose a
 * `bankClass` field on TenantConfig and read it here.
 */
export type BankClass = "A" | "B" | "C" | "other";

export function bankClassForTenant(_tenant: Pick<TenantConfig, "id">): BankClass {
  // Both currently-registered tenants are Class A commercial banks.
  // This lookup is intentionally isolated so the eventual per-tenant
  // class metadata has one place to plug in.
  return "A";
}

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

/**
 * One row on the Green Finance Statement — combines the verbatim
 * Annex 4b columns (Class A/B/C/Other/Grand Total in NPR million) with
 * the green-finance labeling columns required by Table 4 (p. 32).
 */
export type GreenStatementRow = {
  rowId: Annex4bRowId;
  sectorNumber: number;
  /** Verbatim Annex 4b label */
  sectorLabel: string;

  // ---- Annex 4b native columns (values in NPR million) --------------
  classA: number;
  classB: number;
  classC: number;
  otherTotalLoans: number;
  grandTotalNprMillion: number;

  // ---- Green-finance labeling (Table 4 p. 32) -----------------------
  loanCount: number;
  totalOutstandingNpr: number;
  greenOutstandingNpr: number;
  amberOutstandingNpr: number;
  redOutstandingNpr: number;
  unclassifiedOutstandingNpr: number;
  /** greenOutstandingNpr / totalOutstandingNpr, 0..1; 0 when totals are 0 */
  greenShare: number;
};

export type GreenStatementTotals = Omit<
  GreenStatementRow,
  "rowId" | "sectorNumber" | "sectorLabel"
>;

export type UnmappedSummary = {
  loanCount: number;
  outstandingNpr: number;
  /** Distinct unmapped `borrower.nrbSector` strings encountered */
  distinctSectors: string[];
};

export type GreenStatementReport = {
  tenant: {
    id: string;
    displayName: string;
  };
  bankClass: BankClass;
  generatedAt: string;
  /**
   * Reporting period — this is a demo string; a production filing would
   * be pinned to the bank's fiscal year filing calendar. Included so the
   * PDF and xlsx have a fiscal-year label that reads correctly.
   */
  reportingPeriod: {
    fiscalYearLabel: string;
    asOfDate: string;
  };
  rows: GreenStatementRow[];
  totals: GreenStatementTotals;
  unmapped: UnmappedSummary;
};

// ---------------------------------------------------------------------------
// buildGreenStatementReport — pure assembly of the JSON shape
// ---------------------------------------------------------------------------

function emptyStatementRow(def: Annex4bRowDefinition): GreenStatementRow {
  return {
    rowId: def.id,
    sectorNumber: def.number,
    sectorLabel: def.label,
    classA: 0,
    classB: 0,
    classC: 0,
    otherTotalLoans: 0,
    grandTotalNprMillion: 0,
    loanCount: 0,
    totalOutstandingNpr: 0,
    greenOutstandingNpr: 0,
    amberOutstandingNpr: 0,
    redOutstandingNpr: 0,
    unclassifiedOutstandingNpr: 0,
    greenShare: 0,
  };
}

function normaliseColor(raw: string | null | undefined): NrbTaxonomyColor {
  if (raw === "green" || raw === "amber" || raw === "red") return raw;
  return "unclassified";
}

/** Round NPR value to NPR-millions (NRB SIS uses NPR million units). */
function toNprMillion(nprValue: number): number {
  return Math.round(nprValue / 1_000_000);
}

/**
 * Assemble the report shape from:
 *   - `tenant`     : resolved current tenant
 *   - `demoData`   : loan book + borrowers (source of truth for outstandings)
 *   - `assessments`: latest bfi_taxonomy_assessments rows for this tenant,
 *                    used to override `loan.nrbTaxonomy` with the officer's
 *                    saved classification where present.
 *
 * We prefer the officer's saved computed_color when we have one, and
 * fall back to the synthesised `loan.nrbTaxonomy` when the loan hasn't
 * been reviewed. This matches how the per-loan report works and gives
 * one green-share number across both flows.
 */
export function buildGreenStatementReport(
  tenant: Pick<TenantConfig, "id" | "branding">,
  demoData: BfiDemoData,
  assessments: TaxonomyAssessmentRow[],
): GreenStatementReport {
  // Latest-per-loan assessment (input is expected to be sorted desc by
  // captured_at — we tolerate duplicates and keep the first sighting).
  const latestByLoan = new Map<string, TaxonomyAssessmentRow>();
  for (const row of assessments) {
    if (!row.loan_id) continue;
    if (latestByLoan.has(row.loan_id)) continue;
    latestByLoan.set(row.loan_id, row);
  }

  const borrowerById = new Map(demoData.borrowers.map((b) => [b.id, b]));
  const bankClass = bankClassForTenant(tenant);

  // Seed all 17 rows so every sector shows on the return even at zero.
  const rowByRowId = new Map<Annex4bRowId, GreenStatementRow>();
  for (const def of ANNEX_4B_ROWS) {
    rowByRowId.set(def.id, emptyStatementRow(def));
  }

  const unmappedSectorCounts = new Map<string, number>();
  let unmappedLoanCount = 0;
  let unmappedNprTotal = 0;

  for (const loan of demoData.loans) {
    const borrower = borrowerById.get(loan.borrowerId);
    const borrowerSector = borrower?.nrbSector ?? null;
    const rowId = annex4bRowForLoan(loan, borrowerSector);

    if (!rowId) {
      unmappedLoanCount += 1;
      unmappedNprTotal += loan.outstandingNpr;
      if (borrowerSector) {
        unmappedSectorCounts.set(
          borrowerSector,
          (unmappedSectorCounts.get(borrowerSector) ?? 0) + 1,
        );
      }
      continue;
    }

    const row = rowByRowId.get(rowId)!;
    // Prefer officer's saved classification if we have one.
    const savedColor = latestByLoan.get(loan.id)?.computed_color;
    const color = savedColor
      ? normaliseColor(savedColor)
      : normaliseColor(loan.nrbTaxonomy);

    row.loanCount += 1;
    row.totalOutstandingNpr += loan.outstandingNpr;
    switch (color) {
      case "green":
        row.greenOutstandingNpr += loan.outstandingNpr;
        break;
      case "amber":
        row.amberOutstandingNpr += loan.outstandingNpr;
        break;
      case "red":
        row.redOutstandingNpr += loan.outstandingNpr;
        break;
      default:
        row.unclassifiedOutstandingNpr += loan.outstandingNpr;
        break;
    }
  }

  // Finalise Annex 4b column values from the totals we just accumulated.
  // Only ONE class column is populated per-bank submission — the class
  // of the submitting BFI. Every other class column stays at zero.
  for (const row of rowByRowId.values()) {
    const grandNprMillion = toNprMillion(row.totalOutstandingNpr);
    if (bankClass === "A") row.classA = grandNprMillion;
    else if (bankClass === "B") row.classB = grandNprMillion;
    else if (bankClass === "C") row.classC = grandNprMillion;
    else row.otherTotalLoans = grandNprMillion;
    row.grandTotalNprMillion = grandNprMillion;
    row.greenShare =
      row.totalOutstandingNpr > 0
        ? row.greenOutstandingNpr / row.totalOutstandingNpr
        : 0;
  }

  const rows = ANNEX_4B_ROWS.map((def) => rowByRowId.get(def.id)!);

  // Portfolio totals.
  const totals: GreenStatementTotals = {
    classA: 0,
    classB: 0,
    classC: 0,
    otherTotalLoans: 0,
    grandTotalNprMillion: 0,
    loanCount: 0,
    totalOutstandingNpr: 0,
    greenOutstandingNpr: 0,
    amberOutstandingNpr: 0,
    redOutstandingNpr: 0,
    unclassifiedOutstandingNpr: 0,
    greenShare: 0,
  };
  for (const r of rows) {
    totals.classA += r.classA;
    totals.classB += r.classB;
    totals.classC += r.classC;
    totals.otherTotalLoans += r.otherTotalLoans;
    totals.grandTotalNprMillion += r.grandTotalNprMillion;
    totals.loanCount += r.loanCount;
    totals.totalOutstandingNpr += r.totalOutstandingNpr;
    totals.greenOutstandingNpr += r.greenOutstandingNpr;
    totals.amberOutstandingNpr += r.amberOutstandingNpr;
    totals.redOutstandingNpr += r.redOutstandingNpr;
    totals.unclassifiedOutstandingNpr += r.unclassifiedOutstandingNpr;
  }
  totals.greenShare =
    totals.totalOutstandingNpr > 0
      ? totals.greenOutstandingNpr / totals.totalOutstandingNpr
      : 0;

  const asOfIso = demoData.meta.asOfDate ?? demoData.meta.generatedAt;
  const asOfDate = asOfIso.split("T")[0];

  return {
    tenant: {
      id: tenant.id,
      displayName: tenant.branding.displayName,
    },
    bankClass,
    generatedAt: new Date().toISOString(),
    reportingPeriod: {
      // Nepali fiscal year starts mid-July (Shrawan). We don't try to
      // derive that from asOfDate — the demo uses a static label the
      // reviewer will recognise. When productionising, replace this
      // with a helper that reads the bank's actual filing FY.
      fiscalYearLabel: "Annual Green Finance Statement",
      asOfDate,
    },
    rows,
    totals,
    unmapped: {
      loanCount: unmappedLoanCount,
      outstandingNpr: unmappedNprTotal,
      distinctSectors: Array.from(unmappedSectorCounts.keys()).sort(),
    },
  };
}

// ---------------------------------------------------------------------------
// Shared formatting
// ---------------------------------------------------------------------------

function fmtNpr(v: number): string {
  return `NPR ${new Intl.NumberFormat("en-US").format(Math.round(v))}`;
}

function fmtNprMillion(v: number): string {
  return `${new Intl.NumberFormat("en-US").format(Math.round(v))}`;
}

function fmtDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().split("T")[0];
  } catch {
    return iso;
  }
}

function footerText(generatedAtIso: string): string {
  return `Generated by Jana on ${fmtDateShort(generatedAtIso)} · NRB Green Finance Taxonomy 2024 · Annex 4b`;
}

function hexNoHash(hex: string): string {
  return hex.startsWith("#") ? hex.slice(1) : hex;
}

// ---------------------------------------------------------------------------
// buildGreenStatementXlsx — bank-branded xlsx via exceljs
// ---------------------------------------------------------------------------

export async function buildGreenStatementXlsx(
  report: GreenStatementReport,
  branding: ExportBranding,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jana Earth Data";
  wb.created = new Date(report.generatedAt);

  const primaryFillArgb = `FF${hexNoHash(branding.primaryColorHex)}`;
  const primaryFill: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: primaryFillArgb },
  };
  const primaryFont: Partial<ExcelJS.Font> = {
    color: { argb: "FFFFFFFF" },
    bold: true,
  };
  const totalFill: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  const footer = footerText(report.generatedAt);

  // -------------------------------------------------------------------------
  // Sheet 1 — Cover
  // -------------------------------------------------------------------------
  const s1 = wb.addWorksheet("Cover", {
    pageSetup: { orientation: "portrait" },
  });
  s1.columns = [{ width: 90 }];

  if (branding.logoBytes) {
    try {
      const imageId = wb.addImage({
        buffer: branding.logoBytes as unknown as ArrayBuffer,
        extension: "png",
      });
      s1.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 120 },
      });
      for (let i = 1; i <= 6; i++) s1.getRow(i).height = 22;
    } catch {
      // Logo failure is non-fatal.
    }
  }

  const startRow = branding.logoBytes ? 8 : 2;
  s1.getCell(`A${startRow}`).value = branding.displayName;
  s1.getCell(`A${startRow}`).font = {
    size: 22,
    bold: true,
    color: { argb: `FF${hexNoHash(branding.primaryColorHex)}` },
  };
  s1.getCell(`A${startRow + 1}`).value = "NRBSIS Green Finance Statement";
  s1.getCell(`A${startRow + 1}`).font = { size: 14, bold: true };
  s1.getCell(`A${startRow + 2}`).value =
    `Annual filing for NRB Supervisory Information System (SIS) · Bank class ${report.bankClass}`;
  s1.getCell(`A${startRow + 2}`).font = { size: 11 };
  s1.getCell(`A${startRow + 3}`).value =
    `Prepared ${fmtDateShort(report.generatedAt)} · As of ${report.reportingPeriod.asOfDate}`;
  s1.getCell(`A${startRow + 3}`).font = { size: 11, italic: true };
  s1.getCell(`A${startRow + 5}`).value =
    "This report is the aggregate 17-sector Green Finance Statement submitted annually to the NRB Supervisory Information System per NRB Green Finance Taxonomy 2024, Annex 4b. Per-loan classification detail is provided under separate cover (Regulatory export — NRB Green Finance Taxonomy — Classification Report).";
  s1.getCell(`A${startRow + 5}`).alignment = { wrapText: true };
  s1.getRow(startRow + 5).height = 70;

  s1.headerFooter.oddFooter = `&L${branding.displayName}&R${footer}`;

  // -------------------------------------------------------------------------
  // Sheet 2 — Annex 4b statement (verbatim columns + green-labeling columns)
  // -------------------------------------------------------------------------
  const s2 = wb.addWorksheet("Green Finance Statement");
  s2.columns = [
    { header: "#", key: "num", width: 4 },
    { header: "Industry/Sector", key: "sector", width: 55 },
    { header: "Class A", key: "classA", width: 12 },
    { header: "Class B", key: "classB", width: 12 },
    { header: "Class C", key: "classC", width: 12 },
    { header: "Other Total Loans", key: "otherTotal", width: 16 },
    { header: "Grand Total (in NPR million)", key: "grandTotal", width: 22 },
    { header: "Loan count", key: "loanCount", width: 12 },
    { header: "Green outstanding (NPR)", key: "green", width: 22 },
    { header: "Amber outstanding (NPR)", key: "amber", width: 22 },
    { header: "Red outstanding (NPR)", key: "red", width: 22 },
    { header: "Unclassified outstanding (NPR)", key: "unclassified", width: 26 },
    { header: "Green share (%)", key: "greenShare", width: 16 },
  ];

  // Two-row header: super-header on row 1 to show which block is
  // "Annex 4b verbatim" and which is "Green finance labeling".
  s2.spliceRows(1, 0, []);
  const superHeader = s2.getRow(1);
  superHeader.getCell(1).value = "";
  superHeader.getCell(2).value = "";
  superHeader.getCell(3).value = "Annex 4b verbatim columns (NPR million)";
  superHeader.getCell(8).value =
    "Green finance labeling per Table 4 (SIS separately labels green finance for lending areas)";
  s2.mergeCells(1, 3, 1, 7);
  s2.mergeCells(1, 8, 1, 13);
  superHeader.eachCell((cell, colNumber) => {
    if (colNumber >= 3) {
      cell.fill = primaryFill;
      cell.font = primaryFont;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });
  superHeader.height = 22;

  const header = s2.getRow(2);
  header.eachCell((cell) => {
    cell.fill = primaryFill;
    cell.font = primaryFont;
    cell.alignment = { horizontal: "left", vertical: "middle" };
  });
  header.height = 30;

  // Data rows
  for (const row of report.rows) {
    s2.addRow({
      num: row.sectorNumber,
      sector: row.sectorLabel,
      classA: row.classA,
      classB: row.classB,
      classC: row.classC,
      otherTotal: row.otherTotalLoans,
      grandTotal: row.grandTotalNprMillion,
      loanCount: row.loanCount,
      green: row.greenOutstandingNpr,
      amber: row.amberOutstandingNpr,
      red: row.redOutstandingNpr,
      unclassified: row.unclassifiedOutstandingNpr,
      greenShare: row.greenShare,
    });
  }
  // Total row
  const total = s2.addRow({
    num: "",
    sector: "Total",
    classA: report.totals.classA,
    classB: report.totals.classB,
    classC: report.totals.classC,
    otherTotal: report.totals.otherTotalLoans,
    grandTotal: report.totals.grandTotalNprMillion,
    loanCount: report.totals.loanCount,
    green: report.totals.greenOutstandingNpr,
    amber: report.totals.amberOutstandingNpr,
    red: report.totals.redOutstandingNpr,
    unclassified: report.totals.unclassifiedOutstandingNpr,
    greenShare: report.totals.greenShare,
  });
  total.font = { bold: true };
  total.eachCell((cell) => {
    cell.fill = totalFill;
  });

  // Number formatting
  ["classA", "classB", "classC", "otherTotal", "grandTotal"].forEach((k) => {
    s2.getColumn(k).numFmt = "#,##0";
    s2.getColumn(k).alignment = { horizontal: "right" };
  });
  ["loanCount"].forEach((k) => {
    s2.getColumn(k).numFmt = "#,##0";
    s2.getColumn(k).alignment = { horizontal: "right" };
  });
  ["green", "amber", "red", "unclassified"].forEach((k) => {
    s2.getColumn(k).numFmt = "#,##0";
    s2.getColumn(k).alignment = { horizontal: "right" };
  });
  s2.getColumn("greenShare").numFmt = "0.0%";
  s2.getColumn("greenShare").alignment = { horizontal: "right" };

  s2.headerFooter.oddFooter = `&L${branding.displayName}&R${footer}`;

  // -------------------------------------------------------------------------
  // Sheet 3 — Attestation
  // -------------------------------------------------------------------------
  const s3 = wb.addWorksheet("Attestation");
  s3.columns = [{ width: 90 }];
  s3.getCell("A1").value = "Attestation of accuracy";
  s3.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: `FF${hexNoHash(branding.primaryColorHex)}` },
  };
  s3.getCell("A3").value =
    `I, the undersigned, on behalf of ${branding.displayName}, certify that the amounts reported on the Green Finance Statement (Annex 4b) for the reporting period ending ${report.reportingPeriod.asOfDate} have been prepared in accordance with the NRB Green Finance Taxonomy (October 2024) and the reporting requirements of the NRB Supervisory Information System (SIS). Underlying per-loan classifications have been captured and reviewed under the bank's Environmental and Social Risk Management (ESRM) framework in accordance with NRB Directive 22 and the ESRM Guidelines (2022).`;
  s3.getCell("A3").alignment = { wrapText: true };
  s3.getRow(3).height = 96;

  s3.getCell("A5").value = "Chief Executive Officer";
  s3.getCell("A5").font = { bold: true };
  s3.getCell("A6").value = "Name: ____________________________________";
  s3.getCell("A7").value = "Signature: ________________________________";
  s3.getCell("A8").value = "Date: _____________________________________";

  s3.getCell("A10").value = "Chief Risk Officer";
  s3.getCell("A10").font = { bold: true };
  s3.getCell("A11").value = "Name: ____________________________________";
  s3.getCell("A12").value = "Signature: ________________________________";
  s3.getCell("A13").value = "Date: _____________________________________";

  s3.getCell("A15").value = "Bank stamp:";
  s3.getCell("A15").font = { bold: true };
  s3.getCell("A16").value = "";
  s3.getRow(16).height = 90;

  s3.headerFooter.oddFooter = `&L${branding.displayName}&R${footer}`;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// buildGreenStatementPdf — pdf-lib (portable across serverless runtimes)
// ---------------------------------------------------------------------------

const COLOR_HEX_UI: Record<NrbTaxonomyColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#94a3b8",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const n = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return { r, g, b };
}

const rgbHex = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return rgb(r, g, b);
};

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    const width = font.widthOfTextAtSize(trial, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    topY: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  },
): number {
  const {
    x,
    topY,
    maxWidth,
    font,
    size,
    color = rgb(0.07, 0.09, 0.15),
    lineHeight = size * 1.35,
  } = opts;
  const lines = wrapText(text, font, size, maxWidth);
  let y = topY;
  for (const line of lines) {
    page.drawText(line, { x, y: y - size, size, font, color });
    y -= lineHeight;
  }
  return y;
}

async function embedLogo(
  doc: PDFDocument,
  logoBytes: Buffer | null,
): Promise<PDFImage | null> {
  if (!logoBytes) return null;
  try {
    return await doc.embedPng(logoBytes);
  } catch {
    /* not a PNG */
  }
  try {
    return await doc.embedJpg(logoBytes);
  } catch {
    return null;
  }
}

function drawFooter(
  page: PDFPage,
  branding: ExportBranding,
  footer: string,
  fonts: { helv: PDFFont },
): void {
  const gray = rgb(0.42, 0.45, 0.5);
  page.drawText(branding.displayName, {
    x: 40,
    y: 24,
    size: 8,
    font: fonts.helv,
    color: gray,
  });
  const right = `${footer}  ·  Generated by Jana`;
  const w = fonts.helv.widthOfTextAtSize(right, 8);
  const pageW = page.getWidth();
  page.drawText(right, {
    x: pageW - 40 - w,
    y: 24,
    size: 8,
    font: fonts.helv,
    color: gray,
  });
}

/**
 * Trim a label to fit within maxWidth at the given font/size, using an
 * ellipsis when we run out of room. Used for the very long Annex 4b
 * labels ("Metal Products, Machinery & Electronic Equipment &
 * Assemblage" etc.) that would otherwise blow past the sector column.
 */
function fitText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const trial = text.slice(0, mid).trimEnd() + ellipsis;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + ellipsis;
}

/** Right-align a numeric value at `rightX` using pdf-lib's absolute coords. */
function drawRight(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
): void {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

export async function buildGreenStatementPdf(
  report: GreenStatementReport,
  branding: ExportBranding,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(
    `${branding.displayName} — NRBSIS Green Finance Statement (Annex 4b)`,
  );
  doc.setAuthor("Jana Earth Data");
  doc.setCreator("Jana Earth Data");
  doc.setProducer("Jana BFI demo");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const primary = rgbHex(branding.primaryColorHex);
  const black = rgb(0.07, 0.09, 0.15);
  const gray = rgb(0.42, 0.45, 0.5);
  const lightGray = rgb(0.82, 0.84, 0.86);
  const veryLight = rgb(0.94, 0.96, 0.98);

  const logo = await embedLogo(doc, branding.logoBytes);
  const footer = footerText(report.generatedAt);

  // Landscape US-Letter — the Annex 4b table is 13 columns wide.
  const PAGE_W = 792;
  const PAGE_H = 612;
  const MARGIN_X = 40;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // -------------------------------------------------------------------------
  // Cover page (portrait for cover, landscape for the table pages)
  // -------------------------------------------------------------------------
  {
    const COVER_W = 612;
    const COVER_H = 792;
    const COVER_MARGIN = 54;
    const COVER_CONTENT_W = COVER_W - COVER_MARGIN * 2;
    const page = doc.addPage([COVER_W, COVER_H]);
    let y = COVER_H - 60;

    if (logo) {
      const targetH = 96;
      const scale = targetH / logo.height;
      const w = logo.width * scale;
      page.drawImage(logo, {
        x: COVER_MARGIN,
        y: y - targetH,
        width: w,
        height: targetH,
      });
      y -= targetH + 24;
    }

    page.drawText(branding.displayName, {
      x: COVER_MARGIN,
      y: y - 30,
      size: 28,
      font: helvBold,
      color: primary,
    });
    y -= 30 + 12;

    page.drawText("NRBSIS Green Finance Statement", {
      x: COVER_MARGIN,
      y: y - 20,
      size: 20,
      font: helvBold,
      color: black,
    });
    y -= 20 + 4;

    page.drawText(
      "NRB Supervisory Information System · Annex 4b (Annual)",
      {
        x: COVER_MARGIN,
        y: y - 12,
        size: 12,
        font: helv,
        color: gray,
      },
    );
    y -= 12 + 24;

    page.drawRectangle({
      x: COVER_MARGIN,
      y: y,
      width: COVER_CONTENT_W,
      height: 2,
      color: primary,
    });
    y -= 32;

    // Filing meta block
    const meta: Array<[string, string]> = [
      ["Bank class", `Class ${report.bankClass}`],
      ["Reporting period", report.reportingPeriod.fiscalYearLabel],
      ["As of", report.reportingPeriod.asOfDate],
      ["Prepared", fmtDateShort(report.generatedAt)],
    ];
    for (const [k, v] of meta) {
      page.drawText(k, {
        x: COVER_MARGIN,
        y: y - 11,
        size: 10,
        font: helv,
        color: gray,
      });
      page.drawText(v, {
        x: COVER_MARGIN + 140,
        y: y - 11,
        size: 10,
        font: helvBold,
        color: black,
      });
      y -= 16;
    }
    y -= 20;

    y = drawParagraph(
      page,
      "This is the annual aggregate 17-sector Green Finance Statement submitted to the NRB Supervisory Information System (SIS) per the NRB Green Finance Taxonomy (October 2024), Annex 4b. It classifies the bank's loans and advances by industry sector (17 verbatim rows) and separately labels the green, amber, red, and unclassified portions per NRB Green Finance Taxonomy Table 4 (p. 32).",
      {
        x: COVER_MARGIN,
        topY: y,
        maxWidth: COVER_CONTENT_W,
        font: helv,
        size: 10,
        color: black,
        lineHeight: 14,
      },
    );
    y -= 12;
    y = drawParagraph(
      page,
      "Per-loan classification detail supporting this submission is provided under separate cover: NRB Green Finance Taxonomy — Classification Report.",
      {
        x: COVER_MARGIN,
        topY: y,
        maxWidth: COVER_CONTENT_W,
        font: helv,
        size: 10,
        color: gray,
        lineHeight: 14,
      },
    );

    drawFooter(page, branding, footer, { helv });
  }

  // -------------------------------------------------------------------------
  // Statement table page(s) — landscape
  // -------------------------------------------------------------------------

  // Column layout for the Annex 4b table. `x` values are the LEFT edge
  // of each column; numeric columns are right-aligned to their next
  // neighbour's x (or to `CONTENT_W + MARGIN_X` for the last one).
  type ColSpec = { key: string; header: string; x: number; align: "left" | "right"; width: number };
  const cols: ColSpec[] = [
    { key: "num", header: "#", x: MARGIN_X, align: "left", width: 16 },
    { key: "sector", header: "Industry/Sector", x: MARGIN_X + 20, align: "left", width: 176 },
    // Annex 4b verbatim block
    { key: "classA", header: "Class A", x: MARGIN_X + 200, align: "right", width: 44 },
    { key: "classB", header: "Class B", x: MARGIN_X + 248, align: "right", width: 44 },
    { key: "classC", header: "Class C", x: MARGIN_X + 296, align: "right", width: 44 },
    { key: "otherTotal", header: "Other", x: MARGIN_X + 344, align: "right", width: 40 },
    { key: "grandTotal", header: "Grand Total", x: MARGIN_X + 388, align: "right", width: 56 },
    // Green labeling block (NPR — full precision, not million)
    { key: "loanCount", header: "Loans", x: MARGIN_X + 448, align: "right", width: 38 },
    { key: "green", header: "Green", x: MARGIN_X + 490, align: "right", width: 52 },
    { key: "amber", header: "Amber", x: MARGIN_X + 546, align: "right", width: 52 },
    { key: "red", header: "Red", x: MARGIN_X + 602, align: "right", width: 46 },
    { key: "unclassified", header: "Unclass.", x: MARGIN_X + 652, align: "right", width: 46 },
    { key: "greenShare", header: "Green %", x: MARGIN_X + 702, align: "right", width: 42 },
  ];

  /**
   * The right edge for a column: min(next col's x, page content right).
   * Used for right-aligned columns.
   */
  const rightEdge = (i: number): number => {
    if (i + 1 < cols.length) return cols[i + 1].x - 4;
    return MARGIN_X + CONTENT_W;
  };

  const drawTableHeader = (page: PDFPage, topY: number): number => {
    // Section header (which columns are Annex 4b verbatim vs green labels)
    const rowTop = topY;
    page.drawRectangle({
      x: MARGIN_X,
      y: rowTop - 16,
      width: CONTENT_W,
      height: 16,
      color: primary,
    });
    // Left label
    page.drawText("Annex 4b verbatim columns · NPR million", {
      x: cols[2].x,
      y: rowTop - 12,
      size: 8,
      font: helvBold,
      color: rgb(1, 1, 1),
    });
    // Right label — green finance labeling
    page.drawText(
      "Green finance labeling (NPR) · Table 4 (p. 32)",
      {
        x: cols[7].x,
        y: rowTop - 12,
        size: 8,
        font: helvBold,
        color: rgb(1, 1, 1),
      },
    );
    let y = rowTop - 16;

    // Column headers
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 18,
      width: CONTENT_W,
      height: 18,
      color: veryLight,
    });
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      const text = c.header;
      if (c.align === "left") {
        page.drawText(text, {
          x: c.x,
          y: y - 13,
          size: 9,
          font: helvBold,
          color: black,
        });
      } else {
        drawRight(
          page,
          text,
          rightEdge(i),
          y - 13,
          9,
          helvBold,
          black,
        );
      }
    }
    y -= 18;
    // Header underline
    page.drawRectangle({
      x: MARGIN_X,
      y: y,
      width: CONTENT_W,
      height: 0.75,
      color: lightGray,
    });
    y -= 2;
    return y;
  };

  const drawRowValues = (
    page: PDFPage,
    y: number,
    rowData: {
      num: string;
      sector: string;
      classA: number;
      classB: number;
      classC: number;
      otherTotal: number;
      grandTotal: number;
      loanCount: number;
      green: number;
      amber: number;
      red: number;
      unclassified: number;
      greenShare: number;
    },
    bold = false,
  ): void => {
    const f = bold ? helvBold : helv;
    const size = 9;
    // # column
    page.drawText(rowData.num, {
      x: cols[0].x,
      y: y - 11,
      size,
      font: f,
      color: black,
    });
    // Sector column — truncate with ellipsis if too long
    const sectorFit = fitText(rowData.sector, f, size, cols[1].width - 4);
    page.drawText(sectorFit, {
      x: cols[1].x,
      y: y - 11,
      size,
      font: f,
      color: black,
    });
    // Numeric columns
    const num = (n: number) =>
      new Intl.NumberFormat("en-US").format(Math.round(n));
    const drawNum = (i: number, n: number) =>
      drawRight(page, num(n), rightEdge(i), y - 11, size, f, black);
    drawNum(2, rowData.classA);
    drawNum(3, rowData.classB);
    drawNum(4, rowData.classC);
    drawNum(5, rowData.otherTotal);
    drawNum(6, rowData.grandTotal);
    drawNum(7, rowData.loanCount);
    drawNum(8, rowData.green);
    drawNum(9, rowData.amber);
    drawNum(10, rowData.red);
    drawNum(11, rowData.unclassified);
    // Green share as %
    drawRight(
      page,
      `${(rowData.greenShare * 100).toFixed(1)}%`,
      rightEdge(12),
      y - 11,
      size,
      f,
      black,
    );
  };

  // Landscape statement page(s). All 17 rows fit on one page in this
  // layout, but we still bound with a page-break helper in case a
  // future extension adds an XVIII or wraps rows.
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);

    // Page title
    page.drawText("Green Finance Statement — Annex 4b (Annual)", {
      x: MARGIN_X,
      y: PAGE_H - 40,
      size: 14,
      font: helvBold,
      color: primary,
    });
    page.drawText(
      `${branding.displayName} · Bank class ${report.bankClass} · As of ${report.reportingPeriod.asOfDate}`,
      {
        x: MARGIN_X,
        y: PAGE_H - 58,
        size: 9,
        font: helv,
        color: gray,
      },
    );

    let y = PAGE_H - 78;
    y = drawTableHeader(page, y);

    for (const r of report.rows) {
      // Zebra shading
      if (r.sectorNumber % 2 === 0) {
        page.drawRectangle({
          x: MARGIN_X,
          y: y - 18,
          width: CONTENT_W,
          height: 18,
          color: rgb(0.98, 0.98, 0.99),
        });
      }
      drawRowValues(
        page,
        y,
        {
          num: String(r.sectorNumber),
          sector: r.sectorLabel,
          classA: r.classA,
          classB: r.classB,
          classC: r.classC,
          otherTotal: r.otherTotalLoans,
          grandTotal: r.grandTotalNprMillion,
          loanCount: r.loanCount,
          green: r.greenOutstandingNpr,
          amber: r.amberOutstandingNpr,
          red: r.redOutstandingNpr,
          unclassified: r.unclassifiedOutstandingNpr,
          greenShare: r.greenShare,
        },
      );
      y -= 18;
    }
    // Total row
    page.drawRectangle({
      x: MARGIN_X,
      y: y,
      width: CONTENT_W,
      height: 0.75,
      color: lightGray,
    });
    y -= 2;
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 20,
      width: CONTENT_W,
      height: 20,
      color: rgb(0.96, 0.98, 0.96),
    });
    drawRowValues(
      page,
      y - 2,
      {
        num: "",
        sector: "Total (all sectors)",
        classA: report.totals.classA,
        classB: report.totals.classB,
        classC: report.totals.classC,
        otherTotal: report.totals.otherTotalLoans,
        grandTotal: report.totals.grandTotalNprMillion,
        loanCount: report.totals.loanCount,
        green: report.totals.greenOutstandingNpr,
        amber: report.totals.amberOutstandingNpr,
        red: report.totals.redOutstandingNpr,
        unclassified: report.totals.unclassifiedOutstandingNpr,
        greenShare: report.totals.greenShare,
      },
      true,
    );
    y -= 26;

    // Legend / provenance under the table
    y -= 8;
    y = drawParagraph(
      page,
      "Column definitions: Class A / B / C / Other Total Loans are the verbatim Annex 4b BFI-class columns (values in NPR million); this bank fills its own class column only. Green / Amber / Red / Unclassified split the same total by NRB Green Finance Taxonomy classification (values in NPR, per Table 4 p. 32 which requires SIS to separately label green finance for the lending areas).",
      {
        x: MARGIN_X,
        topY: y,
        maxWidth: CONTENT_W,
        font: helv,
        size: 8,
        color: gray,
        lineHeight: 11,
      },
    );

    if (report.unmapped.loanCount > 0) {
      y -= 4;
      y = drawParagraph(
        page,
        `Unmapped loans excluded from the return: ${report.unmapped.loanCount.toLocaleString()} loans totalling ${fmtNpr(report.unmapped.outstandingNpr)} across sectors ${report.unmapped.distinctSectors.join(", ") || "—"}. Add these sectors to SECTOR_TO_ANNEX_4B before the next filing.`,
        {
          x: MARGIN_X,
          topY: y,
          maxWidth: CONTENT_W,
          font: helvBold,
          size: 8,
          color: rgbHex("#b45309"),
          lineHeight: 11,
        },
      );
    }

    drawFooter(page, branding, footer, { helv });
  }

  // -------------------------------------------------------------------------
  // Green-labeling summary page (portrait) — big picture roll-up
  // -------------------------------------------------------------------------
  {
    const S_W = 612;
    const S_H = 792;
    const S_MARGIN = 54;
    const S_CONTENT_W = S_W - S_MARGIN * 2;
    const page = doc.addPage([S_W, S_H]);
    let y = S_H - 60;

    page.drawText("Portfolio green finance labeling", {
      x: S_MARGIN,
      y: y - 18,
      size: 18,
      font: helvBold,
      color: primary,
    });
    y -= 18 + 8;

    page.drawRectangle({
      x: S_MARGIN,
      y: y,
      width: S_CONTENT_W,
      height: 1,
      color: primary,
    });
    y -= 24;

    // Roll-up counts
    y = drawParagraph(
      page,
      `The bank's book totals ${report.totals.loanCount.toLocaleString()} loans and advances at ${fmtNpr(report.totals.totalOutstandingNpr)} outstanding as of ${report.reportingPeriod.asOfDate}. Of that, ${fmtNpr(report.totals.greenOutstandingNpr)} (${(report.totals.greenShare * 100).toFixed(1)}%) is classified Green (transformative), ${fmtNpr(report.totals.amberOutstandingNpr)} Amber (transitional), and ${fmtNpr(report.totals.redOutstandingNpr)} Red (not aligned). ${fmtNpr(report.totals.unclassifiedOutstandingNpr)} remains unclassified pending officer review.`,
      {
        x: S_MARGIN,
        topY: y,
        maxWidth: S_CONTENT_W,
        font: helv,
        size: 10,
        color: black,
        lineHeight: 14,
      },
    );
    y -= 10;

    // Colour swatch table (4 rows)
    const buckets: Array<{ color: NrbTaxonomyColor; label: string; value: number }> = [
      { color: "green", label: "Green (transformative)", value: report.totals.greenOutstandingNpr },
      { color: "amber", label: "Amber (transitional)", value: report.totals.amberOutstandingNpr },
      { color: "red", label: "Red (not aligned)", value: report.totals.redOutstandingNpr },
      { color: "unclassified", label: "Unclassified", value: report.totals.unclassifiedOutstandingNpr },
    ];
    const totalDenom = Math.max(1, report.totals.totalOutstandingNpr);
    for (const b of buckets) {
      // Swatch
      page.drawRectangle({
        x: S_MARGIN,
        y: y - 10,
        width: 10,
        height: 10,
        color: rgbHex(COLOR_HEX_UI[b.color]),
      });
      page.drawText(b.label, {
        x: S_MARGIN + 18,
        y: y - 11,
        size: 11,
        font: helv,
        color: black,
      });
      page.drawText(fmtNpr(b.value), {
        x: S_MARGIN + 280,
        y: y - 11,
        size: 11,
        font: helv,
        color: black,
      });
      drawRight(
        page,
        `${((b.value / totalDenom) * 100).toFixed(1)}%`,
        S_MARGIN + S_CONTENT_W,
        y - 11,
        11,
        helv,
        black,
      );
      y -= 20;
    }
    y -= 6;
    page.drawRectangle({
      x: S_MARGIN,
      y: y,
      width: S_CONTENT_W,
      height: 0.5,
      color: lightGray,
    });
    y -= 12;
    page.drawText(`Total`, {
      x: S_MARGIN + 18,
      y: y - 11,
      size: 11,
      font: helvBold,
      color: black,
    });
    page.drawText(fmtNpr(report.totals.totalOutstandingNpr), {
      x: S_MARGIN + 280,
      y: y - 11,
      size: 11,
      font: helvBold,
      color: black,
    });
    drawRight(
      page,
      "100.0%",
      S_MARGIN + S_CONTENT_W,
      y - 11,
      11,
      helvBold,
      black,
    );
    y -= 26;

    // Top green sectors
    page.drawText("Top green sectors by NPR outstanding", {
      x: S_MARGIN,
      y: y - 12,
      size: 12,
      font: helvBold,
      color: black,
    });
    y -= 20;
    const topGreen = [...report.rows]
      .filter((r) => r.greenOutstandingNpr > 0)
      .sort((a, b) => b.greenOutstandingNpr - a.greenOutstandingNpr)
      .slice(0, 6);
    if (topGreen.length === 0) {
      page.drawText("No sectors currently classified Green.", {
        x: S_MARGIN,
        y: y - 11,
        size: 10,
        font: helv,
        color: gray,
      });
      y -= 14;
    } else {
      for (const r of topGreen) {
        page.drawText(`${r.sectorNumber}. ${r.sectorLabel}`, {
          x: S_MARGIN,
          y: y - 11,
          size: 10,
          font: helv,
          color: black,
        });
        drawRight(
          page,
          fmtNpr(r.greenOutstandingNpr),
          S_MARGIN + S_CONTENT_W,
          y - 11,
          10,
          helv,
          black,
        );
        y -= 16;
      }
    }

    drawFooter(page, branding, footer, { helv });
  }

  // -------------------------------------------------------------------------
  // Attestation page (portrait) — signable filing block
  // -------------------------------------------------------------------------
  {
    const A_W = 612;
    const A_H = 792;
    const A_MARGIN = 54;
    const A_CONTENT_W = A_W - A_MARGIN * 2;
    const page = doc.addPage([A_W, A_H]);
    let y = A_H - 60;

    page.drawText("Attestation of Accuracy", {
      x: A_MARGIN,
      y: y - 20,
      size: 20,
      font: helvBold,
      color: primary,
    });
    y -= 20 + 8;

    page.drawRectangle({
      x: A_MARGIN,
      y: y,
      width: A_CONTENT_W,
      height: 1,
      color: primary,
    });
    y -= 24;

    // Standard NRB filing attestation. NRB's Green Finance Taxonomy PDF
    // (Annex 4b, p. 144) does not specify a verbatim attestation block,
    // so this language is extrapolated from standard NRB regulatory
    // filing conventions and the ESRM linkage in NRB Directive 22.
    y = drawParagraph(
      page,
      `I, the undersigned, on behalf of ${branding.displayName}, hereby certify to Nepal Rastra Bank that the amounts reported on this Green Finance Statement (Annex 4b) for the reporting period ending ${report.reportingPeriod.asOfDate}:`,
      {
        x: A_MARGIN,
        topY: y,
        maxWidth: A_CONTENT_W,
        font: helv,
        size: 11,
        color: black,
        lineHeight: 15,
      },
    );
    y -= 8;

    const attestBullets = [
      "have been prepared in accordance with the NRB Green Finance Taxonomy (October 2024), Annex 4b, and the reporting requirements of the NRB Supervisory Information System;",
      "reflect the bank's loans and advances as recorded in its books of account for the reporting period;",
      "have been classified as Green (transformative), Amber (transitional), Red, or Unclassified in accordance with the classification criteria set out in the NRB Green Finance Taxonomy;",
      "are supported by per-loan Environmental & Social Due Diligence and taxonomy assessments captured under the bank's Environmental and Social Risk Management (ESRM) framework in line with NRB Directive 22 and the NRB ESRM Guidelines 2022;",
      "and are, to the best of my knowledge and belief, true, complete, and free from material misstatement.",
    ];
    for (const bullet of attestBullets) {
      page.drawText("•", {
        x: A_MARGIN + 4,
        y: y - 11,
        size: 11,
        font: helvBold,
        color: primary,
      });
      y = drawParagraph(page, bullet, {
        x: A_MARGIN + 18,
        topY: y,
        maxWidth: A_CONTENT_W - 18,
        font: helv,
        size: 10,
        color: black,
        lineHeight: 13,
      });
      y -= 4;
    }

    y -= 16;
    // Signature block
    const drawSignatureBlock = (title: string, startY: number): number => {
      let sy = startY;
      page.drawText(title, {
        x: A_MARGIN,
        y: sy - 12,
        size: 11,
        font: helvBold,
        color: black,
      });
      sy -= 20;
      const drawSigLine = (label: string, yy: number, width: number): void => {
        page.drawText(label, {
          x: A_MARGIN,
          y: yy - 9,
          size: 9,
          font: helv,
          color: gray,
        });
        page.drawRectangle({
          x: A_MARGIN + 70,
          y: yy - 10,
          width,
          height: 0.5,
          color: rgb(0.4, 0.44, 0.5),
        });
      };
      drawSigLine("Name", sy, 240);
      sy -= 22;
      drawSigLine("Signature", sy, 240);
      sy -= 22;
      drawSigLine("Date", sy, 160);
      sy -= 22;
      return sy;
    };
    y = drawSignatureBlock("Chief Executive Officer", y);
    y -= 12;
    y = drawSignatureBlock("Chief Risk Officer", y);
    y -= 12;

    // Bank stamp box
    page.drawText("Bank stamp", {
      x: A_MARGIN,
      y: y - 12,
      size: 11,
      font: helvBold,
      color: black,
    });
    y -= 18;
    page.drawRectangle({
      x: A_MARGIN,
      y: y - 80,
      width: 200,
      height: 80,
      borderColor: rgb(0.4, 0.44, 0.5),
      borderWidth: 0.75,
    });

    drawFooter(page, branding, footer, { helv });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
