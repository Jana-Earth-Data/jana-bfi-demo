/**
 * POST /api/officer/set
 *
 * Body: { officerId: string }
 *
 * Validates that the officer belongs to the current tenant, then sets the
 * jana_demo_officer cookie. The next SSR pass will surface the officer's
 * name and role via resolveCurrentOfficer().
 *
 * Rejects officers from a different tenant to prevent cookie-based tenant
 * leakage.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  officerBelongsToCurrentTenant,
  currentOfficerRoster,
  OFFICER_COOKIE_MAX_AGE_SECONDS,
  OFFICER_COOKIE_NAME,
} from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let officerId = "";
  try {
    const body = await request.json();
    officerId = typeof body?.officerId === "string" ? body.officerId.trim() : "";
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON with an `officerId` string." },
      { status: 400 },
    );
  }
  if (!officerId) {
    return NextResponse.json({ error: "officerId is required." }, { status: 400 });
  }

  const belongs = await officerBelongsToCurrentTenant(officerId);
  if (!belongs) {
    return NextResponse.json(
      { error: "Officer does not belong to the current tenant." },
      { status: 403 },
    );
  }

  const tenant = await resolveCurrentTenant();
  const officer = (await currentOfficerRoster()).find((o) => o.id === officerId)!;

  const response = NextResponse.json({
    ok: true,
    officer: { id: officer.id, name: officer.name, role: officer.role },
  });
  response.cookies.set(OFFICER_COOKIE_NAME, officer.id, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: OFFICER_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
