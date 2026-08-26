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
import { isDemoMode } from "@/lib/demo/mode";
import type { Officer } from "@/lib/tenants";

export const OFFICER_COOKIE_NAME = "jana_demo_officer";
export const OFFICER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * The officer roster for this request — empty when demo mode is off.
 *
 * The third source of demo data, and the one that survived Phases 1–3.
 *
 * Riya Sharma, Anish Rai, Priya Karki and Bikram Thapa are invented people.
 * They live in lib/tenants/registry.ts as `demoOfficers`, hardcoded in TypeScript
 * rather than in a table, so neither the build-time boundary nor the `origin`
 * column ever touched them: with demo mode off, the portfolio was empty, the
 * queue was empty, and the header still said "As Riya Sharma · Loan officer".
 *
 * That matters beyond tidiness. Officers are the attribution subjects for
 * captured compliance work — an ESDD response records who answered it. A
 * fabricated name attached to a real assessment is a false statement about
 * who did the review, which is exactly the sort of thing an NRB inspection
 * would be entitled to object to.
 *
 * A live instance has no roster until real officers are provisioned, so the
 * honest answer is an empty list.
 *
 * Seeders are exempt: they write demo data by definition and reach for
 * tenant.demoOfficers directly. check-demo-officers.mjs enforces that split.
 */
export async function currentOfficerRoster(): Promise<Officer[]> {
  if (!(await isDemoMode())) return [];
  const tenant = await resolveCurrentTenant();
  return tenant.demoOfficers;
}

/**
 * Resolve the currently selected officer for the current request.
 * Returns null when no officer is set, or when the stored id no longer
 * belongs to the active tenant.
 */
export async function resolveCurrentOfficer(): Promise<Officer | null> {
  const c = await cookies();
  const stored = c.get(OFFICER_COOKIE_NAME)?.value ?? "";
  if (!stored) return null;

  // Via the gated roster: with demo mode off this is empty, so a stale
  // jana_demo_officer cookie from a demo session cannot resolve to a person.
  const roster = await currentOfficerRoster();
  return roster.find((o) => o.id === stored) ?? null;
}

/** True if the officer id belongs to the current tenant's roster. */
export async function officerBelongsToCurrentTenant(
  officerId: string,
): Promise<boolean> {
  const roster = await currentOfficerRoster();
  return roster.some((o) => o.id === officerId);
}
