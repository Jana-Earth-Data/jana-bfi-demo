/**
 * resolveSettings — merge a partial saved TenantSettings blob over the
 * DEFAULT_SETTINGS baseline so callers always receive a fully-hydrated
 * TenantSettings object.
 *
 * The saved blob is a free-form JSONB in bfi_tenant_settings.settings; new
 * settings added to types.ts are populated by the defaults instead of
 * requiring a data backfill. Deep merge only descends one level per
 * category (each category is a small object of primitives / arrays / a
 * nested primitive object), which is enough for the current shape and
 * avoids clever recursion on user-controlled JSON.
 *
 * Unknown keys on the saved blob are ignored — the type surface here is
 * authoritative, not the wire.
 */

import { DEFAULT_SETTINGS } from "./defaults";
import type { TenantSettings } from "./types";

type Raw = Record<string, unknown> | null | undefined;

/**
 * Two-level merge helper for the settings blob. Each TenantSettings
 * category is an object of primitives / arrays / a small nested object
 * (esrm.remarksRequired, cap.monitoringCadenceMonthsByRiskClass) — those
 * nested primitive objects get their own shallow merge so a partial
 * remarksRequired override doesn't wipe the other two flags.
 */
function mergeCategory<T extends Record<string, unknown>>(
  defaults: T,
  saved: Raw,
): T {
  if (!saved || typeof saved !== "object") return { ...defaults };
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (!(key in saved)) continue;
    const savedVal = (saved as Record<string, unknown>)[key];
    const defaultVal = defaults[key];
    if (
      defaultVal !== null &&
      typeof defaultVal === "object" &&
      !Array.isArray(defaultVal) &&
      savedVal !== null &&
      typeof savedVal === "object" &&
      !Array.isArray(savedVal)
    ) {
      // Nested primitive-object — shallow merge one more level.
      out[key] = {
        ...(defaultVal as Record<string, unknown>),
        ...(savedVal as Record<string, unknown>),
      };
    } else {
      // Primitive / array — take the saved value verbatim (or fall
      // back to the default when saved is undefined).
      out[key] = savedVal === undefined ? defaultVal : savedVal;
    }
  }
  return out as T;
}

/**
 * Merge a partial saved settings blob (from bfi_tenant_settings.settings)
 * over the DEFAULT_SETTINGS baseline and return a fully-hydrated
 * TenantSettings. Safe to call with null / undefined / empty object.
 */
export function resolveSettings(raw?: Raw): TenantSettings {
  const safe = raw && typeof raw === "object" ? raw : {};
  return {
    esrm: mergeCategory(DEFAULT_SETTINGS.esrm, safe.esrm as Raw),
    loanBook: mergeCategory(DEFAULT_SETTINGS.loanBook, safe.loanBook as Raw),
    taxonomy: mergeCategory(DEFAULT_SETTINGS.taxonomy, safe.taxonomy as Raw),
    nfrs: mergeCategory(DEFAULT_SETTINGS.nfrs, safe.nfrs as Raw),
    cap: mergeCategory(DEFAULT_SETTINGS.cap, safe.cap as Raw),
    notifications: mergeCategory(
      DEFAULT_SETTINGS.notifications,
      safe.notifications as Raw,
    ),
    bank: mergeCategory(DEFAULT_SETTINGS.bank, safe.bank as Raw),
  };
}

/**
 * True when the given settings object has at least one field that
 * differs from the default. Used by the header gear-icon dot indicator
 * so officers can spot at a glance that this tenant has overrides.
 */
export function hasAnyOverride(settings: TenantSettings): boolean {
  return JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);
}

/**
 * Small helper — is remarks required for the given ESDD section? Wraps
 * the boolean lookup so wizard code reads cleanly and future logic (e.g.
 * per-question overrides) has a single hook to grow through.
 *
 * Section keys align with the ESDD wizard's SectionStep instances:
 *   general → S1 (general risk)
 *   ehs     → S2 (environmental health & safety)
 *   social  → S3 (social risks)
 */
export function remarksRequiredForSection(
  sectionKey: "general" | "ehs" | "social",
  settings: TenantSettings,
): boolean {
  switch (sectionKey) {
    case "general":
      return settings.esrm.remarksRequired.section1;
    case "ehs":
      return settings.esrm.remarksRequired.section2;
    case "social":
      return settings.esrm.remarksRequired.section3;
    default:
      return false;
  }
}
