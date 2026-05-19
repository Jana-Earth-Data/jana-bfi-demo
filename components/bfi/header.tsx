"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { LoginButton } from "@/components/bfi/login-button";
import { Badge } from "@/components/bfi/shared/primitives";
import { useTour } from "@/lib/tour/tour-context";
import { BfiDemoMeta } from "@/lib/types/bfi";

export function DashboardHeader({
  meta,
  isLive,
}: {
  meta: BfiDemoMeta;
  isLive: boolean;
}) {
  const { logout, accessToken } = useAuth();
  const tour = useTour();

  return (
    <header
      className="border-b border-line bg-surface/80 backdrop-blur"
      data-tour="header"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
            {/* Plain img to avoid next/image optimizer in standalone Docker (no sharp). */}
            <img
              src="/green_logo.png"
              alt="Jana"
              width={20}
              height={20}
              className="opacity-90"
            />
          </div>
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
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
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
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20"
            aria-label="Play guided tour"
            title="Play a 3-minute narrated walkthrough"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            Play guided tour
          </button>
          <LoginButton />
          {accessToken && (
            <button
              onClick={logout}
              className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
