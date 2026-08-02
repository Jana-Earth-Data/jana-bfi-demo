/**
 * Access-code lookup.
 *
 * Handed to the bank; validated by the server; resolved to a TenantConfig.
 * Case-insensitive, whitespace-trimmed. Empty string returns null so the
 * caller can fall back to the default tenant deliberately.
 *
 * Codes rotate independently of tenant.id — the id is the stable identifier
 * used as bank_id on every captured Supabase row. Rotating a code (add a
 * new one, drop an old one from registry.ts) does not touch persisted data.
 */

import { REGISTRY } from "./registry";
import type { TenantConfig } from "./types";

const CODE_PATTERN = /^[A-Z0-9-]{4,32}$/;

/** Normalise a code the same way on both entry and lookup. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** True if the string could plausibly be an access code. Cheap guard. */
export function isPlausibleCode(raw: string): boolean {
  return CODE_PATTERN.test(normaliseCode(raw));
}

/** Look up the tenant that owns a code. Returns null if none match. */
export function findTenantByCode(raw: string): TenantConfig | null {
  const code = normaliseCode(raw);
  if (!code) return null;
  for (const tenant of Object.values(REGISTRY)) {
    if (tenant.accessCodes.some((c) => normaliseCode(c) === code)) {
      return tenant;
    }
  }
  return null;
}
