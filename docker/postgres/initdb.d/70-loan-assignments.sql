-- ============================================================================
-- BFI Demo — Loan assignments (officer -> loan)
-- ============================================================================
-- Adds the join table that lets a manager assign under-review loans to a
-- specific loan / ESG officer, and lets an officer see only their assigned
-- work on the "My work" tab.
--
-- One row per (bank_id, loan_id). Reassignment is a plain UPDATE, so the
-- "assignments history" is not preserved by design — the demo's audit trail
-- lives on bfi_esdd_responses / bfi_esrm_screenings (which do preserve
-- history) rather than on the assignment row.
--
-- Idempotent: safe to re-run. Run in the Supabase SQL Editor after
-- scripts/supabase-capture-schema.sql.
-- ============================================================================

DROP TABLE IF EXISTS public.bfi_loan_assignments CASCADE;
CREATE TABLE public.bfi_loan_assignments (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id        text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id        text        NOT NULL,
    officer_id     text        NOT NULL REFERENCES public.bfi_officers(id),
    assigned_by    text                 REFERENCES public.bfi_officers(id),
    assigned_at    timestamptz NOT NULL DEFAULT now(),
    -- One assignment per (bank, loan) — reassignment updates in place.
    UNIQUE (bank_id, loan_id)
);
CREATE INDEX bfi_assign_bank_officer_idx ON public.bfi_loan_assignments (bank_id, officer_id);
CREATE INDEX bfi_assign_bank_loan_idx    ON public.bfi_loan_assignments (bank_id, loan_id);

ALTER TABLE public.bfi_loan_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfi_loan_assignments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_loan_assignments TO service_role;

-- ============================================================================
-- Done. Run this SQL in the Supabase SQL Editor.
-- ============================================================================
