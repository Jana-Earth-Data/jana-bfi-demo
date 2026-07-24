/**
 * POST /api/tenant/clear
 *
 * Called by the "Switch bank" header link. Deletes the tenant cookie so
 * the next request lands on the /enter page (or on the default tenant if
 * the visitor hits / directly without going through the landing page).
 *
 * Idempotent: safe to call when there's no cookie set.
 */

import { NextResponse } from "next/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TENANT_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
