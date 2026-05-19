import { getBfiDemoData, fetchClimateTraceSummary } from "@/lib/api/bfi";
import { NextRequest, NextResponse } from "next/server";

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

    const data = await getBfiDemoData(token);
    return NextResponse.json(data);
  } catch (err) {
    console.error("BFI data fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch BFI data" },
      { status: 500 }
    );
  }
}
