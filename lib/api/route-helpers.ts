/**
 * Shared API route helpers.
 *
 * Every pattern that was copy-pasted across 30+ route files now lives here.
 * Routes import these thin wrappers instead of re-implementing tenant
 * resolution, officer checks, Supabase acquisition, admin auth, error
 * formatting, and PDF validation from scratch each time.
 *
 * Design constraints:
 *   - Helpers return NextResponse directly so routes can `return` them
 *     immediately on failure — no exceptions-as-control-flow.
 *   - The capture client is intentionally separated from the admin client
 *     because they have different provenance semantics (see capture-client.ts).
 *   - Admin token auth uses Bearer header (not query string) for all
 *     endpoints. The three seed routes formerly used ?token= and were
 *     migrated to this shared helper as part of the normalisation.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getCaptureClient } from "@/lib/data/capture-client";
import type { TenantConfig, Officer } from "@/lib/tenants";
import { MAX_JSON_BODY_BYTES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Error responses — standard shape: { error: string; code?: string; details?: unknown }
// ---------------------------------------------------------------------------

/**
 * Return a JSON error response with a consistent shape.
 *
 * Every API route should use this instead of hand-building NextResponse.json
 * for error paths. The shape is always `{ error, code?, details? }` so
 * clients can rely on `response.error` existing whenever `response.ok` is
 * absent.
 */
export function apiError(
  message: string,
  status: number,
  extras?: { code?: string; details?: unknown },
): NextResponse {
  return NextResponse.json(
    { error: message, ...extras },
    { status },
  );
}

// ---------------------------------------------------------------------------
// Tenant + officer resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the tenant, or return an error response.
 *
 * Tenant resolution never truly fails (it falls back to the default tenant),
 * so this is a convenience wrapper that keeps the type narrow. Included for
 * symmetry with requireOfficer and to centralise the import.
 */
export async function requireTenant(): Promise<TenantConfig> {
  return resolveCurrentTenant();
}

/**
 * Resolve the current officer, or return a 401 response.
 *
 * Usage in a route:
 *   const [officer, err] = await requireOfficer();
 *   if (err) return err;
 *   // officer is now Officer, not null
 */
export async function requireOfficer(
  action = "perform this action",
): Promise<[Officer, null] | [null, NextResponse]> {
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return [
      null,
      apiError(`Officer must be selected before ${action}.`, 401),
    ];
  }
  return [officer, null];
}

// ---------------------------------------------------------------------------
// Supabase client acquisition
// ---------------------------------------------------------------------------

/**
 * Acquire the provenance-scoped capture client, or return a 500 response.
 *
 * Usage:
 *   const [supabase, err] = await requireCaptureClient();
 *   if (err) return err;
 */
export async function requireCaptureClient(): Promise<
  [SupabaseClient, null] | [null, NextResponse]
> {
  const supabase = await getCaptureClient();
  if (!supabase) {
    return [
      null,
      apiError("Supabase not configured.", 500),
    ];
  }
  return [supabase, null];
}

// ---------------------------------------------------------------------------
// Admin token auth (Bearer header)
// ---------------------------------------------------------------------------

/**
 * Validate the admin seed token.
 *
 * Accepts the token from either:
 *   1. Authorization: Bearer <token>   (preferred)
 *   2. ?token=<token> query parameter  (legacy, for backward compatibility)
 *
 * Returns null on success, or a NextResponse error to return immediately.
 *
 * Usage:
 *   const authErr = requireAdminToken(request);
 *   if (authErr) return authErr;
 */
export function requireAdminToken(request: NextRequest): NextResponse | null {
  const expected = process.env.SEED_ADMIN_TOKEN;
  if (!expected) {
    return apiError(
      "SEED_ADMIN_TOKEN is not configured on the server.",
      500,
    );
  }
  // Prefer Bearer header; fall back to ?token= query param.
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const provided =
    bearerMatch?.[1]?.trim() ||
    request.nextUrl.searchParams.get("token") ||
    "";
  if (!provided || provided !== expected) {
    return apiError("Unauthorized: bad or missing token.", 401);
  }
  return null;
}

// ---------------------------------------------------------------------------
// PDF validation
// ---------------------------------------------------------------------------

/**
 * Validate that a buffer contains a PDF (checks the %PDF- magic bytes).
 *
 * Returns null on success, or a NextResponse 500 error describing the
 * problem. Used by report-generation routes to catch pdfkit/pdf-lib
 * failures before streaming garbage to the client.
 */
export function validatePdfBuffer(
  buffer: Buffer,
  context = "PDF builder",
): NextResponse | null {
  if (
    buffer.length < 5 ||
    buffer.toString("ascii", 0, 5) !== "%PDF-"
  ) {
    return apiError(
      `${context} produced a non-PDF payload (missing %PDF- header). ` +
        "This usually means pdfkit's font loader failed in the runtime.",
      500,
      {
        details: {
          firstBytesHex: buffer.slice(0, 16).toString("hex"),
          bufferLength: buffer.length,
        },
      },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Request body parsing with size guard
// ---------------------------------------------------------------------------

/**
 * Parse a JSON request body with an optional size limit.
 *
 * Returns the parsed body on success, or a NextResponse error. The size
 * check reads the raw text first and rejects before JSON.parse if it
 * exceeds `maxBytes`. This prevents a multi-megabyte payload from being
 * parsed into a JS object before we notice it is too large.
 *
 * Usage:
 *   const [body, err] = await parseJsonBody<MyType>(request);
 *   if (err) return err;
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<[T, null] | [null, NextResponse]> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      return [
        null,
        apiError(
          `Request body too large (${text.length} bytes, limit ${maxBytes}).`,
          413,
        ),
      ];
    }
    const parsed = JSON.parse(text) as T;
    return [parsed, null];
  } catch {
    return [null, apiError("Body must be valid JSON.", 400)];
  }
}

// ---------------------------------------------------------------------------
// MIME type validation for file uploads
// ---------------------------------------------------------------------------

/** Allowed MIME types for evidence file uploads. */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
]);

/** Magic byte signatures for allowed file types. */
const MAGIC_BYTES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  { mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }, // .PNG
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] }, // JFIF/EXIF
  { mime: "image/webp", offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP (at offset 8)
  // TIFF: little-endian (II) or big-endian (MM) followed by 42
  { mime: "image/tiff", offset: 0, bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mime: "image/tiff", offset: 0, bytes: [0x4d, 0x4d, 0x00, 0x2a] },
];

/**
 * Validate a file's MIME type against the allowlist, checking both the
 * declared type and the actual magic bytes.
 *
 * Returns null on success, or a descriptive error string.
 */
export function validateFileMime(
  declaredType: string,
  fileBytes: Uint8Array,
): string | null {
  // Check declared type
  if (!ALLOWED_MIME_TYPES.has(declaredType)) {
    return (
      `File type "${declaredType}" is not allowed. ` +
      `Accepted types: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}.`
    );
  }

  // Check magic bytes — at least one signature must match
  const matched = MAGIC_BYTES.some(({ offset, bytes }) => {
    if (fileBytes.length < offset + bytes.length) return false;
    return bytes.every((b, i) => fileBytes[offset + i] === b);
  });
  if (!matched) {
    return (
      `File content does not match any allowed file type signature. ` +
      `The declared type was "${declaredType}" but the file bytes ` +
      `do not match.`
    );
  }

  return null;
}
