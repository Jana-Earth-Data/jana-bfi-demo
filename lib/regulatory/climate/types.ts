/**
 * Climate risk metadata types — anchored to the 2022 NRB ESRM Guideline §4
 * (Climate-related risks and Financial Institutions, pp. 24-26) and the
 * NGFS taxonomy referenced by that section.
 *
 * The 2022 NRB ESRM Guideline introduced two first-class climate concepts:
 *
 *   1. NGFS-aligned physical + transition risk categorisation for every
 *      borrower whose sector or location exposes it to climate risk.
 *   2. A 25,000 tCO2e / year GHG reporting threshold. Borrowers above the
 *      threshold are expected to measure, disclose, and set reduction
 *      targets; banks are expected to flag any above-threshold borrower
 *      without a reduction target on file.
 *
 * Both are already surfaced as ESDD Q2.5 (see
 * `lib/regulatory/esdd/annex5-questions.ts`). This module makes them
 * first-class fields on the borrower record so they can be aggregated
 * across the portfolio, exported in the NRB annual report, and shown as
 * decision-support metadata on the ESRM screening workbench.
 *
 * Verbatim source pointers:
 *   - Physical + transition categories: NRB ESRM 2022 §4.1, citing NGFS
 *     "Overview of Environmental Risk Analysis by Financial Institutions".
 *   - 25k tCO2e / yr threshold: NRB ESRM 2022 §4.3, ESDD Q2.5 guidance
 *     note.
 */

// ---------------------------------------------------------------------------
// NGFS physical risk categories (NRB ESRM 2022 §4.1, verbatim)
// ---------------------------------------------------------------------------
// Split into acute (event-driven) and chronic (slow-onset) per the NGFS
// convention. The 2022 Guideline text names extreme weather events (floods,
// storms, wildfires, heatwaves, droughts) alongside sea-level rise, water
// scarcity, deforestation and desertification.

/** Acute physical risks — event-driven, NGFS verbatim per NRB ESRM 2022 §4.1. */
export type NgfsAcutePhysicalRisk =
  | "Floods"
  | "Storms"
  | "Wildfires"
  | "Heat waves"
  | "Droughts";

/** Chronic physical risks — slow-onset, NGFS verbatim per NRB ESRM 2022 §4.1. */
export type NgfsChronicPhysicalRisk =
  | "Sea-level rise"
  | "Water scarcity"
  | "Temperature change"
  | "Deforestation"
  | "Desertification";

/** Union of NGFS physical risk categories used on the borrower record. */
export type NgfsPhysicalRiskCategory =
  | NgfsAcutePhysicalRisk
  | NgfsChronicPhysicalRisk;

/** Ordered list of acute categories — used by the UI to render badges. */
export const NGFS_ACUTE_PHYSICAL: NgfsAcutePhysicalRisk[] = [
  "Floods",
  "Storms",
  "Wildfires",
  "Heat waves",
  "Droughts",
];

/** Ordered list of chronic categories — used by the UI to render badges. */
export const NGFS_CHRONIC_PHYSICAL: NgfsChronicPhysicalRisk[] = [
  "Sea-level rise",
  "Water scarcity",
  "Temperature change",
  "Deforestation",
  "Desertification",
];

export const ALL_NGFS_PHYSICAL: NgfsPhysicalRiskCategory[] = [
  ...NGFS_ACUTE_PHYSICAL,
  ...NGFS_CHRONIC_PHYSICAL,
];

// ---------------------------------------------------------------------------
// NGFS transition risk categories (NRB ESRM 2022 §4.1, verbatim)
// ---------------------------------------------------------------------------
// The 2022 Guideline lists four transition transmission channels: public
// policy change, technology changes, shifting sentiment, and disruptive
// business model. We encode those under the four canonical NGFS labels
// used across the industry (policy, technology, market, reputation) so the
// downstream reporting shape stays comparable with peer banks.

export type NgfsTransitionRiskCategory =
  | "Policy risk"
  | "Technology risk"
  | "Market risk"
  | "Reputation risk";

export const ALL_NGFS_TRANSITION: NgfsTransitionRiskCategory[] = [
  "Policy risk",
  "Technology risk",
  "Market risk",
  "Reputation risk",
];

// ---------------------------------------------------------------------------
// Borrower-level climate risk record
// ---------------------------------------------------------------------------

/** Overall qualitative rating rolled up from physical + transition counts. */
export type ClimateRiskRating = "low" | "medium" | "high";

/**
 * Complete climate risk metadata attached to a borrower. Populated by
 * `inferClimateRisk()` from sector + location + emissions signals in the
 * demo; in a live deployment this would be persisted per-borrower in
 * `bfi_climate_risk_assessments` (see `scripts/supabase-climate-risk.sql`)
 * and editable by the ESRM officer.
 *
 * Anchored to NRB ESRM 2022 §4.1 (NGFS taxonomy) and §4.4 (reporting).
 */
export type BorrowerClimateRisk = {
  physicalRisks: NgfsPhysicalRiskCategory[];
  transitionRisks: NgfsTransitionRiskCategory[];
  overallRating: ClimateRiskRating;
  assessedAt: Date;
  /** Officer id or the system that produced the assessment. */
  assessedBy: string;
};

// ---------------------------------------------------------------------------
// 25,000 tCO2e / yr GHG reporting threshold flag (NRB ESRM 2022 §4.3)
// ---------------------------------------------------------------------------

/** Annual GHG reporting threshold in tCO2e — NRB ESRM 2022 §4.3 (Q2.5 note). */
export const NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E = 25_000;

/**
 * The compliance flag NRB expects a bank to compute for every borrower.
 * Above-threshold borrowers with no reduction target on file are the
 * concrete population the ESRM officer / NRB report needs to enumerate.
 */
export type BorrowerEmissionsFlag = {
  /** Best current estimate of the borrower's annual GHG in tCO2e. */
  estimatedAnnualTco2e: number;
  /** Whether that estimate crosses the NRB ESRM 2022 §4.3 threshold. */
  exceedsReportingThreshold: boolean;
  /** True when the borrower has a documented GHG reduction target. */
  reductionTargetOnFile: boolean;
  /** Human-readable description of the target, or null. */
  targetDetails: string | null;
};

/**
 * Convenience bundle returned by the API and consumed by the ESRM tab.
 * Keeping the two payloads together lets the UI render a single panel
 * without threading two calls through.
 */
export type BorrowerClimateBundle = {
  borrowerId: string;
  climateRisk: BorrowerClimateRisk;
  emissionsFlag: BorrowerEmissionsFlag;
};
