/**
 * Type definitions for the Corrective Action Plan + E&S Covenants +
 * Monitoring capture surface (NRB Circular 22 §7.3.5 + Annex 8/9/10 and
 * §7.3.7).
 *
 * Column names match the Supabase schema in scripts/supabase-cap.sql,
 * translated from snake_case → camelCase at the API boundary.
 */

// ---------------------------------------------------------------------------
// Enums — kept as string literals so the CHECK constraints in the DB and
// the API layer stay in lockstep with the code.
// ---------------------------------------------------------------------------

/** Lifecycle of a single Annex 8 CAP row. */
export type CapItemStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "overdue";

/**
 * Annex 9 covenant classifications. The first four are verbatim from
 * Annex 9. `cap_covenant` is Annex 9's own catch-all for "CAP included as
 * an annex to the legal agreement" — surfaced explicitly so the panel
 * can group it distinctly from a plain positive covenant.
 */
export type CovenantType =
  | "positive"
  | "negative"
  | "condition_precedent"
  | "event_of_default"
  | "cap_covenant";

/** Lifecycle of a single Annex 9 covenant row. */
export type CovenantStatus = "active" | "breached" | "waived" | "expired";

/**
 * Annex 10 Sl. 4 four-way phrasing for both covenant compliance and CAP
 * compliance ("fully implemented / partially implemented / not
 * implemented / delayed implementation").
 */
export type ComplianceStatus = "fully" | "partial" | "not" | "delayed";

/** ESRR risk classes that drive monitoring frequency per §7.3.7 guidance. */
export type CapRiskClass = "low" | "medium" | "high" | "extreme";

// ---------------------------------------------------------------------------
// Row shapes — camelCase API surface
// ---------------------------------------------------------------------------

/** One Annex 8 CAP row as returned by GET /api/cap/[loanId]. */
export type CapItem = {
  id: string;
  bankId: string;
  loanId: string;
  borrowerId: string;
  areaOfConcern: string;
  correctiveAction: string;
  deadlineDate: string | null;      // ISO date "YYYY-MM-DD" or null
  completionIndicator: string | null;
  responsibleParty: string | null;
  costNpr: number | null;
  status: CapItemStatus;
  linkedEsddQuestionId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One Annex 9 covenant row as returned by GET /api/cap/[loanId]. */
export type Covenant = {
  id: string;
  bankId: string;
  loanId: string;
  borrowerId: string;
  covenantType: CovenantType;
  clauseText: string;
  deadlineDate: string | null;
  status: CovenantStatus;
  libraryTemplateId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One Annex 10 monitoring cycle as returned by GET /api/cap/[loanId]. */
export type MonitoringReport = {
  id: string;
  bankId: string;
  loanId: string;
  borrowerId: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  nextDueDate: string;
  frequencyMonths: 1 | 3 | 6 | 12;
  covenantComplianceStatus: ComplianceStatus;
  capComplianceStatus: ComplianceStatus;
  notes: string | null;
  checklistSnapshot: Record<string, MonitoringChecklistResponse>;
  submittedBy: string;
  submittedAt: string;
  createdAt: string;
};

/**
 * One officer response inside a monitoring cycle's checklistSnapshot.
 * Keyed by MonitoringChecklistItem.id.
 */
export type MonitoringChecklistResponse = {
  /** RM's response text (Annex 10 "Response" column). */
  response: string;
  /** Officer's traffic-light flag for the row. */
  flag: "ok" | "issue" | "n/a";
};

// ---------------------------------------------------------------------------
// Library shapes — see lib/regulatory/cap/library.ts
// ---------------------------------------------------------------------------

/** Template entry in COVENANT_LIBRARY. */
export type CovenantTemplate = {
  /** Stable id used as the soft FK from bfi_covenants.library_template_id. */
  id: string;
  /** Annex 9 classification. */
  type: CovenantType;
  /** UX grouping label — e.g. "Reporting", "Incidents", "Pre-disbursement". */
  category: string;
  /** Short human-facing title for the picker dropdown. */
  title: string;
  /**
   * Verbatim clause text (NRB-language where possible). Officers can
   * edit after inserting — the row still records libraryTemplateId so
   * the panel can highlight "edited from template".
   */
  clauseText: string;
  /**
   * Whether this covenant typically has a deadline in the loan
   * agreement. Used to decide whether to prompt for a deadline in the
   * insert dialog (perpetual covenants leave the input blank).
   */
  typicallyHasDeadline: boolean;
  /** Regulatory citation for the covenant. */
  citation: string;
};

/** One item in the Annex 10 13-item monitoring checklist. */
export type MonitoringChecklistItem = {
  /** Stable id — used as the key in MonitoringReport.checklistSnapshot. */
  id: string;
  /** Annex 10 sequence number ("Sl. No."). */
  serial: number;
  /** Annex 10 section grouping. */
  section:
    | "Project Summary Information"
    | "General Information"
    | "EHS Management"
    | "Permits and Compliance Certificates"
    | "Grievance Redressal"
    | "Other Information";
  /** Verbatim prompt from Annex 10. */
  prompt: string;
};

// ---------------------------------------------------------------------------
// API request / response bundles
// ---------------------------------------------------------------------------

/** Bundle returned by GET /api/cap/[loanId]. */
export type CapBundle = {
  ok: true;
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  riskClass: CapRiskClass | null;
  applicable: boolean;
  items: CapItem[];
  covenants: Covenant[];
  monitoring: MonitoringReport[];
  citation: string;
};

/**
 * POST body — any collection may be omitted or partially specified.
 * Items and covenants with an `id` are updates; items and covenants
 * without an `id` are inserts. Monitoring reports are always append-only
 * (no update path — a new cycle is always a new row).
 */
export type CapUpsertBody = {
  loanId: string;
  borrowerId: string;
  items?: Array<Partial<CapItem> & Pick<CapItem, "areaOfConcern" | "correctiveAction">>;
  itemsToDelete?: string[];
  covenants?: Array<Partial<Covenant> & Pick<Covenant, "covenantType" | "clauseText">>;
  covenantsToDelete?: string[];
  monitoring?: Array<
    Omit<
      MonitoringReport,
      | "id"
      | "bankId"
      | "loanId"
      | "borrowerId"
      | "submittedBy"
      | "submittedAt"
      | "createdAt"
    >
  >;
};
