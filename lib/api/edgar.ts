/**
 * EDGAR Nepal national CO2 total — live fetcher.
 *
 * Why a single-number lookup (not sector breakdown):
 *   EDGAR's country_totals table for Nepal has only one sector row per year,
 *   labeled "India +" (EDGAR's regional-aggregation convention for small South
 *   Asian countries near India). There is no sector-level resolution at the
 *   country_totals layer; finer breakdowns live in edgar_grid_emissions which
 *   would require spatial filtering (Nepal polygon) + aggregation. For this
 *   demo we only need the national total to compute "this borrower's share
 *   of Nepal's national CO2 emissions", which is a more defensible metric
 *   than a fake sector benchmark anyway.
 *
 * Endpoint: GET /api/v1/data-sources/edgar/country-totals/
 * Filter names (per src/apps/data_sources/edgar/filters.py): country_iso3, gas
 * Verified value: 15,891.86 Gg CO2 for Nepal 2024 (~15.89 Mt; matches World
 * Bank country profile).
 *
 * Unit conversion: EDGAR country_totals .value is in Gg (gigagrams = kt =
 * 1,000 tonnes). We multiply by 1,000 to surface tonnes for consistency with
 * Climate TRACE facility emissions.
 */

import { apiFetchAll } from "@/lib/api/client";

type EdgarCountryTotalRow = {
  id?: number;
  country_code?: string;
  year?: number;
  gas_type?: string;
  sector?: string;
  value?: number | string;
};

export type EdgarNationalTotal = {
  country: "NPL";
  year: number;
  /** National total in tonnes CO2 (EDGAR value in Gg × 1000). */
  totalTco2: number;
  /** Whether this is a regional aggregation (e.g. "India +"). */
  isRegionalRollup: boolean;
  /** Sector label as returned by EDGAR (for transparency in the UI). */
  rawSectorLabel: string;
};

const GG_TO_TONNES = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheEntry = { value: EdgarNationalTotal; fetchedAt: number };
let nplCache: CacheEntry | null = null;

function toNumeric(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Fetch Nepal national CO2 total for the most recent year available.
 * EDGAR country_totals for Nepal currently covers 1970-2024 (verified May 2026).
 * Falls through earlier years if 2024 is missing.
 *
 * Memoized for 1 hour to match the server-side EDGAR cache.
 */
export async function getNepalNationalCo2(
  token: string
): Promise<EdgarNationalTotal | null> {
  if (nplCache && Date.now() - nplCache.fetchedAt < CACHE_TTL_MS) {
    return nplCache.value;
  }

  // Pull all years for Nepal CO2 (~55 rows, cheap), pick the most recent.
  const { results } = await apiFetchAll<EdgarCountryTotalRow>(
    "/api/v1/data-sources/edgar/country-totals/",
    {
      params: {
        country_iso3: "NPL",
        gas: "co2",
        page_size: 200,
      },
      token,
      maxPages: 2,
    }
  );

  if (results.length === 0) return null;

  // Most-recent year wins
  const sorted = [...results].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  const top = sorted[0];
  const value: EdgarNationalTotal = {
    country: "NPL",
    year: top.year ?? 0,
    totalTco2: toNumeric(top.value) * GG_TO_TONNES,
    isRegionalRollup: (top.sector ?? "").toLowerCase().includes("india"),
    rawSectorLabel: top.sector ?? "national total",
  };
  nplCache = { value, fetchedAt: Date.now() };
  return value;
}

/** Force-refresh — primarily for tests. */
export function invalidateEdgarCache() {
  nplCache = null;
}
