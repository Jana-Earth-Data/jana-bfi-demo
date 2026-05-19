"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { DashboardHeader } from "@/components/bfi/header";
import { TaxonomyTab } from "@/components/bfi/tabs/taxonomy-tab";
import { NsrsTab } from "@/components/bfi/tabs/nsrs-tab";
import { EsrmTab } from "@/components/bfi/tabs/esrm-tab";
import { LoansTab } from "@/components/bfi/tabs/loans-tab";
import { TourProvider, useTour } from "@/lib/tour/tour-context";
import { TourOverlay } from "@/components/bfi/tour/tour-overlay";
import { TourControls } from "@/components/bfi/tour/tour-controls";
import {
  BfiDemoMeta,
  Borrower,
  BorrowerScreening,
  PortfolioSummary,
} from "@/lib/types/bfi";
import { LoanRow } from "@/lib/data/portfolio-query";

export type DashboardSsrData = {
  meta: BfiDemoMeta;
  portfolio: PortfolioSummary;
  initialLoans: LoanRow[];
  totalLoanCount: number;
  topContributors: LoanRow[];
  applications: LoanRow[];
  facilityBorrowers: Borrower[]; // borrowers with facility data (for ESRM/maps)
  /** Pre-computed screenings keyed by borrower ID (covers the applications queue). */
  screenings: Record<string, BorrowerScreening>;
  /** True when EDGAR / OpenAQ screening enrichments were fetched live. */
  liveEnrichment?: {
    edgar: boolean;
    openaq: boolean;
    edgarYear?: number;
  };
  distinctValues: {
    sectors: string[];
    businessUnits: string[];
    branches: Array<{ code: string; name: string }>;
  };
};

type TabId = "loans" | "esrm" | "taxonomy" | "nsrs";

const TABS: Array<{
  id: TabId;
  label: string;
  description: string;
}> = [
  {
    id: "loans",
    label: "Loan Book",
    description: "Simulated 80K-loan portfolio · Search, filter, inspect any record",
  },
  {
    id: "esrm",
    label: "ESRM",
    description: "Credit Decision · Screen new loans (2018 NRB Directive)",
  },
  {
    id: "taxonomy",
    label: "Taxonomy",
    description: "Portfolio Classification · Green / Amber / Red (Oct 2024)",
  },
  {
    id: "nsrs",
    label: "NSRS",
    description: "Disclosure · Financed emissions, PCAF (2026-27)",
  },
];

const VALID_TABS: ReadonlySet<TabId> = new Set([
  "loans",
  "esrm",
  "taxonomy",
  "nsrs",
]);

function tabFromHash(): TabId {
  if (typeof window === "undefined") return "loans";
  const h = window.location.hash.replace(/^#/, "");
  return VALID_TABS.has(h as TabId) ? (h as TabId) : "loans";
}

function DashboardInner({ data }: { data: DashboardSsrData }) {
  const [tab, setTab] = useState<TabId>("loans");
  const [liveData, setLiveData] = useState<DashboardSsrData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const { accessToken } = useAuth();
  const tour = useTour();

  // Resolve initial tab from URL hash after hydration
  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // When the tour wants a different tab, drive ours
  useEffect(() => {
    if (tour.desiredTab && tour.desiredTab !== tab) {
      setTab(tour.desiredTab);
    }
  }, [tour.desiredTab, tab]);

  const setTabAndHash = useCallback((id: TabId) => {
    setTab(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  // Re-fetch as live when token arrives
  useEffect(() => {
    if (!accessToken) {
      setLiveData(null);
      setLiveError(null);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    fetch("/api/dashboard-data", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json() as Promise<DashboardSsrData>;
      })
      .then((d) => {
        if (cancelled) return;
        setLiveData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        setLiveError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const active = liveData ?? data;
  const isLive = !!liveData && !active.meta.isMock;

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <DashboardHeader meta={active.meta} isLive={isLive} />

      <nav className="border-b border-line bg-panel/40" data-tour="tab-strip">
        <div className="mx-auto flex max-w-[1500px] gap-1 px-6">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabAndHash(t.id)}
                className={`relative -mb-px border-b-2 px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? "border-accent text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="font-semibold">{t.label}</span>
                <span className="ml-3 text-xs text-slate-500">
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {liveLoading && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/5 px-6 py-2 text-xs text-emerald-300">
          Loading live Climate TRACE data...
        </div>
      )}
      {liveError && (
        <div className="border-b border-rose-500/30 bg-rose-500/5 px-6 py-2 text-xs text-rose-300">
          Live data fetch failed: {liveError}. Showing demo data.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-6 py-6">
        {tab === "loans" && <LoansTab data={active} />}
        {tab === "esrm" && <EsrmTab data={active} />}
        {tab === "taxonomy" && <TaxonomyTab data={active} />}
        {tab === "nsrs" && <NsrsTab data={active} />}
      </main>

      <footer className="border-t border-line bg-panel/30 py-4 text-center text-xs text-slate-500">
        First Bank of Nepal demo dashboard · Synthesized portfolio · Real facility data from Climate TRACE &amp; Global Cement and Concrete Tracker
      </footer>
    </div>
  );
}

export function Dashboard({ data }: { data: DashboardSsrData }) {
  return (
    <AuthProvider>
      <TourProvider>
        <DashboardInner data={data} />
        <TourOverlay />
        <TourControls />
      </TourProvider>
    </AuthProvider>
  );
}
