/**
 * Fabricated findings — hand-picked answers that no evidence supports.
 *
 * Moved out of lib/regulatory/pcaf/scoring.ts, which is otherwise a faithful
 * implementation of the PCAF Part A §5 decision tree with paragraph-level
 * citations. These name lists were the one thing in that file that was not
 * derived from the standard, and they were consequential: matching a
 * substring here is what put a borrower at the top of the disclosure
 * histogram.
 *
 * Why that mattered enough to move
 * --------------------------------
 * The lists produce a claim -- "this borrower publishes third-party-verified
 * emissions" -- that nobody verified. A real bank would establish that by
 * opening the annual report and finding an assurance statement, which is what
 * lib/regulatory/pcaf/evidence-matrix.ts now provides. Leaving fabricated
 * answers compiled into the regulatory engine meant a live deployment would
 * inherit them, silently granting five named borrowers a data-quality score
 * they had not earned.
 *
 * They also failed in the other direction: every borrower NOT on the list read
 * as "does not publish emissions", which biased the whole book toward Score 5
 * and understated the bank's real data quality -- the exact figure the product
 * is sold on.
 *
 * The rule this establishes: lib/regulatory/** contains no fabricated content.
 * Regulatory modules encode the standard and operate on whatever they are
 * handed. Anything invented is injected from here, and a live build has
 * nothing to inject.
 */

/**
 * Borrowers treated as publishing third-party-verified emissions
 * (PCAF Option 1a, Score 1).
 *
 * Matched by lower-cased substring against the borrower name so the fixture
 * survives re-ordering of the entity catalogue.
 */
export const PCAF_NAME_FIXTURES_VERIFIED: string[] = [
  // Publicly listed, one of the larger dry-process producers. Chosen as the
  // demo's Score 1 exemplar so the disclosure histogram has a top end.
  // Whether the company actually commissions assurance is not asserted here.
  "ghorahi",
];

/**
 * Borrowers treated as publishing unverified emissions
 * (PCAF Option 1b, Score 2).
 *
 * Plausible for the NEPSE-listed subset, whose annual reports often carry
 * scope 1 and 2 without ISO 14064 verification -- but plausible is not the
 * same as established, which is why this is a fixture and not a finding.
 */
export const PCAF_NAME_FIXTURES_UNVERIFIED: string[] = [
  "arghakhanchi",
  "hetauda cement",
  "butwal power",
];
