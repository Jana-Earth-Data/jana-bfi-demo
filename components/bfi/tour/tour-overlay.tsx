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

type CalloutStyle = {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
};

type Placement = {
  scrollTo: number;
  callout: CalloutStyle;
};

const PAD = 10; // px around the target element
const CALLOUT_WIDTH = 380;
const CALLOUT_HEIGHT = 220; // estimated
const CALLOUT_GAP = 16;
const CALLOUT_MARGIN = 24;
// Height of the "reserved band" for a top/bottom-anchored callout on wide
// targets. Callout is ~220px + 24px margin + a little breathing room.
const CALLOUT_BAND_PX = 260;
// If the target's natural page-Y is below this threshold, we have room to
// scroll it under a top-anchored callout. Otherwise we flip the callout to
// the bottom and leave the page at the top.
const TOP_ROOM_PX = 280;
const NARROW_TOP_OFFSET_PX = 88;

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

/**
 * Choose where to scroll AND where the callout should sit, jointly, so the
 * callout never overlaps the highlighted target and the user does not need
 * to scroll manually.
 */
function computePlacement(el: HTMLElement): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();
  // Absolute page-Y of the target's top edge (unaffected by current scroll).
  const absTop = window.scrollY + rect.top;

  // -------- Wide targets (span > 50% of viewport width) --------
  if (rect.width > vw * 0.5) {
    // Case B — target sits near the top of the page: keep page at top,
    // flip the callout to the bottom-left band so the target is visible
    // in the free top region.
    if (absTop < TOP_ROOM_PX) {
      return {
        scrollTo: 0,
        callout: { bottom: "24px", left: "24px" },
      };
    }
    // Case A / Case C — target has room above it. Scroll so the target's
    // top lands at viewport y = CALLOUT_BAND_PX (below the top-anchored
    // callout). When the target is taller than the free vertical region
    // (vh - CALLOUT_BAND_PX - 40), the user will still see the top of it —
    // which is what we want for oversized panels.
    const scrollTo = Math.max(0, absTop - CALLOUT_BAND_PX);
    return {
      scrollTo,
      callout: { top: "24px", left: "24px" },
    };
  }

  // -------- Narrow targets (side placement) --------
  // Vertically centre the target unless it is very tall — in that case,
  // top-align with an 88-px offset so its header stays visible.
  const isTallTarget = rect.height > vh * 0.6;
  const desiredViewportTop = isTallTarget
    ? NARROW_TOP_OFFSET_PX
    : Math.max(NARROW_TOP_OFFSET_PX, (vh - rect.height) / 2);
  const scrollTo = Math.max(0, absTop - desiredViewportTop);

  // Re-project rect into the post-scroll viewport for callout placement.
  const projectedTop = absTop - scrollTo;
  const projectedLeft = rect.left; // horizontal scroll is not used
  const projectedWidth = rect.width;

  // Callout vertical anchor: aligned to target top but clamped to viewport.
  const calloutTop = Math.min(
    vh - CALLOUT_HEIGHT - CALLOUT_MARGIN,
    Math.max(CALLOUT_MARGIN, projectedTop),
  );

  // Try right side (spotlight on left, callout on right)
  if (
    projectedLeft + projectedWidth + CALLOUT_GAP + CALLOUT_WIDTH <
    vw - CALLOUT_MARGIN
  ) {
    return {
      scrollTo,
      callout: {
        top: `${calloutTop}px`,
        left: `${projectedLeft + projectedWidth + CALLOUT_GAP}px`,
      },
    };
  }
  // Try left side
  if (projectedLeft - CALLOUT_GAP - CALLOUT_WIDTH > CALLOUT_MARGIN) {
    return {
      scrollTo,
      callout: {
        top: `${calloutTop}px`,
        left: `${projectedLeft - CALLOUT_GAP - CALLOUT_WIDTH}px`,
      },
    };
  }
  // Try below the target
  if (
    projectedTop + rect.height + CALLOUT_GAP + CALLOUT_HEIGHT <
    vh - CALLOUT_MARGIN
  ) {
    return {
      scrollTo,
      callout: {
        top: `${projectedTop + rect.height + CALLOUT_GAP}px`,
        left: `${Math.min(
          vw - CALLOUT_WIDTH - CALLOUT_MARGIN,
          Math.max(CALLOUT_MARGIN, projectedLeft),
        )}px`,
      },
    };
  }
  // Try above the target
  if (projectedTop - CALLOUT_GAP - CALLOUT_HEIGHT > CALLOUT_MARGIN) {
    return {
      scrollTo,
      callout: {
        top: `${Math.max(
          CALLOUT_MARGIN,
          projectedTop - CALLOUT_GAP - CALLOUT_HEIGHT,
        )}px`,
        left: `${Math.min(
          vw - CALLOUT_WIDTH - CALLOUT_MARGIN,
          Math.max(CALLOUT_MARGIN, projectedLeft),
        )}px`,
      },
    };
  }
  // Fallback — nothing fits without overlap. Pick the corner that leaves
  // the target's own content most visible.
  const targetOnLeft = projectedLeft + projectedWidth < vw * 0.5;
  return {
    scrollTo,
    callout: targetOnLeft
      ? {
          top: "24px",
          left: `${Math.max(CALLOUT_MARGIN, vw - CALLOUT_WIDTH - CALLOUT_MARGIN)}px`,
        }
      : { top: "24px", left: "24px" },
  };
}

/**
 * Fallback callout placement when we do not have a target element in hand
 * (e.g. targetOptional step whose element never mounted, or the rect is
 * still being measured). Parks in the top-right corner.
 */
function emptyCalloutPosition(): CalloutStyle {
  if (typeof window === "undefined") {
    return { top: "24px", right: "24px" };
  }
  return {
    top: "24px",
    left: `${Math.max(24, window.innerWidth - CALLOUT_WIDTH - 24)}px`,
  };
}

export function TourOverlay() {
  const { status, step, currentIndex, totalSteps } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [calloutStyle, setCalloutStyle] = useState<CalloutStyle>(() =>
    emptyCalloutPosition(),
  );

  // Update on step change, resize, and scroll. Uses a MutationObserver so
  // late-mounting targets (e.g. loan cards rendered after an API fetch,
  // wizard content rendered after a route change) are picked up as soon
  // as they appear rather than waiting for a fixed retry that might miss.
  useLayoutEffect(() => {
    if (!step) {
      setRect(null);
      setCalloutStyle(emptyCalloutPosition());
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

  // Scroll + callout placement when a new step arrives.
  //
  // Two things must happen in order:
  //   1. Reset the window scroll to the top of the page IMMEDIATELY. The user
  //      may have been scrolled somewhere arbitrary before pressing Play, and
  //      the previous tour step may also have left the page scrolled deep.
  //      We always want a clean baseline so the next step starts from the
  //      top of the new tab.
  //   2. After a beat (to let the new tab mount / fade in), find the target
  //      and CO-DECIDE the scroll offset AND callout placement via
  //      computePlacement so the callout never overlaps the target. Retry a
  //      few times because tab content sometimes fades in async.
  useEffect(() => {
    if (!step) return;

    // 1. Instant reset to page top. Also park the callout in the fallback
    //    corner until we have a real target measurement.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setCalloutStyle(emptyCalloutPosition());

    const RETRY_DELAYS_MS = [150, 350, 700];
    const timers: number[] = [];

    let landed = false;
    const placeAndScroll = () => {
      if (landed) return;
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return; // not laid out yet
      const placement = computePlacement(el);
      window.scrollTo({ top: placement.scrollTo, left: 0, behavior: "smooth" });
      setCalloutStyle(placement.callout);
      landed = true;
    };

    for (const delay of RETRY_DELAYS_MS) {
      timers.push(window.setTimeout(placeAndScroll, delay));
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [step?.id]);

  // When the measured rect updates (resize, late mount, or observer hit)
  // recompute the callout position using the CURRENT target element so it
  // stays anchored correctly. We do not re-scroll here — the scroll effect
  // above handles the initial landing; this only keeps the callout in sync
  // with layout shifts.
  useLayoutEffect(() => {
    if (!step) return;
    if (!rect) {
      setCalloutStyle(emptyCalloutPosition());
      return;
    }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) return;
    const placement = computePlacement(el);
    setCalloutStyle(placement.callout);
  }, [rect, step?.id, step?.target]);

  if (status === "idle" || !step) return null;

  const isEnded = status === "ended";
  const pos: CalloutStyle = rect ? calloutStyle : emptyCalloutPosition();

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
