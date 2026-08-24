import { getBfiDemoData, fetchClimateTraceSummary } from "@/lib/api/bfi";
import { applyOfficerPcafOverlay } from "@/lib/api/pcaf-overlay";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { resolveCurrentTenant } from "@/lib/tenants";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/bfi-data
 *
 * Without auth token: returns mock data.
 * With auth token: fetches live Climate TRACE data for Nepal,
 * matches to borrowers, recalculates PCAF attributions.
 *
 * Optional query param: ?summary=true returns just the Climate TRACE
 * availability summary without full BFI assembly.
 */
export async function GET(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;

  const wantSummary = req.nextUrl.searchParams.get("summary") === "true";

  try {
    if (wantSummary && token) {
      const summary = await fetchClimateTraceSummary(token);
      return NextResponse.json(summary);
    }

    const base = await getBfiDemoData(token);

    // Apply the same officer PCAF overlay the SSR dashboard applies. Without
    // it, clicking "Sign in for live data" would silently revert the
    // data-quality figures to their build-time values -- the officers' review
    // would appear to undo itself the moment the user authenticated.
    const tenant = await resolveCurrentTenant();
    const supabase = getSupabaseAdmin();
    const overlay = supabase
      ? await applyOfficerPcafOverlay(base, tenant.id, supabase as never)
      : null;

    return NextResponse.json(overlay?.data ?? base);
  } catch (err) {
    console.error("BFI data fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch BFI data" },
      { status: 500 }
    );
  }
}
