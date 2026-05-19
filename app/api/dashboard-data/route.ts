import { NextRequest, NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  try {
    const data = await getBfiDemoData(token);
    const slice = await buildDashboardSlice(data, token);
    return NextResponse.json(slice);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
