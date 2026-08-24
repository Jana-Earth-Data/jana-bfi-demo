/**
 * Currency units and conversion.
 *
 * Extracted from lib/data/util.ts, which is the portfolio synthesizer's
 * toolbox and is moving under lib/demo/. These constants are not demo
 * scaffolding -- three production UI components convert borrower enterprise
 * values for display -- so they belong in a module that survives a live
 * build.
 *
 * Known simplification: the rate is a fixed constant. A real deployment
 * needs a dated rate, because a disclosure has to state the rate and date
 * used to convert, and comparability across reporting years depends on it.
 * That is a data-sourcing question rather than a demo one, so the constant
 * stays here and is flagged rather than hidden inside the synthesizer.
 */

/** NPR per USD. See the note above about needing a dated rate. */
export const NPR_PER_USD = 133.5;

export function nprToUsd(npr: number): number {
  return npr / NPR_PER_USD;
}

export function usdToNpr(usd: number): number {
  return usd * NPR_PER_USD;
}

/** Round to whole rupees. Amounts below one rupee are not meaningful here. */
export function roundNpr(npr: number): number {
  return Math.round(npr);
}
