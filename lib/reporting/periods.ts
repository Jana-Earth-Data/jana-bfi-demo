/**
 * Reporting periods — which years the platform reports on.
 *
 * Extracted from lib/data/util.ts ahead of that file moving under lib/demo/.
 * The year range is a real product concern, not demo scaffolding:
 * lib/api/bfi.ts uses TREND_YEARS to decide which years of live Climate TRACE
 * data to fetch, and the NFRS surfaces label the partial year.
 *
 * Known simplification: the values are hardcoded to the demo's data coverage.
 * In a live deployment the reportable range should come from what has
 * actually been ingested -- a bank whose Climate TRACE coverage starts in
 * 2023 should not be offered a 2021 comparison it cannot support. Flagged
 * here rather than silently inherited, because a disclosure that shows an
 * empty year looks like a data loss rather than a coverage boundary.
 */

/**
 * Years the platform builds emissions and financed-emissions trends for.
 * Matches Climate TRACE Nepal coverage: earliest 2021-01, latest 2025-10.
 */
export const TREND_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

/**
 * Most recent fully-reported year — the one a bank cites in its annual NFRS
 * disclosure. Distinct from LATEST_YEAR because a partial year cannot carry
 * an annual figure.
 */
export const LATEST_FULL_YEAR = 2024;

/** Latest year with any data at all. May be partial; see below. */
export const LATEST_YEAR = 2025;

/** How far into LATEST_YEAR the data runs. Surfaced in the UI so a reader
 *  does not mistake a partial year for a decline. */
export const LATEST_YEAR_PARTIAL_THROUGH = "October";
