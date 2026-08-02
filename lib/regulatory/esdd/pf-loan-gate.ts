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
