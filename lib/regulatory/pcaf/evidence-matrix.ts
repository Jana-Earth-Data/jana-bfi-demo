/**
 * PCAF evidence document matrix — what a data-availability claim rests on.
 *
 * Why this exists
 * ---------------
 * The PCAF availability panel asks five yes/no questions: does the borrower
 * publish verified emissions, unverified emissions, is primary energy data
 * available, physical activity data, revenue. Each answer moves the loan up
 * or down the PCAF score ladder, and the score is what the bank discloses.
 *
 * Those answers were previously either inferred or asserted. Inference is
 * legitimate for some of them — a Climate TRACE facility match really does
 * establish that physical activity data exists — but two of them were
 * inferred from a hardcoded list of five borrower names
 * (NAME_SUBSTRING_VERIFIED in scoring.ts), which is demo scaffolding, not
 * evidence. Nothing recorded WHY a flag was true, so an auditor asking
 * "show me the basis for Score 1 on this borrower" had nothing to read.
 *
 * The distinction that matters: whether a borrower publishes an assured GHG
 * inventory is not inferable. Someone has to open the annual report and
 * look. This module makes that act the thing that sets the flag.
 *
 * Shape borrowed from lib/regulatory/hydro/doc-matrix.ts, which does the
 * same job for Circular 22 Annex 2: a defined catalogue, a status lifecycle
 * per document, and only the terminal status counting. Officers already
 * understand that panel, so this one behaves the same way.
 *
 * What is NOT here
 * ----------------
 * This module does not replace inference. Facility matching and listed
 * status remain inferred from Jana's own data, because there is no document
 * for the bank to collect — the evidence is a data join, not a PDF. See
 * resolveAvailability() for how the two combine.
 */

import type { PcafDataAvailability } from "./types";

// ---------------------------------------------------------------------------
// Status lifecycle
// ---------------------------------------------------------------------------

/**
 * The lifecycle a piece of evidence can be in for a borrower.
 *
 * Mirrors HydroDocumentStatus deliberately. As there, only "verified"
 * counts: "received" means the document is on file but nobody has read it,
 * and a document nobody has read cannot support a disclosure.
 *
 *   - not-applicable : this document cannot exist for this borrower
 *                      (e.g. assurance opinion for an unlisted SME)
 *   - not-collected  : relevant but not requested yet
 *   - requested      : asked the borrower, waiting
 *   - received       : on file, not yet reviewed
 *   - verified       : reviewed and accepted as supporting the claim
 *   - unavailable    : confirmed the borrower does not have it
 *
 * "unavailable" is distinct from "not-collected" on purpose. Establishing
 * that a borrower does NOT publish emissions is itself a finding, and it is
 * the finding that justifies dropping to Score 4 or 5. Without it there is
 * no way to tell a checked-and-absent from an unchecked.
 */
export type PcafEvidenceStatus =
  | "not-applicable"
  | "not-collected"
  | "requested"
  | "received"
  | "verified"
  | "unavailable";

/** Statuses an officer can pick, in dropdown order. */
export const PCAF_EVIDENCE_STATUSES: PcafEvidenceStatus[] = [
  "not-collected",
  "requested",
  "received",
  "verified",
  "unavailable",
  "not-applicable",
];

export const PCAF_EVIDENCE_STATUS_LABEL: Record<PcafEvidenceStatus, string> = {
  "not-applicable": "Not applicable",
  "not-collected": "Not collected",
  requested: "Requested",
  received: "Received, not reviewed",
  verified: "Verified",
  unavailable: "Confirmed unavailable",
};

/** Only this status can establish a flag. */
export function supportsClaim(status: PcafEvidenceStatus): boolean {
  return status === "verified";
}

/** These statuses mean the officer has actually reached a conclusion. */
export function isResolved(status: PcafEvidenceStatus): boolean {
  return (
    status === "verified" ||
    status === "unavailable" ||
    status === "not-applicable"
  );
}

// ---------------------------------------------------------------------------
// Document catalogue
// ---------------------------------------------------------------------------

/** The availability flags a document can establish. */
export type PcafFlagKey = keyof PcafDataAvailability;

export type PcafEvidenceDocument = {
  /** Stable id — primary key in the status table. Never renumber these. */
  id: string;
  name: string;
  /** What the officer is looking for when they open it. */
  lookFor: string;
  /**
   * The flag this document establishes when verified. One document, one
   * claim: an assurance opinion is the only thing that distinguishes
   * Score 1 from Score 2, so it gets its own row rather than being a
   * property of the annual report.
   */
  establishes: PcafFlagKey;
  /** PCAF option this supports, for the UI and the audit trail. */
  supportsOption: string;
  citation: string;
  /**
   * Whose fact is this?
   *
   *   "borrower" - a property of the company. Whether it publishes an
   *                assured GHG inventory does not change per loan, so one
   *                review serves every facility the bank has to it.
   *
   *   "activity" - depends on what was financed. PCAF Part A 3rd Edition
   *                §5.3 attributes project-finance emissions to the
   *                PROJECT: the numerator is the project's physical output,
   *                not the company's total. A hydro developer with five
   *                plants where the bank financed one needs that plant's
   *                generation, so these documents are collected per loan
   *                on project finance and per borrower otherwise.
   */
  scope: "borrower" | "activity";
};

const PCAF_CITATION = "PCAF Global GHG Standard Part A, 3rd Edition §5.2";

/**
 * Ordered by the score ladder, best evidence first, so the panel reads the
 * way an officer works: try for Score 1, fall back down.
 */
export const PCAF_EVIDENCE_DOCUMENTS: PcafEvidenceDocument[] = [
  {
    id: "assurance-opinion",
    name: "Third-party assurance opinion on the GHG inventory",
    lookFor:
      "A signed limited or reasonable assurance statement from an independent assurer, covering the same reporting year as the emissions figures. An audit opinion on the financial statements is not this.",
    establishes: "borrower_publishes_verified",
    supportsOption: "Option 1a",
    citation: `${PCAF_CITATION} · Option 1a (verified emissions)`,
    scope: "borrower",
  },
  {
    id: "ghg-inventory",
    name: "Published GHG inventory (annual or sustainability report)",
    lookFor:
      "Scope 1 and Scope 2 emissions stated for a named reporting year, prepared on a GHG-Protocol basis. A qualitative environment section with no tonnage is not an inventory.",
    establishes: "borrower_publishes_unverified",
    supportsOption: "Option 1b",
    citation: `${PCAF_CITATION} · Option 1b (unverified reported emissions)`,
    scope: "borrower",
  },
  {
    id: "energy-records",
    name: "Primary energy consumption records",
    lookFor:
      "Utility invoices, meter readings, or fuel purchase records covering the reporting year. Must be the borrower's own consumption, not a sector estimate.",
    establishes: "energy_consumption_data_available",
    supportsOption: "Option 2a",
    citation: `${PCAF_CITATION} · Option 2a (primary energy data)`,
    scope: "activity",
  },
  {
    id: "production-records",
    name: "Primary physical activity / production records",
    lookFor:
      "Production volume for the reporting year in physical units — tonnes of clinker or cement, MWh generated, tonnes of steel. Installed capacity is not production.",
    establishes: "physical_activity_data_available",
    supportsOption: "Option 2b",
    citation: `${PCAF_CITATION} · Option 2b (physical activity data)`,
    scope: "activity",
  },
  {
    id: "financial-statements",
    name: "Audited financial statements",
    lookFor:
      "Revenue for the reporting year from audited accounts or a stock-exchange filing. Establishes the denominator for a revenue-based estimate.",
    establishes: "revenue_data_available",
    supportsOption: "Option 3a",
    citation: `${PCAF_CITATION} · Option 3a (revenue-based estimation)`,
    scope: "borrower",
  },
];

export const PCAF_EVIDENCE_BY_ID: Record<string, PcafEvidenceDocument> =
  Object.fromEntries(PCAF_EVIDENCE_DOCUMENTS.map((d) => [d.id, d]));

// ---------------------------------------------------------------------------
// Recorded status
// ---------------------------------------------------------------------------

export type PcafEvidenceRecord = {
  documentId: string;
  /**
   * Loan this row is scoped to, or null for a company-level document.
   * Set only for "activity" documents on project-finance loans, where
   * PCAF §5.3 wants the project's output rather than the company's.
   */
  loanId: string | null;
  status: PcafEvidenceStatus;
  /**
   * Reporting year the document covers. A 2024 annual report supports a
   * FY2024 disclosure and is stale for FY2025 — PCAF is re-run annually, so
   * evidence without a year cannot be aged.
   */
  reportingYear: number | null;
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * Evidence is stale when it is verified but covers a year older than the
 * one being disclosed. Stale evidence does not establish a claim: last
 * year's production figure does not tell you this year's emissions.
 */
export function isStale(
  record: PcafEvidenceRecord,
  disclosureYear: number,
): boolean {
  if (record.status !== "verified") return false;
  if (record.reportingYear === null) return false;
  return record.reportingYear < disclosureYear;
}

/**
 * Attachment key for a document's FILES.
 *
 * Deliberately has no loan component, and must never gain one. Files are
 * borrower-scoped: an officer uploads a borrower's annual report once and
 * every loan to that borrower can see it. Keying attachments per loan would
 * make the same PDF get uploaded again for each facility, which is both
 * wasted work and a reconciliation problem the first time two copies
 * disagree.
 *
 * Review STATE can be loan-scoped even while the file is not -- see
 * evidenceScopeKey(). Two project-finance loans to one hydro developer draw
 * on the same document library but reach their own verified/unavailable
 * conclusions about their own plant, with the officer naming the relevant
 * file in the row's notes.
 *
 * The attachments table indexes (bank_id, entity_type, entity_id, field_key)
 * non-uniquely, so one key legitimately holds several files.
 */
export function evidenceAttachmentKey(doc: PcafEvidenceDocument): string {
  return `doc_${doc.id}`;
}

/**
 * The loan_id an evidence row should carry for this document.
 *
 * Company-level documents are always filed against the borrower (null), so
 * one review serves every loan. Activity documents are filed per loan when
 * the loan is project finance, because §5.3 scopes the numerator to the
 * project, and against the borrower otherwise.
 *
 * Callers pass the resolved asset class rather than the raw loan category
 * so the ESDD category override is respected.
 */
export function evidenceScopeKey(
  doc: PcafEvidenceDocument,
  loanId: string,
  isProjectFinance: boolean,
): string | null {
  if (doc.scope === "borrower") return null;
  return isProjectFinance ? loanId : null;
}

/** Pick the row that applies to this loan, preferring a loan-scoped one. */
export function recordFor(
  doc: PcafEvidenceDocument,
  records: PcafEvidenceRecord[],
  loanId: string,
  isProjectFinance: boolean,
): PcafEvidenceRecord | undefined {
  const wanted = evidenceScopeKey(doc, loanId, isProjectFinance);
  return records.find(
    (r) => r.documentId === doc.id && r.loanId === wanted,
  );
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

export type FlagBasis =
  /** A verified, in-year document establishes it. */
  | { source: "document"; documentId: string; reportingYear: number | null }
  /** The officer confirmed the borrower does not have the document. */
  | { source: "document-absent"; documentId: string }
  /** Verified but covering an earlier year, so it no longer supports the claim. */
  | { source: "document-stale"; documentId: string; reportingYear: number }
  /** Derived from Jana's own data — no document exists to collect. */
  | { source: "inference" }
  /** Nobody has established anything either way. */
  | { source: "unevidenced" };

export type ResolvedAvailability = {
  flags: PcafDataAvailability;
  basis: Record<PcafFlagKey, FlagBasis>;
};

/**
 * Combine document evidence with inference into the flags actually used for
 * scoring, and record what each answer rests on.
 *
 * Precedence, strongest first:
 *   1. A verified in-year document  -> true, basis "document"
 *   2. Confirmed unavailable        -> false, basis "document-absent"
 *   3. A verified but stale document-> false, basis "document-stale"
 *   4. Inference                    -> inferred value, basis "inference"
 *
 * Document evidence outranks inference in both directions. If an officer has
 * read the annual report and found no GHG inventory, that finding beats a
 * guess based on the borrower's name or sector — which is the whole point.
 *
 * Flags with no document in the catalogue (sector_average_only, out_of_scope)
 * pass through from inference untouched: they are properties of the loan, not
 * claims about the borrower's disclosures.
 */
export function resolveAvailability(
  inferred: PcafDataAvailability,
  records: PcafEvidenceRecord[],
  disclosureYear: number,
  ctx: {
    /** Loan being scored. Activity documents resolve against it. */
    loanId: string;
    /** Whether that loan is project finance (PCAF §5.3). */
    isProjectFinance: boolean;
  },
): ResolvedAvailability {
  const flags: PcafDataAvailability = { ...inferred };
  const basis = {} as Record<PcafFlagKey, FlagBasis>;

  for (const key of Object.keys(inferred) as PcafFlagKey[]) {
    basis[key] = { source: "inference" };
  }

  for (const doc of PCAF_EVIDENCE_DOCUMENTS) {
    // Company-level documents resolve against the borrower row; activity
    // documents against this loan when it is project finance. Picking the
    // wrong one would let a hydro developer's group-wide production stand
    // in for the single financed plant.
    const rec = recordFor(doc, records, ctx.loanId, ctx.isProjectFinance);
    if (!rec || rec.status === "not-collected" || rec.status === "requested") {
      // Nothing established. Fall back to inference, but say so rather than
      // letting an unreviewed row look the same as a reviewed one.
      basis[doc.establishes] = { source: "unevidenced" };
      continue;
    }

    if (rec.status === "verified") {
      if (rec.reportingYear !== null && rec.reportingYear < disclosureYear) {
        flags[doc.establishes] = false;
        basis[doc.establishes] = {
          source: "document-stale",
          documentId: doc.id,
          reportingYear: rec.reportingYear,
        };
      } else {
        flags[doc.establishes] = true;
        basis[doc.establishes] = {
          source: "document",
          documentId: doc.id,
          reportingYear: rec.reportingYear,
        };
      }
      continue;
    }

    if (rec.status === "unavailable" || rec.status === "not-applicable") {
      flags[doc.establishes] = false;
      basis[doc.establishes] = { source: "document-absent", documentId: doc.id };
      continue;
    }

    // "received" — on file but unread. Deliberately does NOT establish the
    // claim; an unreviewed document is not evidence.
    basis[doc.establishes] = { source: "unevidenced" };
  }

  // Score 1 subsumes Score 2: an assured inventory is also a published one.
  // Without this a borrower with a verified assurance opinion but no separate
  // ghg-inventory row would read "publishes verified: yes, publishes
  // unverified: no", which is incoherent.
  if (flags.borrower_publishes_verified) {
    flags.borrower_publishes_unverified = true;
  }

  return { flags, basis };
}

/**
 * How much of the evidence review has actually been done. Drives a progress
 * indicator so a borrower nobody has reviewed is visibly distinct from one
 * where every document has been chased down and the answer is still Score 5.
 */
export function evidenceProgress(records: PcafEvidenceRecord[]): {
  resolved: number;
  total: number;
} {
  const byDoc = new Map(records.map((r) => [r.documentId, r]));
  let resolved = 0;
  for (const doc of PCAF_EVIDENCE_DOCUMENTS) {
    const rec = byDoc.get(doc.id);
    if (rec && isResolved(rec.status)) resolved += 1;
  }
  return { resolved, total: PCAF_EVIDENCE_DOCUMENTS.length };
}
