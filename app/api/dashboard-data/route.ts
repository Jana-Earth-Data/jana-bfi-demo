import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { applyOfficerPcafOverlay } from "@/lib/api/pcaf-overlay";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  try {
    const tenant = await resolveCurrentTenant();
    const currentOfficer = await resolveCurrentOfficer();
    const base = await getBfiDemoData(token);

    // Same officer PCAF overlay as app/page.tsx. This route backs the
    // dashboard's client-side refresh, so omitting it would make the
    // data-quality figures revert on any re-fetch.
    const supabase = getSupabaseAdmin();
    const overlay = supabase
      ? await applyOfficerPcafOverlay(base, tenant.id, supabase as never)
      : null;
    const data = overlay?.data ?? base;

    data.meta = {
      ...data.meta,
      bankName: tenant.branding.displayName,
      tenantId: tenant.id,
      tenantLogoPath: tenant.branding.logoPath,
    };
    const slice = await buildDashboardSlice(data, token);
    return NextResponse.json({
      ...slice,
      officers: tenant.demoOfficers,
      currentOfficer,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
