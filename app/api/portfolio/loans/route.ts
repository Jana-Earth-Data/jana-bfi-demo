import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import {
  LoanFilter,
  LoanSort,
  queryLoans,
} from "@/lib/data/portfolio-query";
import {
  Borrower,
  BorrowerDataTier,
  BusinessUnit,
  Loan,
  LoanCategory,
  LoanStatus,
  NrbTaxonomyColor,
  PcafMethodology,
} from "@/lib/types/bfi";
import {
  BFI_LOANS_TABLE,
  getSupabaseAdmin,
  isSupabaseConfigured,
} from "@/lib/data/supabase";
import type { LoanRow } from "@/lib/data/portfolio-query";

export const dynamic = "force-dynamic";

function parseTaxonomy(v: string | null): NrbTaxonomyColor | undefined {
  if (!v) return undefined;
  const set: ReadonlySet<NrbTaxonomyColor> = new Set([
    "green",
    "amber",
    "red",
    "unclassified",
  ] as const);
  return set.has(v as NrbTaxonomyColor) ? (v as NrbTaxonomyColor) : undefined;
}

function parseBusinessUnit(v: string | null): Loan["businessUnit"] | undefined {
  if (!v) return undefined;
  if (
    v === "Retail" ||
    v === "SME" ||
    v === "Corporate" ||
    v === "Project Finance"
  ) {
    return v;
  }
  return undefined;
}

function parseStatus(v: string | null): Loan["status"] | undefined {
  if (!v) return undefined;
  if (
    v === "active" ||
    v === "disbursed" ||
    v === "under-review" ||
    v === "approved" ||
    v === "declined"
  ) {
    return v;
  }
  return undefined;
}

function parseSort(
  field: string | null,
  direction: string | null
): LoanSort | undefined {
  if (!field) return undefined;
  if (
    field !== "outstandingNpr" &&
    field !== "attributedCo2eTonnes" &&
    field !== "disbursedDate" &&
    field !== "id"
  ) {
    return undefined;
  }
  const dir: "asc" | "desc" = direction === "asc" ? "asc" : "desc";
  return { field, direction: dir };
}

const SORT_FIELD_TO_COLUMN: Record<LoanSort["field"], string> = {
  outstandingNpr: "outstanding_npr",
  attributedCo2eTonnes: "attributed_co2e_tonnes",
  disbursedDate: "disbursed_date",
  id: "id",
};

/**
 * Run the paginated loan query against Supabase. Returns the same shape the
 * in-memory queryLoans returns so the client doesn't need to know which backend
 * served the data.
 */
async function querySupabase(
  filter: LoanFilter,
  sort: LoanSort,
  page: number,
  pageSize: number
): Promise<{ rows: LoanRow[]; total: number; page: number; pageSize: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");

  let q = supabase
    .from(BFI_LOANS_TABLE)
    .select("*", { count: "exact" });

  if (filter.taxonomy) q = q.eq("nrb_taxonomy", filter.taxonomy);
  if (filter.businessUnit) q = q.eq("business_unit", filter.businessUnit);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.branchCode) q = q.eq("branch_code", filter.branchCode);
  if (filter.sector) q = q.eq("borrower_sector", filter.sector);
  if (filter.category) q = q.eq("category", filter.category);
  if (filter.minNpr != null) q = q.gte("outstanding_npr", filter.minNpr);
  if (filter.maxNpr != null) q = q.lte("outstanding_npr", filter.maxNpr);
  if (filter.query) {
    // Trigram-backed search across the concatenated text columns; ilike works
    // and uses the gin trigram index for prefix/contains queries.
    const term = filter.query.replace(/[%_]/g, " ").trim();
    if (term) {
      q = q.or(
        `id.ilike.%${term}%,borrower_name.ilike.%${term}%,branch.ilike.%${term}%,borrower_sector.ilike.%${term}%`
      );
    }
  }

  const column = SORT_FIELD_TO_COLUMN[sort.field];
  q = q.order(column, { ascending: sort.direction === "asc" });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.range(from, to);

  const { data, count, error } = await q;
  if (error) throw new Error(`Supabase loan query failed: ${error.message}`);

  // Map the flat denormalized rows back into the LoanRow shape the client expects.
  // Supabase returns the literal-union columns as plain strings, so we narrow
  // them with casts at the boundary. The seed endpoint is the only writer and
  // produces only valid values.
  const rows: LoanRow[] = (data ?? []).map((r) => {
    const loan: Loan = {
      id: r.id,
      borrowerId: r.borrower_id,
      product: r.product,
      category: (r.category ?? undefined) as LoanCategory | undefined,
      businessUnit: (r.business_unit ?? undefined) as BusinessUnit | undefined,
      branch: r.branch ?? undefined,
      branchCode: r.branch_code ?? undefined,
      outstandingNpr: r.outstanding_npr,
      outstandingUsd: r.outstanding_usd,
      disbursedDate: r.disbursed_date,
      maturityDate: r.maturity_date,
      status: r.status as LoanStatus,
      nrbTaxonomy: r.nrb_taxonomy as NrbTaxonomyColor,
      purpose: r.purpose ?? "",
    };
    const borrower: Borrower = {
      id: r.borrower_id,
      name: r.borrower_name,
      nrbSector: r.borrower_sector,
      enterpriseValueUsd: r.borrower_ev_usd,
      evSource: "estimated",
      dataTier: (r.borrower_data_tier ?? undefined) as
        | BorrowerDataTier
        | undefined,
      facilities: [],
      totalCo2eTonnes: 0,
    };
    const attribution = {
      loanId: r.id,
      borrowerId: r.borrower_id,
      methodology: (r.methodology ?? undefined) as PcafMethodology | undefined,
      attributionFactor: Number(r.attribution_factor),
      attributedCo2eTonnes: r.attributed_co2e_tonnes,
      dataQualityScore: r.data_quality_score as 1 | 2 | 3 | 4 | 5,
      qualityNote: r.quality_note ?? "",
    };
    return { loan, borrower, attribution };
  });

  return {
    rows,
    total: count ?? rows.length,
    page,
    pageSize,
  };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50")));

  const filter: LoanFilter = {
    query: sp.get("q") ?? undefined,
    taxonomy: parseTaxonomy(sp.get("taxonomy")),
    businessUnit: parseBusinessUnit(sp.get("businessUnit")),
    status: parseStatus(sp.get("status")),
    branchCode: sp.get("branchCode") ?? undefined,
    sector: sp.get("sector") ?? undefined,
    minNpr: sp.get("minNpr") ? Number(sp.get("minNpr")) : undefined,
    maxNpr: sp.get("maxNpr") ? Number(sp.get("maxNpr")) : undefined,
  };

  const sort =
    parseSort(sp.get("sortField"), sp.get("sortDirection")) ?? {
      field: "outstandingNpr" as const,
      direction: "desc" as const,
    };

  try {
    if (isSupabaseConfigured()) {
      const result = await querySupabase(filter, sort, page, pageSize);
      return NextResponse.json(result);
    }

    // Fallback for local dev without Supabase env vars
    const data = await getBfiDemoData(token);
    const result = queryLoans(data, { page, pageSize, filter, sort });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
