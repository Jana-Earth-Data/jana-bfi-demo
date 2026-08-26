/**
 * Route middleware — two responsibilities:
 *
 * 1. **Tenant gating (pages):** Steers visitors through the bank access-code
 *    entry flow. If the visitor has no tenant cookie and is requesting a real
 *    page, redirect them to /enter to enter a code.
 *
 * 2. **Rate limiting (API routes):** Applies a per-IP sliding-window rate
 *    limit to all /api/* requests. Returns 429 when exceeded.
 *
 * The matcher now includes both page paths and API routes, with the logic
 * branching by pathname prefix.
 */

import { NextRequest, NextResponse } from "next/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenants/resolve";
import { isTenantId } from "@/lib/tenants/registry";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // -----------------------------------------------------------------------
  // API routes — rate limiting only (no tenant redirect)
  // -----------------------------------------------------------------------
  if (pathname.startsWith("/api/")) {
    // Health check is excluded from rate limiting — orchestrators (Docker
    // HEALTHCHECK, ECS, ALB) poll it every few seconds.
    if (pathname === "/api/health") {
      return NextResponse.next();
    }

    // Demo builds skip rate limiting entirely. A bank demo room is behind
    // one NAT — every attendee shares a single IP. A single page load can
    // fire 6+ parallel API calls (taxonomy-summary, followups, officer-queue,
    // dashboard-data, …), so even a modest group trips the limit and the
    // failure looks like the app breaking.
    if (process.env.JANA_DEMO === "1") {
      return NextResponse.next();
    }

    const ip = getClientIp(request.headers);
    const result = checkRateLimit(ip);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
          },
        },
      );
    }
    return NextResponse.next();
  }

  // -----------------------------------------------------------------------
  // Page routes — tenant gating
  // -----------------------------------------------------------------------

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

  // Cookie present but value is not a known tenant → clear the invalid
  // cookie and redirect to /enter. This prevents a stale or forged cookie
  // from bypassing the entry gate and reaching routes that would fall back
  // to the default tenant silently.
  if (!isTenantId(cookie.value)) {
    const url = request.nextUrl.clone();
    url.pathname = "/enter";
    url.search = "";
    const response = NextResponse.redirect(url);
    response.cookies.delete(TENANT_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

/**
 * Matcher: includes API routes (for rate limiting) and page routes (for
 * tenant gating). Skips Next internals, static assets, and public files.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|tenants/|audio/|green_logo\\.png|admin/).*)",
  ],
};
