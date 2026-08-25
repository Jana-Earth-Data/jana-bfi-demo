"use client";

/**
 * One Demo menu, replacing seven buttons in the header.
 *
 * What it consolidates
 * --------------------
 * The header carried a TOUR strip with one button per tour, a Switch bank
 * button, and an officer picker. Nine controls in the chrome of a compliance
 * product, all of them scaffolding, none of which a bank's own staff would
 * ever use. They also read as product features rather than demo apparatus,
 * which is the wrong impression to give in a sales conversation.
 *
 * The toggle
 * ----------
 * Turning demo mode off empties the loan book, because the book is
 * fabricated. That is the point: it shows a prospect what their instance
 * looks like on day one, before core-banking import. The menu stays visible
 * while off, since it is how you switch back.
 *
 * Why the panel is portalled into document.body
 * ---------------------------------------------
 * <DashboardHeader> uses backdrop-blur. Any backdrop-filter on an ancestor
 * creates a new stacking context, which traps a descendant's z-index inside
 * it -- so the tab strip below the header painted OVER this panel and, worse,
 * swallowed its clicks. The visible symptom was text bleeding through the
 * menu; the invisible one was that clicking the demo toggle silently
 * activated whichever tab happened to be underneath, and no request was ever
 * sent. A control that does nothing while looking like it did something is
 * the exact failure this whole demo/live separation exists to prevent.
 *
 * OfficerPicker portals for the same reason and says so in its own docstring.
 *
 * Rendered only in a demo build. A live build never mounts this.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTour } from "@/lib/tour/tour-context";
import { availableTours } from "@/lib/tour/registry";
import type { TourName } from "@/lib/tour/types";

const TOUR_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "loan-officer": "Loan officer",
  manager: "Manager",
  "pf-screening": "PF screening",
  pcaf: "PCAF scoring",
  nfrs: "NFRS",
};

const PANEL_WIDTH = 288; // w-72

export function DemoMenu({
  demoMode,
  onSwitchBank,
  switching = false,
}: {
  /** Resolved server-side so the menu and the data cannot disagree. */
  demoMode: boolean;
  onSwitchBank: () => void;
  switching?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rect, setRect] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { startTour, status, stop } = useTour();

  useEffect(() => setMounted(true), []);

  const tenantId =
    typeof document !== "undefined"
      ? document.documentElement.dataset.tenantId ?? "default"
      : "default";
  const tours = availableTours(tenantId);

  /** Anchor the fixed-position panel under the trigger. */
  const place = useCallback(() => {
    const b = buttonRef.current?.getBoundingClientRect();
    if (!b) return;
    setRect({ top: b.bottom + 6, right: window.innerWidth - b.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  async function setDemoMode(on: boolean) {
    setError(null);
    try {
      const res = await fetch("/api/demo/mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ on }),
      });
      if (!res.ok) {
        // Surfaced, not swallowed. An earlier version returned silently here,
        // which would have made a broken toggle indistinguishable from a
        // working one.
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Toggle failed (HTTP ${res.status}).`);
        return;
      }
      setOpen(false);
      // Server components read the cookie, so a refresh is what applies it.
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message || "Toggle request did not complete.");
    }
  }

  // A tour in progress gets its own exit affordance rather than being buried
  // in a menu the operator would have to open mid-narration.
  if (status !== "idle") {
    return (
      <button
        onClick={stop}
        className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
        title="End the current tour"
      >
        End tour
      </button>
    );
  }

  const panel = (
    <>
      {/* Click-away. Above the app, below the panel. */}
      <div
        className="fixed inset-0 z-[999]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="menu"
        style={{
          position: "fixed",
          top: rect?.top ?? 0,
          right: rect?.right ?? 0,
          width: PANEL_WIDTH,
          visibility: rect ? "visible" : "hidden",
        }}
        className="z-[1000] rounded-lg border border-line bg-panel p-1 shadow-2xl"
      >
        {/* --- demo data toggle ---------------------------------------- */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Demo data
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {demoMode
                  ? "Synthetic portfolio loaded"
                  : "Off — showing the empty product"}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={demoMode}
              aria-label="Toggle demo data"
              disabled={pending}
              onClick={() => void setDemoMode(!demoMode)}
              className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                demoMode
                  ? "border-transparent bg-amber-500"
                  : "border-line/60 bg-panelAlt"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  demoMode ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {demoMode && (
            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              Turning this off empties the loan book. The portfolio is
              synthetic, so there is nothing underneath it yet.
            </p>
          )}
          {pending && (
            <p className="mt-2 text-[11px] text-slate-500">Reloading…</p>
          )}
          {error && (
            <p className="mt-2 rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[11px] text-rose-300">
              {error}
            </p>
          )}
        </div>

        <div className="my-1 border-t border-line/60" />

        {/* --- tours ---------------------------------------------------- */}
        {tours.length > 0 && (
          <>
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Guided tours
            </div>
            {tours.map((name: TourName) => (
              <button
                key={name}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  startTour(name);
                }}
                className="block w-full rounded px-3 py-1.5 text-left text-xs text-slate-300 transition hover:bg-white/5"
              >
                {TOUR_LABELS[name] ?? name}
              </button>
            ))}
            <div className="my-1 border-t border-line/60" />
          </>
        )}

        {/* --- bank switching -------------------------------------------- */}
        <button
          role="menuitem"
          disabled={switching}
          onClick={() => {
            setOpen(false);
            onSwitchBank();
          }}
          className="block w-full rounded px-3 py-1.5 text-left text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          {switching ? "Switching…" : "Switch bank"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-white/5"
        style={{
          borderColor: demoMode ? "rgb(245 158 11 / 0.6)" : "var(--line)",
          color: demoMode ? "rgb(252 211 77)" : "rgb(148 163 184)",
        }}
        title="Demo controls — tours, bank switching, demo data"
      >
        Demo
        <span aria-hidden className="text-[9px]">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {/*
        Portalled out of the header's backdrop-blur stacking context. Without
        this the panel is painted under the tab strip and its clicks land on
        whatever is above it.
      */}
      {open && mounted && createPortal(panel, document.body)}
    </>
  );
}
