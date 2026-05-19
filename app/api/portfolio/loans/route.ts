import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import {
  LoanFilter,
  LoanSort,
  queryLoans,
} from "@/lib/data/portfolio-query";
import { Loan, NrbTaxonomyColor } from "@/lib/types/bfi";

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
