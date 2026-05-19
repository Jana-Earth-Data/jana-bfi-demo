/**
 * Helpers for slicing the in-memory portfolio for SSR and API responses.
 *
 * All functions operate on the cached portfolio returned by getPortfolio()
 * (or an explicit BfiDemoData passed in, which makes them easy to unit-test).
 */

import {
  BfiDemoData,
  Borrower,
  Loan,
  NrbTaxonomyColor,
  PcafAttribution,
} from "@/lib/types/bfi";

export type LoanRow = {
  loan: Loan;
  borrower: Borrower;
  attribution: PcafAttribution;
};

export type LoanFilter = {
  query?: string;
  taxonomy?: NrbTaxonomyColor;
  businessUnit?: Loan["businessUnit"];
  status?: Loan["status"];
  branchCode?: string;
  sector?: string;
  category?: Loan["category"];
  minNpr?: number;
  maxNpr?: number;
};

export type LoanSort = {
  field: "outstandingNpr" | "attributedCo2eTonnes" | "disbursedDate" | "id";
  direction: "asc" | "desc";
};

function loanMatches(
  loan: Loan,
  borrower: Borrower,
  attribution: PcafAttribution,
  f: LoanFilter
): boolean {
  if (f.taxonomy && loan.nrbTaxonomy !== f.taxonomy) return false;
  if (f.businessUnit && loan.businessUnit !== f.businessUnit) return false;
  if (f.status && loan.status !== f.status) return false;
  if (f.branchCode && loan.branchCode !== f.branchCode) return false;
  if (f.sector && borrower.nrbSector !== f.sector) return false;
  if (f.category && loan.category !== f.category) return false;
  if (f.minNpr != null && loan.outstandingNpr < f.minNpr) return false;
  if (f.maxNpr != null && loan.outstandingNpr > f.maxNpr) return false;
  if (f.query) {
    const q = f.query.toLowerCase();
    if (
      !loan.id.toLowerCase().includes(q) &&
      !borrower.name.toLowerCase().includes(q) &&
      !(loan.branch ?? "").toLowerCase().includes(q) &&
      !borrower.nrbSector.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  return true;
}

function compareLoans(
  a: LoanRow,
  b: LoanRow,
  sort: LoanSort
): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  switch (sort.field) {
    case "outstandingNpr":
      return dir * (a.loan.outstandingNpr - b.loan.outstandingNpr);
    case "attributedCo2eTonnes":
      return dir * (a.attribution.attributedCo2eTonnes - b.attribution.attributedCo2eTonnes);
    case "disbursedDate":
      return dir * a.loan.disbursedDate.localeCompare(b.loan.disbursedDate);
    case "id":
      return dir * a.loan.id.localeCompare(b.loan.id);
  }
}

/**
 * Page through loans with optional filter/sort. Returns the page + the total
 * matching count (so the UI can show "showing X of Y").
 */
export function queryLoans(
  data: BfiDemoData,
  opts: {
    page?: number;
    pageSize?: number;
    filter?: LoanFilter;
    sort?: LoanSort;
  }
): { rows: LoanRow[]; total: number; page: number; pageSize: number } {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const filter = opts.filter ?? {};
  const sort: LoanSort = opts.sort ?? { field: "outstandingNpr", direction: "desc" };

  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));
  const attributionByLoanId = new Map(
    data.attributions.map((a) => [a.loanId, a])
  );

  const rows: LoanRow[] = [];
  for (const loan of data.loans) {
    const borrower = borrowerById.get(loan.borrowerId);
    const attribution = attributionByLoanId.get(loan.id);
    if (!borrower || !attribution) continue;
    if (!loanMatches(loan, borrower, attribution, filter)) continue;
    rows.push({ loan, borrower, attribution });
  }

  rows.sort((a, b) => compareLoans(a, b, sort));
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

/** Top N attributed-emissions contributors. */
export function topContributors(
  data: BfiDemoData,
  n = 20
): LoanRow[] {
  return queryLoans(data, {
    page: 1,
    pageSize: n,
    sort: { field: "attributedCo2eTonnes", direction: "desc" },
    filter: {},
  }).rows;
}

/** The ESRM queue: loans currently under review, newest first. */
export function applicationQueue(
  data: BfiDemoData,
  n = 30
): LoanRow[] {
  return queryLoans(data, {
    page: 1,
    pageSize: n,
    filter: { status: "under-review" },
    sort: { field: "disbursedDate", direction: "desc" },
  }).rows;
}

/** Borrower lookup with attached attributions. */
export function getBorrowerDetail(
  data: BfiDemoData,
  borrowerId: string
): {
  borrower: Borrower | null;
  loans: Array<{ loan: Loan; attribution: PcafAttribution }>;
} {
  const borrower = data.borrowers.find((b) => b.id === borrowerId) ?? null;
  if (!borrower) return { borrower: null, loans: [] };
  const attrByLoan = new Map(data.attributions.map((a) => [a.loanId, a]));
  const loans = data.loans
    .filter((l) => l.borrowerId === borrowerId)
    .map((l) => ({ loan: l, attribution: attrByLoan.get(l.id)! }));
  return { borrower, loans };
}

/** All distinct values for a filter dropdown. */
export function distinctValues(
  data: BfiDemoData
): {
  sectors: string[];
  businessUnits: Array<NonNullable<Loan["businessUnit"]>>;
  branches: Array<{ code: string; name: string }>;
} {
  const sectors = new Set<string>();
  const units = new Set<NonNullable<Loan["businessUnit"]>>();
  const branches = new Map<string, string>();
  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));
  for (const l of data.loans) {
    const b = borrowerById.get(l.borrowerId);
    if (b && b.kind !== "retail-pool") sectors.add(b.nrbSector);
    if (l.businessUnit) units.add(l.businessUnit);
    if (l.branchCode && l.branch) branches.set(l.branchCode, l.branch);
  }
  return {
    sectors: Array.from(sectors).sort(),
    businessUnits: Array.from(units).sort(),
    branches: Array.from(branches.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}
