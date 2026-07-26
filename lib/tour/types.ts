/** Types for the auto-pilot guided tour. */

export type TourTabId = "mywork" | "esrm" | "taxonomy" | "loans" | "nsrs";

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
  /**
   * Optional. When set, the ESRM tab will select the first application
   * whose borrower name contains this substring (case-insensitive) as the
   * tour enters this step. Used to keep the narration aligned with the
   * on-screen borrower regardless of any clicking the user did beforehand.
   */
  selectBorrowerNameContains?: string;
};

export type TourScript = {
  version: string;
  totalDurationSecondsApprox: number;
  voice: string;
  model: string;
  narrator: string;
  steps: TourStep[];
};
