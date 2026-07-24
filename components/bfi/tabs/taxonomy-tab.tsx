"use client";

import { useMemo, useState } from "react";
import { DashboardSsrData } from "@/components/bfi/dashboard";
import {
  Badge,
  KpiCard,
  Panel,
  ProgressBar,
  SegmentToggle,
  StatRow,
} from "@/components/bfi/shared/primitives";
import {
  PortfolioFunnelChart,
  TaxonomyPieChart,
  TAXONOMY_FILL,
  type FunnelStage,
} from "@/components/bfi/charts";
import { InfoTip } from "@/components/bfi/shared/info-tip";
import {
  formatCo2e,
  formatNpr,
  formatPercent,
  taxonomyColors,
} from "@/components/bfi/ui";

type Mode = "count" | "value";

export function TaxonomyTab({ data }: { data: DashboardSsrData }) {
  const [mode, setMode] = useState<Mode>("value");
  const s = data.portfolio;
  const funnel = s.funnel;
  const totalCount = s.totalLoans;
  const totalValue = s.totalOutstandingNpr;

  const breakdown = mode === "count"
    ? s.taxonomyBreakdown
    : (s.taxonomyBreakdownValue ?? s.taxonomyBreakdown);
  const total =
    breakdown.green +
    breakdown.amber +
    breakdown.red +
    breakdown.unclassified;

  return (
    <div className="grid gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total loans"
          value={totalCount.toLocaleString()}
          sublabel={`across ${data.distinctValues.branches.length} branches`}
        />
        <KpiCard
          label="Total outstanding"
          value={formatNpr(totalValue)}
          sublabel={`${data.meta.bankName} · ${data.meta.asOfDate ?? ""}`}
        />
        <KpiCard
          label="In scope for taxonomy"
          value={(funnel?.inScopeLoans ?? 0).toLocaleString()}
          sublabel={`${formatPercent((funnel?.inScopeLoans ?? 0) / Math.max(1, totalCount))} of loans · ${formatNpr(funnel?.inScopeOutstandingNpr ?? 0)}`}
        />
        <KpiCard
          label={
            <span className="inline-flex items-center gap-1">
              Facility-data classified
              <InfoTip id="facility-tier" side="below" />
            </span>
          }
          value={(funnel?.facilityMatchedLoans ?? 0).toLocaleString()}
          sublabel={`${(funnel?.facilityMatchedBorrowers ?? 0).toLocaleString()} unique borrowers · ${formatPercent((funnel?.facilityMatchedOutstandingNpr ?? 0) / Math.max(1, funnel?.inScopeOutstandingNpr ?? 1))} of in-scope value`}
          accent
        />
      </div>

      {/* Funnel */}
      <div data-tour="funnel">
        <Panel
          title="Portfolio funnel"
          subtitle="From total book to facility-verified exposure — see why count vs. value matters"
        >
          <Funnel data={data} />
        </Panel>
      </div>

      {/* Pie / bars */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={
            <span className="inline-flex items-center gap-1">
              NRB Green Finance Taxonomy
              <InfoTip id="nrb-taxonomy" side="below" />
            </span>
          }
          subtitle={
            mode === "count"
              ? "By loan count — note retail dominance"
              : "By outstanding value — note where the exposure actually sits"
          }
          action={
            <SegmentToggle
              value={mode}
              options={[
                { value: "value", label: "By NPR" },
                { value: "count", label: "By count" },
              ]}
              onChange={setMode}
            />
          }
        >
          <TaxonomyPieChart data={breakdown} mode={mode} />
        </Panel>

        <Panel title="Taxonomy split" className="lg:col-span-2">
          <div className="space-y-3">
            {(["green", "amber", "red", "unclassified"] as const).map((color) => {
              const v = breakdown[color];
              const pct = total > 0 ? v / total : 0;
              return (
                <div key={color}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={taxonomyColors[color]}>
                        {color}
                      </Badge>
                      <InfoTip id={`taxonomy-${color}`} side="right" />
                      <span className="text-slate-300">
                        {mode === "count"
                          ? `${v.toLocaleString()} loans`
                          : formatNpr(v)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatPercent(pct)}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    fillClass={
                      color === "green"
                        ? "bg-emerald-400"
                        : color === "amber"
                          ? "bg-amber-400"
                          : color === "red"
                            ? "bg-rose-400"
                            : "bg-slate-500"
                    }
                    trackClass="bg-line/40"
                    className="mt-1"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-md border border-line/60 bg-panel/40 p-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Why two views matter: </span>
            By count, retail loans dominate and most of the book is unclassified
            because residential mortgages and personal loans fall outside NRB's
            taxonomy. By value (NPR), the green/amber/red breakdown of the
            commercial book is what NRB will actually examine.
          </div>
        </Panel>
      </div>

      {/* Sector breakdown */}
      <Panel
        title="Sector breakdown"
        subtitle="In-scope loans grouped by NRB sector classification"
      >
        <SectorTable data={data} />
      </Panel>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel visualization
// ---------------------------------------------------------------------------

function Funnel({ data }: { data: DashboardSsrData }) {
  const f = data.portfolio.funnel;
  if (!f) return null;
  const stages: FunnelStage[] = [
    {
      name: "Total book",
      count: f.totalLoans,
      nprValue: f.totalOutstandingNpr,
      fill: "#475569",
      label: `Total book · ${f.totalLoans.toLocaleString()} loans · ${formatNpr(f.totalOutstandingNpr)}`,
    },
    {
      name: "In scope for ESRM / Taxonomy",
      count: f.inScopeLoans,
      nprValue: f.inScopeOutstandingNpr,
      fill: "#fbbf24",
      label: `In scope · ${f.inScopeLoans.toLocaleString()} loans · ${formatNpr(f.inScopeOutstandingNpr)}`,
    },
    {
      name: "Facility-tier data",
      count: f.facilityMatchedLoans,
      nprValue: f.facilityMatchedOutstandingNpr,
      fill: "#34d399",
      label: `Facility-tier data · ${f.facilityMatchedLoans.toLocaleString()} loans · ${formatNpr(f.facilityMatchedOutstandingNpr)}`,
    },
  ];
  const totalPct =
    f.totalLoans > 0 ? (f.facilityMatchedLoans / f.totalLoans) * 100 : 0;
  const valuePct =
    f.totalOutstandingNpr > 0
      ? (f.facilityMatchedOutstandingNpr / f.totalOutstandingNpr) * 100
      : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PortfolioFunnelChart stages={stages} height={300} />
      </div>
      <div className="space-y-3 lg:col-span-2">
        <div className="rounded-lg border border-line/60 bg-panel/40 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            The headline
          </div>
          <p className="mt-2 text-sm text-slate-200">
            <span className="font-semibold text-white">
              {(f.facilityMatchedBorrowers ?? 0).toLocaleString()}
            </span>{" "}
            unique borrowers carry facility-tier emissions data across{" "}
            <span className="font-semibold text-white">
              {f.facilityMatchedLoans.toLocaleString()}
            </span>{" "}
            of the bank's loans. That is{" "}
            <span className="font-semibold text-white">
              {formatPercent(totalPct / 100)}
            </span>{" "}
            of the book by count,{" "}
            <span className="font-semibold text-white">
              {formatPercent(valuePct / 100)}
            </span>{" "}
            by outstanding value. Small by count, large by value, all of the
            regulatory exposure.
          </p>
        </div>
        <div className="space-y-1 rounded-lg border border-line/60 bg-panel/40 p-4 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#475569" }} />
            Total book: all loans, retail through corporate.
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#fbbf24" }} />
            In scope: commercial, corporate, and project finance (the slice NRB regulates).
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#34d399" }} />
            Facility-tier data: PCAF Score 2-3 from Climate TRACE, GCCT, or capacity-derived.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sector table
// ---------------------------------------------------------------------------

function SectorTable({ data }: { data: DashboardSsrData }) {
  const rows = data.portfolio.sectorBreakdown.slice(0, 12);
  const maxNpr = rows.reduce((m, r) => Math.max(m, r.outstandingNpr ?? 0), 1);
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-panel/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Sector</th>
            <th className="px-3 py-2 text-right">Loans</th>
            <th className="px-3 py-2 text-right">Outstanding (NPR)</th>
            <th className="px-3 py-2 text-right">Attributed CO₂e</th>
            <th className="px-3 py-2 w-[28%]">Share of in-scope value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sector} className="border-t border-line/60">
              <td className="px-3 py-2 text-slate-200">{r.sector}</td>
              <td className="px-3 py-2 text-right text-slate-300">
                {r.loanCount.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-slate-200">
                {formatNpr(r.outstandingNpr ?? 0)}
              </td>
              <td className="px-3 py-2 text-right text-slate-200">
                {r.attributedCo2e > 0 ? formatCo2e(r.attributedCo2e) : "—"}
              </td>
              <td className="px-3 py-2">
                <ProgressBar
                  value={(r.outstandingNpr ?? 0) / maxNpr}
                  fillClass="bg-accent"
                  trackClass="bg-line/40"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
