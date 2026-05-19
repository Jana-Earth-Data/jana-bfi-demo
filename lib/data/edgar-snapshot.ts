/**
 * EDGAR Nepal national CO2 — snapshot loader.
 *
 * Reads data/edgar-nepal-2024.json, which is built by
 * scripts/build-data-snapshots.py from the 0.1° EDGAR grid clipped to the
 * Nepal admin polygon (per-cell max across duplicate sector rows, then
 * point-in-polygon mask).
 *
 * Why we don't hit the country_totals API at request time:
 *   The /api/v1/data-sources/edgar/country-totals/ endpoint returns Nepal
 *   under EDGAR's "India +" regional roll-up convention. The value is a
 *   roll-up artifact, not a Nepal-specific number, and exposing the "India +"
 *   sector label in the UI would confuse a banker. The polygon-clipped grid
 *   is Nepal-specific by construction and produces a defensible national
 *   total (~18.8 Mt CO2 / 2024) we can cite without explanation.
 */

import snapshot from "@/data/edgar-nepal-2024.json";

export type EdgarNepalSnapshot = {
  source: string;
  year: number;
  nepalTotalTco2: number;
  nepalCellCount: number;
};

export const EDGAR_NEPAL: EdgarNepalSnapshot = {
  source: snapshot.source,
  year: snapshot.year,
  nepalTotalTco2: snapshot.nepalTotalTco2,
  nepalCellCount: snapshot.nepalCellCount,
};
