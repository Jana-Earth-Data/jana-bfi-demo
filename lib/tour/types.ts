/** Types for the auto-pilot guided tour. */

export type TourTabId = "esrm" | "taxonomy" | "loans" | "nsrs";

export type TourStep = {
  id: string;
  tab: TourTabId;
  /** CSS selector for the element to spotlight. */
  target: string;
  calloutTitle: string;
  calloutText: string;
  /** Full narration text (also embedded in the MP3). */
  narration: string;
  /** Public-relative URL to the pre-generated MP3 (e.g. /audio/tour-01-intro.mp3). */
  audioFile: string;
};

export type TourScript = {
  version: string;
  totalDurationSecondsApprox: number;
  voice: string;
  model: string;
  narrator: string;
  steps: TourStep[];
};
