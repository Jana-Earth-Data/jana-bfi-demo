-- ============================================================================
-- BFI Demo — Loan Category Override (P45)
-- ============================================================================
-- Adds a nullable text column on bfi_loan_assignments to persist the ESDD
-- wizard's Loan Category override across page refreshes / Save & Exit +
-- re-entry cycles.
--
-- Before P45 the override lived only in React state on the wizard. It
-- survived step navigation (5df66f8 lifted it to the parent) but was
-- silently discarded on every fresh mount because we re-derived from
-- loan.category. This column is the write-through target.
--
-- One row per (bank_id, loan_id) already exists post-P36 auto-claim, so
-- no new table is needed — we just extend the existing assignment row.
--
-- When present, this value takes precedence over the derived
-- deriveEsddLoanCategory(loan, borrower) on:
--   - the ESDD wizard Basic Information step
--   - the PF-screening gate (isProjectFinanceLoanWithOverride)
--   - the officer-queue rollup PF CTA visibility
--   - any downstream reporting that keys off the ESDD loan category
--
-- Values are one of the EsddLoanCategory enum (lib/regulatory/esdd/
-- annex5-questions.ts):
--   - small-non-critical
--   - small-critical
--   - bwc-term
--   - project-finance
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.bfi_loan_assignments
  ADD COLUMN IF NOT EXISTS loan_category_override text;

COMMENT ON COLUMN public.bfi_loan_assignments.loan_category_override IS
  'Officer-set ESDD loan category override. When present, takes precedence over the derived loan.category on the ESDD wizard, PF-screening gate, and downstream reporting. Value is one of EsddLoanCategory enum: commercial-term-loan, commercial-working-capital, commercial-project-finance, corporate-syndicated, corporate-project-finance, sme-*, retail-*.';

-- ============================================================================
-- Done.
-- ============================================================================
