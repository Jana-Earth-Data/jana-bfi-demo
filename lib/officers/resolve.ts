/**
 * Server-only officer resolution.
 *
 * The demo's "signed-in officer" is stored in a jana_demo_officer HTTP-only
 * cookie. On every request, we read the cookie, look up the officer by id
 * inside the current tenant's roster, and return the resolved Officer (or
 * null if no officer is currently selected).
 *
 * Officers are scoped per tenant — a Laxmi Sunrise cookie value is never
 * looked up against the default tenant's roster. This prevents a cookie
 * from one demo session leaking a different tenant's officer identity when
 * the visitor changes bank codes.
 */

import { cookies } from "next/headers";
import { resolveCurrentTenant } from "@/lib/tenants";
import type { Officer } from "@/lib/tenants";

export const OFFICER_COOKIE_NAME = "jana_demo_officer";
export const OFFICER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Resolve the currently selected officer for the current request.
 * Returns null when no officer is set, or when the stored id no longer
 * belongs to the active tenant.
 */
export async function resolveCurrentOfficer(): Promise<Officer | null> {
  const c = await cookies();
  const stored = c.get(OFFICER_COOKIE_NAME)?.value ?? "";
  if (!stored) return null;

  const tenant = await resolveCurrentTenant();
  const match = tenant.demoOfficers.find((o) => o.id === stored);
  return match ?? null;
}

/** True if the officer id belongs to the current tenant's roster. */
export async function officerBelongsToCurrentTenant(
  officerId: string,
): Promise<boolean> {
  const tenant = await resolveCurrentTenant();
  return tenant.demoOfficers.some((o) => o.id === officerId);
}
