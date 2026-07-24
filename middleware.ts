/**
 * Route middleware — steers visitors through the bank access-code entry.
 *
 * Rules:
 *   - If the URL carries ?bank=CODE (any path), redirect to /enter?bank=CODE
 *     so the server-side handler in app/enter/page.tsx can validate the
 *     code, set the cookie, and forward on to /.
 *   - If the visitor has no tenant cookie and is asking for a real page
 *     (not the landing page itself, not an API route, not a static asset),
 *     redirect them to /enter to enter a code.
 *   - Otherwise pass through unchanged.
 *
 * The tenant cookie is the visitor's identity for the rest of the session.
 * It is set only by /enter or by /api/tenant/set-code.
 */

import { NextRequest, NextResponse } from "next/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenants/resolve";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ?bank=CODE anywhere → hand off to the landing page for validation.
  const bankCode = searchParams.get("bank");
  if (bankCode && pathname !== "/enter") {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    // Preserve the bank code for the landing page's server handler.
    return NextResponse.redirect(url);
  }

  // Already on the landing page — no rewriting.
  if (pathname === "/enter") {
    return NextResponse.next();
  }

  // No cookie → prompt for a code first.
  const cookie = request.cookies.get(TENANT_COOKIE_NAME);
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Matcher: skip API routes, Next internals, static assets, and public files.
 * We want middleware to run on real pages (/, /any-page) so we can gate
 * them on the tenant cookie.
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|tenants/|audio/|green_logo\\.png).*)",
  ],
};
