"use client";

/**
 * Fixed bottom-of-screen control bar for the guided tour.
 * Play/pause, prev/next, restart, exit, plus a clickable progress strip.
 */

import { useTour } from "@/lib/tour/tour-context";

export function TourControls() {
  const {
    status,
    currentIndex,
    totalSteps,
    togglePlayPause,
    prev,
    next,
    restart,
    stop,
    goTo,
  } = useTour();

  if (status === "idle") return null;

  const isPlaying = status === "playing";
  const isEnded = status === "ended";

  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-[70] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-line bg-panel/95 px-3 py-2 shadow-2xl backdrop-blur">
        <button
          onClick={prev}
          disabled={currentIndex === 0}
          className="rounded-full p-2 text-slate-200 hover:bg-line/40 disabled:opacity-40"
          aria-label="Previous step"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M6 6h2v12H6zm3.5 6L18 6v12z" />
          </svg>
        </button>

        <button
          onClick={togglePlayPause}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-slate-900 shadow hover:bg-sky-300"
          aria-label={isPlaying ? "Pause tour" : "Play tour"}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={next}
          disabled={isEnded}
          className="rounded-full p-2 text-slate-200 hover:bg-line/40 disabled:opacity-40"
          aria-label="Next step"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z" />
          </svg>
        </button>

        {/* Progress / chapter strip */}
        <div className="ml-2 flex items-center gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const active = i === currentIndex;
            const done = i < currentIndex || isEnded;
            return (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Jump to step ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  active
                    ? "w-8 bg-accent"
                    : done
                      ? "w-2 bg-emerald-400"
                      : "w-2 bg-line"
                }`}
              />
            );
          })}
        </div>

        <span className="ml-2 text-xs text-slate-400">
          {currentIndex + 1} / {totalSteps}
        </span>

        <button
          onClick={restart}
          className="ml-2 rounded-full p-2 text-slate-200 hover:bg-line/40"
          aria-label="Restart tour"
          title="Restart"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 5V2L7 7l5 5V8c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z" />
          </svg>
        </button>

        <button
          onClick={stop}
          className="rounded-full px-3 py-1 text-xs text-slate-300 hover:bg-line/40"
          aria-label="Exit tour"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
