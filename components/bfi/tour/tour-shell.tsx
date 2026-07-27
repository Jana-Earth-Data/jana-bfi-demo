"use client";

/**
 * Tour shell — mounts TourProvider + TourOverlay + TourControls at layout
 * level so tour state and audio survive route changes into wizard pages
 * (/esdd/[loanId], /taxonomy/[loanId]).
 *
 * The shell is a passthrough for children. It renders no visible chrome
 * of its own — the overlay + controls only appear when a tour is active.
 */

import type { ReactNode } from "react";
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
    <TourProvider tenantId={tenantId}>
      {children}
      <TourOverlay />
      <TourControls />
    </TourProvider>
  );
}
