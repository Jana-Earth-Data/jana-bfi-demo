"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardSsrData } from "@/components/bfi/dashboard";
import {
  Badge,
  KpiCard,
  Panel,
  StatRow,
  TaxonomyDot,
  MutedText,
} from "@/components/bfi/shared/primitives";
import {
  DataQualityBars,
  EmissionsTrendChart,
  SectorEmissionsChart,
} from "@/components/bfi/charts";
import {
  formatCo2e,
  formatNpr,
  formatPercent,
  qualityScoreColors,
  taxonomyColors,
} from "@/components/bfi/ui";
import { InfoTip, PcafScoreInfoTip } from "@/components/bfi/shared/info-tip";
import { NPR_PER_USD } from "@/lib/data/util";
import { NrbTaxonomyExportButton } from "@/components/bfi/reports/nrb-taxonomy-export-button";

export function NsrsTab({ data }: { data: DashboardSsrData }) {
  const s = data.portfolio;
  const trend = s.trend ?? [];
  // YoY compares the last TWO fully-reported years. 2025 is partial through
  // October (Climate TRACE coverage), so we explicitly skip it for YoY.
  const yoy = useMemo(() => {
    const fullYears = trend.filter((p) => p.year < 2025);
    if (fullYears.length < 2) return null;
    const last = fullYears[fullYears.length - 1];
    const prev = fullYears[fullYears.length - 2];
    if (prev.totalAttributedCo2eTonnes === 0) return null;
    return {
      pct:
        (last.totalAttributedCo2eTonnes - prev.totalAttributedCo2eTonnes) /
        prev.totalAttributedCo2eTonnes,
      lastYear: last.year,
      prevYear: prev.year,
    };
  }, [trend]);

  const facilityBorrowers = data.facilityBorrowers.length;

  return (
    <div className="grid gap-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-tour="nsrs-headline">
        <KpiCard
          label="Total financed emissions"
          value={formatCo2e(s.totalAttributedCo2eTonnes)}
          sublabel={
            yoy != null ? (
              <span className={yoy.pct >= 0 ? "text-rose-300" : "text-emerald-300"}>
                {yoy.pct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(yoy.pct))} YoY ({yoy.prevYear} → {yoy.lastYear})
              </span>
            ) : (
              "PCAF Cat. 15 Scope 3"
            )
          }
          accent
        />
        <KpiCard
          label="Most recent fully-reported year"
          value="2024"
          sublabel={
            trend.length > 1
              ? `Trend ${trend[0].year}–${trend[trend.length - 1].year} · 2025 partial (Climate TRACE through Oct)`
              : data.meta.asOfDate ?? ""
          }
        />
        <KpiCard
          label={
            <span className="flex items-center gap-1">
              Weighted PCAF data quality
              <InfoTip
                id={
                  Math.round(s.weightedDataQuality) >= 4
                    ? "pcaf-score-4"
                    : Math.round(s.weightedDataQuality) === 3
                      ? "pcaf-score-3"
                      : "pcaf-score-2"
                }
                side="below"
              />
            </span>
          }
          value={s.weightedDataQuality.toFixed(1)}
          sublabel={`${facilityBorrowers} borrowers with facility-level data`}
        />
        <KpiCard
          label="In-scope exposure"
          value={formatNpr(s.funnel?.inScopeOutstandingNpr ?? 0)}
          sublabel={`${(s.funnel?.inScopeLoans ?? 0).toLocaleString()} commercial / corporate loans`}
        />
      </div>

      {/* Regulatory exports — bank-branded downloads (JSON / xlsx / PDF) */}
      <div data-tour="regulatory-exports">
        <Panel
          title="Regulatory exports"
          subtitle="Portfolio-level NRB Green Finance Taxonomy classification report"
        >
          <NrbTaxonomyExportButton />
        </Panel>
      </div>

      {/* Charts row 1: multi-year trend + data quality */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Multi-year trend"
          subtitle="Attributed emissions by NRB taxonomy color"
          className="lg:col-span-2"
        >
          {trend.length > 0 ? (
            <EmissionsTrendChart data={trend} />
          ) : (
            <p className="text-sm text-slate-500">No trend data available.</p>
          )}
        </Panel>
        <div data-tour="data-quality">
        <Panel
          title="Data quality distribution"
          subtitle="PCAF score by NPR outstanding"
        >
          <DataQualityBars distribution={s.dataQualityDistribution ?? []} />
          <div className="mt-3 space-y-1">
            {(s.dataQualityDistribution ?? []).map((d) => (
              <div
                key={d.score}
                className="flex items-center justify-between text-xs"
              >
                <span
                  className={`inline-flex items-center gap-1 ${qualityScoreColors[d.score]}`}
                >
                  Score {d.score}
                  <PcafScoreInfoTip score={d.score} side="right" />
                </span>
                <span className="text-slate-400">
                  {d.loanCount.toLocaleString()} loans ·{" "}
                  {formatNpr(d.outstandingNpr)} ·{" "}
                  {formatCo2e(d.attributedCo2eTonnes)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        </div>
      </div>

      {/* Sector emissions chart — full width */}
      <Panel
        title="Emissions by sector"
        subtitle="Attributed CO₂e for the disclosure year"
      >
        <SectorEmissionsChart data={s.sectorBreakdown} />
      </Panel>

      {/* Disclosure preview */}
      <Panel
        title="Annual report disclosure preview"
        subtitle="IFRS S2 / NSRS-aligned excerpt"
      >
        <DisclosurePreview data={data} />
      </Panel>

      {/* Taxonomy portfolio breakdown — reads latest saved assessments */}
      <div data-tour="taxonomy-breakdown">
        <Panel
          title="Taxonomy portfolio breakdown"
          subtitle="Latest saved NRB Green Finance Taxonomy classification per loan"
        >
          <TaxonomyBreakdownSection />
        </Panel>
      </div>

      {/* Top contributors — detail table at the bottom of the page */}
      <Panel
        title="Top contributors"
        subtitle="Loans driving the largest attributed emissions"
      >
        <TopContributorsTable data={data} />
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top contributors table with drill-down
// ---------------------------------------------------------------------------

function TopContributorsTable({ data }: { data: DashboardSsrData }) {
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(
    data.topContributors[0]?.loan.id ?? null
  );
  const selected = data.topContributors.find(
    (r) => r.loan.id === selectedLoanId
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel/60 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Loan</th>
                <th className="px-3 py-2">Borrower</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2 text-right">Attributed CO₂e</th>
                <th className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1">
                    Score
                    <InfoTip id="pcaf-score-3" side="left" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topContributors.map((r) => {
                const isSel = r.loan.id === selectedLoanId;
                return (
                  <tr
                    key={r.loan.id}
                    onClick={() => setSelectedLoanId(r.loan.id)}
                    className={`cursor-pointer border-t border-line/60 hover:bg-line/20 ${
                      isSel ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">
                      {r.loan.id}
                    </td>
                    <td className="px-3 py-2 text-slate-200">
                      <div className="flex items-center gap-2">
                        <TaxonomyDot color={r.loan.nrbTaxonomy} />
                        <span>{r.borrower.name}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {r.borrower.nrbSector}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {formatNpr(r.loan.outstandingNpr)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {formatCo2e(r.attribution.attributedCo2eTonnes)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${qualityScoreColors[r.attribution.dataQualityScore]}`}
                    >
                      {r.attribution.dataQualityScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <DrillDown row={selected} />
        ) : (
          <MutedText>Select a loan to inspect attribution.</MutedText>
        )}
      </div>
    </div>
  );
}

function DrillDown({
  row,
}: {
  row: DashboardSsrData["topContributors"][number];
}) {
  const { loan, borrower, attribution } = row;
  return (
    <div className="rounded-lg border border-line bg-panel/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {loan.id}
          </div>
          <div className="text-base font-semibold text-white">
            {borrower.name}
          </div>
          <div className="text-xs text-slate-500">{borrower.nrbSector}</div>
        </div>
        <Badge className={taxonomyColors[loan.nrbTaxonomy]}>
          {loan.nrbTaxonomy}
        </Badge>
      </div>
      <div className="mt-3 space-y-1">
        <StatRow
          label="Loan outstanding"
          value={formatNpr(loan.outstandingNpr)}
        />
        <StatRow
          label="Borrower EV"
          value={formatNpr(borrower.enterpriseValueUsd * NPR_PER_USD)}
          hint="demo only"
        />
        <StatRow
          label="Attribution factor"
          value={`${(attribution.attributionFactor * 100).toFixed(2)}%`}
          hint="loan outstanding ÷ enterprise value"
        />
        <StatRow
          label="Borrower CO₂e"
          value={formatCo2e(borrower.totalCo2eTonnes)}
          hint={`${borrower.facilities.length} matched ${borrower.facilities.length === 1 ? "facility" : "facilities"}`}
        />
        <StatRow
          label="Attributed CO₂e"
          value={formatCo2e(attribution.attributedCo2eTonnes)}
          hint="attribution factor × borrower CO₂e"
        />
        <StatRow
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
      </div>
      {borrower.facilities.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-line/60 pt-3 text-xs">
          <div className="text-slate-400">Matched facilities</div>
          {borrower.facilities.map((f) => (
            <div key={f.assetId} className="flex justify-between text-slate-300">
              <span className="truncate" title={f.facilityName}>
                {f.facilityName}
              </span>
              <span className="ml-2 whitespace-nowrap text-slate-500">
                {formatCo2e(f.annualCo2eTonnes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disclosure preview (annual-report style excerpt)
// ---------------------------------------------------------------------------

function DisclosurePreview({ data }: { data: DashboardSsrData }) {
  const s = data.portfolio;
  const trend = s.trend ?? [];
  const latestYear = trend[trend.length - 1];
  const total = latestYear?.totalAttributedCo2eTonnes ?? s.totalAttributedCo2eTonnes;
  const red = latestYear?.byTaxonomy.red ?? 0;
  const green = latestYear?.byTaxonomy.green ?? 0;

  const facilityShareValue =
    (s.funnel?.facilityMatchedOutstandingNpr ?? 0) /
    Math.max(1, s.funnel?.inScopeOutstandingNpr ?? 1);
  // Disclosure narrative uses the latest fully-reported year, not the partial 2025.
  const fullYears = trend.filter((p) => p.year < 2025);
  const disclosureYear = fullYears[fullYears.length - 1] ?? latestYear;
  const disclosureTotal =
    disclosureYear?.totalAttributedCo2eTonnes ?? total;
  const disclosureRed = disclosureYear?.byTaxonomy.red ?? red;
  const disclosureGreen = disclosureYear?.byTaxonomy.green ?? green;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-line bg-panel/30 p-5">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Scope 3 — Category 15 financed emissions
        </div>
        <p className="mt-2 text-sm text-slate-300">
          For the calendar year {disclosureYear?.year ?? "—"} (most recent
          fully-reported year), {data.meta.bankName} attributed{" "}
          <span className="font-semibold text-white">{formatCo2e(disclosureTotal)}</span>{" "}
          of greenhouse gas emissions to its lending book under the PCAF Global
          GHG Accounting and Reporting Standard, Category 15.
        </p>
        <p className="mt-3 text-sm text-slate-300">
          The portfolio's weighted PCAF data quality score is{" "}
          <span
            className={
              qualityScoreColors[
                Math.round(s.weightedDataQuality) as 1 | 2 | 3 | 4 | 5
              ]
            }
          >
            {s.weightedDataQuality.toFixed(1)}
          </span>
          , reflecting that{" "}
          <span className="font-semibold text-white">
            {formatPercent(facilityShareValue)}
          </span>{" "}
          of in-scope outstanding value is attached to facility-level Climate
          TRACE emissions.
        </p>
        <p className="mt-3 text-sm text-slate-300">
          High-emissions sectors (red taxonomy) account for{" "}
          <span className="font-semibold text-white">{formatCo2e(disclosureRed)}</span>;
          green taxonomy assets (renewable energy) contribute{" "}
          <span className="font-semibold text-white">{formatCo2e(disclosureGreen)}</span>.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel/30 p-5">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          Methodology note
        </div>
        <p className="mt-2 text-sm text-slate-300">{data.meta.pcafMethodologyNote}</p>
        <p className="mt-3 text-xs text-slate-500">
          Reference: PCAF Global GHG Accounting and Reporting Standard (Part A,
          Chapter 5), IFRS S2 §29, NSRS draft §17(b). Underlying facility data:
          Climate TRACE Nepal facility emissions; Global Cement and Concrete
          Tracker (July 2025); Global Energy Monitor.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Taxonomy portfolio breakdown — reads /api/portfolio/taxonomy-summary
//
// Splits the tenant's saved NRB Green Finance Taxonomy assessments into the
// four disclosure buckets and surfaces the Amber "transitional financing"
// footnote plus the "not yet classified" callout so an officer can see how
// much of the eligible book is still unreviewed.
// ---------------------------------------------------------------------------

type TxBucketKey = "green" | "amber" | "red" | "unclassified";

type TxActivityBreakdown = {
  activityId: string;
  activityName: string;
  count: number;
  nprTotal: number;
};

type TxBucketTotal = {
  count: number;
  nprTotal: number;
  activityBreakdown: TxActivityBreakdown[];
};

type TxSummaryResponse = {
  ok: true;
  tenant: { id: string; displayName: string };
  totals: Record<TxBucketKey, TxBucketTotal>;
  totalClassified: number;
  totalUnclassifiedApplicable: number;
};

// Colour swatches — same primitives used elsewhere in the demo
// (esrm-tab.tsx WB_TAX_BG, loan-table.tsx). Duplicated here rather than
// importing so the NSRS tab stays self-contained.
const BUCKET_COLOR: Record<TxBucketKey, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#64748b",
};

const BUCKET_META: Record<
  TxBucketKey,
  { label: string; sublabel: string }
> = {
  green: { label: "Green", sublabel: "Transformative" },
  amber: { label: "Amber", sublabel: "Transitional" },
  red: { label: "Red", sublabel: "Not aligned" },
  unclassified: { label: "Unclassified", sublabel: "Rule did not resolve" },
};

function TaxonomyBreakdownSection() {
  const [summary, setSummary] = useState<TxSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portfolio/taxonomy-summary");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setError(body?.error ?? `Request failed (${res.status})`);
          }
          return;
        }
        const body = (await res.json()) as TxSummaryResponse;
        if (!cancelled) setSummary(body);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-slate-500">Loading taxonomy breakdown…</p>
    );
  }
  if (error || !summary) {
    return (
      <p className="text-sm text-rose-300">
        Could not load taxonomy breakdown{error ? `: ${error}` : ""}.
      </p>
    );
  }

  const buckets: TxBucketKey[] = ["green", "amber", "red", "unclassified"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {buckets.map((key) => {
          const t = summary.totals[key];
          const meta = BUCKET_META[key];
          const color = BUCKET_COLOR[key];
          return (
            <div
              key={key}
              className="rounded-lg border bg-panel/40 p-4"
              style={{ borderColor: `${color}55` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div className="text-sm font-semibold text-white">
                  {meta.label}
                </div>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-500">
                  {meta.sublabel}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {t.count.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {t.count === 1 ? "loan" : "loans"} · {formatNpr(t.nprTotal)}
              </div>
              {t.activityBreakdown.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-[11px] text-slate-500">
                  {t.activityBreakdown.slice(0, 3).map((a) => (
                    <li key={a.activityId} className="flex justify-between gap-2">
                      <span className="truncate" title={a.activityName}>
                        {a.activityName}
                      </span>
                      <span className="whitespace-nowrap text-slate-400">
                        {a.count} · {formatNpr(a.nprTotal)}
                      </span>
                    </li>
                  ))}
                  {t.activityBreakdown.length > 3 && (
                    <li className="text-slate-600">
                      +{t.activityBreakdown.length - 3} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        <span className="font-semibold text-amber-300">Amber (transitional):</span>{" "}
        transitional financing counts toward the bank&rsquo;s green finance target
        on separate terms per NRB — see the NRB GFT October 2024 Ch. 5 for the
        reporting treatment.
      </p>

      <div className="rounded-lg border border-line bg-panel/30 px-4 py-3 text-xs text-slate-300">
        <span className="font-semibold text-white">
          {summary.totalUnclassifiedApplicable.toLocaleString()}
        </span>{" "}
        {summary.totalUnclassifiedApplicable === 1 ? "loan" : "loans"} in
        taxonomy-eligible sectors{" "}
        {summary.totalUnclassifiedApplicable === 1 ? "is" : "are"} not yet
        classified.{" "}
        <a
          href="#esrm"
          className="text-accent underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          Open the ESRM tab
        </a>{" "}
        to assign and classify.
      </div>
    </div>
  );
}
