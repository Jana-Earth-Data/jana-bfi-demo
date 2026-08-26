/**
 * POST /api/admin/seed-officers?token=<SEED_ADMIN_TOKEN>
 *
 * Populates bfi_officers from the code registry in lib/tenants/registry.ts.
 * Idempotent: uses INSERT ... ON CONFLICT to keep re-runs safe.
 *
 * Run this once after applying the capture-schema migration, and again any
 * time the seeded officer roster changes in registry.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { withOrigin } from "@/lib/data/capture-client";
import { listTenants } from "@/lib/tenants";
import { apiError, requireAdminToken } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authErr = requireAdminToken(request);
  if (authErr) return authErr;

  // Seeded rows are demo rows by definition, regardless of what mode the
  // operator happens to be in when they run the seeder. Forcing 'demo' here
  // rather than deriving it from the request is what makes the label mean
  // "this was manufactured" instead of "this was written on a Tuesday".
  const admin = getSupabaseAdmin();
  const supabase = admin ? withOrigin(admin, "demo") : null;
  if (!supabase) {
    return apiError("Supabase env vars not configured.", 500);
  }

  // Flatten the officer rosters across every tenant. Each officer already
  // knows their bank via the tenant's id, so we stamp bank_id here as we
  // flatten.
  const rows = listTenants().flatMap((tenant) =>
    tenant.demoOfficers.map((officer) => ({
      id: officer.id,
      bank_id: tenant.id,
      name: officer.name,
      role: officer.role,
      email: officer.email ?? null,
    })),
  );

  // upsert on the primary key so re-runs are idempotent.
  const { error, count } = await supabase
    .from("bfi_officers")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return apiError(`Officer seed failed: ${error.message}`, 500, {
      details: { attempted: rows.length },
    });
  }

  return NextResponse.json({
    ok: true,
    seeded: rows.length,
    countReported: count,
    perBank: rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.bank_id] = (acc[r.bank_id] ?? 0) + 1;
      return acc;
    }, {}),
  });
}
