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
    const buffer = await buildTaxonomyXlsx(report, branding);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${stub}-nrb-taxonomy-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // format === "pdf"
  const buffer = await buildTaxonomyPdf(report, branding);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${stub}-nrb-taxonomy-${dateStamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
