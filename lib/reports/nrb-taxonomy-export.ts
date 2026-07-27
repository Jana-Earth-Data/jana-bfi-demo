/**
 * NRB Green Finance Taxonomy — export builders.
 *
 * Pure builders separated from the route handler so the same shape can be
 * emitted in three formats (JSON / xlsx / PDF) without any framework
 * coupling. All three formats are anchored on the same TaxonomyReport
 * structure returned by buildTaxonomyReport().
 *
 *   buildTaxonomyReport(...)   → assembles the report shape from
 *                                Supabase rows + demo portfolio data.
 *   buildTaxonomyXlsx(...)     → xlsx Buffer (bank-branded) via exceljs.
 *   buildTaxonomyPdf(...)      → PDF Buffer (bank-branded) via pdfkit.
 *
 * Bank branding is passed in explicitly (as a plain object) so the
 * builders remain pure and unit-testable. The route reads the tenant
 * cookie and resolves branding once, then hands it off.
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
import type { BfiDemoData, NrbTaxonomyColor } from "@/lib/types/bfi";
import type { TenantConfig } from "@/lib/tenants";
import { findActivityById } from "@/lib/regulatory/taxonomy/activities";

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

export type TaxonomyReportBucket = {
  count: number;
  nprTotal: number;
};

export type TaxonomyReportLoan = {
  loanId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  activityId: string | null;
  activityName: string | null;
  color: NrbTaxonomyColor;
  rationale: string;
  citation: string;
  capturedAt: string | null;
  dnshFailures: string[];
};

/**
 * Portfolio scope hierarchy shown at the top of the summary page so the
 * reader understands what the classification totals cover. NRB Green
 * Finance Taxonomy applies to SME + commercial + corporate loans;
 * retail (personal / mortgage / education / vehicle) sits out of scope.
 */
export type PortfolioScope = {
  totalLoans: number;
  totalOutstandingNpr: number;
  retailLoans: number;
  retailOutstandingNpr: number;
  inScopeLoans: number;
  inScopeOutstandingNpr: number;
  classifiedLoans: number;
  classifiedOutstandingNpr: number;
};

export type TaxonomyReport = {
  tenant: {
    id: string;
    displayName: string;
  };
  generatedAt: string;
  scope: PortfolioScope;
  portfolio: Record<NrbTaxonomyColor, TaxonomyReportBucket>;
  loans: TaxonomyReportLoan[];
};

/** Row shape as returned by the /bfi_taxonomy_assessments Supabase select. */
export type TaxonomyAssessmentRow = {
  loan_id: string;
  activity_id: string | null;
  computed_color: string | null;
  computed_rationale: string | null;
  citation: string | null;
  captured_at: string | null;
  criterion_answers: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Branding descriptor (subset of TenantConfig + resolved logo bytes)
// ---------------------------------------------------------------------------

export type ExportBranding = {
  displayName: string;
  shortName: string;
  primaryColorHex: string;
  accentColorHex: string;
  /** Bytes of the logo file, when the tenant has one on disk. */
  logoBytes: Buffer | null;
};

export function brandingFromTenant(
  tenant: TenantConfig,
  logoBytes: Buffer | null,
): ExportBranding {
  return {
    displayName: tenant.branding.displayName,
    shortName: tenant.branding.shortName,
    primaryColorHex: tenant.branding.primaryColorHex,
    accentColorHex: tenant.branding.accentColorHex,
    logoBytes,
  };
}

// ---------------------------------------------------------------------------
// buildTaxonomyReport — pure assembly of the JSON shape
// ---------------------------------------------------------------------------

const COLORS: NrbTaxonomyColor[] = ["green", "amber", "red", "unclassified"];

function emptyBuckets(): Record<NrbTaxonomyColor, TaxonomyReportBucket> {
  return {
    green: { count: 0, nprTotal: 0 },
    amber: { count: 0, nprTotal: 0 },
    red: { count: 0, nprTotal: 0 },
    unclassified: { count: 0, nprTotal: 0 },
  };
}

function normaliseColor(raw: string | null | undefined): NrbTaxonomyColor {
  if (raw === "green" || raw === "amber" || raw === "red") return raw;
  return "unclassified";
}

/** Extract activity-level DNSH failure list from a raw criterion_answers blob. */
function extractDnshFailures(
  activityId: string | null,
  criterionAnswers: Record<string, unknown> | null,
): string[] {
  if (!activityId || !criterionAnswers) return [];
  const activity = findActivityById(activityId);
  if (!activity) return [];
  try {
    const derivation = activity.classify(criterionAnswers);
    return derivation.dnshFailures ?? [];
  } catch {
    return [];
  }
}

/**
 * Build the report shape from:
 *   - `tenant`      : resolved current tenant
 *   - `demoData`    : the portfolio (loans + borrowers) — source of truth for
 *                     borrower names, sectors, and outstanding balances
 *   - `assessments` : latest-per-loan rows from bfi_taxonomy_assessments
 *                     (already filtered by bank_id and reduced to latest)
 */
export function buildTaxonomyReport(
  tenant: Pick<TenantConfig, "id" | "branding">,
  demoData: BfiDemoData,
  assessments: TaxonomyAssessmentRow[],
): TaxonomyReport {
  // Latest per loan (input is expected to already be sorted desc by
  // captured_at; we tolerate duplicates and keep only the first sighting).
  const latestByLoan = new Map<string, TaxonomyAssessmentRow>();
  for (const row of assessments) {
    if (!row.loan_id) continue;
    if (latestByLoan.has(row.loan_id)) continue;
    latestByLoan.set(row.loan_id, row);
  }

  const borrowerById = new Map(demoData.borrowers.map((b) => [b.id, b]));
  const loanById = new Map(demoData.loans.map((l) => [l.id, l]));

  const loans: TaxonomyReportLoan[] = [];
  const portfolio = emptyBuckets();

  // Pass 1: loans WITH a saved taxonomy assessment. These carry rich
  // rationale + citation + DNSH detail from what the officer captured.
  const assessedLoanIds = new Set<string>();
  for (const [loanId, row] of latestByLoan) {
    const loan = loanById.get(loanId);
    if (!loan) continue; // orphaned assessment — skip
    const borrower = borrowerById.get(loan.borrowerId);
    const activity = row.activity_id ? findActivityById(row.activity_id) : null;
    const color = normaliseColor(row.computed_color);
    loans.push({
      loanId,
      borrowerName: borrower?.name ?? "(unknown borrower)",
      sector: borrower?.nrbSector ?? "",
      outstandingNpr: loan.outstandingNpr,
      activityId: row.activity_id,
      activityName: activity?.name ?? null,
      color,
      rationale: row.computed_rationale ?? "",
      citation: row.citation ?? "",
      capturedAt: row.captured_at,
      dnshFailures: extractDnshFailures(row.activity_id, row.criterion_answers),
    });
    portfolio[color].count += 1;
    portfolio[color].nprTotal += loan.outstandingNpr;
    assessedLoanIds.add(loanId);
  }

  // Pass 2: every OTHER in-scope loan in the portfolio contributes to
  // the Unclassified bucket in the SUMMARY totals. The NSRS annual
  // filing covers the full commercial + SME + corporate book, not
  // just the loans currently under review — retail loans (personal,
  // mortgage, education, vehicle) are the only category legitimately
  // out of scope for the taxonomy.
  //
  // These loans do NOT get added to the per-loan detail list — a
  // typical bank has tens of thousands of in-scope loans and the PDF
  // detail pages would balloon into thousands of rows. Detail rows
  // remain reserved for loans with saved officer assessments (the
  // captured slice). The summary counts show how much of the book
  // has been captured versus how much is still pending.
  const scope: PortfolioScope = {
    totalLoans: 0,
    totalOutstandingNpr: 0,
    retailLoans: 0,
    retailOutstandingNpr: 0,
    inScopeLoans: 0,
    inScopeOutstandingNpr: 0,
    classifiedLoans: 0,
    classifiedOutstandingNpr: 0,
  };
  for (const loan of demoData.loans) {
    scope.totalLoans += 1;
    scope.totalOutstandingNpr += loan.outstandingNpr;
    const isRetail = loan.category?.startsWith("retail-") ?? false;
    if (isRetail) {
      scope.retailLoans += 1;
      scope.retailOutstandingNpr += loan.outstandingNpr;
      continue;
    }
    scope.inScopeLoans += 1;
    scope.inScopeOutstandingNpr += loan.outstandingNpr;
    if (assessedLoanIds.has(loan.id)) {
      scope.classifiedLoans += 1;
      scope.classifiedOutstandingNpr += loan.outstandingNpr;
    } else {
      portfolio.unclassified.count += 1;
      portfolio.unclassified.nprTotal += loan.outstandingNpr;
    }
  }

  // Stable ordering: green first, then amber, red, unclassified; within a
  // bucket, largest exposure first.
  const colorRank: Record<NrbTaxonomyColor, number> = {
    green: 0,
    amber: 1,
    red: 2,
    unclassified: 3,
  };
  loans.sort((a, b) => {
    const c = colorRank[a.color] - colorRank[b.color];
    if (c !== 0) return c;
    return b.outstandingNpr - a.outstandingNpr;
  });

  return {
    tenant: {
      id: tenant.id,
      displayName: tenant.branding.displayName,
    },
    generatedAt: new Date().toISOString(),
    scope,
    portfolio,
    loans,
  };
}

// ---------------------------------------------------------------------------
// Shared formatting
// ---------------------------------------------------------------------------

function fmtNpr(v: number): string {
  return `NPR ${new Intl.NumberFormat("en-US").format(Math.round(v))}`;
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
  return `Generated by Jana on ${fmtDateShort(generatedAtIso)} · NRB Green Finance Taxonomy (October 2024)`;
}

function hexNoHash(hex: string): string {
  return hex.startsWith("#") ? hex.slice(1) : hex;
}

// ---------------------------------------------------------------------------
// buildTaxonomyXlsx
// ---------------------------------------------------------------------------

export async function buildTaxonomyXlsx(
  report: TaxonomyReport,
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
  const footer = footerText(report.generatedAt);

  // -------------------------------------------------------------------------
  // Sheet 1 — Title
  // -------------------------------------------------------------------------
  const s1 = wb.addWorksheet("Title", {
    pageSetup: { orientation: "portrait" },
  });
  s1.columns = [{ width: 90 }];

  // Optional embedded logo (top-left) — exceljs can add image from buffer.
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
      // Reserve vertical space for the image
      for (let i = 1; i <= 6; i++) s1.getRow(i).height = 22;
    } catch {
      // Logo failure is non-fatal — the sheet still renders with text.
    }
  }

  const startRow = branding.logoBytes ? 8 : 2;
  s1.getCell(`A${startRow}`).value = branding.displayName;
  s1.getCell(`A${startRow}`).font = {
    size: 22,
    bold: true,
    color: { argb: `FF${hexNoHash(branding.primaryColorHex)}` },
  };
  s1.getCell(`A${startRow + 1}`).value = "NRB Green Finance Taxonomy — Classification Report";
  s1.getCell(`A${startRow + 1}`).font = { size: 14, bold: true };
  s1.getCell(`A${startRow + 2}`).value = `Generated ${fmtDateShort(report.generatedAt)}`;
  s1.getCell(`A${startRow + 2}`).font = { size: 11, italic: true };
  s1.getCell(`A${startRow + 4}`).value =
    "This report classifies every assessed loan in the portfolio against the NRB Green Finance Taxonomy (October 2024). It is intended for submission as part of the bank's regulatory filing with Nepal Rastra Bank.";
  s1.getCell(`A${startRow + 4}`).alignment = { wrapText: true };
  s1.getRow(startRow + 4).height = 60;

  // Footer as page footer + last-row echo
  s1.headerFooter.oddFooter = `&L${branding.displayName}&R${footer}`;
  s1.getCell(`A${startRow + 8}`).value = footer;
  s1.getCell(`A${startRow + 8}`).font = { size: 9, italic: true, color: { argb: "FF888888" } };

  // -------------------------------------------------------------------------
  // Sheet 2 — Portfolio summary
  // -------------------------------------------------------------------------
  const s2 = wb.addWorksheet("Portfolio summary");
  s2.columns = [
    { header: "Bucket", key: "bucket", width: 44 },
    { header: "Loan count", key: "count", width: 14 },
    { header: "Outstanding (NPR)", key: "npr", width: 24 },
    { header: "Share of in-scope exposure", key: "share", width: 26 },
  ];

  // Portfolio scope hierarchy at the top so the reader understands what
  // the classification bucket totals below are covering. NRB Green
  // Finance Taxonomy applies to SME + commercial + corporate loans;
  // retail sits out of scope.
  const sc = report.scope;
  s2.addRow({ bucket: "Total loans in the book", count: sc.totalLoans, npr: sc.totalOutstandingNpr, share: null });
  s2.addRow({ bucket: "  Out of scope — retail", count: sc.retailLoans, npr: sc.retailOutstandingNpr, share: null });
  s2.addRow({ bucket: "  In scope — SME, commercial, corporate", count: sc.inScopeLoans, npr: sc.inScopeOutstandingNpr, share: null });
  s2.addRow({ bucket: "    Classified in this report", count: sc.classifiedLoans, npr: sc.classifiedOutstandingNpr, share: null });
  s2.addRow({ bucket: "    Not yet classified", count: sc.inScopeLoans - sc.classifiedLoans, npr: sc.inScopeOutstandingNpr - sc.classifiedOutstandingNpr, share: null });
  s2.addRow({});

  s2.addRow({ bucket: "Classification breakdown (in-scope loans)", count: null, npr: null, share: null });

  const totalNpr = COLORS.reduce((accum, c) => accum + report.portfolio[c].nprTotal, 0);
  for (const c of COLORS) {
    const b = report.portfolio[c];
    s2.addRow({
      bucket: c.charAt(0).toUpperCase() + c.slice(1),
      count: b.count,
      npr: b.nprTotal,
      share: totalNpr > 0 ? b.nprTotal / totalNpr : 0,
    });
  }
  s2.addRow({
    bucket: "Total (in-scope)",
    count: COLORS.reduce((accum, c) => accum + report.portfolio[c].count, 0),
    npr: totalNpr,
    share: totalNpr > 0 ? 1 : 0,
  });

  s2.getRow(1).eachCell((cell) => {
    cell.fill = primaryFill;
    cell.font = primaryFont;
    cell.alignment = { horizontal: "left" };
  });
  s2.getColumn("npr").numFmt = "#,##0";
  s2.getColumn("share").numFmt = "0.0%";
  s2.getRow(s2.rowCount).font = { bold: true };

  s2.headerFooter.oddFooter = `&L${branding.displayName}&R${footer}`;

  // -------------------------------------------------------------------------
  // Sheet 3 — Per-loan detail
  // -------------------------------------------------------------------------
  const s3 = wb.addWorksheet("Per-loan detail");
  s3.columns = [
    { header: "Loan ID", key: "loanId", width: 18 },
    { header: "Borrower", key: "borrower", width: 32 },
    { header: "Sector", key: "sector", width: 22 },
    { header: "Outstanding (NPR)", key: "npr", width: 20 },
    { header: "Activity", key: "activity", width: 40 },
    { header: "Color", key: "color", width: 14 },
    { header: "Rationale", key: "rationale", width: 60 },
    { header: "Citation", key: "citation", width: 40 },
    { header: "Captured at", key: "captured", width: 22 },
    { header: "DNSH failures", key: "dnsh", width: 40 },
  ];
  s3.getRow(1).eachCell((cell) => {
    cell.fill = primaryFill;
    cell.font = primaryFont;
    cell.alignment = { horizontal: "left" };
  });

  for (const loan of report.loans) {
    s3.addRow({
      loanId: loan.loanId,
      borrower: loan.borrowerName,
      sector: loan.sector,
      npr: loan.outstandingNpr,
      activity: loan.activityName ?? loan.activityId ?? "",
      color: loan.color,
      rationale: loan.rationale,
      citation: loan.citation,
      captured: loan.capturedAt ? fmtDateShort(loan.capturedAt) : "",
      dnsh: loan.dnshFailures.join("; "),
    });
  }
  s3.getColumn("npr").numFmt = "#,##0";
  s3.getColumn("rationale").alignment = { wrapText: true, vertical: "top" };
  s3.getColumn("dnsh").alignment = { wrapText: true, vertical: "top" };

  s3.headerFooter.oddFooter = `&L${branding.displayName}&R${footer}`;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}


// ---------------------------------------------------------------------------
// buildTaxonomyPdf — pdf-lib implementation (portable across serverless
// runtimes; no runtime file lookups for fonts).
// ---------------------------------------------------------------------------

const COLOR_HEX_UI: Record<NrbTaxonomyColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#94a3b8",
};

// ---- Small pure helpers -----------------------------------------------------

/** Parse a #RRGGBB hex into pdf-lib's rgb() (0-1 floats). */
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

/** Split text into lines that fit `maxWidth` at the given font+size. */
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

/**
 * Draw a wrapped-text block, top-aligned at (x, topY). Returns the y
 * coordinate just BELOW the last line drawn (in pdf-lib's coordinate
 * system where y decreases downward on the page).
 */
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
  // Try PNG first (Laxmi's logo), then JPG. If neither, skip.
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
    x: 54,
    y: 30,
    size: 8,
    font: fonts.helv,
    color: gray,
  });
  const right = `${footer}  ·  Generated by Jana`;
  const w = fonts.helv.widthOfTextAtSize(right, 8);
  page.drawText(right, {
    x: 558 - w,
    y: 30,
    size: 8,
    font: fonts.helv,
    color: gray,
  });
}

// ---- Main builder -----------------------------------------------------------

export async function buildTaxonomyPdf(
  report: TaxonomyReport,
  branding: ExportBranding,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(
    `${branding.displayName} — NRB Green Finance Taxonomy Classification Report`,
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

  const logo = await embedLogo(doc, branding.logoBytes);
  const footer = footerText(report.generatedAt);

  // Page dimensions — US Letter.
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_X = 54;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // -------------------------------------------------------------------------
  // Cover page
  // -------------------------------------------------------------------------
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let cursorY = PAGE_H - 60;

    if (logo) {
      const targetH = 96;
      const scale = targetH / logo.height;
      const w = logo.width * scale;
      page.drawImage(logo, {
        x: MARGIN_X,
        y: cursorY - targetH,
        width: w,
        height: targetH,
      });
      cursorY -= targetH + 24;
    }

    page.drawText(branding.displayName, {
      x: MARGIN_X,
      y: cursorY - 30,
      size: 28,
      font: helvBold,
      color: primary,
    });
    cursorY -= 30 + 12;

    page.drawText("NRB Green Finance Taxonomy", {
      x: MARGIN_X,
      y: cursorY - 18,
      size: 18,
      font: helvBold,
      color: black,
    });
    cursorY -= 18 + 4;

    page.drawText("Classification Report", {
      x: MARGIN_X,
      y: cursorY - 14,
      size: 14,
      font: helv,
      color: gray,
    });
    cursorY -= 14 + 24;

    // Primary color divider
    page.drawRectangle({
      x: MARGIN_X,
      y: cursorY,
      width: CONTENT_W,
      height: 2,
      color: primary,
    });
    cursorY -= 32;

    page.drawText(`Generated ${fmtDateShort(report.generatedAt)}`, {
      x: MARGIN_X,
      y: cursorY - 11,
      size: 11,
      font: helv,
      color: black,
    });
    cursorY -= 11 + 4;
    page.drawText(
      `Tenant: ${branding.displayName}${branding.shortName ? ` (${branding.shortName})` : ""}`,
      {
        x: MARGIN_X,
        y: cursorY - 11,
        size: 11,
        font: helv,
        color: black,
      },
    );
    cursorY -= 11 + 24;

    cursorY = drawParagraph(
      page,
      "This report classifies every assessed loan in the portfolio against the NRB Green Finance Taxonomy (October 2024). It is intended for submission as part of the bank's regulatory filing with Nepal Rastra Bank.",
      {
        x: MARGIN_X,
        topY: cursorY,
        maxWidth: CONTENT_W,
        font: helv,
        size: 10,
        color: gray,
        lineHeight: 14,
      },
    );

    drawFooter(page, branding, footer, { helv });
  }

  // -------------------------------------------------------------------------
  // Portfolio summary page
  // -------------------------------------------------------------------------
  {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - 60;

    page.drawText("Portfolio summary", {
      x: MARGIN_X,
      y: y - 18,
      size: 18,
      font: helvBold,
      color: primary,
    });
    y -= 18 + 8;

    page.drawRectangle({
      x: MARGIN_X,
      y: y,
      width: CONTENT_W,
      height: 1,
      color: primary,
    });
    y -= 24;

    // Portfolio-at-a-glance scope hierarchy. Establishes what the
    // classification totals below are covering. NRB Green Finance
    // Taxonomy applies to SME + commercial + corporate loans; retail
    // sits out of scope per NRB Oct 2024.
    const s = report.scope;
    page.drawText("Portfolio at a glance", {
      x: MARGIN_X,
      y: y - 12,
      size: 12,
      font: helvBold,
      color: black,
    });
    y -= 18;

    const scopeRows: Array<{ label: string; count: number; npr: number; hint?: string }> = [
      {
        label: "Total loans in the book",
        count: s.totalLoans,
        npr: s.totalOutstandingNpr,
      },
      {
        label: "Out of scope — retail (personal, mortgage, education, vehicle)",
        count: s.retailLoans,
        npr: s.retailOutstandingNpr,
        hint: "Not subject to NRB Green Finance Taxonomy",
      },
      {
        label: "In scope — SME, commercial, corporate",
        count: s.inScopeLoans,
        npr: s.inScopeOutstandingNpr,
        hint: "Subject to NRB Green Finance Taxonomy classification",
      },
      {
        label: "  · Classified in this report",
        count: s.classifiedLoans,
        npr: s.classifiedOutstandingNpr,
      },
      {
        label: "  · Not yet classified",
        count: s.inScopeLoans - s.classifiedLoans,
        npr: s.inScopeOutstandingNpr - s.classifiedOutstandingNpr,
      },
    ];
    const scopeCol = { label: MARGIN_X, count: 340, npr: 420 };
    for (const row of scopeRows) {
      page.drawText(row.label, {
        x: scopeCol.label,
        y: y - 10,
        size: 10,
        font: helv,
        color: black,
      });
      page.drawText(row.count.toLocaleString(), {
        x: scopeCol.count,
        y: y - 10,
        size: 10,
        font: helv,
        color: black,
      });
      page.drawText(fmtNpr(row.npr), {
        x: scopeCol.npr,
        y: y - 10,
        size: 10,
        font: helv,
        color: black,
      });
      y -= 14;
      if (row.hint) {
        page.drawText(row.hint, {
          x: scopeCol.label + 14,
          y: y - 8,
          size: 8,
          font: helv,
          color: gray,
        });
        y -= 12;
      }
    }
    y -= 8;

    page.drawRectangle({
      x: MARGIN_X,
      y: y,
      width: CONTENT_W,
      height: 0.5,
      color: lightGray,
    });
    y -= 20;

    page.drawText("Classification breakdown (in-scope loans)", {
      x: MARGIN_X,
      y: y - 12,
      size: 12,
      font: helvBold,
      color: black,
    });
    y -= 22;

    const totalNpr = COLORS.reduce(
      (accum, c) => accum + report.portfolio[c].nprTotal,
      0,
    );

    // Table header
    const colX = { bucket: MARGIN_X, count: 200, npr: 300, share: 460 };
    page.drawText("Bucket", {
      x: colX.bucket,
      y: y - 11,
      size: 11,
      font: helvBold,
      color: black,
    });
    page.drawText("Loan count", {
      x: colX.count,
      y: y - 11,
      size: 11,
      font: helvBold,
      color: black,
    });
    page.drawText("Outstanding (NPR)", {
      x: colX.npr,
      y: y - 11,
      size: 11,
      font: helvBold,
      color: black,
    });
    page.drawText("Share", {
      x: colX.share,
      y: y - 11,
      size: 11,
      font: helvBold,
      color: black,
    });
    y -= 16;

    page.drawRectangle({
      x: MARGIN_X,
      y: y,
      width: CONTENT_W,
      height: 0.5,
      color: lightGray,
    });
    y -= 12;

    for (const c of COLORS) {
      const b = report.portfolio[c];
      // Color swatch
      page.drawRectangle({
        x: colX.bucket,
        y: y - 8,
        width: 8,
        height: 8,
        color: rgbHex(COLOR_HEX_UI[c]),
      });
      page.drawText(c.charAt(0).toUpperCase() + c.slice(1), {
        x: colX.bucket + 14,
        y: y - 11,
        size: 11,
        font: helv,
        color: black,
      });
      page.drawText(b.count.toLocaleString(), {
        x: colX.count,
        y: y - 11,
        size: 11,
        font: helv,
        color: black,
      });
      page.drawText(fmtNpr(b.nprTotal), {
        x: colX.npr,
        y: y - 11,
        size: 11,
        font: helv,
        color: black,
      });
      const shareTxt =
        totalNpr > 0 ? `${((b.nprTotal / totalNpr) * 100).toFixed(1)}%` : "—";
      page.drawText(shareTxt, {
        x: colX.share,
        y: y - 11,
        size: 11,
        font: helv,
        color: black,
      });
      y -= 22;
    }

    page.drawRectangle({
      x: MARGIN_X,
      y: y,
      width: CONTENT_W,
      height: 0.5,
      color: lightGray,
    });
    y -= 16;
    page.drawText(
      `Total: ${report.loans.length.toLocaleString()} classified loans · ${fmtNpr(totalNpr)}`,
      {
        x: MARGIN_X,
        y: y - 11,
        size: 11,
        font: helvBold,
        color: black,
      },
    );

    drawFooter(page, branding, footer, { helv });
  }

  // -------------------------------------------------------------------------
  // Per-loan detail pages — grouped by color
  // -------------------------------------------------------------------------
  {
    // Layout tuning — text-heavy rows so we page-break aggressively.
    const ROW_MIN_HEIGHT = 60;
    const BOTTOM_MARGIN = 80; // leave room for footer

    // State kept in an object so mutations from newPage() are visible to
    // TypeScript's control-flow analysis in the caller (a plain closure
    // capture of `let page` narrows to `never` after the assignment).
    const s: { page: PDFPage; y: number } = {
      page: doc.addPage([PAGE_W, PAGE_H]),
      y: PAGE_H,
    };

    const newPage = (title: string) => {
      s.page = doc.addPage([PAGE_W, PAGE_H]);
      s.y = PAGE_H - 60;
      s.page.drawText(title, {
        x: MARGIN_X,
        y: s.y - 18,
        size: 18,
        font: helvBold,
        color: primary,
      });
      s.y -= 18 + 8;
      s.page.drawRectangle({
        x: MARGIN_X,
        y: s.y,
        width: CONTENT_W,
        height: 1,
        color: primary,
      });
      s.y -= 22;
      drawFooter(s.page, branding, footer, { helv });
    };

    const ensureRoom = (needed: number, title: string) => {
      if (s.y - needed < BOTTOM_MARGIN) newPage(title);
    };

    let currentColor: NrbTaxonomyColor | null = null;
    for (const loan of report.loans) {
      if (loan.color !== currentColor) {
        currentColor = loan.color;
        newPage(
          `Per-loan detail · ${currentColor.charAt(0).toUpperCase() + currentColor.slice(1)}`,
        );
      }
      ensureRoom(
        ROW_MIN_HEIGHT,
        `Per-loan detail · ${currentColor.charAt(0).toUpperCase() + currentColor.slice(1)}`,
      );
      const page = s.page;
      let y = s.y;

      // Loan header line
      const header = `${loan.borrowerName}  ·  ${loan.loanId}`;
      page.drawText(header, {
        x: MARGIN_X,
        y: y - 12,
        size: 12,
        font: helvBold,
        color: black,
      });
      // Color swatch on the right
      page.drawRectangle({
        x: PAGE_W - MARGIN_X - 12,
        y: y - 12,
        width: 12,
        height: 12,
        color: rgbHex(COLOR_HEX_UI[loan.color]),
      });
      y -= 16;

      const meta = [
        loan.sector,
        fmtNpr(loan.outstandingNpr),
        loan.activityName ?? loan.activityId ?? "",
      ]
        .filter(Boolean)
        .join("  ·  ");
      page.drawText(meta, {
        x: MARGIN_X,
        y: y - 9,
        size: 9,
        font: helv,
        color: gray,
      });
      y -= 14;

      // Rationale — wrap
      y = drawParagraph(page, loan.rationale, {
        x: MARGIN_X,
        topY: y,
        maxWidth: CONTENT_W,
        font: helv,
        size: 10,
        color: black,
        lineHeight: 13,
      });
      y -= 4;

      // DNSH failures
      if (loan.dnshFailures.length > 0) {
        page.drawText("DNSH:", {
          x: MARGIN_X,
          y: y - 9,
          size: 9,
          font: helvBold,
          color: rgbHex("#b45309"),
        });
        y = drawParagraph(page, loan.dnshFailures.join(" · "), {
          x: MARGIN_X + 34,
          topY: y,
          maxWidth: CONTENT_W - 34,
          font: helv,
          size: 9,
          color: rgbHex("#b45309"),
          lineHeight: 12,
        });
        y -= 2;
      }

      // Citation
      if (loan.citation) {
        page.drawText(loan.citation, {
          x: MARGIN_X,
          y: y - 9,
          size: 9,
          font: helv,
          color: gray,
        });
        y -= 12;
      }

      // Divider between loans
      page.drawRectangle({
        x: MARGIN_X,
        y: y,
        width: CONTENT_W,
        height: 0.25,
        color: lightGray,
      });
      y -= 14;
      // Sync cursor back to shared state so the next ensureRoom check
      // sees the current position.
      s.y = y;
    }

    // If no loans at all, still leave a page with a message.
    if (report.loans.length === 0) {
      const emptyPage = doc.addPage([PAGE_W, PAGE_H]);
      emptyPage.drawText("Per-loan detail", {
        x: MARGIN_X,
        y: PAGE_H - 78,
        size: 18,
        font: helvBold,
        color: primary,
      });
      emptyPage.drawText(
        "No classified loans in the portfolio at report time.",
        {
          x: MARGIN_X,
          y: PAGE_H - 120,
          size: 12,
          font: helv,
          color: gray,
        },
      );
      drawFooter(emptyPage, branding, footer, { helv });
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
