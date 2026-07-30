"use client";

/**
 * Full-screen overlay that dims the dashboard and "cuts a hole" over the
 * active step's target element. A callout bubble with the step title and
 * narration text floats next to the spotlight.
 *
 * The overlay listens for window resize + scroll so the spotlight tracks
 * the element if the layout shifts (e.g. when tabs switch).
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { useTour } from "@/lib/tour/tour-context";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PAD = 10; // px around the target element

function targetRect(selector: string): Rect | null {
  if (typeof window === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: Math.max(0, r.top - PAD),
    left: Math.max(0, r.left - PAD),
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

function calloutPosition(rect: Rect | null) {
  // When there is no target, park the callout in the top-right corner
  // instead of dead-centering it (which historically felt like an
  // "everything is broken" state).
  if (!rect) {
    if (typeof window === "undefined") {
      return { top: "24px", right: "24px" };
    }
    return {
      top: "24px",
      left: `${Math.max(24, window.innerWidth - 380 - 24)}px`,
    };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const calloutWidth = 380;
  const calloutHeight = 220; // estimated
  const calloutGap = 16;

  // For a spotlight that spans a large fraction of the viewport width
  // (banner-style targets like the escalation banner, KPI strip, or
  // wide loan cards with action buttons on the right edge), placing
  // the callout above/below just moves the obstruction from one
  // meaningful area to another AND placing it to the right of a
  // near-full-width target ends up overlapping the target's own
  // right-side content (e.g. the CTA column on a loan card).
  //
  // Pin to the top-right corner instead so the callout hovers over
  // blank chrome, not over content the reader needs to see next. The
  // 50% threshold catches typical loan-card widths (65-75% of vw) as
  // well as true full-width banners.
  const targetIsWide = rect.width > vw * 0.5;
  if (targetIsWide) {
    return {
      top: "24px",
      left: `${Math.max(24, vw - calloutWidth - 24)}px`,
    };
  }

  // Try right side (spotlight on left, callout on right)
  if (rect.left + rect.width + calloutGap + calloutWidth < vw - 24) {
    return {
      top: `${Math.min(vh - calloutHeight - 24, Math.max(24, rect.top))}px`,
      left: `${rect.left + rect.width + calloutGap}px`,
    };
  }
  // Try left side
  if (rect.left - calloutGap - calloutWidth > 24) {
    return {
      top: `${Math.min(vh - calloutHeight - 24, Math.max(24, rect.top))}px`,
      left: `${rect.left - calloutGap - calloutWidth}px`,
    };
  }
  // Try below the target
  if (rect.top + rect.height + calloutGap + calloutHeight < vh - 24) {
    return {
      top: `${rect.top + rect.height + calloutGap}px`,
      left: `${Math.min(vw - calloutWidth - 24, Math.max(24, rect.left))}px`,
    };
  }
  // Try above the target
  if (rect.top - calloutGap - calloutHeight > 24) {
    return {
      top: `${Math.max(24, rect.top - calloutGap - calloutHeight)}px`,
      left: `${Math.min(vw - calloutWidth - 24, Math.max(24, rect.left))}px`,
    };
  }
  // Nothing fits without overlap — pin the callout to the top-right
  // corner (or top-left if the spotlight itself is on the right). This
  // way the callout still displays but the spotlight remains visible.
  const pinRight = rect.left + rect.width / 2 < vw / 2;
  return pinRight
    ? { top: "24px", left: `${Math.max(24, vw - calloutWidth - 24)}px` }
    : { top: "24px", left: "24px" };
}

export function TourOverlay() {
  const { status, step, currentIndex, totalSteps } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);

  // Update on step change, resize, and scroll. Uses a MutationObserver so
  // late-mounting targets (e.g. loan cards rendered after an API fetch,
  // wizard content rendered after a route change) are picked up as soon
  // as they appear rather than waiting for a fixed retry that might miss.
  useLayoutEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const measure = () => setRect(targetRect(step.target));

    // Initial + a couple of prompt retries for the common case where the
    // element mounts within a beat of the step change.
    measure();
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 250);

    // Observe DOM changes for late-mounting targets. Bounded by a 4s
    // timeout so we don't keep listening forever on a step whose target
    // never appears (see targetOptional handling in tour-context.tsx).
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      observer = new MutationObserver(() => {
        const r = targetRect(step.target);
        if (r) {
          setRect(r);
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "data-tour"],
      });
    }
    const disconnect = window.setTimeout(() => {
      observer?.disconnect();
      observer = null;
    }, 4000);

    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(disconnect);
      observer?.disconnect();
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [step?.id, step?.target]);

  // Scroll handling when a new step arrives.
  //
  // Two things must happen in order:
  //   1. Reset the window scroll to the top of the page IMMEDIATELY. The user
  //      may have been scrolled somewhere arbitrary before pressing Play, and
  //      the previous tour step may also have left the page scrolled deep.
  //      We always want a clean baseline so the next step starts from the
  //      top of the new tab.
  //   2. After a beat (to let the new tab mount / fade in), find the target
  //      and scroll it so its TOP sits at TOP_OFFSET_PX below the viewport
  //      top. This guarantees the user sees the start of the target (the
  //      loan table title, the borrower-detail header, the NFRS headline)
  //      rather than its middle. We retry a few times because tab content
  //      sometimes fades in async.
  useEffect(() => {
    if (!step) return;

    // 1. Instant reset to page top.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    // 2. Scroll target into view, top-aligned, with breathing room.
    const TOP_OFFSET_PX = 88;
    const RETRY_DELAYS_MS = [150, 350, 700];
    const timers: number[] = [];

    let landed = false;
    const ensureTargetVisible = () => {
      if (landed) return;
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return; // not laid out yet
      const targetY = Math.max(0, window.scrollY + rect.top - TOP_OFFSET_PX);
      window.scrollTo({ top: targetY, left: 0, behavior: "smooth" });
      landed = true;
    };

    for (const delay of RETRY_DELAYS_MS) {
      timers.push(window.setTimeout(ensureTargetVisible, delay));
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step?.id]);

  if (status === "idle" || !step) return null;

  const isEnded = status === "ended";
  const pos = calloutPosition(rect);

  // SVG mask: full-screen black with a transparent rect over the target
  const vw = typeof window !== "undefined" ? window.innerWidth : 1500;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-live="polite"
      aria-atomic="true"
    >
      {/*
        Only render the dim + spotlight SVG when we HAVE a rect. When the
        target is missing, showing a fully-dimmed screen with only a
        centred callout hides the underlying UI — the user has no idea
        what's happening. Better to skip the overlay entirely and let
        the callout hover over the still-visible page.
      */}
      {rect && (
        <svg
          className="absolute inset-0 h-full w-full"
          width={vw}
          height={vh}
          aria-hidden
        >
          <defs>
            <mask id="tour-spotlight-mask">
              <rect x="0" y="0" width={vw} height={vh} fill="white" />
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="14"
                ry="14"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width={vw}
            height={vh}
            fill="rgba(2, 6, 23, 0.78)"
            mask="url(#tour-spotlight-mask)"
          />
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx="14"
            ry="14"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="2"
            style={{ filter: "drop-shadow(0 0 12px rgba(125, 211, 252, 0.6))" }}
          />
        </svg>
      )}

      {/* Callout — pointer events enabled */}
      <aside
        className="pointer-events-auto absolute w-[380px] rounded-2xl border border-line bg-panel/95 p-5 shadow-2xl backdrop-blur"
        style={pos}
        role="dialog"
        aria-label={step.calloutTitle}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
          <span>Step {currentIndex + 1} of {totalSteps}</span>
          {isEnded && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
              Tour complete
            </span>
          )}
        </div>
        <h3 className="mt-2 text-lg font-semibold text-white">
          {step.calloutTitle}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          {step.calloutText}
        </p>
      </aside>
    </div>
  );
}
