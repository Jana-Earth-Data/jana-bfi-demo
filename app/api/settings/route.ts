/**
 * GET  /api/settings — returns { settings } for the current tenant, deep-
 *                       merged with defaults so callers always receive a
 *                       fully-hydrated TenantSettings object.
 * POST /api/settings — body: { settings: Partial<TenantSettings> } — deep-
 *                       merges into the saved JSONB blob, upserts on
 *                       bank_id, bumps `version`, stamps updated_by from
 *                       the current officer.
 *
 * Any signed-in officer can edit — no per-role gating at the moment.
 * Officer must be selected to save (mirrors the CAP route pattern).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveSettings } from "@/lib/settings/schema";
import type { TenantSettings } from "@/lib/settings/types";

export const dynamic = "force-dynamic";

type SettingsRow = {
  bank_id: string;
  settings: Record<string, unknown> | null;
  updated_at: string;
  updated_by: string | null;
  version: number;
};

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();

  const { data, error } = await supabase
    .from("bfi_tenant_settings")
    .select("bank_id, settings, updated_at, updated_by, version")
    .eq("bank_id", tenant.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: `Settings query failed: ${error.message}` },
      { status: 500 },
    );
  }

  const row = data as SettingsRow | null;
  const settings = resolveSettings(row?.settings ?? {});
  return NextResponse.json({
    ok: true,
    tenantId: tenant.id,
    settings,
    updatedAt: row?.updated_at ?? null,
    updatedBy: row?.updated_by ?? null,
    version: row?.version ?? 1,
  });
}

// ---------------------------------------------------------------------------
// POST — upsert with deep merge
// ---------------------------------------------------------------------------

/**
 * Two-level deep merge — mirrors the shape of TenantSettings (one nested
 * object per category, with at most one further nesting for e.g.
 * esrm.remarksRequired). Arrays are replaced, not concatenated.
 */
function deepMergePartial(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    if (
      cur &&
      typeof cur === "object" &&
      !Array.isArray(cur) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = deepMergePartial(
        cur as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured." },
      { status: 500 },
    );
  }
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return NextResponse.json(
      { error: "Officer must be selected before saving settings." },
      { status: 401 },
    );
  }

  let body: { settings?: Partial<TenantSettings> } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const patch = body.settings;
  if (!patch || typeof patch !== "object") {
    return NextResponse.json(
      { error: "Body.settings is required and must be an object." },
      { status: 400 },
    );
  }

  // Load the current saved blob so we can deep-merge the patch into it.
  const { data: existing, error: readErr } = await supabase
    .from("bfi_tenant_settings")
    .select("bank_id, settings, version")
    .eq("bank_id", tenant.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { error: `Existing settings read failed: ${readErr.message}` },
      { status: 500 },
    );
  }
  const current = (existing as SettingsRow | null)?.settings ?? {};
  const nextVersion = ((existing as SettingsRow | null)?.version ?? 0) + 1;
  const merged = deepMergePartial(
    current as Record<string, unknown>,
    patch as unknown as Record<string, unknown>,
  );

  const { error: upsertErr } = await supabase
    .from("bfi_tenant_settings")
    .upsert(
      {
        bank_id: tenant.id,
        settings: merged,
        updated_by: officer.id,
        version: nextVersion,
      },
      { onConflict: "bank_id" },
    );
  if (upsertErr) {
    return NextResponse.json(
      { error: `Settings upsert failed: ${upsertErr.message}` },
      { status: 500 },
    );
  }

  const resolved = resolveSettings(merged);
  return NextResponse.json({
    ok: true,
    tenantId: tenant.id,
    settings: resolved,
    version: nextVersion,
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
}
