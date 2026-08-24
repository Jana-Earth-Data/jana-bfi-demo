"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  TaxonomyDot,
} from "@/components/bfi/shared/primitives";
import {
  formatCo2e,
  formatNpr,
  formatUsd,
  qualityScoreColors,
  taxonomyColors,
} from "@/components/bfi/ui";
import { useAuth } from "@/lib/auth/auth-context";
import { LoanRow } from "@/lib/data/portfolio-query";
import { NrbTaxonomyColor, Loan } from "@/lib/types/bfi";
import { InfoTip, PcafScoreInfoTip } from "@/components/bfi/shared/info-tip";
import { NPR_PER_USD } from "@/lib/units";

type TaxonomyFilter = NrbTaxonomyColor | "all";
type BusinessUnitFilter = NonNullable<Loan["businessUnit"]> | "all";
type SortField = "outstandingNpr" | "attributedCo2eTonnes" | "disbursedDate" | "id";
type SortDirection = "asc" | "desc";

export type LoanTableProps = {
  initialRows: LoanRow[];
  initialTotal: number;
  pageSize?: number;
  sectors: string[];
  businessUnits: string[];
  /** Pre-applied filter that the user cannot override (used to scope the table). */
  lockedFilter?: {
    taxonomy?: NrbTaxonomyColor;
    businessUnit?: NonNullable<Loan["businessUnit"]>;
    sector?: string;
    status?: Loan["status"];
  };
};

export function LoanTable({
  initialRows,
  initialTotal,
  pageSize = 50,
  sectors,
  businessUnits,
  lockedFilter,
}: LoanTableProps) {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<LoanRow[]>(initialRows);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [taxonomy, setTaxonomy] = useState<TaxonomyFilter>("all");
  const [businessUnit, setBusinessUnit] = useState<BusinessUnitFilter>("all");
  const [sector, setSector] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("outstandingNpr");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LoanRow | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const hasUserFilters =
    debouncedQuery !== "" ||
    taxonomy !== "all" ||
    businessUnit !== "all" ||
    sector !== "all" ||
    sortField !== "outstandingNpr" ||
    sortDirection !== "desc" ||
    page !== 1;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, taxonomy, businessUnit, sector, sortField, sortDirection]);

  // Reset to initial rows if all filters are at defaults
  useEffect(() => {
    if (!hasUserFilters) {
      setRows(initialRows);
      setTotal(initialTotal);
      setLoading(false);
      setError(null);
    }
  }, [hasUserFilters, initialRows, initialTotal]);

  // Refetch when filters/sort/page change (and we're off defaults)
  const lockedRef = useRef(lockedFilter);
  lockedRef.current = lockedFilter;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    sp.set("sortField", sortField);
    sp.set("sortDirection", sortDirection);
    if (debouncedQuery) sp.set("q", debouncedQuery);
    if (taxonomy !== "all") sp.set("taxonomy", taxonomy);
    if (businessUnit !== "all") sp.set("businessUnit", businessUnit);
    if (sector !== "all") sp.set("sector", sector);
    if (lockedRef.current?.taxonomy) sp.set("taxonomy", lockedRef.current.taxonomy);
    if (lockedRef.current?.businessUnit) sp.set("businessUnit", lockedRef.current.businessUnit);
    if (lockedRef.current?.sector) sp.set("sector", lockedRef.current.sector);
    if (lockedRef.current?.status) sp.set("status", lockedRef.current.status);

    try {
      const res = await fetch(`/api/portfolio/loans?${sp.toString()}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json: {
        rows: LoanRow[];
        total: number;
        page: number;
        pageSize: number;
      } = await res.json();
      setRows(json.rows);
      setTotal(json.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sortField,
    sortDirection,
    debouncedQuery,
    taxonomy,
    businessUnit,
    sector,
    accessToken,
  ]);

  useEffect(() => {
    if (hasUserFilters) {
      void fetchRows();
    }
  }, [hasUserFilters, fetchRows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDirection === "asc" ? "▲" : "▼") : "";

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      {/* Filter strip */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search loan ID, borrower, branch..."
          className="min-w-[16rem] flex-1 rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-accent focus:outline-none"
        />
        <select
          value={taxonomy}
          onChange={(e) => setTaxonomy(e.target.value as TaxonomyFilter)}
          className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-slate-200"
          aria-label="Filter by taxonomy"
        >
          <option value="all">All taxonomy</option>
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="red">Red</option>
          <option value="unclassified">Unclassified</option>
        </select>
        <select
          value={businessUnit}
          onChange={(e) => setBusinessUnit(e.target.value as BusinessUnitFilter)}
          className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-slate-200"
          aria-label="Filter by business unit"
        >
          <option value="all">All units</option>
          {businessUnits.map((bu) => (
            <option key={bu} value={bu}>
              {bu}
            </option>
          ))}
        </select>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-slate-200"
          aria-label="Filter by sector"
        >
          <option value="all">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {loading ? "Loading..." : `${total.toLocaleString()} loans match`}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          Loan fetch failed: {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel/60 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th
                className="cursor-pointer px-3 py-2 hover:text-slate-200"
                onClick={() => toggleSort("id")}
              >
                Loan ID {sortIndicator("id")}
              </th>
              <th className="px-3 py-2">Borrower</th>
              <th className="px-3 py-2">Branch / unit</th>
              <th
                className="cursor-pointer px-3 py-2 text-right hover:text-slate-200"
                onClick={() => toggleSort("outstandingNpr")}
              >
                Outstanding {sortIndicator("outstandingNpr")}
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right hover:text-slate-200"
                onClick={() => toggleSort("attributedCo2eTonnes")}
              >
                Attributed CO₂e {sortIndicator("attributedCo2eTonnes")}
              </th>
              <th className="px-3 py-2 text-center">Tax.</th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center gap-1">
                  Score
                  <InfoTip id="pcaf-score-3" side="left" />
                </span>
              </th>
              <th
                className="cursor-pointer px-3 py-2 text-right hover:text-slate-200"
                onClick={() => toggleSort("disbursedDate")}
              >
                Disbursed {sortIndicator("disbursedDate")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.loan.id}
                onClick={() => setSelected(r)}
                className={`cursor-pointer border-t border-line/60 hover:bg-line/20 ${
                  selected?.loan.id === r.loan.id ? "bg-accent/10" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-300">
                  {r.loan.id}
                </td>
                <td className="px-3 py-2 text-slate-200">
                  <div>{r.borrower.name}</div>
                  <div className="text-xs text-slate-500">
                    {r.borrower.nrbSector}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-300">
                  <div>{r.loan.branch ?? "—"}</div>
                  <div className="text-slate-500">{r.loan.businessUnit}</div>
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  {formatNpr(r.loan.outstandingNpr)}
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  {r.attribution.attributedCo2eTonnes > 0
                    ? formatCo2e(r.attribution.attributedCo2eTonnes)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  <TaxonomyDot color={r.loan.nrbTaxonomy} />
                </td>
                <td
                  className={`px-3 py-2 text-right ${qualityScoreColors[r.attribution.dataQualityScore]}`}
                >
                  {r.attribution.dataQualityScore}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-400">
                  {r.loan.disbursedDate}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No loans match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <span>
          Showing {((page - 1) * pageSize + 1).toLocaleString()}
          {"–"}
          {Math.min(page * pageSize, total).toLocaleString()} of{" "}
          {total.toLocaleString()} loans &nbsp;·&nbsp; page {page} of{" "}
          {totalPages.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1 || loading}
            className="rounded-md border border-line bg-panel px-2 py-1 disabled:opacity-40"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="rounded-md border border-line bg-panel px-2 py-1 disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-line bg-panel px-2 py-1 disabled:opacity-40"
          >
            Next ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-line bg-panel px-2 py-1 disabled:opacity-40"
          >
            »
          </button>
        </div>
      </div>

      {/* Drawer */}
      {selected && (
        <LoanDrawer row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide-in drawer with loan + borrower + attribution detail
// ---------------------------------------------------------------------------

function LoanDrawer({ row, onClose }: { row: LoanRow; onClose: () => void }) {
  const { loan, borrower, attribution } = row;
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {loan.id}
            </div>
            <div className="text-lg font-semibold text-white">
              {borrower.name}
            </div>
            <div className="text-xs text-slate-500">{borrower.nrbSector}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-300"
            aria-label="Close detail panel"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          <Badge className={taxonomyColors[loan.nrbTaxonomy]}>
            {loan.nrbTaxonomy}
          </Badge>
          <InfoTip id={`taxonomy-${loan.nrbTaxonomy}`} side="below" />
          {loan.businessUnit && (
            <Badge className="border-line bg-panelAlt text-slate-300">
              {loan.businessUnit}
            </Badge>
          )}
          {loan.status && (
            <Badge className="border-line bg-panelAlt text-slate-300">
              {loan.status}
            </Badge>
          )}
        </div>

        {/*
          Compact NRB compliance stripe — two live-status CTAs for the
          two independent NRB frameworks (ESDD risk screening under the
          NRB ESRM Guideline 2022, and Green Finance Taxonomy 2024
          classification). Chips fetch
          from the same Supabase endpoints the rich compliance drawer
          uses. For full per-question detail, use the "View NRB
          compliance status" button on the ESRM tab.
        */}
        <NrbComplianceStripe loanId={loan.id} nrbSector={borrower.nrbSector} />

        <dl className="mt-4 space-y-2 text-sm">
          <DrawerRow label="Product" value={loan.product} />
          <DrawerRow label="Purpose" value={loan.purpose} />
          <DrawerRow
            label="Outstanding"
            value={`${formatNpr(loan.outstandingNpr)} · ${formatUsd(loan.outstandingUsd)}`}
          />
          <DrawerRow label="Branch" value={loan.branch ?? "—"} />
          <DrawerRow label="Disbursed" value={loan.disbursedDate} />
          <DrawerRow label="Matures" value={loan.maturityDate} />

          <div className="mt-3 border-t border-line/60 pt-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Borrower
            </div>
          </div>
          <DrawerRow
            label={
              <span className="inline-flex items-center gap-1">
                Enterprise value
                <InfoTip id="ev-demo-only" side="left" />
              </span>
            }
            value={`${formatNpr(borrower.enterpriseValueUsd * NPR_PER_USD)} · ${formatUsd(borrower.enterpriseValueUsd)}`}
            hint="demo only"
          />
          {borrower.parent && (
            <DrawerRow label="Parent" value={borrower.parent} />
          )}
          {borrower.municipality && (
            <DrawerRow
              label="HQ / primary site"
              value={`${borrower.municipality}${borrower.subnationalUnit ? ", " + borrower.subnationalUnit : ""}`}
            />
          )}
          {borrower.publiclyListed && (
            <DrawerRow label="Listing" value="Publicly listed" />
          )}

          <div className="mt-3 border-t border-line/60 pt-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              PCAF attribution
            </div>
          </div>
          <DrawerRow
            label="Attribution factor"
            value={`${(attribution.attributionFactor * 100).toFixed(2)}%`}
            hint="outstanding USD / enterprise value"
          />
          <DrawerRow
            label="Attributed CO₂e"
            value={formatCo2e(attribution.attributedCo2eTonnes)}
            hint={`${formatCo2e(borrower.totalCo2eTonnes)} borrower total × attribution factor`}
          />
          <DrawerRow
            label={
              <span className="inline-flex items-center gap-1">
                Data quality
                <PcafScoreInfoTip
                  score={attribution.dataQualityScore}
                  methodology={attribution.methodology}
                  side="left"
                />
              </span>
            }
            value={
              <span className={qualityScoreColors[attribution.dataQualityScore]}>
                Score {attribution.dataQualityScore}
              </span>
            }
            hint={attribution.qualityNote}
          />

          {borrower.facilities.length > 0 && (
            <>
              <div className="mt-3 border-t border-line/60 pt-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Matched facilities
                </div>
              </div>
              {borrower.facilities.map((f) => (
                <div
                  key={f.assetId}
                  className="rounded-md border border-line/50 bg-panelAlt p-2 text-xs"
                >
                  <div className="font-medium text-slate-200">{f.facilityName}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
                    <span>{formatCo2e(f.annualCo2eTonnes)} / yr</span>
                    {f.municipality && <span>{f.municipality}</span>}
                    {f.cementCapacityMtpa != null && (
                      <span>{f.cementCapacityMtpa.toFixed(2)} Mt/yr cement</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </dl>
      </aside>
    </div>
  );
}

function DrawerRow({
  label,
  value,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-right">
        <div className="text-sm text-slate-100">{value}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NRB compliance stripe — two compact live-status cards
// ---------------------------------------------------------------------------

const NRB_TAXONOMY_COLOR_BG: Record<
  "green" | "amber" | "red" | "unclassified",
  string
> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#64748b",
};

const NRB_RISK_COLOR_BG: Record<"low" | "medium" | "high" | "extreme", string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  extreme: "#ef4444",
};

type StripeState = {
  esdd: {
    loading: boolean;
    answered: number;
    total: number;
    riskClass: "low" | "medium" | "high" | "extreme" | null;
    escalated: boolean;
  };
  taxonomy: {
    loading: boolean;
    color: "green" | "amber" | "red" | "unclassified" | null;
    activityId: string | null;
  };
};

// ESDD total is the fixed sector-agnostic count from the NRB ESRM
// Guideline 2022 Annex 5 (13 questions — 4 general incl. Q1.4 land
// acquisition + 5 EHS incl. Q2.5 climate + 4 social). Sector supplements
// were removed to conform to source.
import {
  fullChecklist as annex5FullChecklist,
} from "@/lib/regulatory/esdd/annex5-questions";

function NrbComplianceStripe({
  loanId,
  nrbSector: _nrbSector,
}: {
  loanId: string;
  nrbSector: string;
}) {
  const esddTotal = annex5FullChecklist().length;
  const [state, setState] = useState<StripeState>({
    esdd: {
      loading: true,
      answered: 0,
      total: esddTotal,
      riskClass: null,
      escalated: false,
    },
    taxonomy: { loading: true, color: null, activityId: null },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [respRes, scrRes, taxRes] = await Promise.all([
        fetch(`/api/esdd/responses?loanId=${encodeURIComponent(loanId)}`).catch(
          () => null,
        ),
        fetch(`/api/esrm/screenings?loanId=${encodeURIComponent(loanId)}`).catch(
          () => null,
        ),
        fetch(`/api/taxonomy/assessments?loanId=${encodeURIComponent(loanId)}`).catch(
          () => null,
        ),
      ]);
      if (cancelled) return;

      let answered = 0;
      if (respRes && respRes.ok) {
        const body = await respRes.json();
        const distinct = new Set<string>();
        for (const r of body.responses ?? []) distinct.add(r.questionId);
        answered = distinct.size;
      }

      let riskClass: StripeState["esdd"]["riskClass"] = null;
      let escalated = false;
      if (scrRes && scrRes.ok) {
        const body = await scrRes.json();
        if (body?.latest) {
          riskClass = body.latest.computed_risk_class;
          escalated = body.latest.escalation_flag;
        }
      }

      let color: StripeState["taxonomy"]["color"] = null;
      let activityId: string | null = null;
      if (taxRes && taxRes.ok) {
        const body = await taxRes.json();
        if (body?.latest) {
          color = body.latest.computed_color;
          activityId = body.latest.activity_id;
        }
      }

      setState({
        esdd: {
          loading: false,
          answered,
          total: esddTotal,
          riskClass,
          escalated,
        },
        taxonomy: { loading: false, color, activityId },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <StripeCard
        label="ESDD"
        subtitle="NRB ESRM 2022"
        chip={
          state.esdd.loading ? (
            <StripeChip tone="neutral">…</StripeChip>
          ) : state.esdd.riskClass ? (
            <StripeChip
              tone="filled"
              bg={NRB_RISK_COLOR_BG[state.esdd.riskClass]}
            >
              {state.esdd.riskClass.toUpperCase()}
            </StripeChip>
          ) : state.esdd.answered > 0 ? (
            <StripeChip tone="neutral">
              {state.esdd.answered}/{state.esdd.total}
            </StripeChip>
          ) : (
            <StripeChip tone="dim">Not started</StripeChip>
          )
        }
        ctaHref={`/esdd/${encodeURIComponent(loanId)}`}
        ctaLabel={
          state.esdd.riskClass
            ? "Review"
            : state.esdd.answered > 0
              ? "Continue"
              : "Start"
        }
        escalated={state.esdd.escalated}
      />
      <StripeCard
        label="Taxonomy"
        subtitle="GFT Oct 2024"
        chip={
          state.taxonomy.loading ? (
            <StripeChip tone="neutral">…</StripeChip>
          ) : state.taxonomy.color ? (
            <StripeChip
              tone="filled"
              bg={NRB_TAXONOMY_COLOR_BG[state.taxonomy.color]}
            >
              {state.taxonomy.color.toUpperCase()}
            </StripeChip>
          ) : (
            <StripeChip tone="dim">Not classified</StripeChip>
          )
        }
        ctaHref={`/taxonomy/${encodeURIComponent(loanId)}`}
        ctaLabel={state.taxonomy.color ? "Re-run" : "Classify"}
      />
    </div>
  );
}

function StripeCard({
  label,
  subtitle,
  chip,
  ctaHref,
  ctaLabel,
  escalated,
}: {
  label: string;
  subtitle: string;
  chip: React.ReactNode;
  ctaHref: string;
  ctaLabel: string;
  escalated?: boolean;
}) {
  return (
    <a
      href={ctaHref}
      className="flex flex-col justify-between rounded-lg border border-line bg-panelAlt p-3 transition hover:bg-white/5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-200">{label}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {subtitle}
          </div>
        </div>
        {chip}
      </div>
      {escalated && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
          Escalated
        </div>
      )}
      <div
        className="mt-3 flex items-center justify-between text-xs font-semibold"
        style={{ color: "var(--brand-primary)" }}
      >
        <span>{ctaLabel}</span>
        <span aria-hidden>→</span>
      </div>
    </a>
  );
}

function StripeChip({
  tone,
  bg,
  children,
}: {
  tone: "filled" | "neutral" | "dim";
  bg?: string;
  children: React.ReactNode;
}) {
  if (tone === "filled") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ backgroundColor: bg }}
      >
        {children}
      </span>
    );
  }
  const cls =
    tone === "neutral"
      ? "border-line bg-panel text-slate-300"
      : "border-line/60 bg-panel/60 text-slate-500";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>
      {children}
    </span>
  );
}
