-- ============================================================================
-- BFI Demo — Annex 5b Project Finance Screening tables
-- ============================================================================
-- Adds persistence for the Annex 5b Project Finance Screening Questionnaire
-- (2022 NRB ESRM Guideline, pp. 43-49) that Circular 22 requires for every
-- loan categorised as Project Finance.
--
-- Mirrors the pattern of scripts/supabase-capture-schema.sql:
--   * one row-per-item responses table (append-only for audit trail)
--   * one row-per-submission results table (computed risk + flag summary)
--   * scoped by bank_id + officer_id
--   * service-role access only (RLS enabled as defence-in-depth)
--
-- Idempotent: safe to re-run. Drops-and-creates each table.
-- Run this in the Supabase SQL Editor of the demo project after
-- scripts/supabase-capture-schema.sql (which sets up bfi_banks, bfi_officers,
-- bfi_esdd_responses, bfi_esrm_screenings).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PF screening responses (one row per (loan, item) answer)
-- ---------------------------------------------------------------------------
-- Immutable — revising an answer inserts a new row with a later captured_at;
-- the latest row per (bank_id, loan_id, item_id) is the current answer. Same
-- pattern as bfi_esdd_responses.
DROP TABLE IF EXISTS public.bfi_pf_screening_responses CASCADE;
CREATE TABLE public.bfi_pf_screening_responses (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id        text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id        text        NOT NULL,            -- foreign to bfi_loans_denorm.id (no FK constraint)
    borrower_id    text        NOT NULL,
    officer_id     text        NOT NULL REFERENCES public.bfi_officers(id),
    item_id        text        NOT NULL,            -- e.g. "annex5b.PS1.3"
    ifc_ps         text        NOT NULL CHECK (ifc_ps IN
                                    ('PS1','PS2','PS3','PS4','PS5','PS6','PS7','PS8')),
    answer         text        NOT NULL CHECK (answer IN ('yes','no','n/a')),
    remarks        text,
    captured_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_pf_resp_bank_loan_idx     ON public.bfi_pf_screening_responses (bank_id, loan_id);
CREATE INDEX bfi_pf_resp_bank_item_idx     ON public.bfi_pf_screening_responses (bank_id, item_id);
CREATE INDEX bfi_pf_resp_bank_ps_idx       ON public.bfi_pf_screening_responses (bank_id, ifc_ps);
CREATE INDEX bfi_pf_resp_captured_desc_idx ON public.bfi_pf_screening_responses (captured_at DESC);


-- ---------------------------------------------------------------------------
-- PF screening results (one row per screening submission)
-- ---------------------------------------------------------------------------
-- Snapshots the responses used at decision time and stores the computed
-- risk class + flag summary. Same pattern as bfi_esrm_screenings.
DROP TABLE IF EXISTS public.bfi_pf_screening_results CASCADE;
CREATE TABLE public.bfi_pf_screening_results (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                  text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id                  text        NOT NULL,
    borrower_id              text        NOT NULL,
    officer_id               text        NOT NULL REFERENCES public.bfi_officers(id),
    computed_risk_class      text        NOT NULL CHECK (computed_risk_class IN
                                            ('low','medium','high','critical')),
    items_answered           int         NOT NULL,
    items_applicable         int         NOT NULL,
    items_flagged            int         NOT NULL,
    critical_flagged_items   jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- string[] of item ids
    ps_breakdown             jsonb       NOT NULL,                       -- PfPsBreakdown[]
    computed_rationale       text        NOT NULL,
    responses_snapshot       jsonb       NOT NULL,                       -- {"annex5b.PS1.3": {"answer":"no","remarks":"..."}, ...}
    captured_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_pf_res_bank_loan_idx      ON public.bfi_pf_screening_results (bank_id, loan_id);
CREATE INDEX bfi_pf_res_bank_risk_idx      ON public.bfi_pf_screening_results (bank_id, computed_risk_class);
CREATE INDEX bfi_pf_res_captured_desc_idx  ON public.bfi_pf_screening_results (captured_at DESC);


-- ---------------------------------------------------------------------------
-- Permissions (service-role only, matches capture-schema pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bfi_pf_screening_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_pf_screening_results   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_pf_screening_responses FROM anon, authenticated;
REVOKE ALL ON public.bfi_pf_screening_results   FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_pf_screening_responses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_pf_screening_results   TO service_role;

-- ============================================================================
-- Done. Next step: hit the /api/pf-screening/* endpoints from the app.
-- ============================================================================
