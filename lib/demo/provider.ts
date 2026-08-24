/**
 * The single door to everything fabricated.
 *
 * Why a door rather than a filter
 * -------------------------------
 * The platform ships two kinds of data. Real: Climate TRACE facilities, EDGAR
 * grids, GCCT plant capacities, and whatever the bank captures. Fabricated:
 * an 80,035-loan portfolio invented by a seeded PRNG, borrower enterprise
 * values, and a handful of hardcoded name lists that hand specific borrowers
 * a PCAF score.
 *
 * The requirement is that no fabricated record can appear in a live
 * deployment. That could be met by filtering at every read, but a filter you
 * have to remember at every call site is a filter that will eventually be
 * forgotten -- and the failure is silent, because invented loans look exactly
 * like real ones. This codebase has already produced three bugs of that shape
 * in a single week: a swallowed query error, a missing scope filter, and a
 * stale flag, each of which rendered a confident wrong number rather than an
 * error.
 *
 * So the guarantee is structural instead. Everything fabricated lives under
 * lib/demo/, nothing outside may import it directly, and a live build resolves
 * this module's dynamic import to nothing. You cannot leak what was never
 * shipped.
 *
 * How the switch works
 * --------------------
 * JANA_DEMO is a build-time flag, not a runtime setting. A live build has no
 * demo code in it at all -- not hidden behind a toggle, absent -- so there is
 * nothing for a misconfiguration or a crafted cookie to re-enable.
 *
 * The runtime demo-mode toggle, added separately, lives INSIDE a demo build.
 * It lets you show the clean empty product mid-conversation without a rebuild.
 * A live build has no toggle because it has nothing to toggle.
 */

import type { BfiDemoData } from "@/lib/types/bfi";

/**
 * Everything the application is allowed to ask the demo layer for.
 *
 * Deliberately small. Each method added here is another thing a live build
 * has to have an answer for, so the pressure is toward keeping the real code
 * paths honest rather than reaching for fabricated data.
 */
export type DemoProvider = {
  /** The synthesized portfolio: loans, borrowers, attributions, summary. */
  getPortfolio(): BfiDemoData;
  /** Drop the in-process cache. Used by the seed routes after a rewrite. */
  invalidatePortfolioCache(): void;
  /**
   * Borrower-name substrings that grant a PCAF Score 1 or 2 without any
   * evidence behind them. Pure scaffolding: they exist so the demo has
   * examples at the top of the data-quality ladder. Injected into
   * inferPcafAvailability() rather than compiled into it, so the regulatory
   * module contains no fabricated content.
   */
  pcafNameFixtures(): { verified: string[]; unverified: string[] };
  /**
   * A plausible PM2.5 reading for a facility, when no real station reading is
   * available. Previously generated inline inside buildScreening(), which is
   * called from a client component -- so the generator shipped to every
   * browser. Now it is demo-only and server-side.
   */
  synthAirQuality(facility: {
    lat: number;
    lng: number;
    municipality?: string | null;
  }): { pm25: number; readingDate: string; stationName: string };
};

/**
 * Whether this build contains the demo layer at all.
 *
 * Read from the environment at module scope so the value is fixed for the
 * process. A request cannot change it.
 */
export function isDemoBuild(): boolean {
  return process.env.JANA_DEMO === "1";
}

let cached: DemoProvider | null | undefined;

/**
 * Returns the demo provider, or null in a live build.
 *
 * Callers must handle null. That is the point: it forces every consumer to
 * have a real-data path rather than treating fabricated data as the default
 * and live as the exception, which is how the current code got here.
 *
 * The import is dynamic so that a live build can drop the module entirely.
 * next.config.ts additionally aliases lib/demo/* to a stub when JANA_DEMO is
 * unset, so exclusion does not depend on the bundler proving this branch
 * dead.
 */
export async function getDemoProvider(): Promise<DemoProvider | null> {
  if (cached !== undefined) return cached;
  if (!isDemoBuild()) {
    cached = null;
    return null;
  }
  const mod = await import("./impl");
  cached = mod.demoProvider;
  return cached;
}

/**
 * Convenience for the production call sites of inferPcafAvailability().
 *
 * Returns undefined in a live build, which is exactly what that function
 * wants when nothing should be asserted. Exists so the four call sites read
 * identically -- if they diverged, the availability panel and the portfolio
 * could infer different flags for the same borrower and neither would be
 * obviously wrong.
 */
export async function demoPcafNameFixtures(): Promise<
  { verified: string[]; unverified: string[] } | undefined
> {
  const provider = await getDemoProvider();
  return provider?.pcafNameFixtures();
}

/**
 * Test seam. Resets the memoised provider so a test can flip JANA_DEMO
 * between cases.
 */
export function __resetDemoProviderCache(): void {
  cached = undefined;
}
