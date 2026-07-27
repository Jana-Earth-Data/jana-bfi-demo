/** Types for the auto-pilot guided tour. */

export type TourTabId = "mywork" | "esrm" | "taxonomy" | "loans" | "nsrs";

export type TourName = "dashboard" | "loan-officer" | "manager";

export type TourStep = {
  id: string;
  /** Dashboard tab id. Ignored when navigateTo is set (wizard routes). */
  tab: TourTabId;
  /** CSS selector for the element to spotlight. */
  target: string;
  calloutTitle: string;
  calloutText: string;
  /** Full narration text (also embedded in the MP3). */
  narration: string;
  /** Public-relative URL to the pre-generated MP3. */
  audioFile: string;
  /**
   * Optional. When set, the ESRM tab will select the first application
   * whose borrower name contains this substring (case-insensitive) as the
   * tour enters this step. Used to keep the narration aligned with the
   * on-screen borrower regardless of any clicking the user did beforehand.
   */
  selectBorrowerNameContains?: string;
  /**
   * Optional. When set, the tour router.push()es to this pathname before
   * measuring the target. Used to spotlight elements on wizard routes
   * (e.g. /esdd/L-0079959) that live outside the dashboard.
   */
  navigateTo?: string;
  /**
   * Optional. When true and the target selector cannot be resolved after
   * a short bounded wait, the tour advances to the next step rather than
   * showing a floating centred callout on a fully-dimmed screen. Use for
   * elements that only render conditionally (e.g. escalation banner that
   * only exists when a loan has been escalated).
   */
  targetOptional?: boolean;
};

export type TourScript = {
  version: string;
  totalDurationSecondsApprox: number;
  voice: string;
  model: string;
  narrator: string;
  steps: TourStep[];
};
