import { Dashboard } from "@/components/bfi/dashboard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Resolve the tenant + the currently signed-in officer from the
  // jana_demo_tenant / jana_demo_officer cookies. Both are used to paint
  // the SSR tree correctly on first render (no client-side flash of wrong
  // bank name / wrong officer).
  const tenant = await resolveCurrentTenant();
  const currentOfficer = await resolveCurrentOfficer();

  // SSR has no bank-auth token — mock data + synthetic screenings.
  const data = await getBfiDemoData();
  data.meta = {
    ...data.meta,
    bankName: tenant.branding.displayName,
    tenantId: tenant.id,
    tenantLogoPath: tenant.branding.logoPath,
  };

  const slice = await buildDashboardSlice(data, null);
  const enriched = {
    ...slice,
    officers: tenant.demoOfficers,
    currentOfficer,
  };
  return (
    <TenantThemeProvider tenant={tenant}>
      <Dashboard data={enriched} />
    </TenantThemeProvider>
  );
}
