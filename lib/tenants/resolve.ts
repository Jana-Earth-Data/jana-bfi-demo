/**
 * Server-only tenant resolution.
 *
 * Every server component and API route resolves the active tenant by
 * reading the `jana_demo_tenant` cookie set by the landing page (or by
 * the ?bank= query handler). Unknown or missing cookie → default tenant.
 *
 * IMPORTANT: this module imports from next/headers, which forbids client
 * bundling. Do not import it from a "use client" component. Client
 * components that need tenant info should receive it as a prop from a
 * server parent, or call an API route that reads it.
 */

import { cookies } from "next/headers";
import { REGISTRY, isTenantId } from "./registry";
import type { TenantConfig } from "./types";

export const TENANT_COOKIE_NAME = "jana_demo_tenant";
export const TENANT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Resolve the active tenant for the current request.
 *
 * Precedence:
 *   1. Cookie value matching a known tenant id → that tenant
 *   2. Otherwise → the tenant marked isDefault
 */
export async function resolveCurrentTenant(): Promise<TenantConfig> {
  const c = await cookies();
  const stored = c.get(TENANT_COOKIE_NAME)?.value ?? "";
  if (stored && isTenantId(stored)) {
    return REGISTRY[stored];
  }
  return getDefaultTenant();
}

/** The tenant flagged isDefault. Throws if the registry has none. */
export function getDefaultTenant(): TenantConfig {
  const fallback = Object.values(REGISTRY).find((t) => t.isDefault);
  if (!fallback) {
    throw new Error(
      "Tenant registry has no default tenant. Set isDefault:true on exactly one entry.",
    );
  }
  return fallback;
}
