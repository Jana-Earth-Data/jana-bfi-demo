"use client";

import { useCallback, useEffect, useState } from "react";
import { BfiDemoData, Loan, Borrower, PcafAttribution } from "@/lib/types/bfi";
import { SectorEmissionsChart, TaxonomyPieChart } from "@/components/bfi/charts";
import {
  formatNpr,
  formatUsd,
  formatCo2e,
  formatPercent,
  taxonomyColors,
  qualityScoreColors,
} from "@/components/bfi/ui";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { LoginButton } from "@/components/bfi/login-button";

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  accent = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panelAlt p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div
        className={`mt-2 text-3xl font-semibold ${accent ? "text-accent" : "text-white"}`}
      >
        {value}
      </div>
      {sublabel && <div className="mt-1 text-sm text-slate-500">{sublabel}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loan row in the left panel
// ---------------------------------------------------------------------------

function LoanRow({
  loan,
  borrower,
  attribution,
  selected,
  onClick,
}: {
  loan: Loan;
  borrower: Borrower;
  attribution: PcafAttribution;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition ${
        selected
          ? "border-accent bg-accent/10"
          : "border-line bg-panelAlt hover:border-slate-500"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-white">{borrower.name}</div>
          <div className="mt-0.5 text-xs text-slate-400">{loan.product}</div>
        </div>
        <Badge className={taxonomyColors[loan.nrbTaxonomy]}>
          {loan.nrbTaxonomy}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Outstanding</div>
          <div className="text-slate-200">{formatNpr(loan.outstandingNpr)}</div>
        </div>
        <div>
          <div className="text-slate-500">Attributed</div>
          <div className="text-slate-200">
            {formatCo2e(attribution.attributedCo2eTonnes)}
          </div>
        </div>
        <div>
          <div className="text-slate-500">Quality</div>
          <div className={qualityScoreColors[attribution.dataQualityScore]}>
            Score {attribution.dataQualityScore}/5
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Facility detail (right panel)
// ---------------------------------------------------------------------------

function FacilityDetail({
  loan,
  borrower,
  attribution,
}: {
  loan: Loan;
  borrower: Borrower;
  attribution: PcafAttribution;
}) {
  return (
    <div className="space-y-6">
      {/* Borrower header */}
      <div>
        <div className="text-xs uppercase tracking-wider text-accent">
          Borrower
        </div>
        <h3 className="mt-1 text-xl font-semibold text-white">{borrower.name}</h3>
        <div className="mt-1 text-sm text-slate-400">{borrower.nrbSector}</div>
      </div>

      {/* Loan details */}
      <div className="rounded-xl border border-line bg-slate-950/30 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
          Loan Details
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-slate-500">Product</div>
            <div className="text-slate-200">{loan.product}</div>
          </div>
          <div>
            <div className="text-slate-500">Outstanding</div>
            <div className="text-slate-200">{formatNpr(loan.outstandingNpr)}</div>
          </div>
          <div>
            <div className="text-slate-500">USD Equivalent</div>
            <div className="text-slate-200">{formatUsd(loan.outstandingUsd)}</div>
          </div>
          <div>
            <div className="text-slate-500">NRB Taxonomy</div>
            <Badge className={taxonomyColors[loan.nrbTaxonomy]}>
              {loan.nrbTaxonomy}
            </Badge>
          </div>
          <div className="col-span-2">
            <div className="text-slate-500">Purpose</div>
            <div className="text-slate-200">{loan.purpose}</div>
          </div>
          <div>
            <div className="text-slate-500">Disbursed</div>
            <div className="text-slate-200">{loan.disbursedDate}</div>
          </div>
          <div>
            <div className="text-slate-500">Maturity</div>
            <div className="text-slate-200">{loan.maturityDate}</div>
          </div>
        </div>
      </div>

      {/* PCAF calculation */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <div className="text-xs uppercase tracking-wider text-accent mb-3">
          PCAF Attribution
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Enterprise Value (est.)</span>
            <span className="text-slate-200 font-mono">
              {formatUsd(borrower.enterpriseValueUsd)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">EV Source</span>
            <Badge
              className={
                borrower.evSource === "public-filing"
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }
            >
              {borrower.evSource}
            </Badge>
          </div>
          <div className="border-t border-line/50 pt-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Attribution Factor</span>
            <span className="text-white font-mono">
              {formatPercent(attribution.attributionFactor)}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono pl-2">
            = {formatUsd(loan.outstandingUsd)} / {formatUsd(borrower.enterpriseValueUsd)}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Borrower Total Emissions</span>
            <span className="text-slate-200 font-mono">
              {formatCo2e(borrower.totalCo2eTonnes)}
            </span>
          </div>
          <div className="border-t border-accent/20 pt-2" />
          <div className="flex items-center justify-between">
            <span className="text-accent font-medium">Attributed Emissions</span>
            <span className="text-accent text-lg font-bold font-mono">
              {formatCo2e(attribution.attributedCo2eTonnes)}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono pl-2">
            = {formatPercent(attribution.attributionFactor)} x{" "}
            {formatCo2e(borrower.totalCo2eTonnes)}
          </div>
          <div className="border-t border-line/50 pt-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">PCAF Data Quality</span>
            <span className={`font-mono font-bold ${qualityScoreColors[attribution.dataQualityScore]}`}>
              Score {attribution.dataQualityScore}/5
            </span>
          </div>
          <div className="text-xs text-slate-500">{attribution.qualityNote}</div>
        </div>
      </div>

      {/* Matched facilities */}
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">
          Matched Climate TRACE Facilities ({borrower.facilities.length})
        </div>
        <div className="space-y-3">
          {borrower.facilities.map((f) => (
            <div
              key={f.assetId}
              className="rounded-xl border border-line bg-slate-950/30 p-4"
            >
              <div className="font-medium text-white text-sm">
                {f.facilityName}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Sector: </span>
                  <span className="text-slate-300">{f.sector}</span>
                </div>
                <div>
                  <span className="text-slate-500">Emissions: </span>
                  <span className="text-slate-300">
                    {formatCo2e(f.annualCo2eTonnes)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Year: </span>
                  <span className="text-slate-300">{f.emissionsYear}</span>
                </div>
                <div>
                  <span className="text-slate-500">Match: </span>
                  <span className="text-slate-300">
                    {f.matchMethod} ({(f.matchConfidence * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Location: </span>
                  <span className="text-slate-300">
                    {f.lat.toFixed(2)}, {f.lng.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard (inner, has access to auth context)
// ---------------------------------------------------------------------------

function BfiDashboard({ initialData }: { initialData: BfiDemoData }) {
  const { accessToken } = useAuth();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    initialData.loans[0]?.id ?? ""
  );

  // When user authenticates, fetch live data from API route
  const fetchLiveData = useCallback(async (token: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/bfi-data", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const liveData: BfiDemoData = await res.json();
      setData(liveData);
    } catch (err) {
      console.error("Live BFI fetch failed:", err);
      setFetchError((err as Error).message);
      // Keep showing whatever data we had
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetchLiveData(accessToken);
    } else {
      // Reset to mock when logged out
      setData(initialData);
      setFetchError(null);
    }
  }, [accessToken, initialData, fetchLiveData]);

  const borrowerMap = new Map(data.borrowers.map((b) => [b.id, b]));
  const attrMap = new Map(data.attributions.map((a) => [a.loanId, a]));

  const selectedLoan = data.loans.find((l) => l.id === selectedLoanId);
  const selectedBorrower = selectedLoan
    ? borrowerMap.get(selectedLoan.borrowerId)
    : undefined;
  const selectedAttr = selectedLoan ? attrMap.get(selectedLoan.id) : undefined;

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-4">
            <img
              src="/green_logo.png"
              alt="Jana Earth"
              className="h-12 w-auto"
            />
            <div>
              <div className="text-lg font-semibold text-white">
                Financed Emissions Dashboard
              </div>
              <div className="text-xs text-slate-400">
                PCAF Scope 3, Category 15 - Powered by Jana Earth Data
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-accent">
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Fetching live data...
              </div>
            )}
            <Badge
              className={
                data.meta.isMock
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                  : "border-green-500/30 bg-green-500/10 text-green-200"
              }
            >
              {data.meta.isMock ? "Mock data" : "Live data"}
            </Badge>
            <LoginButton />
          </div>
        </div>

        {/* Error banner */}
        {fetchError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Live data fetch failed: {fetchError}. Showing{" "}
            {data.meta.isMock ? "mock" : "cached"} data.
          </div>
        )}

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Loans"
            value={String(data.portfolio.totalLoans)}
            sublabel="In sample portfolio"
          />
          <KpiCard
            label="Total Outstanding"
            value={formatNpr(data.portfolio.totalOutstandingNpr)}
            sublabel={formatUsd(data.portfolio.totalOutstandingUsd)}
          />
          <KpiCard
            label="Total Financed Emissions"
            value={formatCo2e(data.portfolio.totalAttributedCo2eTonnes)}
            sublabel="Attributed via PCAF"
            accent
          />
          <KpiCard
            label="Avg Data Quality"
            value={`${data.portfolio.weightedDataQuality}/5`}
            sublabel="Weighted by emissions"
          />
        </div>

        {/* Main content: loan list + detail */}
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left panel: loan list */}
          <div className="rounded-3xl border border-line bg-panel/70 p-6">
            <div className="mb-1 text-xs uppercase tracking-wider text-accent">
              Loan Portfolio
            </div>
            <h2 className="text-xl font-semibold text-white">
              Select a loan to see emissions
            </h2>
            <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {data.loans.map((loan) => {
                const borrower = borrowerMap.get(loan.borrowerId)!;
                const attr = attrMap.get(loan.id)!;
                return (
                  <LoanRow
                    key={loan.id}
                    loan={loan}
                    borrower={borrower}
                    attribution={attr}
                    selected={loan.id === selectedLoanId}
                    onClick={() => setSelectedLoanId(loan.id)}
                  />
                );
              })}
            </div>
          </div>

          {/* Right panel: facility detail */}
          <div className="rounded-3xl border border-line bg-panel/70 p-6">
            <div className="mb-1 text-xs uppercase tracking-wider text-accent">
              Emissions Detail
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">
              PCAF Attribution
            </h2>
            {selectedLoan && selectedBorrower && selectedAttr ? (
              <FacilityDetail
                loan={selectedLoan}
                borrower={selectedBorrower}
                attribution={selectedAttr}
              />
            ) : (
              <div className="text-slate-400 text-sm">
                Select a loan from the list to view emissions detail.
              </div>
            )}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-line bg-panel/70 p-6">
            <div className="mb-1 text-xs uppercase tracking-wider text-accent">
              By Sector
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Attributed Emissions by Sector
            </h2>
            <SectorEmissionsChart data={data.portfolio.sectorBreakdown} />
          </div>

          <div className="rounded-3xl border border-line bg-panel/70 p-6">
            <div className="mb-1 text-xs uppercase tracking-wider text-accent">
              NRB Taxonomy
            </div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Loan Classification
            </h2>
            <TaxonomyPieChart data={data.portfolio.taxonomyBreakdown} />
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-green-300 font-semibold">
                  {data.portfolio.taxonomyBreakdown.green}
                </div>
                <div className="text-slate-500">Green</div>
              </div>
              <div>
                <div className="text-amber-300 font-semibold">
                  {data.portfolio.taxonomyBreakdown.amber}
                </div>
                <div className="text-slate-500">Amber</div>
              </div>
              <div>
                <div className="text-red-300 font-semibold">
                  {data.portfolio.taxonomyBreakdown.red}
                </div>
                <div className="text-slate-500">Red</div>
              </div>
              <div>
                <div className="text-slate-300 font-semibold">
                  {data.portfolio.taxonomyBreakdown.unclassified}
                </div>
                <div className="text-slate-500">Unclass.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Methodology note */}
        <div className="rounded-2xl border border-line bg-panelAlt p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Methodology
          </div>
          <p className="text-sm leading-6 text-slate-400">
            {data.meta.pcafMethodologyNote}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pb-4">
          Jana Earth Data Nepal Pvt. Ltd. - BFI Financed Emissions Demo -{" "}
          {new Date().getFullYear()}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper with AuthProvider
// ---------------------------------------------------------------------------

export function BfiPageClient({ data }: { data: BfiDemoData }) {
  return (
    <AuthProvider>
      <BfiDashboard initialData={data} />
    </AuthProvider>
  );
}
