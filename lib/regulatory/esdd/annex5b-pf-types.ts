/**
 * NRB ESRM Guideline 2022 — Annex 5b Project Finance Screening Questionnaire.
 * Type definitions.
 *
 * Annex 5b is a Yes/No screening questionnaire built from the 8 IFC
 * Performance Standards. It applies only when a loan is categorised as
 * Project Finance under Circular 22 §5 (see `annex5-questions.ts` for the
 * `EsddLoanCategory` shape).
 *
 * Source of truth: `uploads/Final-ESRM-without-cover-1.pdf`, pp. 43-49.
 * Every catalog item cites `NRB ESRM 2022 Annex 5b · PSx §y.z` where PSx is
 * the IFC Performance Standard grouping and §y.z is Jana's own paragraph
 * ordering within that PS (the NRB PDF does not number the individual
 * items, so we assign stable ids and paragraph numbers here).
 */

export type PfAnswer = "yes" | "no" | "n/a";

/**
 * IFC Performance Standard identifiers, used both as `ifcPS` on catalog
 * items and as the key for the `ANNEX5B_BY_PS` grouping.
 */
export type IfcPS =
  | "PS1" // Assessment and Management of E&S Risks and Impacts
  | "PS2" // Labor and Working Conditions
  | "PS3" // Resource Efficiency and Pollution Prevention
  | "PS4" // Community Health, Safety and Security
  | "PS5" // Land Acquisition and Involuntary Resettlement
  | "PS6" // Biodiversity Conservation and Sustainable Natural Resource Management
  | "PS7" // Indigenous Peoples
  | "PS8"; // Cultural Heritage

export const IFC_PS_TITLE: Record<IfcPS, string> = {
  PS1: "Assessment and Management of Environmental and Social Risks and Impacts",
  PS2: "Labor and Working Conditions",
  PS3: "Resource Efficiency and Pollution Prevention",
  PS4: "Community Health, Safety and Security",
  PS5: "Land Acquisition and Involuntary Resettlement",
  PS6: "Biodiversity Conservation and Sustainable Natural Resource Management",
  PS7: "Indigenous Peoples",
  PS8: "Cultural Heritage",
};

/**
 * Single catalog item, one Yes/No question from Annex 5b.
 *
 * - `id`             : stable identifier used on captured rows (e.g. `annex5b.PS1.3`)
 * - `ifcPS`          : the IFC Performance Standard the item belongs to
 * - `area`           : verbatim sub-area heading from Annex 5b (e.g. "Policy", "Retrenchment")
 * - `prompt`         : verbatim question text
 * - `options`        : always `['yes', 'no', 'n/a']`; kept in the shape so the
 *                       wizard can render pills without hardcoding the values
 * - `guidanceNote`   : verbatim explanation or NRB context (kept as an array
 *                       so we can add per-item notes without breaking JSON)
 * - `flagOnAnswer`   : which answer triggers a review flag. Most items flag
 *                       on `no` (missing policy / plan / procedure); a few
 *                       flag on `yes` (e.g. "uses WHO Class Ia pesticides",
 *                       "forced evictions carried out")
 * - `citation`       : cite string for audit trail (`NRB ESRM 2022 Annex 5b · PSx §y.z`)
 * - `ifcPsTerminationTrigger` : when true, a flag on this item pushes the
 *                       overall screening to CRITICAL because the item maps
 *                       onto termination-grade language in the underlying
 *                       IFC Performance Standards text NRB Annex 5b is built
 *                       on (child/forced labor, forced eviction, critical
 *                       habitat, protected area without permit, IP relocation
 *                       without FPIC, WHO Ia/Ib pesticides, critical cultural
 *                       heritage, security-abuse allegations, etc.). NRB
 *                       Annex 5b itself does NOT publish an escalation grid
 *                       — this is Jana synthesis of the IFC PS red lines,
 *                       supported by the per-item `terminationCitation`.
 * - `terminationCitation` : (optional; set alongside `ifcPsTerminationTrigger`)
 *                       the specific IFC PS § that supports the item's
 *                       inclusion as a termination trigger.
 */
export type Annex5bItem = {
  id: string;
  ifcPS: IfcPS;
  area: string;
  prompt: string;
  options: readonly PfAnswer[];
  guidanceNote: string[];
  flagOnAnswer: "no" | "yes";
  citation: string;
  ifcPsTerminationTrigger?: boolean;
  terminationCitation?: string;
};

/**
 * Officer responses, keyed by item id. `null` means unanswered.
 */
export type PfScreeningResponse = Record<string, PfAnswer | null>;

/**
 * Overall risk classification. LOW / MEDIUM / HIGH are graduated by flag
 * count; CRITICAL is triggered by any item marked
 * `ifcPsTerminationTrigger = true`.
 */
export type PfRiskClass = "low" | "medium" | "high" | "critical";

/**
 * Per-PS scoring breakdown.
 */
export type PfPsBreakdown = {
  ifcPS: IfcPS;
  title: string;
  answered: number;
  applicable: number; // excludes 'n/a'
  flagged: number;
  criticalFlagged: number;
  total: number;
};

/**
 * Summary of a completed PF screening. This is the shape the review step
 * renders and the shape stored in `bfi_pf_screening_results.summary` at
 * screening save time.
 */
export type PfScreeningResult = {
  totalItems: number;
  itemsAnswered: number;
  itemsApplicable: number;
  itemsFlagged: number;
  criticalFlaggedItems: string[]; // ids of critical-flagged items
  psBreakdown: PfPsBreakdown[];
  riskClass: PfRiskClass;
  rationale: string;
};
