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
import PDFDocument from "pdfkit";
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

export type TaxonomyReport = {
  tenant: {
    id: string;
    displayName: string;
  };
  generatedAt: string;
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
    { header: "Bucket", key: "bucket", width: 22 },
    { header: "Loan count", key: "count", width: 14 },
    { header: "Outstanding (NPR)", key: "npr", width: 24 },
    { header: "Share of assessed exposure", key: "share", width: 26 },
  ];

  const totalNpr = COLORS.reduce((s, c) => s + report.portfolio[c].nprTotal, 0);
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
    bucket: "Total (assessed)",
    count: COLORS.reduce((s, c) => s + report.portfolio[c].count, 0),
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
// buildTaxonomyPdf
// ---------------------------------------------------------------------------

const COLOR_HEX_UI: Record<NrbTaxonomyColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#94a3b8",
};

export async function buildTaxonomyPdf(
  report: TaxonomyReport,
  branding: ExportBranding,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 54, right: 54 },
      autoFirstPage: false,
      info: {
        Title: `${branding.displayName} — NRB Green Finance Taxonomy Classification Report`,
        Author: "Jana Earth Data",
        Creator: "Jana Earth Data",
        Producer: "Jana BFI demo",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const primary = branding.primaryColorHex;
    const footer = footerText(report.generatedAt);

    // Draw footer on every page (before content flows for that page).
    doc.on("pageAdded", () => drawFooter(doc, branding, footer));

    // -----------------------------------------------------------------------
    // Cover page
    // -----------------------------------------------------------------------
    doc.addPage();
    let y = 60;
    if (branding.logoBytes) {
      try {
        doc.image(branding.logoBytes, 54, y, { fit: [110, 110] });
      } catch {
        // ignore bad logo bytes
      }
    }
    y = 60 + (branding.logoBytes ? 130 : 0);
    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(branding.displayName, 54, y, { width: 500 });
    y = doc.y + 8;
    doc
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("NRB Green Finance Taxonomy", 54, y, { width: 500 });
    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor("#374151")
      .text("Classification Report", 54, doc.y + 2, { width: 500 });

    // Primary color divider
    doc
      .moveTo(54, doc.y + 16)
      .lineTo(558, doc.y + 16)
      .lineWidth(2)
      .strokeColor(primary)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#374151")
      .text(`Generated ${fmtDateShort(report.generatedAt)}`, 54, doc.y + 28);
    doc.text(`Tenant: ${branding.displayName}${branding.shortName ? ` (${branding.shortName})` : ""}`, 54, doc.y + 2);

    doc
      .fontSize(10)
      .fillColor("#4b5563")
      .text(
        "This report classifies every assessed loan in the portfolio against the NRB Green Finance Taxonomy (October 2024). It is intended for submission as part of the bank's regulatory filing with Nepal Rastra Bank.",
        54,
        doc.y + 22,
        { width: 500 },
      );

    // -----------------------------------------------------------------------
    // Portfolio summary page
    // -----------------------------------------------------------------------
    doc.addPage();
    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Portfolio summary", 54, 60);
    doc
      .moveTo(54, 84)
      .lineTo(558, 84)
      .lineWidth(1)
      .strokeColor(primary)
      .stroke();

    const totalNpr = COLORS.reduce(
      (s, c) => s + report.portfolio[c].nprTotal,
      0,
    );

    // Table header
    const rowY = 104;
    const colX = { bucket: 54, count: 200, npr: 300, share: 460 };
    doc
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .fontSize(11)
      .text("Bucket", colX.bucket, rowY)
      .text("Loan count", colX.count, rowY)
      .text("Outstanding (NPR)", colX.npr, rowY)
      .text("Share", colX.share, rowY);
    doc
      .moveTo(54, rowY + 16)
      .lineTo(558, rowY + 16)
      .strokeColor("#d1d5db")
      .lineWidth(0.5)
      .stroke();

    let ry = rowY + 22;
    doc.font("Helvetica").fontSize(11);
    for (const c of COLORS) {
      const b = report.portfolio[c];
      // Color swatch
      doc
        .rect(colX.bucket, ry + 2, 8, 8)
        .fillColor(COLOR_HEX_UI[c])
        .fill();
      doc
        .fillColor("#111827")
        .text(c.charAt(0).toUpperCase() + c.slice(1), colX.bucket + 14, ry)
        .text(b.count.toLocaleString(), colX.count, ry)
        .text(fmtNpr(b.nprTotal), colX.npr, ry)
        .text(
          totalNpr > 0 ? `${((b.nprTotal / totalNpr) * 100).toFixed(1)}%` : "—",
          colX.share,
          ry,
        );
      ry += 22;
    }
    doc
      .moveTo(54, ry)
      .lineTo(558, ry)
      .strokeColor("#d1d5db")
      .lineWidth(0.5)
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Total (assessed)", colX.bucket + 14, ry + 6)
      .text(
        COLORS.reduce((s, c) => s + report.portfolio[c].count, 0).toLocaleString(),
        colX.count,
        ry + 6,
      )
      .text(fmtNpr(totalNpr), colX.npr, ry + 6)
      .text(totalNpr > 0 ? "100.0%" : "—", colX.share, ry + 6);

    // -----------------------------------------------------------------------
    // Per-loan detail pages (grouped by color)
    // -----------------------------------------------------------------------
    doc.addPage();
    doc
      .fillColor(primary)
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Per-loan detail", 54, 60);
    doc
      .moveTo(54, 84)
      .lineTo(558, 84)
      .lineWidth(1)
      .strokeColor(primary)
      .stroke();

    if (report.loans.length === 0) {
      doc
        .font("Helvetica")
        .fillColor("#4b5563")
        .fontSize(11)
        .text(
          "No taxonomy assessments have been captured for this tenant yet. Once officers complete taxonomy wizards for loans, each classification will appear here.",
          54,
          110,
          { width: 500 },
        );
    } else {
      let cy = 104;
      let currentColor: NrbTaxonomyColor | null = null;
      for (const loan of report.loans) {
        // New color heading
        if (loan.color !== currentColor) {
          if (cy > 720) {
            doc.addPage();
            cy = 60;
          }
          currentColor = loan.color;
          doc
            .rect(54, cy + 4, 8, 8)
            .fillColor(COLOR_HEX_UI[loan.color])
            .fill();
          doc
            .fillColor("#111827")
            .font("Helvetica-Bold")
            .fontSize(13)
            .text(
              `${loan.color.charAt(0).toUpperCase() + loan.color.slice(1)} — ${report.portfolio[loan.color].count} loan${report.portfolio[loan.color].count === 1 ? "" : "s"}`,
              68,
              cy,
            );
          cy += 22;
        }

        // Estimated row height — page break if we'd overflow.
        const estimatedHeight = 90;
        if (cy + estimatedHeight > 720) {
          doc.addPage();
          cy = 60;
        }

        // Row block
        doc
          .fillColor("#111827")
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(loan.loanId, 54, cy, { continued: true })
          .fillColor("#4b5563")
          .font("Helvetica")
          .text(`  ·  ${loan.borrowerName}`, { continued: true })
          .fillColor("#6b7280")
          .fontSize(9)
          .text(`  ·  ${loan.sector}`);
        doc
          .fillColor("#111827")
          .font("Helvetica")
          .fontSize(10)
          .text(
            `${fmtNpr(loan.outstandingNpr)}  ·  ${loan.activityName ?? loan.activityId ?? "(no activity)"}`,
            54,
            doc.y + 2,
          );
        if (loan.rationale) {
          doc
            .fillColor("#374151")
            .fontSize(9)
            .text(loan.rationale, 54, doc.y + 2, { width: 500 });
        }
        if (loan.citation) {
          doc
            .fillColor("#6b7280")
            .fontSize(8)
            .text(`Citation: ${loan.citation}`, 54, doc.y + 2, { width: 500 });
        }
        if (loan.dnshFailures.length > 0) {
          doc
            .fillColor("#b91c1c")
            .fontSize(8)
            .text(
              `DNSH failures: ${loan.dnshFailures.join("; ")}`,
              54,
              doc.y + 2,
              { width: 500 },
            );
        }
        cy = doc.y + 12;
        doc
          .moveTo(54, cy - 4)
          .lineTo(558, cy - 4)
          .lineWidth(0.25)
          .strokeColor("#e5e7eb")
          .stroke();
      }
    }

    doc.end();
  });
}

/**
 * Draw the footer on the current page.
 *
 * Two subtleties handled here:
 *
 *  1) The footer sits inside the page's bottom margin (below the usable
 *     content area). PDFKit's `text` uses the page margins to decide
 *     whether text overflows to the next page. If we draw at `page.height
 *     - 40` while the bottom margin is 60, PDFKit will detect the
 *     "overflow" and call `addPage()`, which fires `pageAdded` again —
 *     an infinite loop. We temporarily zero the margins so PDFKit treats
 *     the whole page as usable while the footer draws.
 *
 *  2) `save()`/`restore()` covers graphics state only; the text cursor is
 *     not restored. All callers therefore place their next text with an
 *     explicit (x, y) rather than relying on `doc.y`.
 */
function drawFooter(
  doc: PDFKit.PDFDocument,
  branding: ExportBranding,
  footer: string,
): void {
  const savedMargins = doc.page.margins;
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  const bottomY = doc.page.height - 30;
  doc
    .save()
    .fillColor("#6b7280")
    .font("Helvetica")
    .fontSize(8)
    .text(branding.displayName, 54, bottomY, {
      width: 250,
      align: "left",
      lineBreak: false,
      height: 20,
    })
    .text(`${footer}  ·  Generated by Jana`, 304, bottomY, {
      width: 254,
      align: "right",
      lineBreak: false,
      height: 20,
    })
    .restore();
  doc.page.margins = savedMargins;
}
