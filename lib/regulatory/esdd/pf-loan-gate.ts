/**
 * Project-Finance loan gate — shared helper.
 *
 * Circular 22 §5 defines Project Finance as one of three loan-category
 * buckets (Small / BWC-Term / Project Finance). The demo's `Loan` type
 * (`lib/types/bfi.ts`) already has a matching `businessUnit` (`"Project
 * Finance"`) and category strings ending in `project-finance`
 * (`commercial-project-finance`, `corporate-project-finance`).
 *
 * This helper is the single point of truth for "is this a PF loan?" so the
 * wizard route gate, the officer-queue reason-string logic and the ESDD
 * Review callout all agree.
 */

import type { Loan } from "@/lib/types/bfi";

export function isProjectFinanceLoan(loan: Pick<Loan, "businessUnit" | "category">): boolean {
  if (loan.businessUnit === "Project Finance") return true;
  if (loan.category && loan.category.endsWith("project-finance")) return true;
  return false;
}

/**
 * Override-aware variant used by P45. When the officer has set an ESDD
 * loan-category override (persisted on bfi_loan_assignments), that
 * value drives the PF gate — otherwise we fall back to the raw
 * `isProjectFinanceLoan(loan)` check on the loan record.
 *
 * The override values are EsddLoanCategory strings (see
 * lib/regulatory/esdd/annex5-questions.ts):
 *   - "project-finance" → treat as PF (Circular 22 §5 PF bucket)
 *   - anything else     → not PF
 *
 * When `override` is null / undefined / empty string, this behaves
 * exactly like `isProjectFinanceLoan(loan)`. That means every existing
 * caller can adopt this helper without changing behaviour for loans
 * that don't yet have an override on file.
 */
export function isProjectFinanceLoanWithOverride(
  loan: Pick<Loan, "businessUnit" | "category">,
  override: string | null | undefined,
): boolean {
  if (override === "project-finance") return true;
  if (override && override !== "project-finance") return false;
  return isProjectFinanceLoan(loan);
}
