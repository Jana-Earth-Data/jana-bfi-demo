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
import { listTenants } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const expected = process.env.SEED_ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SEED_ADMIN_TOKEN not configured on the server." },
      { status: 500 },
    );
  }
  if (token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized: bad or missing token." },
      { status: 401 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase env vars not configured." },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: `Officer seed failed: ${error.message}`, attempted: rows.length },
      { status: 500 },
    );
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
