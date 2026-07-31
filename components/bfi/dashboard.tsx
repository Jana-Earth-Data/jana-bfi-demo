"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { DashboardHeader } from "@/components/bfi/header";
import { TaxonomyTab } from "@/components/bfi/tabs/taxonomy-tab";
import { NfrsTab } from "@/components/bfi/tabs/nfrs-tab";
import { EsrmTab } from "@/components/bfi/tabs/esrm-tab";
import { LoansTab } from "@/components/bfi/tabs/loans-tab";
import { MyWorkTab } from "@/components/bfi/tabs/my-work-tab";
import { useTour } from "@/lib/tour/tour-context";
import {
  BfiDemoMeta,
  Borrower,
  BorrowerScreening,
  PortfolioSummary,
} from "@/lib/types/bfi";
import { LoanRow } from "@/lib/data/portfolio-query";
import type { Officer } from "@/lib/tenants";
import type { ClimatePortfolioSummary } from "@/lib/regulatory/climate/infer";

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
  /**
   * Portfolio-level climate risk summary (NRB ESRM 2022 §4.4).
   * Powers the NFRS "above threshold without target" callout and any
   * other portfolio-level climate metric. Always present — computed from
   * the in-memory synthesized borrower catalogue.
   */
  climateSummary: ClimatePortfolioSummary;
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
  /** Current tenant's officer roster (surfaced in the header picker). */
  officers: Officer[];
  /** Currently signed-in officer, or null when none is selected. */
  currentOfficer: Officer | null;
};

type TabId = "mywork" | "loans" | "esrm" | "taxonomy" | "nfrs";

const TABS: Array<{
  id: TabId;
  label: string;
  description: string;
}> = [
  {
    id: "mywork",
    label: "My Work",
    description: "Your ESRM queue · Assigned loans, in-progress checklists",
  },
  {
    id: "loans",
    label: "Loan Book",
    description: "Simulated 80K-loan portfolio · Search, filter, inspect any record",
  },
  {
    id: "esrm",
    label: "ESRM",
    description: "Manager view · All loans under review (NRB Circular 22 · ESRM 2022)",
  },
  {
    id: "taxonomy",
    label: "Taxonomy",
    description: "Portfolio Classification · Green / Amber / Red (Oct 2024)",
  },
  {
    id: "nfrs",
    label: "NFRS",
    description: "Disclosure · Financed emissions, PCAF (ICAN exposure draft)",
  },
];

const VALID_TABS: ReadonlySet<TabId> = new Set([
  "mywork",
  "loans",
  "esrm",
  "taxonomy",
  "nfrs",
]);

function tabFromHash(fallback: TabId): TabId {
  if (typeof window === "undefined") return fallback;
  const h = window.location.hash.replace(/^#/, "");
  return VALID_TABS.has(h as TabId) ? (h as TabId) : fallback;
}

function DashboardInner({ data }: { data: DashboardSsrData }) {
  // Default tab depends on identity: signed-in officers land on their
  // work queue; unsigned visitors land on the loan book (the natural
  // demo intro). Explicit URL hash always wins.
  const defaultTab: TabId = data.currentOfficer ? "mywork" : "loans";
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [liveData, setLiveData] = useState<DashboardSsrData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const { accessToken } = useAuth();
  const tour = useTour();

  // Resolve initial tab from URL hash after hydration
  useEffect(() => {
    setTab(tabFromHash(defaultTab));
    const onHash = () => setTab(tabFromHash(defaultTab));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [defaultTab]);

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
      <DashboardHeader
        meta={active.meta}
        isLive={isLive}
        officers={data.officers}
        currentOfficer={data.currentOfficer}
      />

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
                    ? "text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
                style={
                  isActive
                    ? { borderColor: "var(--brand-primary)" }
                    : undefined
                }
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
        <div
          className="border-b px-6 py-2 text-xs"
          style={{
            borderColor: "var(--brand-primary)",
            backgroundColor: "var(--brand-primary-soft)",
            color: "var(--brand-primary)",
          }}
        >
          Loading live Climate TRACE data...
        </div>
      )}
      {liveError && (
        <div className="border-b border-rose-500/30 bg-rose-500/5 px-6 py-2 text-xs text-rose-300">
          Live data fetch failed: {liveError}. Showing demo data.
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-6 py-6">
        {tab === "mywork" && <MyWorkTab data={active} />}
        {tab === "loans" && <LoansTab data={active} />}
        {tab === "esrm" && <EsrmTab data={active} />}
        {tab === "taxonomy" && <TaxonomyTab data={active} />}
        {tab === "nfrs" && <NfrsTab data={active} />}
      </main>

      <footer className="border-t border-line bg-panel/30 py-4 text-center text-xs text-slate-500">
        {data.meta.bankName} demo dashboard · Synthesized portfolio · Real facility data from Climate TRACE &amp; Global Cement and Concrete Tracker
      </footer>
    </div>
  );
}

export function Dashboard({ data }: { data: DashboardSsrData }) {
  // TourProvider + TourOverlay + TourControls now mount at layout level
  // via components/bfi/tour/tour-shell.tsx so tour state survives when
  // a step navigates into a wizard route.
  return (
    <AuthProvider>
      <DashboardInner data={data} />
    </AuthProvider>
  );
}
