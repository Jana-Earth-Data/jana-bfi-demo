import { Dashboard } from "@/components/bfi/dashboard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { getBfiDemoData } from "@/lib/api/bfi";
import { buildDashboardSlice } from "@/lib/data/dashboard-slice";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { getSupabaseAdmin } from "@/lib/data/supabase";
import { applyOfficerPcafOverlay } from "@/lib/api/pcaf-overlay";

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
  const supabase = getSupabaseAdmin();
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
    officers: tenant.demoOfficers,
    currentOfficer,
  };
  return (
    <TenantThemeProvider tenant={tenant}>
      <Dashboard data={enriched} />
    </TenantThemeProvider>
  );
}
