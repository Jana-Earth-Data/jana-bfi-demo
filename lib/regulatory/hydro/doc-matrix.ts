/**
 * NRB Circular 22 — Annex 2 (Hydropower)
 * Documentation Requirements for Project Sponsors
 *
 * Source (verbatim): the ESRM Guideline PDF attached to Circular 22,
 * Annex 2, "Documentation Requirements for Project Sponsors" table on
 * page 25 of the PDF. Every document name and every capacity threshold
 * in this file is taken directly from that table.
 *
 * The matrix is a documentation-collection checklist a bank must have on
 * file BEFORE approving a hydropower loan. It is NOT scored Q&A: an
 * officer records which documents have been received/verified per loan,
 * and the panel surfaces a completion percentage.
 *
 * Capacity bands from Annex 2:
 *   - > 50 MW  : requires EIA (Environmental Impact Assessment)
 *   - 1 - 50 MW : requires IEE (Initial Environmental Examination)
 *   - < 1 MW   : no environmental assessment license required, but the
 *                Department of Electricity Development (DEOD) requires
 *                prescribed information for projects between 100 kW and
 *                1000 kW.
 *
 * See research/02-circular-22-authoritative.md §3 (Sector supplements —
 * Annex 2 doc matrix) for the full extraction context.
 */

// ---------------------------------------------------------------------------
// Capacity band
// ---------------------------------------------------------------------------

/**
 * The three capacity bands NRB Annex 2 defines. Names match the source
 * table rows exactly ("<1 MW", "1-50 MW", ">50 MW").
 */
export type HydroCapacityBand = "under-1mw" | "1-to-50mw" | "over-50mw";

/**
 * Human-readable label for each band, matching the source table wording.
 */
export const HYDRO_CAPACITY_BAND_LABEL: Record<HydroCapacityBand, string> = {
  "under-1mw": "< 1 MW",
  "1-to-50mw": "1 – 50 MW",
  "over-50mw": "> 50 MW",
};

/**
 * The environmental-assessment level Annex 2 pairs with each band.
 */
export const HYDRO_CAPACITY_BAND_ASSESSMENT: Record<HydroCapacityBand, string> = {
  "under-1mw": "None (DEOD info only for 100 kW – 1000 kW)",
  "1-to-50mw": "IEE",
  "over-50mw": "EIA",
};

/**
 * Bucket a borrower's installed hydropower capacity (in MW) into the
 * three Annex 2 bands. Boundary rules match the source:
 *   - "1 - 50 MW" is inclusive of 1 and 50 (the source uses a hyphen,
 *     not "<50 MW", so both endpoints belong to this band).
 *   - "<1 MW" is strictly under 1 MW.
 *   - ">50 MW" is strictly over 50 MW.
 */
export function hydroCapacityBand(capacityMw: number): HydroCapacityBand {
  if (capacityMw < 1) return "under-1mw";
  if (capacityMw <= 50) return "1-to-50mw";
  return "over-50mw";
}

// ---------------------------------------------------------------------------
// Document status
// ---------------------------------------------------------------------------

/**
 * The lifecycle a document can be in for a specific loan:
 *   - not-required  : the borrower's capacity band does not require this doc
 *   - not-collected : required but the officer has not received it yet
 *   - in-progress   : the officer has requested / partially received it
 *   - received      : the officer has the document on file, unverified
 *   - verified      : the document has been reviewed and accepted
 *
 * Only "verified" counts toward the completion percentage; "received"
 * is intentionally distinct so the officer's review step is visible.
 */
export type HydroDocumentStatus =
  | "not-required"
  | "not-collected"
  | "in-progress"
  | "received"
  | "verified";

/**
 * All non-"not-required" statuses in the order they should appear in a
 * dropdown. Kept here so the panel and the API share one source of truth.
 */
export const HYDRO_DOCUMENT_STATUSES: HydroDocumentStatus[] = [
  "not-collected",
  "in-progress",
  "received",
  "verified",
];

// ---------------------------------------------------------------------------
// Document catalogue
// ---------------------------------------------------------------------------

export type HydroDocument = {
  /** Stable identifier used as the primary key in the status table. */
  id: string;
  /** Verbatim name from Annex 2 (single bullet from the source). */
  name: string;
  /**
   * Bands that require this document. If a document is required for
   * multiple bands, list them all. A document that is not in any band's
   * requiredForBands array is never surfaced.
   */
  requiredForBands: HydroCapacityBand[];
  /**
   * Citation string — always references Annex 2 of Circular 22 with the
   * PDF page reference. Rendered in the UI footer + the drawer.
   */
  citation: string;
};

const ANNEX_2_CITATION =
  "NRB Circular 22 Annex 2 (ESRM Guideline PDF p. 25)";

/**
 * The document list, verbatim from the two rows of Annex 2's
 * "Documentation Requirements for Project Sponsors" table (>50 MW and
 * 1-50 MW). The <1 MW row contains a descriptive DEOD-info note rather
 * than a named bullet; we encode that note as a single document so the
 * officer can still record its status.
 *
 * The PDF renders each doc as a "➢" bullet. Both the ">50 MW" and
 * "1-50 MW" rows list the same five-document structure, differing only
 * in which environmental-assessment approval letter is required.
 */
export const HYDRO_DOCUMENTS: HydroDocument[] = [
  {
    id: "company-registration",
    name: "Company registration document (VAT, PAN, registration certificate, AOA and MOA)",
    requiredForBands: ["1-to-50mw", "over-50mw"],
    citation: ANNEX_2_CITATION,
  },
  {
    id: "survey-license",
    name: "Survey license (Electricity generation, transmission and distribution or combined)",
    requiredForBands: ["1-to-50mw", "over-50mw"],
    citation: ANNEX_2_CITATION,
  },
  {
    id: "eia-approval-letter",
    name:
      "Letter of approval for EIA from Ministry of Forests and Environment " +
      "(Previously named as Ministry of Population and Environment)",
    requiredForBands: ["over-50mw"],
    citation: ANNEX_2_CITATION,
  },
  {
    id: "iee-approval-letter",
    name:
      "Letter of approval for IEE from Ministry of Energy, Water Resources and Irrigation " +
      "(Previously named as Ministry of Water Resource (MOWR)) through Department of " +
      "Electricity Development (DEOD)",
    requiredForBands: ["1-to-50mw"],
    citation: ANNEX_2_CITATION,
  },
  {
    id: "development-license",
    name: "Development license (Generation, Transmission and Distribution of Electricity or combined)",
    requiredForBands: ["1-to-50mw", "over-50mw"],
    citation: ANNEX_2_CITATION,
  },
  {
    id: "power-purchase-agreement",
    name: "Power Purchase Agreement (PPA)",
    requiredForBands: ["1-to-50mw", "over-50mw"],
    citation: ANNEX_2_CITATION,
  },
  {
    id: "deod-prescribed-info",
    name:
      "For project between 100kW to 1000KW, no license is required but DEOD requires " +
      "prescribed information.",
    requiredForBands: ["under-1mw"],
    citation: ANNEX_2_CITATION,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Documents required for a borrower's installed capacity. Returns the
 * matching subset of HYDRO_DOCUMENTS in the order they appear in the
 * catalogue (i.e., the source-table order).
 */
export function requiredDocumentsForCapacity(
  capacityMw: number,
): HydroDocument[] {
  const band = hydroCapacityBand(capacityMw);
  return HYDRO_DOCUMENTS.filter((d) => d.requiredForBands.includes(band));
}

/**
 * Convenience: the ordered set of documents for a specific band, without
 * needing to know the underlying MW value.
 */
export function documentsForBand(band: HydroCapacityBand): HydroDocument[] {
  return HYDRO_DOCUMENTS.filter((d) => d.requiredForBands.includes(band));
}

/**
 * Look up a document by id. Returns undefined if the id does not match
 * any entry in HYDRO_DOCUMENTS.
 */
export function findHydroDocument(id: string): HydroDocument | undefined {
  return HYDRO_DOCUMENTS.find((d) => d.id === id);
}
