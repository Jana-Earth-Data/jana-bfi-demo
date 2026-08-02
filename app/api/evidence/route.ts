/**
 * GET  /api/evidence?entity_type=&entity_id=&field_key= — list metadata
 *      (no `data` column) for a given remarks field, scoped to the
 *      current tenant.
 *
 * POST /api/evidence — multipart/form-data upload. Body fields:
 *        entity_type — one of the six recognised surface types
 *        entity_id   — loan id, cap item id, covenant id, …
 *        field_key   — sub-field key (question id / row_1a / etc.)
 *        file        — the file itself
 *      Enforces 10 MB per file. Reads bytes with `file.arrayBuffer()`
 *      and inserts into `bfi_evidence_attachments`.
 *
 * Tenant scoping via resolveCurrentTenant(); officer attribution via
 * resolveCurrentOfficer(). Follows the auth + service-role posture of
 * /api/cap and /api/pcaf/availability.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { assertOwnerOrRespond } from "@/lib/officers/loan-lock";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
// Uploaded blobs go straight to Postgres via the service-role client.
// The Next.js edge runtime doesn't ship the Buffer polyfills we rely on
// for base64 fallback + bytea encoding, so pin to the Node runtime.
export const runtime = "nodejs";

const VALID_ENTITY_TYPES = new Set<EvidenceEntityType>([
  "esdd",
  "cap_item",
  "covenant",
  "monitoring_report",
  "pcaf_availability",
  "pf_screening",
]);

export type EvidenceEntityType =
  | "esdd"
  | "cap_item"
  | "covenant"
  | "monitoring_report"
  | "pcaf_availability"
  | "pf_screening";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Resolve the loan id an evidence attachment belongs to, so the owner-
 * only edit rule (P36) can be enforced consistently across the six
 * entity types. Behaves like the `assertOwnerOrRespond` helper —
 * fail-open on infra errors, LOG and allow.
 *
 * Mapping:
 *   - esdd / pf_screening / pcaf_availability → entity_id IS the loan
 *     (or borrower id; PCAF is per-borrower and not gated on loan).
 *   - cap_item / covenant / monitoring_report → look up the row's
 *     loan_id column.
 *
 * Returns null when the loan id cannot be resolved (unknown entity type,
 * missing row, infra failure) — callers should treat that as "no lock".
 */
async function resolveLoanIdForEvidence(
  supabase: SupabaseClient,
  bankId: string,
  entityType: EvidenceEntityType,
  entityId: string,
): Promise<string | null> {
  try {
    if (entityType === "esdd" || entityType === "pf_screening") {
      // entity_id IS the loan id for these surfaces.
      return entityId;
    }
    if (entityType === "pcaf_availability") {
      // Borrower-level; not loan-gated. Return null so we skip enforcement.
      return null;
    }
    const table =
      entityType === "cap_item"
        ? "bfi_cap_items"
        : entityType === "covenant"
          ? "bfi_covenants"
          : entityType === "monitoring_report"
            ? "bfi_monitoring_reports"
            : null;
    if (!table) return null;
    const { data, error } = await supabase
      .from(table)
      .select("loan_id")
      .eq("bank_id", bankId)
      .eq("id", entityId)
      .maybeSingle();
    if (error) {
      console.warn(
        `[evidence] loan lookup for ${entityType} failed (fail-open):`,
        error.message,
      );
      return null;
    }
    return (data?.loan_id as string | null) ?? null;
  } catch (err) {
    console.warn(`[evidence] loan lookup for ${entityType} threw:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — list metadata
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }

  const entityType = request.nextUrl.searchParams.get("entity_type");
  const entityId = request.nextUrl.searchParams.get("entity_id");
  const fieldKey = request.nextUrl.searchParams.get("field_key");
  if (!entityType || !entityId || !fieldKey) {
    return NextResponse.json(
      {
        error:
          "entity_type, entity_id, and field_key query params are required.",
      },
      { status: 400 },
    );
  }
  if (!VALID_ENTITY_TYPES.has(entityType as EvidenceEntityType)) {
    return NextResponse.json(
      { error: `Invalid entity_type: ${entityType}` },
      { status: 400 },
    );
  }

  const tenant = await resolveCurrentTenant();

  const { data, error } = await supabase
    .from("bfi_evidence_attachments")
    .select(
      "id, filename, mime_type, size_bytes, uploaded_by, uploaded_at",
    )
    .eq("bank_id", tenant.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("field_key", fieldKey)
    .order("uploaded_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: `Evidence list failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Resolve uploader officer names from the current tenant's roster so
  // the panel can render "Sita Sharma · 2 days ago" without a second
  // round trip.
  const nameById = new Map<string, string>();
  for (const o of tenant.demoOfficers) nameById.set(o.id, o.name);

  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    filename: r.filename as string,
    mime_type: (r.mime_type as string | null) ?? null,
    size_bytes: r.size_bytes as number,
    uploaded_by: (r.uploaded_by as string | null) ?? null,
    uploaded_by_name:
      r.uploaded_by ? (nameById.get(r.uploaded_by as string) ?? null) : null,
    uploaded_at: r.uploaded_at as string,
  }));

  return NextResponse.json({ ok: true, attachments: rows });
}

// ---------------------------------------------------------------------------
// POST — upload
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Body must be multipart/form-data." },
      { status: 400 },
    );
  }

  const entityType = form.get("entity_type");
  const entityId = form.get("entity_id");
  const fieldKey = form.get("field_key");
  const file = form.get("file");

  if (
    typeof entityType !== "string" ||
    typeof entityId !== "string" ||
    typeof fieldKey !== "string" ||
    !(file instanceof File)
  ) {
    return NextResponse.json(
      {
        error:
          "entity_type, entity_id, field_key, and file (multipart) are required.",
      },
      { status: 400 },
    );
  }
  if (!VALID_ENTITY_TYPES.has(entityType as EvidenceEntityType)) {
    return NextResponse.json(
      { error: `Invalid entity_type: ${entityType}` },
      { status: 400 },
    );
  }
  if (!file.name) {
    return NextResponse.json(
      { error: "Uploaded file must have a filename." },
      { status: 400 },
    );
  }
  if (file.size <= 0) {
    return NextResponse.json(
      { error: "Uploaded file is empty." },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      },
      { status: 413 },
    );
  }

  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();

  // Owner-only edit (P36). Resolve the loan id this evidence attaches
  // to (via the entity type) and reject non-owners.
  if (officer) {
    const attachedLoanId = await resolveLoanIdForEvidence(
      supabase,
      tenant.id,
      entityType as EvidenceEntityType,
      entityId,
    );
    if (attachedLoanId) {
      const denied = await assertOwnerOrRespond(attachedLoanId, officer, tenant);
      if (denied) return denied;
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const row = {
    bank_id: tenant.id,
    entity_type: entityType,
    entity_id: entityId,
    field_key: fieldKey,
    filename: file.name,
    mime_type: file.type || null,
    size_bytes: buf.byteLength,
    // Supabase JS serialises Buffer for bytea columns via a hex encoding
    // by passing it as a string prefixed with '\x'. Doing that manually
    // avoids relying on library heuristics that occasionally regress.
    data: "\\x" + buf.toString("hex"),
    uploaded_by: officer?.id ?? null,
  };

  const { data, error } = await supabase
    .from("bfi_evidence_attachments")
    .insert(row)
    .select("id, filename, mime_type, size_bytes, uploaded_by, uploaded_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: `Evidence insert failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const uploaderName = officer?.name ?? null;
  return NextResponse.json({
    ok: true,
    attachment: {
      id: data.id as string,
      filename: data.filename as string,
      mime_type: (data.mime_type as string | null) ?? null,
      size_bytes: data.size_bytes as number,
      uploaded_by: (data.uploaded_by as string | null) ?? null,
      uploaded_by_name: uploaderName,
      uploaded_at: data.uploaded_at as string,
    },
  });
}
