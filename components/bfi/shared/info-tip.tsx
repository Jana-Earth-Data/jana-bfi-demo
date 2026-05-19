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
 */

import { useEffect, useRef, useState } from "react";
import { getTooltip } from "@/lib/tooltips/tooltips";

type Side = "right" | "left" | "above" | "below";

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
  const ref = useRef<HTMLSpanElement>(null);
  const content = getTooltip(id);

  // Click-outside / Escape close
  useEffect(() => {
    if (!pinned) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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

  const sidePos: Record<Side, string> = {
    right: "top-1/2 left-full ml-2 -translate-y-1/2",
    left: "top-1/2 right-full mr-2 -translate-y-1/2",
    above: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    below: "top-full left-1/2 mt-2 -translate-x-1/2",
  };

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center gap-1 align-baseline ${className}`}
      onMouseEnter={() => !pinned && setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
    >
      <button
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
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-72 rounded-lg border border-line bg-panel/98 p-3 text-left text-xs text-slate-200 shadow-2xl backdrop-blur ${sidePos[side]}`}
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
        </span>
      )}
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
  // Score 1 is rare in practice — falls through to score-2 content.
  const id =
    score === 1
      ? "pcaf-score-2"
      : score === 2
        ? "pcaf-score-2"
        : score === 3
          ? "pcaf-score-3"
          : score === 4
            ? "pcaf-score-4"
            : "pcaf-score-5";
  return <InfoTip id={id} side={side} />;
}
