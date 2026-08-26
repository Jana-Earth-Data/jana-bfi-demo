"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { LoginButton } from "@/components/bfi/login-button";
import { OfficerPicker } from "@/components/bfi/officer-picker";
import { DemoMenu } from "@/components/bfi/demo/demo-menu";
import { Badge } from "@/components/bfi/shared/primitives";
import { BfiDemoMeta } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DashboardHeader({
  meta,
  isLive,
  officers,
  currentOfficer,
  demoBuild,
  demoMode,
}: {
  meta: BfiDemoMeta;
  isLive: boolean;
  officers: Officer[];
  currentOfficer: Officer | null;
  /** Was this artifact compiled with the demo layer? Build-time, immutable. */
  demoBuild: boolean;
  /** Is the demo layer active right now? Runtime, togglable. */
  demoMode: boolean;
}) {
  const { logout, accessToken } = useAuth();
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
          {/*
            The "Demo data" badge that used to sit here is gone. The amber
            banner in the root layout says the same thing far louder, and two
            notices at different volumes invite the reader to believe the
            quieter one. The Live badge stays: it marks a genuine distinction
            between served-from-DB and live-enriched data.
          */}
          {isLive && (
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
          )}
          <Badge className="border-line bg-panel text-slate-300">
            Powered by Jana
          </Badge>
          {/*
            OfficerPicker deliberately stays in the header rather than moving
            into the Demo menu. It is not demo scaffolding -- it attributes
            captured review data to a named person, and it is a redirect
            target: the ESDD and Taxonomy wizards bounce unsigned visitors
            back with ?openOfficerPicker=1, which the component honours in a
            mount effect. Inside a closed popover it would never mount, and
            that redirect would silently do nothing.
          */}
          <OfficerPicker
            officers={officers}
            currentOfficer={currentOfficer}
          />
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel text-slate-300 transition hover:bg-line/30"
          >
            {/* Gear icon (inline svg — no lucide dep for one glyph) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
          <LoginButton />
          {accessToken && (
            <button
              onClick={logout}
              className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            >
              Sign out
            </button>
          )}
          {/*
            One entry point for every piece of demo apparatus. Absent
            entirely from a live build -- see lib/demo/mode.ts.
          */}
          {demoBuild && (
            <DemoMenu
              demoMode={demoMode}
              onSwitchBank={switchBank}
              switching={switching}
            />
          )}
        </div>
      </div>
    </header>
  );
}

// TourSelector moved to components/bfi/demo/demo-menu.tsx.
