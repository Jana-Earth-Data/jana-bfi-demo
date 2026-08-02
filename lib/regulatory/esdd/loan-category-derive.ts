/**
 * Derive the ESDD loan category (Circular 22 Excel `Tempor!A1:A4`) from
 * the richer `Loan.category` + borrower sector.
 *
 * Mapping table (Loan.category → EsddLoanCategory), with the borrower
 * sector overriding "small" into "small-critical" when the sector is on
 * NRB's critical-sector list.
 *
 *   retail-*                    → small-non-critical (retail is typically
 *                                 out of scope for ESRM entirely, but the
 *                                 field must have a value if the wizard
 *                                 is opened)
 *   sme-working-capital         → small-non-critical / small-critical
 *   sme-trade-finance           → small-non-critical / small-critical
 *   sme-term-loan               → small-non-critical / small-critical
 *   commercial-term-loan        → bwc-term
 *   commercial-working-capital  → bwc-term
 *   commercial-project-finance  → project-finance
 *   corporate-syndicated        → bwc-term
 *   corporate-project-finance   → project-finance
 *
 * The critical-sector override uses substring matching against the
 * borrower's `nrbSector` label. The list is per Circular 22 §5 (the 10
 * critical sectors that require the full checklist regardless of loan
 * size). We're intentionally conservative with the matching — better to
 * over-route into "critical" than under-route.
 */

import type { Loan, Borrower } from "@/lib/types/bfi";
import type { EsddLoanCategory } from "./annex5-questions";

// Circular 22 §5 critical sectors (substring match against nrbSector).
// Case-insensitive.
const CRITICAL_SECTOR_TOKENS = [
  "hydro",
  "cement",
  "textile",
  "steel",
  "chemical",
  "brick",
  "agriculture",
  "mining",
  "leather",
  "sugar",
];

function isCriticalSector(nrbSector: string): boolean {
  const s = nrbSector.toLowerCase();
  return CRITICAL_SECTOR_TOKENS.some((t) => s.includes(t));
}

export function deriveEsddLoanCategory(
  loan: Pick<Loan, "category" | "businessUnit">,
  borrower: Pick<Borrower, "nrbSector">,
): EsddLoanCategory {
  // Project Finance short-circuits.
  if (loan.businessUnit === "Project Finance") return "project-finance";
  const c = loan.category ?? "";
  if (c.endsWith("project-finance")) return "project-finance";

  // BWC-Term for commercial / corporate non-PF term & WC loans.
  if (c.startsWith("commercial-") || c === "corporate-syndicated") {
    return "bwc-term";
  }

  // SME + retail → Small (split by critical-sector).
  return isCriticalSector(borrower.nrbSector)
    ? "small-critical"
    : "small-non-critical";
}
