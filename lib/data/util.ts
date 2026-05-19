/**
 * Synthesizer utilities: deterministic PRNG, simple distributions, constants.
 *
 * Used by the portfolio synthesizer so that every run produces the same
 * 80K-loan portfolio (stable across requests, SSR/CSR, and demos).
 */

export const NPR_PER_USD = 133.5;

/** Reference "as-of" date for the demo dashboard. */
export const AS_OF_DATE = "2026-05-01";

/**
 * Years we synthesize emissions / financed-emissions trends for.
 * Matches actual Climate TRACE Nepal coverage (earliest 2021-01, latest 2025-10).
 * 2025 is partial through October; the UI labels it as such.
 */
export const TREND_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

/** Most recent fully-reported year — the one a bank would cite in its annual NSRS disclosure. */
export const LATEST_FULL_YEAR = 2024;

/** Latest year with any data (may be partial). */
export const LATEST_YEAR = 2025;
export const LATEST_YEAR_PARTIAL_THROUGH = "October";

/**
 * Mulberry32 — small, fast, deterministic PRNG.
 * Returns a function that yields floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

export function pickWeighted<T>(
  items: ReadonlyArray<{ value: T; weight: number }>,
  r: () => number
): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r() * total;
  for (const it of items) {
    x -= it.weight;
    if (x <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

export function rangeInt(lo: number, hi: number, r: () => number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

export function rangeFloat(lo: number, hi: number, r: () => number): number {
  return lo + r() * (hi - lo);
}

/** Log-uniform between lo and hi — useful for loan amounts that span orders of magnitude. */
export function logUniform(lo: number, hi: number, r: () => number): number {
  const a = Math.log(lo);
  const b = Math.log(hi);
  return Math.exp(a + r() * (b - a));
}

/** Box-Muller normal random with mean mu and stddev sigma. */
export function gaussian(mu: number, sigma: number, r: () => number): number {
  const u = Math.max(1e-9, r());
  const v = r();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** ISO 8601 date string n days before `as-of`. */
export function isoDateOffsetDays(asOf: string, offsetDays: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function nprToUsd(npr: number): number {
  return npr / NPR_PER_USD;
}

export function usdToNpr(usd: number): number {
  return usd * NPR_PER_USD;
}

/** Round NPR to a clean step (nearest 10K NPR for small loans, 1M for big). */
export function roundNpr(npr: number): number {
  if (npr < 1_000_000) return Math.round(npr / 10_000) * 10_000;
  if (npr < 100_000_000) return Math.round(npr / 100_000) * 100_000;
  if (npr < 1_000_000_000) return Math.round(npr / 1_000_000) * 1_000_000;
  return Math.round(npr / 10_000_000) * 10_000_000;
}

/**
 * Branches of First Bank of Nepal. ~36 branches covering major cities.
 * Codes follow "FBN-NNN" pattern.
 */
export const BRANCHES = [
  { code: "FBN-001", name: "Kathmandu Main", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-002", name: "Durbar Marg", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-003", name: "New Baneshwor", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-004", name: "Maharajgunj", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-005", name: "Boudha", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-006", name: "Patan", city: "Lalitpur", province: "Bagmati" },
  { code: "FBN-007", name: "Jawalakhel", city: "Lalitpur", province: "Bagmati" },
  { code: "FBN-008", name: "Bhaktapur", city: "Bhaktapur", province: "Bagmati" },
  { code: "FBN-009", name: "Pokhara Lakeside", city: "Pokhara", province: "Gandaki" },
  { code: "FBN-010", name: "Pokhara Mahendrapul", city: "Pokhara", province: "Gandaki" },
  { code: "FBN-011", name: "Biratnagar", city: "Biratnagar", province: "Koshi" },
  { code: "FBN-012", name: "Itahari", city: "Itahari", province: "Koshi" },
  { code: "FBN-013", name: "Dharan", city: "Dharan", province: "Koshi" },
  { code: "FBN-014", name: "Birgunj", city: "Birgunj", province: "Madhesh" },
  { code: "FBN-015", name: "Janakpur", city: "Janakpur", province: "Madhesh" },
  { code: "FBN-016", name: "Simara Industrial", city: "Simara", province: "Madhesh" },
  { code: "FBN-017", name: "Hetauda", city: "Hetauda", province: "Bagmati" },
  { code: "FBN-018", name: "Bharatpur", city: "Bharatpur", province: "Bagmati" },
  { code: "FBN-019", name: "Butwal", city: "Butwal", province: "Lumbini" },
  { code: "FBN-020", name: "Bhairahawa", city: "Bhairahawa", province: "Lumbini" },
  { code: "FBN-021", name: "Nepalgunj", city: "Nepalgunj", province: "Lumbini" },
  { code: "FBN-022", name: "Ghorahi", city: "Ghorahi", province: "Lumbini" },
  { code: "FBN-023", name: "Tulsipur", city: "Tulsipur", province: "Lumbini" },
  { code: "FBN-024", name: "Dhangadhi", city: "Dhangadhi", province: "Sudurpaschim" },
  { code: "FBN-025", name: "Mahendranagar", city: "Mahendranagar", province: "Sudurpaschim" },
  { code: "FBN-026", name: "Surkhet", city: "Surkhet", province: "Karnali" },
  { code: "FBN-027", name: "Birendranagar", city: "Birendranagar", province: "Karnali" },
  { code: "FBN-028", name: "Damak", city: "Damak", province: "Koshi" },
  { code: "FBN-029", name: "Birtamod", city: "Birtamod", province: "Koshi" },
  { code: "FBN-030", name: "Banepa", city: "Banepa", province: "Bagmati" },
  { code: "FBN-031", name: "Hetauda Industrial", city: "Hetauda", province: "Bagmati" },
  { code: "FBN-032", name: "Birgunj Industrial", city: "Birgunj", province: "Madhesh" },
  { code: "FBN-033", name: "Kalanki", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-034", name: "Chabahil", city: "Kathmandu", province: "Bagmati" },
  { code: "FBN-035", name: "Lagankhel", city: "Lalitpur", province: "Bagmati" },
  { code: "FBN-036", name: "Nepalgunj Industrial", city: "Nepalgunj", province: "Lumbini" },
] as const;

export type BranchRecord = (typeof BRANCHES)[number];
