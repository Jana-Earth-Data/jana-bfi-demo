/**
 * Centralised application constants.
 *
 * Only exports that are actually imported belong here. Do not add
 * aspirational constants — unused exports rot and mislead.
 */

// ---------------------------------------------------------------------------
// File uploads / request bodies
// ---------------------------------------------------------------------------

/** Maximum evidence file size in bytes (10 MB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum JSON request body size in bytes (256 KB). */
export const MAX_JSON_BODY_BYTES = 256 * 1024;
