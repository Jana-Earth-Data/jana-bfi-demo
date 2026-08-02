/**
 * Public tenant API.
 *
 * Server code: `resolveCurrentTenant()` reads the tenant cookie and returns
 * the resolved TenantConfig (or the default when no cookie / unknown value).
 *
 * Server / route handlers: `findTenantByCode()` validates an access code
 * handed by a bank and returns its TenantConfig.
 *
 * Client code: receive TenantConfig as a prop from a server parent, or
 * fetch /api/tenant/current for the read-only view (implemented in a
 * later step).
 *
 * The `bank_id` on every captured row is the tenant.id — this is the
 * multi-tenant isolation contract described in the extension plan.
 */

import { REGISTRY } from "./registry";
import type { TenantConfig, TenantId } from "./types";

export {
  resolveCurrentTenant,
  getDefaultTenant,
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_MAX_AGE_SECONDS,
} from "./resolve";

export {
  findTenantByCode,
  isPlausibleCode,
  normaliseCode,
} from "./codes";

/** Look up a tenant by id. Throws when the id is unknown. */
export function getTenant(id: TenantId): TenantConfig {
  return REGISTRY[id];
}

/** List all registered tenants (used by the admin UI later). */
export function listTenants(): TenantConfig[] {
  return Object.values(REGISTRY);
}

export type { TenantConfig, TenantId, Officer, OfficerRole, TenantBranding } from "./types";
