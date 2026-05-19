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
import { TaxonomyPieChart, TAXONOMY_FILL } from "@/components/bfi/charts";
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
          sublabel={`First Bank of Nepal · ${data.meta.asOfDate ?? ""}`}
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
          sublabel={`${formatPercent((funnel?.facilityMatchedOutstandingNpr ?? 0) / Math.max(1, funnel?.inScopeOutstandingNpr ?? 1))} of in-scope value · facility-tier data`}
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
  const stages = [
    {
      label: "Total book",
      sub: "All loans — retail + SME + commercial + corporate",
      count: f.totalLoans,
      value: f.totalOutstandingNpr,
      pctCount: 1,
      pctValue: 1,
      accent: "from-slate-700 to-slate-600",
    },
    {
      label: "In scope for ESRM / Taxonomy",
      sub: "Commercial, corporate, and project-finance loans",
      count: f.inScopeLoans,
      value: f.inScopeOutstandingNpr,
      pctCount: f.totalLoans > 0 ? f.inScopeLoans / f.totalLoans : 0,
      pctValue: f.totalOutstandingNpr > 0
        ? f.inScopeOutstandingNpr / f.totalOutstandingNpr
        : 0,
      accent: "from-amber-600/70 to-amber-500/70",
    },
    {
      label: "Facility-tier data",
      sub: "Climate TRACE + GCCT + capacity-derived facility emissions (PCAF Score 2-3)",
      count: f.facilityMatchedLoans,
      value: f.facilityMatchedOutstandingNpr,
      pctCount:
        f.inScopeLoans > 0 ? f.facilityMatchedLoans / f.inScopeLoans : 0,
      pctValue:
        f.inScopeOutstandingNpr > 0
          ? f.facilityMatchedOutstandingNpr / f.inScopeOutstandingNpr
          : 0,
      accent: "from-emerald-600/70 to-emerald-500/70",
    },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {stages.map((stage, i) => {
        const ofTotalValue =
          f.totalOutstandingNpr > 0 ? stage.value / f.totalOutstandingNpr : 0;
        return (
          <div
            key={stage.label}
            className={`rounded-lg border border-line bg-gradient-to-b ${stage.accent} p-4`}
          >
            <div className="text-xs uppercase tracking-wide text-white/70">
              Stage {i + 1}
            </div>
            <div className="mt-1 text-base font-semibold text-white">
              {stage.label}
            </div>
            <div className="text-xs text-white/70">{stage.sub}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">
                  By count
                </div>
                <div className="mt-0.5 text-lg font-semibold text-white">
                  {stage.count.toLocaleString()}
                </div>
                <div className="text-xs text-white/70">
                  {formatPercent(stage.pctCount)}{" "}
                  {i === 0 ? "of book" : "of prior stage"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">
                  By NPR
                </div>
                <div className="mt-0.5 text-lg font-semibold text-white">
                  {formatNpr(stage.value)}
                </div>
                <div className="text-xs text-white/70">
                  {formatPercent(ofTotalValue)} of book
                </div>
              </div>
            </div>
          </div>
        );
      })}
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
