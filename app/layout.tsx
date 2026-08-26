import "./globals.css";
import type { Metadata } from "next";
import { TourShell } from "@/components/bfi/tour/tour-shell";
import { DemoModeBanner } from "@/components/bfi/demo/demo-banner";
import { isDemoMode } from "@/lib/demo/mode";
import { resolveCurrentTenant } from "@/lib/tenants";

export const metadata: Metadata = {
  title: "Jana BFI Demo - Financed Emissions",
  description:
    "Scope 3 financed emissions dashboard for Nepal BFIs, powered by Jana Earth Data",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve the tenant server-side so the TourProvider can pre-select the
  // right tour registry entry. When no cookie is set (e.g. on /enter),
  // TourProvider stays inert — startTour won't find a script and the
  // controls stay hidden.
  const tenant = await resolveCurrentTenant().catch(() => null);

  // The banner lives in the root layout rather than the dashboard header so
  // that it also covers the wizard routes (/esdd, /cap, /taxonomy, /pcaf,
  // /pf-screening) and /settings. Those render synthetic borrowers too, and
  // a warning that only appears on the dashboard is a warning you can walk
  // out from under.
  const demoMode = await isDemoMode();

  return (
    <html lang="en" data-tenant-id={tenant?.id ?? ""}>
      <body>
        {demoMode && <DemoModeBanner />}
        <TourShell tenantId={tenant?.id ?? null}>{children}</TourShell>
      </body>
    </html>
  );
}
