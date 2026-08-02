/**
 * Tenant model for the BFI demo.
 *
 * A "tenant" is the bank whose UI, branding, and captured officer data the
 * demo is currently rendering for. The tenant is picked at deploy time via
 * NEXT_PUBLIC_TENANT (see lib/tenants/index.ts).
 *
 * Everything a page needs to render bank-specific chrome, branch codes,
 * loan captions, and per-tenant persistence keys lives on this shape.
 */

export type TenantId = "default" | "laxmi_sunrise";

/** Officer roles surfaced in the officer-picker (Phase 2 UI). */
export type OfficerRole =
  | "loan_officer"
  | "esg_officer"
  | "compliance"
  | "credit_committee";

export type Officer = {
  id: string;
  name: string;
  role: OfficerRole;
  email?: string;
};

export type TenantBranding = {
  /** Full display name used in headers, footers, and email templates. */
  displayName: string;
  /** Short form used where space is tight (KPI sublabels, badges). */
  shortName: string;
  /**
   * Path (from /public) to the tenant's primary logo. Should be a square
   * PNG or SVG. When absent, the app falls back to the Jana green_logo.png.
   */
  logoPath: string;
  /**
   * Optional wordmark (horizontal). Used in the app header. When absent,
   * the app renders the shortName in text.
   */
  wordmarkPath?: string;
  /** CSS-friendly hex, used for primary buttons, active nav, etc. */
  primaryColorHex: string;
  /** CSS-friendly hex, used for accent chips, KPI values, etc. */
  accentColorHex: string;
};

export type TenantConfig = {
  /** Stable identifier. Persisted on every captured row. */
  id: TenantId;
  branding: TenantBranding;
  /**
   * Two-to-four-letter prefix used on branch codes for this bank (e.g.
   * "FBN-001", "LSB-001"). The synthesizer uses this when generating the
   * default portfolio for a new tenant.
   */
  branchCodePrefix: string;
  /**
   * Access codes handed to the bank for this tenant. Rotatable — adding
   * a new code and removing an old one does not touch any captured data,
   * because bank_id on Supabase rows is the tenant.id (stable), not the
   * code. Case-insensitive on lookup.
   *
   * Empty array means "no code required" — used for the default tenant,
   * which anyone can land on without a code by clicking the "Continue as
   * <default bank>" button on the landing page.
   */
  accessCodes: string[];
  /**
   * Officers surfaced in the picker. Not authoritative — the source of
   * truth for real deployments would be the bfi_officers Supabase table.
   * This list is what the demo shows on first open.
   */
  demoOfficers: Officer[];
  /**
   * If true, this tenant is the fallback when no cookie is set and no
   * valid access code is presented. Exactly one tenant must set this true.
   */
  isDefault: boolean;
};
