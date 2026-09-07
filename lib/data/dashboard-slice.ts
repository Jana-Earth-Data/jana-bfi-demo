/**
 * Build the SSR / API payload that the dashboard client component consumes.
 *
 * Picks a slice out of the full 80K-loan portfolio so the JSON payload stays
 * small (~50-100KB) while giving each tab enough seed data to render its
 * initial view. Heavier views (full loan table, drill-downs) fetch from
 * dedicated API routes.
 *
 * When a `token` is supplied, the ESRM screenings are enriched with live
 * EDGAR sector totals + OpenAQ PM2.5 readings; otherwise we fall back to
 * synthetic / industry-baseline values.
 */

import {
  applicationQueue,
  distinctValues,
  queryLoans,
  topContributors,
} from "@/lib/data/portfolio-query";
import {
  BfiDemoData,
  Borrower,
  BorrowerScreening,
} from "@/lib/types/bfi";
import type { DashboardSsrData } from "@/components/bfi/dashboard";
import {
  buildScreening,
  buildScreeningLive,
} from "@/lib/data/screening";
import { EDGAR_NEPAL } from "@/lib/data/edgar-snapshot";
import { getActiveDemoProvider, getDemoProvider } from "@/lib/demo/provider";
import { summarisePortfolioClimate } from "@/lib/regulatory/climate/infer";

const INITIAL_PAGE_SIZE = 50;
const TOP_N = 20;
const APP_QUEUE = 30;

/**
 * Per-portfolio memo of the token-less (demo) slice.
 *
 * WHY: the homepage is force-dynamic and re-renders server-side on every
 * request. buildDashboardSlice does ~4 full scans + 3 sorts of the 80,035-loan
 * book (topContributors, applicationQueue, queryLoans, distinctValues) plus
 * per-borrower screening synthesis — ~8s of pure CPU measured in a warm
 * container, repeated on EVERY page load. On Vercel that recurring recompute
 * was the bulk of the CPU overage (jana-bfi-demo alone burned 99.7% of the
 * account's Active-CPU budget). The inputs are build-time constant, so the
 * work is identical every time.
 *
 * KEY: data.attributions array identity. getBfiDemoData() returns a fresh
 * top-level spread each call, so we can NOT key on `data` itself. But the inner
 * arrays are shared by reference from the cached portfolio, and the officer
 * PCAF overlay — the one thing that legitimately changes the slice — swaps in a
 * NEW attributions array (and portfolio) when it rescores. So keying on
 * data.attributions gives an exact hit for "same portfolio, no overlay change"
 * and an exact miss for "overlay rescored", which is precisely the
 * invalidation we want. A WeakMap lets a superseded portfolio (e.g. after a
 * seed/reset invalidates the cache) be garbage-collected.
 *
 * SCOPE: token-less path ONLY. The live (token) path enriches screenings with
 * per-request EDGAR/OpenAQ reads and must never be served from this memo.
 */
const demoSliceMemo = new WeakMap<object, DashboardSlicePartial>();

/**
 * Data-shape return type. Callers layer identity fields (officers,
 * currentOfficer) on top before handing to <Dashboard>. See app/page.tsx
 * and app/api/dashboard-data/route.ts.
 */
type DashboardSlicePartial = Omit<DashboardSsrData, "officers" | "currentOfficer">;

/**
 * Synthetic air quality for a borrower's first geocoded facility, in a demo
 * build only. Returns undefined in a live build, where a borrower with no
 * real station reading simply has no air-quality panel -- which is the honest
 * result rather than an invented one.
 */
function makeDemoAirQuality(
  provider: Awaited<ReturnType<typeof getDemoProvider>>,
) {
  return (b: Borrower) => {
    if (!provider) return undefined;
    const f = b.facilities[0];
    if (!f || !Number.isFinite(f.lat)) return undefined;
    return provider.synthAirQuality(f);
  };
}

export async function buildDashboardSlice(
  data: BfiDemoData,
  token?: string | null
): Promise<DashboardSlicePartial> {
  // Fast path: the token-less (demo) slice is a pure function of the portfolio
  // arrays, which are build-time constant. Serve a memoized result keyed on the
  // attributions identity so the ~8s of scans/sorts/screening synthesis runs
  // once per portfolio instead of on every force-dynamic render. meta is NOT
  // taken from the memo — it carries the per-tenant bank name and is overlaid
  // fresh below so two tenants sharing the same base portfolio never see each
  // other's branding.
  if (!token) {
    const cached = demoSliceMemo.get(data.attributions as unknown as object);
    if (cached) {
      return { ...cached, meta: data.meta, portfolio: data.portfolio };
    }
  }

  // Null in a live build, and null when demo mode is off, so borrowers
  // without a real station reading get no air-quality panel rather than a
  // manufactured one. Mode matters as well as build: buildDashboardSlice runs
  // over whatever borrowers it is handed, and once CBS import lands those are
  // real companies. A generated PM2.5 reading attached to a real facility is
  // a fabricated environmental measurement about a real place.
  const demoAirQuality = makeDemoAirQuality(await getActiveDemoProvider());

  const top = topContributors(data, TOP_N);
  const apps = applicationQueue(data, APP_QUEUE);
  const initial = queryLoans(data, {
    page: 1,
    pageSize: INITIAL_PAGE_SIZE,
    sort: { field: "outstandingNpr", direction: "desc" },
  });
  const dv = distinctValues(data);

  // Facility-tier borrowers (for ESRM map + drill-downs)
  const facilityBorrowers: Borrower[] = data.borrowers.filter(
    (b) => b.dataTier === "facility" && b.facilities.length > 0
  );

  // Build screenings for every unique borrower in the application queue
  // (and any contributor borrowers, since they're also drillable).
  const screeningBorrowerIds = new Set<string>([
    ...apps.map((r) => r.borrower.id),
    ...top.map((r) => r.borrower.id),
  ]);
  const screeningBorrowers = data.borrowers.filter((b) =>
    screeningBorrowerIds.has(b.id)
  );

  const screenings: Record<string, BorrowerScreening> = {};
  let edgarOk = false;
  let openaqOk = false;
  let edgarYear: number | undefined;

  // EDGAR national CO2 comes from the polygon-clipped snapshot (always
  // available, no API call). The badge reflects that source.
  edgarOk = EDGAR_NEPAL.nepalTotalTco2 > 0;
  edgarYear = EDGAR_NEPAL.year;

  if (token) {
    // Build live screenings in parallel — only OpenAQ requires the token now.
    const results = await Promise.all(
      screeningBorrowers.map(async (b) => {
        try {
          const s = await buildScreeningLive(b, token);
          if (s.airQualityNearby) openaqOk = true;
          return [b.id, s] as const;
        } catch (err) {
          console.warn(
            `Screening live for ${b.id} failed, falling back: ${(err as Error).message}`
          );
          return [b.id, buildScreening(b, demoAirQuality(b))] as const;
        }
      })
    );
    for (const [id, s] of results) screenings[id] = s;
  } else {
    for (const b of screeningBorrowers) {
      screenings[b.id] = buildScreening(b, demoAirQuality(b));
    }
  }

  // Portfolio-level climate risk summary (NRB ESRM 2022 §4.4). Computes
  // the "above threshold without target" callout counts once at slice
  // build time so the NFRS tab doesn't need a per-page fetch.
  const climateSummary = summarisePortfolioClimate(data.borrowers);

  const slice: DashboardSlicePartial = {
    meta: data.meta,
    portfolio: data.portfolio,
    initialLoans: initial.rows,
    totalLoanCount: initial.total,
    topContributors: top,
    applications: apps,
    facilityBorrowers,
    screenings,
    climateSummary,
    liveEnrichment: token ? { edgar: edgarOk, openaq: openaqOk, edgarYear } : undefined,
    distinctValues: {
      sectors: dv.sectors,
      businessUnits: dv.businessUnits,
      branches: dv.branches,
    },
  };

  // Memoize the token-less result so subsequent force-dynamic renders of the
  // same portfolio skip the scans/sorts above. Not cached for the live path:
  // its screenings depend on per-request EDGAR/OpenAQ reads. meta/portfolio are
  // re-applied from `data` on every cache hit (see the fast path above), so
  // caching them here is harmless — they are overwritten, never served stale.
  if (!token) {
    demoSliceMemo.set(data.attributions as unknown as object, slice);
  }

  return slice;
}
