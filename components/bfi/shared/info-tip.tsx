"use client";

/**
 * Small explainer tooltip anchored to an inline ⓘ icon.
 *
 * Usage:
 *   <InfoTip id="pcaf-score-3" />
 *   <InfoTip id="ev-demo-only" label="(demo only)" />
 *
 * Hover shows the popover; click pins it; click outside or press Escape to
 * close. The content lives in lib/tooltips/tooltips.ts — adding a new tip is
 * a one-line edit there plus dropping <InfoTip id="..."/> at the use site.
 *
 * Rendering note: the popover is rendered into a React portal at
 * document.body with `position: fixed`, then clamped to the viewport. This
 * lets the popover escape any ancestor with `overflow:auto/hidden` (notably
 * the loan-detail slide-over drawer) and guarantees it never gets cut off
 * by viewport edges.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getTooltip } from "@/lib/tooltips/tooltips";

type Side = "right" | "left" | "above" | "below";

// Layout constants used to position the popover.
const TIP_WIDTH = 288; // matches Tailwind w-72
const ESTIMATED_TIP_HEIGHT = 140; // best-effort; clamped to viewport below
const GAP = 8;
const VIEWPORT_GUTTER = 8;

function clampToViewport(
  top: number,
  left: number,
  height: number,
): { top: number; left: number } {
  if (typeof window === "undefined") return { top, left };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (left + TIP_WIDTH > vw - VIEWPORT_GUTTER) {
    left = vw - VIEWPORT_GUTTER - TIP_WIDTH;
  }
  if (left < VIEWPORT_GUTTER) {
    left = VIEWPORT_GUTTER;
  }
  if (top + height > vh - VIEWPORT_GUTTER) {
    top = vh - VIEWPORT_GUTTER - height;
  }
  if (top < VIEWPORT_GUTTER) {
    top = VIEWPORT_GUTTER;
  }
  return { top, left };
}

function computeCoords(
  anchor: DOMRect,
  side: Side,
  tipHeight: number,
): { top: number; left: number } {
  let top = 0;
  let left = 0;
  switch (side) {
    case "right":
      top = anchor.top + anchor.height / 2 - tipHeight / 2;
      left = anchor.right + GAP;
      break;
    case "left":
      top = anchor.top + anchor.height / 2 - tipHeight / 2;
      left = anchor.left - GAP - TIP_WIDTH;
      break;
    case "above":
      top = anchor.top - GAP - tipHeight;
      left = anchor.left + anchor.width / 2 - TIP_WIDTH / 2;
      break;
    case "below":
      top = anchor.bottom + GAP;
      left = anchor.left + anchor.width / 2 - TIP_WIDTH / 2;
      break;
  }
  return clampToViewport(top, left, tipHeight);
}

export function InfoTip({
  id,
  label,
  side = "right",
  className = "",
}: {
  id: string;
  /** Optional inline text rendered next to the icon (e.g. "(demo only)"). */
  label?: string;
  side?: Side;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const content = getTooltip(id);

  // Position the popover on open + on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }
    const recompute = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const anchor = btn.getBoundingClientRect();
      // First pass with the estimated height
      const initial = computeCoords(anchor, side, ESTIMATED_TIP_HEIGHT);
      setCoords(initial);
      // After the popover renders, measure its real height and re-clamp.
      requestAnimationFrame(() => {
        if (!popoverRef.current || !buttonRef.current) return;
        const realHeight = popoverRef.current.getBoundingClientRect().height;
        const refined = computeCoords(
          buttonRef.current.getBoundingClientRect(),
          side,
          realHeight,
        );
        setCoords(refined);
      });
    };
    recompute();
    window.addEventListener("resize", recompute);
    // capture-phase so scrolls inside any ancestor (e.g. drawer) also trigger
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, side]);

  // Click-outside / Escape close (operates on the wrapper that holds the icon
  // and on the portal popover via its own ref).
  useEffect(() => {
    if (!pinned) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      const inWrapper = wrapperRef.current?.contains(t);
      const inPopover = popoverRef.current?.contains(t);
      if (!inWrapper && !inPopover) {
        setPinned(false);
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  if (!content) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`InfoTip: no tooltip content registered for id="${id}"`);
    }
    return null;
  }

  const popover =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={popoverRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${TIP_WIDTH}px`,
            }}
            className="z-[100] rounded-lg border border-line bg-panel/98 p-3 text-left text-xs text-slate-200 shadow-2xl backdrop-blur"
          >
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-accent">
              {content.title}
            </span>
            <span className="mt-1 block whitespace-pre-line leading-relaxed text-slate-200">
              {content.body}
            </span>
            {content.source && (
              <span className="mt-2 block border-t border-line/60 pt-2 text-[10px] text-slate-500">
                {content.source}
              </span>
            )}
          </span>,
          document.body,
        )
      : null;

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center gap-1 align-baseline ${className}`}
      onMouseEnter={() => !pinned && setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
          setOpen((o) => !o || !pinned);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-500/40 bg-slate-700/30 text-[9px] font-bold leading-none text-slate-300 hover:border-accent hover:bg-accent/10 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        aria-label={`Explain: ${content.title}`}
        aria-expanded={open}
      >
        i
      </button>
      {label && <span className="text-xs text-slate-500">{label}</span>}
      {popover}
    </span>
  );
}

/**
 * Map a numeric PCAF score (1-5) to the registered tooltip id.
 * Use:  <PcafScoreInfoTip score={3} />
 *       <PcafScoreInfoTip score={5} methodology="out-of-scope" />
 *
 * When methodology="out-of-scope" (retail loans) we surface the
 * out-of-scope tooltip instead of the score-5 worst-tier explanation.
 */
export function PcafScoreInfoTip({
  score,
  methodology,
  side = "right",
}: {
  score: 1 | 2 | 3 | 4 | 5;
  methodology?: string;
  side?: Side;
}) {
  if (methodology === "out-of-scope") {
    return <InfoTip id="pcaf-out-of-scope" side={side} />;
  }
  const id =
    score === 1
      ? "pcaf-score-1"
      : score === 2
        ? "pcaf-score-2"
        : score === 3
          ? "pcaf-score-3"
          : score === 4
            ? "pcaf-score-4"
            : "pcaf-score-5";
  return <InfoTip id={id} side={side} />;
}
