/**
 * /settings — Tenant settings page.
 *
 * Server component. Resolves the tenant + current officer. If no officer
 * is signed in the visitor is bounced back to the dashboard with the
 * officer-picker auto-open query flag (same pattern used by /esdd/[loanId]
 * and /taxonomy/[loanId]).
 *
 * The actual settings form is a client component (SettingsPage) that
 * fetches /api/settings on mount and issues a POST /api/settings on save.
 * We render the tenant theme wrapper here so brand colours cascade.
 */

import { redirect } from "next/navigation";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { SettingsPage } from "@/components/bfi/settings/settings-page";

export const dynamic = "force-dynamic";

export default async function TenantSettingsPage() {
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    // Punt back to the dashboard so the officer picker opens. Preserve a
    // returnTo so the visitor lands back on /settings after sign-in.
    redirect(
      `/?openOfficerPicker=1&returnTo=${encodeURIComponent("/settings")}`,
    );
  }

  return (
    <TenantThemeProvider tenant={tenant}>
      <SettingsPage
        tenantId={tenant.id}
        tenantDisplayName={tenant.branding.displayName}
        tenantLogoPath={tenant.branding.logoPath}
        officerName={officer.name}
      />
    </TenantThemeProvider>
  );
}
