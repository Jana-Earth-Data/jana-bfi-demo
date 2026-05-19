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
  if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const calloutWidth = 380;
  const calloutGap = 16;

  // Try right side first
  if (rect.left + rect.width + calloutGap + calloutWidth < vw - 24) {
    return {
      top: `${Math.min(vh - 220, Math.max(24, rect.top))}px`,
      left: `${rect.left + rect.width + calloutGap}px`,
    };
  }
  // Try left side
  if (rect.left - calloutGap - calloutWidth > 24) {
    return {
      top: `${Math.min(vh - 220, Math.max(24, rect.top))}px`,
      left: `${rect.left - calloutGap - calloutWidth}px`,
    };
  }
  // Below
  if (rect.top + rect.height + calloutGap + 200 < vh) {
    return {
      top: `${rect.top + rect.height + calloutGap}px`,
      left: `${Math.min(vw - calloutWidth - 24, Math.max(24, rect.left))}px`,
    };
  }
  // Above
  return {
    top: `${Math.max(24, rect.top - calloutGap - 200)}px`,
    left: `${Math.min(vw - calloutWidth - 24, Math.max(24, rect.left))}px`,
  };
}

export function TourOverlay() {
  const { status, step, currentIndex, totalSteps } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);

  // Update on step change, resize, and scroll. Re-measure after a beat to
  // catch tab-content fade-ins.
  useLayoutEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const measure = () => setRect(targetRect(step.target));
    measure();
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 250);
    const t3 = window.setTimeout(measure, 600);
    const handler = () => measure();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [step?.id, step?.target]);

  // Scroll the target into view when a new step arrives.
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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
      <svg
        className="absolute inset-0 h-full w-full"
        width={vw}
        height={vh}
        aria-hidden
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width={vw} height={vh} fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
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
        {rect && (
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
        )}
      </svg>

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
