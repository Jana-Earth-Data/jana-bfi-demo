"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { LoginButton } from "@/components/bfi/login-button";
import { OfficerPicker } from "@/components/bfi/officer-picker";
import { Badge } from "@/components/bfi/shared/primitives";
import { useTour } from "@/lib/tour/tour-context";
import { BfiDemoMeta } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardHeader({
  meta,
  isLive,
  officers,
  currentOfficer,
}: {
  meta: BfiDemoMeta;
  isLive: boolean;
  officers: Officer[];
  currentOfficer: Officer | null;
}) {
  const { logout, accessToken } = useAuth();
  const tour = useTour();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function switchBank() {
    setSwitching(true);
    try {
      await fetch("/api/tenant/clear", { method: "POST" });
      // Navigate to the bank access-code entry.
      router.push("/enter");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header
      className="border-b border-line bg-surface/80 backdrop-blur"
      data-tour="header"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-4">
          {/*
            Logo lockup. Full-size band so both compact monograms (Jana) and
            wordmark-style bank logos (Laxmi Sunrise) have room to breathe.
            object-contain preserves aspect ratio; no tinted background tile
            because bank logos ship with their own colour palettes and read
            best on the neutral header surface.
          */}
          <img
            src={meta.tenantLogoPath ?? "/green_logo.png"}
            alt={meta.bankName}
            className="h-12 w-auto max-w-[200px] object-contain"
          />
          <div>
            <div className="text-base font-semibold text-white">
              {meta.bankName}
            </div>
            <div className="text-xs text-slate-500">
              Financed emissions &amp; portfolio risk
              {meta.asOfDate ? ` · As of ${meta.asOfDate}` : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isLive ? (
            <Badge
              className="text-white"
              style={{
                borderColor: "var(--brand-primary)",
                backgroundColor: "var(--brand-primary-soft)",
                color: "var(--brand-primary)",
              }}
            >
              Live data · Climate TRACE
            </Badge>
          ) : (
            <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-300">
              Demo data
            </Badge>
          )}
          <Badge className="border-line bg-panel text-slate-300">
            Powered by Jana
          </Badge>
          <button
            onClick={tour.start}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition"
            style={{
              borderColor: "var(--brand-primary)",
              backgroundColor: "var(--brand-primary-soft)",
              color: "var(--brand-primary)",
              borderWidth: "1px",
              borderStyle: "solid",
            }}
            aria-label="Play guided tour"
            title="Play a 3-minute narrated walkthrough"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            Play guided tour
          </button>
          <OfficerPicker
            officers={officers}
            currentOfficer={currentOfficer}
          />
          <LoginButton />
          {accessToken && (
            <button
              onClick={logout}
              className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            >
              Sign out
            </button>
          )}
          <button
            onClick={switchBank}
            disabled={switching}
            className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30 disabled:opacity-50"
            title="Enter a different bank access code"
          >
            {switching ? "Switching…" : "Switch bank"}
          </button>
        </div>
      </div>
    </header>
  );
}
