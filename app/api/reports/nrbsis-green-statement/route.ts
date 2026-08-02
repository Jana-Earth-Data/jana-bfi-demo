/**
 * GET /api/reports/nrbsis-green-statement
 *
 * The **actual regulatory submission** for the NRB Green Finance
 * Taxonomy filing: the annual aggregate 17-sector Green Finance
 * Statement submitted to the NRB Supervisory Information System (SIS)
 * per NRB Green Finance Taxonomy 2024, Annex 4b (p. 144).
 *
 * Serves the same underlying data in three formats:
 *   - ?format=json (default) — aggregate 17-sector shape
 *   - ?format=xlsx           — bank-branded spreadsheet with cover,
 *                              Annex 4b sheet, and attestation sheet
 *   - ?format=pdf            — bank-branded PDF with cover, statement
 *                              table, portfolio green-labeling roll-up,
 *                              and signable attestation page
 *
 * Contrast with /api/reports/nrb-taxonomy (per-loan classification
 * report) — that is the auditor-evidence support pack for this filing.
 * The file returned here is what the bank actually keys into SIS.
 *
 * Data flow mirrors /api/reports/nrb-taxonomy:
 *   1. Resolve the current tenant (cookie → TenantConfig).
 *   2. Pull the demo portfolio (loans + borrowers) via getBfiDemoData().
 *   3. Pull the latest bfi_taxonomy_assessments rows for the tenant.
 *   4. Hand off to the pure builders in
 *      lib/reports/nrbsis-green-statement.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveCurrentTenant } from "@/lib/tenants";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import {
  brandingFromTenant,
  type TaxonomyAssessmentRow,
} from "@/lib/reports/nrb-taxonomy-export";
import {
  buildGreenStatementPdf,
  buildGreenStatementReport,
  buildGreenStatementXlsx,
} from "@/lib/reports/nrbsis-green-statement";

export const dynamic = "force-dynamic";
// exceljs and pdf-lib both rely on node built-ins that are unavailable
// in the edge runtime.
export const runtime = "nodejs";

type ReportFormat = "json" | "xlsx" | "pdf";

function parseFormat(raw: string | null): ReportFormat {
  if (raw === "xlsx" || raw === "pdf") return raw;
  return "json";
}

function readTenantLogo(logoPath: string | undefined | null): Buffer | null {
  if (!logoPath) return null;
  try {
    const filePath = path.join(process.cwd(), "public", logoPath);
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function sanitizeFileSegment(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase() || "report";
}

export async function GET(request: NextRequest) {
  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  const tenant = await resolveCurrentTenant();

  // Pull latest assessments (sorted so the builder can dedupe by
  // keeping the first sighting per loan_id). Same query as
  // /api/reports/nrb-taxonomy — the Green Finance Statement re-uses
  // the officer's saved computed_color when available, falling back
  // to the synthesised loan.nrbTaxonomy otherwise.
  let assessments: TaxonomyAssessmentRow[] = [];
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("bfi_taxonomy_assessments")
      .select(
        "loan_id, activity_id, computed_color, computed_rationale, citation, captured_at, criterion_answers",
      )
      .eq("bank_id", tenant.id)
      .order("captured_at", { ascending: false });
    if (error) {
      return NextResponse.json(
        { error: `Assessment query failed: ${error.message}` },
        { status: 500 },
      );
    }
    assessments = (data ?? []) as TaxonomyAssessmentRow[];
  }
  // If Supabase is not configured we still respond — the SIS return
  // just falls back to the synthesised per-loan `nrbTaxonomy` field.
  // A production deployment must have Supabase wired for the officer's
  // computed classification to flow through.

  const demoData = await getBfiDemoData();
  const report = buildGreenStatementReport(tenant, demoData, assessments);

  if (format === "json") {
    return NextResponse.json(report);
  }

  const logoBytes = readTenantLogo(tenant.branding.logoPath);
  const branding = brandingFromTenant(tenant, logoBytes);
  const stub = sanitizeFileSegment(tenant.branding.shortName || tenant.id);
  const dateStamp = report.generatedAt.split("T")[0];

  if (format === "xlsx") {
    let buffer: Buffer;
    try {
      buffer = await buildGreenStatementXlsx(report, branding);
    } catch (err) {
      return NextResponse.json(
        { error: `xlsx build failed: ${(err as Error).message}` },
        { status: 500 },
      );
    }
    // Copy into a fresh Uint8Array — same defensive pattern as the
    // sibling nrb-taxonomy route uses (avoids returning a view over a
    // shared slab allocator).
    const body = Uint8Array.from(buffer);
    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${stub}-nrbsis-green-statement-${dateStamp}.xlsx"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // format === "pdf"
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildGreenStatementPdf(report, branding);
  } catch (err) {
    return NextResponse.json(
      { error: `pdf build failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
  // Sanity-check header — the sibling route has the same guard rail.
  if (
    pdfBuffer.length < 5 ||
    pdfBuffer.toString("ascii", 0, 5) !== "%PDF-"
  ) {
    return NextResponse.json(
      {
        error:
          "PDF builder produced a non-PDF payload (missing %PDF- header).",
        firstBytesHex: pdfBuffer.slice(0, 16).toString("hex"),
        bufferLength: pdfBuffer.length,
      },
      { status: 500 },
    );
  }
  const pdfBody = Uint8Array.from(pdfBuffer);
  return new NextResponse(pdfBody as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${stub}-nrbsis-green-statement-${dateStamp}.pdf"`,
      "Content-Length": String(pdfBody.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
