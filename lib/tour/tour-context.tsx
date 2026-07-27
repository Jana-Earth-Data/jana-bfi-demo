"use client";

/**
 * Tour state machine (v2 — multi-tour, route-aware, MutationObserver-driven).
 *
 * Holds: current tour name, current step index, play/pause state, audio
 * element ref. Exposes: startTour(name), stop, play, pause, next, prev,
 * goTo(idx). Auto-advances when the active audio element fires `ended`.
 *
 * v2 changes from the first implementation:
 *   - The active tour is selected at runtime via startTour(name). The
 *     script is looked up from lib/tour/registry.ts against the current
 *     tenant id (passed in via prop, resolved server-side in layout).
 *   - Steps may declare navigateTo — the tour will router.push()
 *     to that path before spotlighting (used to enter wizard routes).
 *   - Steps may declare targetOptional — if the target element does not
 *     appear within a bounded wait, the tour auto-advances instead of
 *     showing a centred callout on a fully-dimmed screen.
 *   - The provider lives at layout level so state survives navigation
 *     into wizard routes (see components/bfi/tour/tour-shell.tsx).
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getTourScript } from "./registry";
import type { TourName, TourScript, TourStep } from "./types";
import type { TenantId } from "@/lib/tenants";

type TourStatus = "idle" | "playing" | "paused" | "ended";

type TourContextValue = {
  status: TourStatus;
  currentTour: TourName | null;
  currentIndex: number;
  totalSteps: number;
  step: TourStep | null;
  /** Hint for the dashboard so it can switch tabs without listening here. */
  desiredTab: TourStep["tab"] | null;
  startTour: (name: TourName) => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  restart: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({
  tenantId,
  children,
}: {
  tenantId: TenantId | string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const routerSearchParams = useSearchParams();
  // Full path + query for navigateTo comparison. Distinguishes
  // /esdd/L-0079959?tourStep=0 from /esdd/L-0079959?tourStep=1 so
  // tour steps that share a route but change a query param actually
  // navigate rather than being treated as "already there".
  const fullPath =
    (pathname ?? "") +
    (routerSearchParams && routerSearchParams.toString()
      ? `?${routerSearchParams.toString()}`
      : "");
  const [status, setStatus] = useState<TourStatus>("idle");
  const [currentTour, setCurrentTour] = useState<TourName | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const script: TourScript | null = useMemo(() => {
    if (!tenantId || !currentTour) return null;
    return getTourScript(tenantId, currentTour);
  }, [tenantId, currentTour]);

  const totalSteps = script?.steps.length ?? 0;
  const step = status === "idle" || !script
    ? null
    : script.steps[currentIndex] ?? null;
  const desiredTab = step?.tab ?? null;

  // ------------------------------------------------------------------
  // Audio playback
  // ------------------------------------------------------------------
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
  }, []);

  const playAudioForStep = useCallback(
    (index: number) => {
      if (!script) return;
      cleanupAudio();
      const s = script.steps[index];
      if (!s) return;
      const audio = new Audio(s.audioFile);
      audio.preload = "auto";
      audioRef.current = audio;
      audio.addEventListener("ended", () => {
        if (index < script.steps.length - 1) {
          setCurrentIndex(index + 1);
        } else {
          setStatus("ended");
        }
      });
      audio.addEventListener("error", () => {
        console.warn(`Tour audio missing or failed: ${s.audioFile}`);
        if (index < script.steps.length - 1) {
          setCurrentIndex(index + 1);
        } else {
          setStatus("ended");
        }
      });
      void audio.play().catch((err) => {
        console.warn(`Audio play() blocked or failed: ${err.message}`);
      });
    },
    [script, cleanupAudio],
  );

  useEffect(() => {
    if (!script) return;
    if (status === "playing") {
      const expectedSrc = script.steps[currentIndex]?.audioFile;
      if (!expectedSrc) return;
      const currentSrc = audioRef.current?.src ?? "";
      if (audioRef.current && currentSrc.endsWith(expectedSrc)) {
        void audioRef.current.play().catch((err) => {
          console.warn(`Audio resume failed: ${(err as Error).message}`);
        });
      } else {
        playAudioForStep(currentIndex);
      }
    } else if (status === "paused") {
      audioRef.current?.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, status, script]);

  useEffect(() => {
    return cleanupAudio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Route navigation for wizard steps
  // ------------------------------------------------------------------
  //
  // When a step declares navigateTo, we router.push there. The tour
  // provider is mounted at layout level so state survives the route
  // change. When the step ends and the next step has no navigateTo
  // (or a different one), we handle transitions naturally as each
  // step's effect runs.
  useEffect(() => {
    if (!step) return;
    if (!step.navigateTo) {
      // If we're on a wizard route but the next step wants us back on
      // the dashboard, bounce home.
      if (pathname && pathname !== "/") {
        router.push("/");
      }
      return;
    }
    // Compare full path+query so tours that switch between
    // /esdd/L-0079959?tourStep=0 and ?tourStep=1 actually navigate.
    if (fullPath !== step.navigateTo) {
      router.push(step.navigateTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, step?.navigateTo]);

  // ------------------------------------------------------------------
  // Optional-target auto-advance
  // ------------------------------------------------------------------
  //
  // For steps flagged targetOptional, wait up to 2s for the target to
  // appear. If it doesn't, skip to the next step. Prevents the "dark
  // screen with a centred callout" failure mode when a conditional UI
  // element (e.g. escalation banner) isn't present in the current demo
  // state.
  useEffect(() => {
    if (!step?.targetOptional) return;
    let cancelled = false;
    const start = performance.now();
    const check = () => {
      if (cancelled) return;
      if (typeof document === "undefined") return;
      const found = document.querySelector(step.target);
      if (found) return; // target appeared — normal spotlight will pick up
      if (performance.now() - start > 2000) {
        // Advance
        if (currentIndex < totalSteps - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setStatus("ended");
        }
        return;
      }
      window.setTimeout(check, 150);
    };
    window.setTimeout(check, 300);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------
  const startTour = useCallback((name: TourName) => {
    setCurrentTour(name);
    setCurrentIndex(0);
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    setStatus("idle");
    setCurrentIndex(0);
    setCurrentTour(null);
    // If a tour left us on a wizard route, bounce home so the user isn't
    // stranded there.
    if (pathname && pathname !== "/") {
      router.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio, pathname]);

  const play = useCallback(() => {
    if (!script) return;
    if (status === "ended" || status === "idle") {
      setCurrentIndex(0);
    }
    setStatus("playing");
  }, [status, script]);

  const pause = useCallback(() => {
    if (status === "playing") {
      audioRef.current?.pause();
      setStatus("paused");
    }
  }, [status]);

  const togglePlayPause = useCallback(() => {
    if (status === "playing") pause();
    else play();
  }, [status, pause, play]);

  const next = useCallback(() => {
    if (currentIndex < totalSteps - 1) {
      setCurrentIndex(currentIndex + 1);
      setStatus("playing");
    } else {
      setStatus("ended");
    }
  }, [currentIndex, totalSteps]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setStatus("playing");
    }
  }, [currentIndex]);

  const goTo = useCallback(
    (index: number) => {
      if (!totalSteps) return;
      const clamped = Math.max(0, Math.min(totalSteps - 1, index));
      setCurrentIndex(clamped);
      setStatus("playing");
    },
    [totalSteps],
  );

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setStatus("playing");
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      status,
      currentTour,
      currentIndex,
      totalSteps,
      step,
      desiredTab,
      startTour,
      stop,
      play,
      pause,
      togglePlayPause,
      next,
      prev,
      goTo,
      restart,
    }),
    [
      status,
      currentTour,
      currentIndex,
      totalSteps,
      step,
      desiredTab,
      startTour,
      stop,
      play,
      pause,
      togglePlayPause,
      next,
      prev,
      goTo,
      restart,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used inside <TourProvider>");
  }
  return ctx;
}
