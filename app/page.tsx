import { Dashboard } from "@/components/bfi/dashboard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer, currentOfficerRoster } from "@/lib/officers/resolve";

import { applyOfficerPcafOverlay } from "@/lib/api/pcaf-overlay";
import { isDemoBuild } from "@/lib/demo/provider";
import { isDemoMode } from "@/lib/demo/mode";
import { getCaptureClient } from "@/lib/data/capture-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Resolve the tenant + the currently signed-in officer from the
  // jana_demo_tenant / jana_demo_officer cookies. Both are used to paint
  // the SSR tree correctly on first render (no client-side flash of wrong
  // bank name / wrong officer).
  const tenant = await resolveCurrentTenant();
  const currentOfficer = await resolveCurrentOfficer();

  // SSR has no bank-auth token — mock data + synthetic screenings.
  const base = await getBfiDemoData();

  // Fold in the officers' saved PCAF availability. getBfiDemoData() returns
  // the build-time precompute, whose data-quality scores were derived before
  // anyone reviewed anything — without this the dashboard would report a
  // weighted score computed as though the review had not happened. Scoped to
  // this tenant; only reviewed borrowers' loans are re-scored.
  const supabase = await getCaptureClient();
  const overlay = supabase
    ? await applyOfficerPcafOverlay(base, tenant.id, supabase as never)
    : null;
  const data = overlay?.data ?? base;

  data.meta = {
    ...data.meta,
    bankName: tenant.branding.displayName,
    tenantId: tenant.id,
    tenantLogoPath: tenant.branding.logoPath,
  };

  const slice = await buildDashboardSlice(data, null);
  const enriched = {
    ...slice,
    officers: await currentOfficerRoster(),
    currentOfficer,
    // Resolved once, server-side, and passed down. The header must not
    // re-derive these -- isDemoMode() reads a cookie and isDemoBuild() reads
    // an env var, neither of which a client component can see correctly. One
    // answer per render is also what stops the banner and the loan count
    // disagreeing.
    demoBuild: isDemoBuild(),
    demoMode: await isDemoMode(),
  };
  return (
    <TenantThemeProvider tenant={tenant}>
      <Dashboard data={enriched} />
    </TenantThemeProvider>
  );
}
