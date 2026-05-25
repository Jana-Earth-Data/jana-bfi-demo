"use client";

/**
 * Tour state machine.
 *
 * Holds: current step index, play/pause state, audio element ref.
 * Exposes: start, stop, play, pause, next, prev, skipTo(idx), getCurrentStep.
 *
 * Auto-advances when the active audio element fires its `ended` event.
 * Pauses automatically if the user clicks outside the spotlight (handled
 * by tour-overlay.tsx via a backdrop click), but the user can resume.
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
import tourScript from "@/data/tour-script.json";
import type { TourScript, TourStep } from "./types";

const script = tourScript as TourScript;

type TourStatus = "idle" | "playing" | "paused" | "ended";

type TourContextValue = {
  status: TourStatus;
  currentIndex: number;
  totalSteps: number;
  step: TourStep | null;
  /** Hint for the dashboard so it can switch tabs without listening here. */
  desiredTab: TourStep["tab"] | null;
  start: () => void;
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

export function TourProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<TourStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalSteps = script.steps.length;
  const step = status === "idle" ? null : script.steps[currentIndex] ?? null;
  const desiredTab = step?.tab ?? null;

  // Stop/cleanup audio on every step change
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
  }, []);

  const playStep = useCallback(
    (index: number) => {
      cleanupAudio();
      const s = script.steps[index];
      if (!s) return;
      const audio = new Audio(s.audioFile);
      audio.preload = "auto";
      audioRef.current = audio;
      audio.addEventListener("ended", () => {
        // Auto-advance unless we're at the last step
        if (index < script.steps.length - 1) {
          setCurrentIndex(index + 1);
        } else {
          setStatus("ended");
        }
      });
      audio.addEventListener("error", () => {
        // Audio missing — surface as ended so the tour still progresses
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
    [cleanupAudio]
  );

  // Drive the audio element from state. Two distinct cases:
  //   (a) status is "playing" AND we either have no audio loaded OR the
  //       loaded audio is for a different step → load fresh
  //   (b) status is "playing" AND the loaded audio matches the current step
  //       → resume it
  //   (c) status is "paused" → pause whatever is loaded, but DO NOT cleanup
  //       (otherwise the next play / prev / next has nothing to resume)
  useEffect(() => {
    if (status === "playing") {
      const expectedSrc = script.steps[currentIndex]?.audioFile;
      if (!expectedSrc) return;
      const currentSrc = audioRef.current?.src ?? "";
      if (audioRef.current && currentSrc.endsWith(expectedSrc)) {
        // Same step audio already loaded — just resume.
        void audioRef.current.play().catch((err) => {
          console.warn(`Audio resume failed: ${(err as Error).message}`);
        });
      } else {
        // Different step (or nothing loaded) — fresh load.
        playStep(currentIndex);
      }
    } else if (status === "paused") {
      audioRef.current?.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, status]);

  // Cleanup the audio element only on unmount, not on every state change.
  useEffect(() => {
    return cleanupAudio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    setCurrentIndex(0);
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    setStatus("idle");
    setCurrentIndex(0);
  }, [cleanupAudio]);

  const play = useCallback(() => {
    if (status === "ended" || status === "idle") {
      setCurrentIndex(0);
    }
    // The effect on [currentIndex, status] handles resume vs reload.
    setStatus("playing");
  }, [status]);

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
      setStatus("playing"); // navigation implies resume on the new step
    } else {
      setStatus("ended");
    }
  }, [currentIndex, totalSteps]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setStatus("playing"); // navigation implies resume on the new step
    }
  }, [currentIndex]);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, index));
    setCurrentIndex(clamped);
    setStatus("playing");
  }, [totalSteps]);

  const restart = useCallback(() => {
    setCurrentIndex(0);
    setStatus("playing");
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      status,
      currentIndex,
      totalSteps,
      step,
      desiredTab,
      start,
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
      currentIndex,
      totalSteps,
      step,
      desiredTab,
      start,
      stop,
      play,
      pause,
      togglePlayPause,
      next,
      prev,
      goTo,
      restart,
    ]
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
