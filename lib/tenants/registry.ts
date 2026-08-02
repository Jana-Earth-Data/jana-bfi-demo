/**
 * Tenant registry.
 *
 * Two entries today:
 *   - default        : "First Bank of Nepal" hypothetical, matches the
 *                       existing demo behavior. Used when NEXT_PUBLIC_TENANT
 *                       is unset or unrecognised.
 *   - laxmi_sunrise  : Laxmi Sunrise Bank. Real bank; branding rendered
 *                       during Laxmi meetings and Laxmi-specific captures.
 *
 * Adding a new tenant is a one-file edit: add a Tenant object to REGISTRY,
 * drop a logo under public/tenants/<id>/, and set NEXT_PUBLIC_TENANT=<id>
 * on the deployment.
 */

import type { Officer, TenantConfig, TenantId } from "./types";

// Demo officer rosters. These are surfaced in the picker; the real source
// of truth for a production deployment would be the bfi_officers table.
const DEFAULT_OFFICERS: Officer[] = [
  { id: "off-default-01", name: "Riya Sharma", role: "loan_officer" },
  { id: "off-default-02", name: "Anish Rai", role: "esg_officer" },
  { id: "off-default-03", name: "Priya Karki", role: "compliance" },
  { id: "off-default-04", name: "Bikram Thapa", role: "credit_committee" },
];

const LAXMI_OFFICERS: Officer[] = [
  { id: "off-laxmi-01", name: "Sujata Adhikari", role: "loan_officer" },
  { id: "off-laxmi-02", name: "Rajan Basnet", role: "esg_officer" },
  { id: "off-laxmi-03", name: "Kabita Shrestha", role: "compliance" },
  { id: "off-laxmi-04", name: "Deepak Pradhan", role: "credit_committee" },
];

export const REGISTRY: Record<TenantId, TenantConfig> = {
  default: {
    id: "default",
    branding: {
      displayName: "First Bank of Nepal",
      shortName: "FBN",
      // Default tenant re-uses the Jana Earth Data mark; the "First Bank
      // of Nepal" placeholder does not have a real logo of its own.
      logoPath: "/green_logo.png",
      primaryColorHex: "#0F5132",  // Jana brand green (matches demo docs)
      accentColorHex: "#1B6B3D",
    },
    branchCodePrefix: "FBN",
    // Default tenant intentionally has no code — visitors reach it via
    // the "Continue as First Bank of Nepal (demo)" button on the landing
    // page, or by entering an unknown code (falls back here).
    accessCodes: [],
    demoOfficers: DEFAULT_OFFICERS,
    isDefault: true,
  },
  laxmi_sunrise: {
    id: "laxmi_sunrise",
    branding: {
      displayName: "Laxmi Sunrise Bank",
      shortName: "LSB",
      logoPath: "/tenants/laxmi_sunrise/logo.png",
      // Laxmi Sunrise brand orange, extracted from their live site.
      // Primary is the CTA / wordmark orange; accent is the secondary
      // deeper orange used on the news-ticker and Ctrl-O bars.
      primaryColorHex: "#F5951E",
      accentColorHex: "#E37B15",
    },
    branchCodePrefix: "LSB",
    // Access codes handed to Laxmi Sunrise. Rotatable — to invalidate a
    // code, remove the string from this array on the next deploy. Multiple
    // codes supported so we can hand different codes to different Laxmi
    // meeting sessions if useful.
    accessCodes: ["LX-K7QN2P"],
    demoOfficers: LAXMI_OFFICERS,
    isDefault: false,
  },
};

/**
 * Runtime guard: exactly one tenant should be marked isDefault. This
 * expression evaluates at module load so a mistake shows up on the first
 * page render, not at meeting time.
 */
const DEFAULT_COUNT = Object.values(REGISTRY).filter((t) => t.isDefault).length;
if (DEFAULT_COUNT !== 1 && process.env.NODE_ENV !== "production") {
  console.warn(
    `Tenant registry has ${DEFAULT_COUNT} tenants marked isDefault. Exactly one must be default.`
  );
}

export function isTenantId(value: string): value is TenantId {
  return value in REGISTRY;
}
