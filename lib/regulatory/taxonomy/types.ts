/**
 * Shared types for the NRB Green Finance Taxonomy modules.
 *
 * Extracted into their own file so activities.ts, dnsh.ts, and
 * applicability.ts can all reference these types without circular
 * imports. Nothing in here is regulatory content — it is the shape
 * language the rest of the taxonomy modules speak.
 */

export type TaxonomyColor = "green" | "amber" | "red" | "unclassified";

export type TaxonomyCriterion =
  | {
      id: string;
      type: "yes_no";
      prompt: string;
      helpText?: string;
    }
  | {
      id: string;
      type: "numeric";
      prompt: string;
      unit: string;
      helpText?: string;
    };

export type TaxonomyClassification = {
  color: TaxonomyColor;
  rationale: string;
  citation: string;
  /** Optional DNSH failure detail if the activity would otherwise be green/amber. */
  dnshFailures?: string[];
};

/**
 * The four NRB core environmental objectives (Chapter 2.3, pp. 20-22).
 * Each activity in Annex 2 tags itself with one or more of these letters
 * in parentheses, e.g. "(A, M, N)". Used as the top-level grouping for
 * DNSH conditions (Table 1, p. 22).
 */
export type NrbObjective = "A" | "M" | "N" | "P";

export type TaxonomyActivity = {
  id: string;
  name: string;
  sectorLabel: string;
  nrbCitation: string;
  /** Substrings matched against borrower.nrbSector. */
  applicableTo: string[];
  /** DNSH check ids from the central library (dnsh.ts) that apply here. */
  dnshCheckIds: string[];
  /** All criteria the wizard should ask — activity-specific plus DNSH. */
  criteria: TaxonomyCriterion[];
  /** Pure function that turns criterion answers into a classification. */
  classify: (answers: Record<string, unknown>) => TaxonomyClassification;
};
