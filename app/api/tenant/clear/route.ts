/**
 * POST /api/tenant/clear
 *
 * Called by the "Exit demo" header control. Exiting has to leave no demo
 * data behind, so it clears BOTH cookies:
 *
 *   jana_demo_tenant — which bank was selected. Cleared so the next request
 *     is redirected by middleware to /enter, the bank-select landing (first)
 *     screen.
 *   jana_demo_mode   — whether the synthetic portfolio is shown. Pinned to
 *     "off" so that if the visitor re-enters a bank, they land on the empty
 *     product rather than the 80K fabricated loans. Without this, demo mode
 *     defaults back ON (see lib/demo/mode.ts) and "exit" would still show
 *     fabricated data — the opposite of what "exit demo" promises.
 *
 * Idempotent: safe to call when neither cookie is set.
 */

import { NextResponse } from "next/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenants";
import { DEMO_MODE_COOKIE } from "@/lib/demo/mode";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TENANT_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  // Turn demo data OFF as part of exiting. Same attributes the toggle uses
  // (see app/api/demo/mode/route.ts) so this write is a true override of the
  // toggle's cookie, not a second cookie the reader might disagree with.
  response.cookies.set(DEMO_MODE_COOKIE, "off", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
