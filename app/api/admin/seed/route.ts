/**
 * One-off seed endpoint.
 *
 * Usage from a shell (after schema migration has been applied):
 *   curl -X POST "http://localhost:3000/api/admin/seed?token=<SEED_ADMIN_TOKEN>"
 *
 * Or from the deployed Vercel URL:
 *   curl -X POST "https://your-demo.vercel.app/api/admin/seed?token=..."
 *
 * The endpoint:
 *   1. Generates the 80K-loan portfolio in memory via the existing synthesizer.
 *   2. Truncates the bfi_loans_denorm table.
 *   3. Inserts loans in batches of 1000 with denormalized borrower + attribution fields.
 *
 * Returns JSON with insert counts. Idempotent: safe to re-run after schema or
 * synthesizer changes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPortfolio } from "@/lib/data/portfolio";
import {
  BFI_LOANS_TABLE,
  getSupabaseAdmin,
} from "@/lib/data/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel function timeout, in seconds

const BATCH_SIZE = 1000;

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const expected = process.env.SEED_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_ADMIN_TOKEN is not configured on the server." },
      { status: 500 }
    );
  }
  if (token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized: bad or missing token." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase env vars are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  const t0 = Date.now();
  const portfolio = getPortfolio();
  const borrowerById = new Map(portfolio.borrowers.map((b) => [b.id, b]));
  const attributionByLoanId = new Map(
    portfolio.attributions.map((a) => [a.loanId, a])
  );

  // Denormalize each loan to a single row for fast filtered pagination
  const rows = portfolio.loans
    .map((l) => {
      const b = borrowerById.get(l.borrowerId);
      const a = attributionByLoanId.get(l.id);
      if (!b || !a) return null;
      return {
        id: l.id,
        borrower_id: l.borrowerId,
        borrower_name: b.name,
        borrower_sector: b.nrbSector,
        borrower_ev_usd: Math.round(b.enterpriseValueUsd),
        borrower_data_tier: b.dataTier ?? null,
        product: l.product,
        category: l.category ?? null,
        business_unit: l.businessUnit ?? null,
        branch: l.branch ?? null,
        branch_code: l.branchCode ?? null,
        outstanding_npr: Math.round(l.outstandingNpr),
        outstanding_usd: Math.round(l.outstandingUsd),
        disbursed_date: l.disbursedDate,
        maturity_date: l.maturityDate,
        status: l.status,
        nrb_taxonomy: l.nrbTaxonomy,
        purpose: l.purpose,
        methodology: a.methodology ?? null,
        attribution_factor: Number(a.attributionFactor.toFixed(8)),
        attributed_co2e_tonnes: Math.round(a.attributedCo2eTonnes),
        data_quality_score: a.dataQualityScore,
        quality_note: a.qualityNote,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // 1. Truncate (delete-all) the existing table
  const { error: truncErr } = await supabase
    .from(BFI_LOANS_TABLE)
    .delete()
    .neq("id", "__never__");
  if (truncErr) {
    return NextResponse.json(
      { error: `Failed to truncate ${BFI_LOANS_TABLE}: ${truncErr.message}` },
      { status: 500 }
    );
  }

  // 2. Insert in batches
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(BFI_LOANS_TABLE).insert(batch);
    if (error) {
      return NextResponse.json(
        {
          error: `Insert failed at offset ${i}: ${error.message}`,
          insertedSoFar: inserted,
        },
        { status: 500 }
      );
    }
    inserted += batch.length;
  }

  const elapsedMs = Date.now() - t0;
  return NextResponse.json({
    ok: true,
    table: BFI_LOANS_TABLE,
    inserted,
    elapsedMs,
    elapsedHuman: `${(elapsedMs / 1000).toFixed(1)}s`,
  });
}
