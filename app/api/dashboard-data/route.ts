import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  try {
    const tenant = await resolveCurrentTenant();
    const currentOfficer = await resolveCurrentOfficer();
    const data = await getBfiDemoData(token);
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
