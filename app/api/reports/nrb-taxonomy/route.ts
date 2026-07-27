/**
 * GET /api/reports/nrb-taxonomy
 *
 * Regulatory-export endpoint for the NRB Green Finance Taxonomy filing.
 * Serves the same underlying data in three formats:
 *   - ?format=json (default)  — full portfolio-level roll-up + per-loan rows
 *   - ?format=xlsx            — spreadsheet, bank-branded, three sheets
 *   - ?format=pdf             — cover + portfolio summary + per-loan detail,
 *                                bank-branded (primary color, logo, footer)
 *
 * Data flow:
 *   1. Resolve the current tenant (cookie → TenantConfig).
 *   2. Pull the demo portfolio (loans + borrowers) via getBfiDemoData().
 *   3. Pull the latest bfi_taxonomy_assessments rows for the tenant.
 *   4. Hand off to the pure builders in lib/reports/nrb-taxonomy-export.ts.
 *
 * No auth gate beyond tenant resolution — this is a demo download, not a
 * production endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveCurrentTenant } from "@/lib/tenants";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { getBfiDemoData } from "@/lib/api/bfi";
import {
  brandingFromTenant,
  buildTaxonomyPdf,
  buildTaxonomyReport,
  buildTaxonomyXlsx,
  type TaxonomyAssessmentRow,
} from "@/lib/reports/nrb-taxonomy-export";

export const dynamic = "force-dynamic";
// pdfkit and exceljs both use node built-ins (fs, streams, etc.) and are
// not compatible with the edge runtime.
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

  // Pull latest assessments (sorted so the builder can dedupe by keeping the
  // first sighting per loan_id).
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
  // If Supabase is not configured we still respond — the report just shows
  // zero classified loans. Demo environments without a DB shouldn't 500 here.

  const demoData = await getBfiDemoData();
  const report = buildTaxonomyReport(tenant, demoData, assessments);

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
      buffer = await buildTaxonomyXlsx(report, branding);
    } catch (err) {
      return NextResponse.json(
        {
          error: `xlsx build failed: ${(err as Error).message}`,
        },
        { status: 500 },
      );
    }
    // Copy into a fresh Uint8Array so we never accidentally send a
    // view over a shared slab allocator (Node's Buffer sometimes lives
    // inside a larger internal ArrayBuffer). Uint8Array.from copies.
    const body = Uint8Array.from(buffer);
    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${stub}-nrb-taxonomy-${dateStamp}.xlsx"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // format === "pdf"
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildTaxonomyPdf(report, branding);
  } catch (err) {
    return NextResponse.json(
      { error: `pdf build failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
  // Sanity-check the PDF bytes before we send them. If the buffer
  // doesn't start with "%PDF-", the builder produced garbage
  // (typically pdfkit font loading failed silently in the runtime).
  // Better to fail loud than to hand Adobe an unreadable file.
  if (
    pdfBuffer.length < 5 ||
    pdfBuffer.toString("ascii", 0, 5) !== "%PDF-"
  ) {
    return NextResponse.json(
      {
        error:
          "PDF builder produced a non-PDF payload (missing %PDF- header). This usually means pdfkit's font loader failed in the runtime.",
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
      "Content-Disposition": `attachment; filename="${stub}-nrb-taxonomy-${dateStamp}.pdf"`,
      "Content-Length": String(pdfBody.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
