/**
 * Tenant settings — shape of the JSONB blob stored in bfi_tenant_settings.
 *
 * One nested object per dashboard category. Every field has a well-typed
 * default in DEFAULT_SETTINGS (lib/settings/defaults.ts). Reads always go
 * through resolveSettings() (lib/settings/schema.ts) so a partial saved
 * blob is deep-merged over the defaults and callers always receive a
 * fully-hydrated TenantSettings object — no undefined branches.
 *
 * Naming convention: category.setting (nested). Category keys stay short
 * so the settings-page left rail can double as the URL hash target.
 */

// ---------------------------------------------------------------------------
// Union literals — reused by both the type definition and the DEFAULT_SETTINGS
// constant. Keeping them here means the settings-page dropdown can render
// its options straight off the source of truth.
// ---------------------------------------------------------------------------

export type EscalationTrigger =
  | "esrr-medium-high"
  | "any-c"
  | "two-c"
  | "section3-only";

export type AutoAssignment =
  | "unassigned-in-all-queues"
  | "round-robin"
  | "manual-only";

export type NprDisplayFormat = "plain" | "millions" | "crores";

export type FiscalYearMode = "calendar-jan-dec" | "nepal-fiscal-mid-jul";

export type EsrmGateMode = "hard-enforce" | "warn-and-allow";

export type ReportingFrequency = "annual" | "semi-annual" | "quarterly";

export type EmailDigestCadence = "off" | "daily" | "weekly";

// ---------------------------------------------------------------------------
// Per-category settings shapes
// ---------------------------------------------------------------------------

export type EsrmSettings = {
  /**
   * Per-section toggle: when true, the ESDD wizard requires a non-empty
   * remarks textarea on every answered question in that section before
   * the "Continue" button will advance. Wired end-to-end.
   */
  remarksRequired: {
    section1: boolean; // annex5 general risk
    section2: boolean; // annex5 EHS
    section3: boolean; // annex5 social
  };
  /**
   * Rule for when the ESRM screening result should escalate.
   *
   * NRB ESRM Guideline 2022 §7.3.6 "Escalation" (p. 18) is the baseline:
   * "All transactions rated as MEDIUM or HIGH (ESRR) will be escalated to
   * the one-level higher related credit approval authority." Under NRB's
   * ESRR rule (ESRR_criteria sheet of the NRB ESDD Excel tool) any 'b'
   * with no 'c' produces MEDIUM and any 'c' produces HIGH, with Q2.4
   * excluded from the rating. So a 'b' answer escalates too — escalation
   * is NOT keyed to 'c' answers alone.
   *
   * Default is "esrr-medium-high" (the NRB rule). The remaining options
   * are bank-level narrowings a BFI may configure on top of it; they are
   * stricter-than-NRB conveniences, not readings of the Guideline.
   */
  escalationTrigger: EscalationTrigger;
  /**
   * Q2.5 climate risks and opportunities was added by the 2022 ESRM
   * update — some banks are still phasing it in. Toggle whether the
   * wizard should require it before saving a screening.
   */
  q25Required: boolean;
  /**
   * How the officer queue auto-picks up work when a loan needs an owner.
   */
  autoAssignment: AutoAssignment;
};

export type LoanBookSettings = {
  /** How NPR amounts render in the loan book KPIs / detail views. */
  nprDisplayFormat: NprDisplayFormat;
  /**
   * Calendar year (Jan–Dec) or Nepali fiscal year (mid-Jul to mid-Jul).
   * Drives the "year" filter chip on the loan book.
   */
  fiscalYear: FiscalYearMode;
};

export type TaxonomySettings = {
  /**
   * When a loan is Amber / Red on the taxonomy, should the ESRM gate
   * prevent progression (hard-enforce) or allow it with a warning
   * (warn-and-allow)? NRB GFT §3.2.2 defaults to hard-enforce.
   */
  esrmGateMode: EsrmGateMode;
  /**
   * Activity ids the bank has chosen to hide from the classification
   * picker (e.g. sectors they do not lend into). Empty by default —
   * every NRB-listed activity is offered.
   */
  hiddenActivityIds: string[];
  /**
   * When a loan is missing a taxonomy classification, should the queue
   * kick it up to a manager review lane instead of leaving it in the
   * officer's queue?
   */
  missingClassificationEscalatesToManager: boolean;
};

export type NfrsSettings = {
  /**
   * PCAF scoring saved to the audit trail requires both an ESG officer
   * and a compliance sign-off before being considered final.
   */
  pcafDualSignoff: boolean;
  /** How often the bank produces the NFRS disclosure aggregate. */
  reportingFrequency: ReportingFrequency;
  /**
   * When true, exposures that the taxonomy classified as
   * "unclassified" are still counted in the disclosure aggregate. When
   * false, they are excluded and reported separately.
   */
  includeUnclassifiedInAggregate: boolean;
};

export type CapSettings = {
  /**
   * NRB ESRM Guideline 2022 §7.3.7 monitoring cadence by ESRR risk class.
   * Defaults align with the demo's frequencyForRiskClass helper —
   * Extreme=1 mo, High=3 mo, Medium=6 mo, Low=12 mo.
   */
  monitoringCadenceMonthsByRiskClass: {
    low: number;
    medium: number;
    high: number;
    extreme: number;
  };
  /**
   * Number of grace days after a CAP item's deadline_date before it is
   * projected as "overdue" in the UI. 0 = strict.
   */
  overdueGraceDays: number;
};

export type NotificationSettings = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  emailDigestCadence: EmailDigestCadence;
};

export type BankSettings = {
  /**
   * When null, the header + email templates use the tenant registry
   * displayName. When set, this string overrides it. Useful for banks
   * that prefer a different rendering of their name in the demo (e.g.
   * "Laxmi Sunrise" vs "Laxmi Sunrise Bank Ltd").
   */
  displayNameOverride: string | null;
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export type TenantSettings = {
  esrm: EsrmSettings;
  loanBook: LoanBookSettings;
  taxonomy: TaxonomySettings;
  nfrs: NfrsSettings;
  cap: CapSettings;
  notifications: NotificationSettings;
  bank: BankSettings;
};

/**
 * Category keys used by the settings-page left rail. Kept as a separate
 * const array so the nav list order is the single source of truth for both
 * the render loop and the URL hash target.
 */
export const SETTINGS_CATEGORIES: Array<{
  key: keyof TenantSettings | "mywork";
  label: string;
  description: string;
}> = [
  {
    key: "mywork",
    label: "My Work",
    description: "How your officer queue routes and reminds",
  },
  {
    key: "loanBook",
    label: "Loan Book",
    description: "Number formatting + fiscal year for the loan browser",
  },
  {
    key: "esrm",
    label: "ESRM",
    description: "NRB ESRM Guideline 2022 checklist behaviour + escalation rules",
  },
  {
    key: "taxonomy",
    label: "Taxonomy",
    description: "Green Finance Taxonomy gates + activity visibility",
  },
  {
    key: "nfrs",
    label: "NFRS",
    description: "Disclosure aggregate + PCAF sign-off",
  },
  {
    key: "cap",
    label: "CAP & Monitoring",
    description: "Corrective Action Plan cadence + overdue grace",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Email, SMS, push, and digest cadence",
  },
  {
    key: "bank",
    label: "Bank",
    description: "Display name override",
  },
];
