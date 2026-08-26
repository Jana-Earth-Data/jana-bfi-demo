/**
 * Centralised application constants.
 *
 * Values that were previously scattered as magic numbers across multiple
 * files now live here as named exports. Each constant documents its purpose
 * and the files that consume it.
 */

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Default page size for loan queries (portfolio-query.ts, portfolio/loans route). */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum pages the apiFetchAll helper will follow (lib/api/client.ts). */
export const MAX_PAGINATION_PAGES = 20;

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------

/** Maximum evidence file size in bytes (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum JSON request body size in bytes (256 KB). */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Earliest valid reporting year for PCAF scores. */
export const REPORTING_YEAR_MIN = 1990;

/** Latest valid reporting year for PCAF scores. */
export const REPORTING_YEAR_MAX = 2100;
