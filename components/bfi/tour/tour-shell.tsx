"use client";

/**
 * Tour shell — mounts TourProvider + TourOverlay + TourControls at layout
 * level so tour state and audio survive route changes into wizard pages
 * (/esdd/[loanId], /taxonomy/[loanId]).
 *
 * The shell is a passthrough for children. It renders no visible chrome
 * of its own — the overlay + controls only appear when a tour is active.
 *
 * Suspense boundary is required because TourProvider calls
 * useSearchParams() internally (for query-aware navigateTo comparison).
 * Without the boundary, Next.js's static prerender of /_not-found (and
 * any other page rendered via the root layout) hits a CSR bailout error.
 * See https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout.
 */

import { Suspense, type ReactNode } from "react";
import { TourProvider } from "@/lib/tour/tour-context";
import { TourOverlay } from "@/components/bfi/tour/tour-overlay";
import { TourControls } from "@/components/bfi/tour/tour-controls";
import type { TenantId } from "@/lib/tenants";

export function TourShell({
  tenantId,
  children,
}: {
  tenantId: TenantId | string | null;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <TourProvider tenantId={tenantId}>
        {children}
        <TourOverlay />
        <TourControls />
      </TourProvider>
    </Suspense>
  );
}
