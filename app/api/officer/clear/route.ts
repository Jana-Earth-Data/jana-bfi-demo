/**
 * POST /api/officer/clear
 *
 * Deletes the jana_demo_officer cookie. Idempotent — safe to call when
 * there's no officer set. Used by the "change officer" affordance in the
 * header.
 */

import { NextResponse } from "next/server";
import { OFFICER_COOKIE_NAME } from "@/lib/officers/resolve";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OFFICER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
