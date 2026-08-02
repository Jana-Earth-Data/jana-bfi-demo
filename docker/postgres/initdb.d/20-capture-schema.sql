-- ============================================================================
-- BFI Demo — Capture tables (Phase 1 of the Laxmi Sunrise extension plan)
-- ============================================================================
-- Adds the officer-input persistence layer. Every table is scoped by
-- bank_id so we can demo multiple prospects against the same Supabase
-- database without cross-contamination, and can wipe one prospect's
-- captured data via /api/admin/reset without touching another's.
--
-- Idempotent: safe to re-run. Drops-and-creates each new table; leaves the
-- existing bfi_loans_denorm table (owned by the loan-book pagination path)
-- alone.
--
-- Run this in the Supabase SQL Editor of the demo project after
-- scripts/supabase-schema.sql (which sets up bfi_loans_denorm).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reference: registered banks (tenants)
-- ---------------------------------------------------------------------------
-- Mirrors lib/tenants/registry.ts. The code registry is the source of truth
-- for branding; this table exists so foreign keys can reference bank rows
-- without hardcoding string literals on every capture table.
DROP TABLE IF EXISTS public.bfi_banks CASCADE;
CREATE TABLE public.bfi_banks (
    id             text        PRIMARY KEY,          -- matches TenantId (e.g. "laxmi_sunrise")
    display_name   text        NOT NULL,
    is_default     boolean     NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Seed the two currently-registered tenants. These rows match REGISTRY in
-- lib/tenants/registry.ts. Adding a new tenant is a two-step change: add
-- it to the code registry, then add a matching row here.
INSERT INTO public.bfi_banks (id, display_name, is_default) VALUES
    ('default',        'First Bank of Nepal (demo placeholder)', true),
    ('laxmi_sunrise',  'Laxmi Sunrise Bank',                     false);


-- ---------------------------------------------------------------------------
-- Officers (loan officers, ESG officers, compliance, credit committee)
-- ---------------------------------------------------------------------------
-- Officers are attributed to every capture row for audit trail. The demo
-- ships with a seeded roster per tenant (from lib/tenants/registry.ts);
-- production deployments could replace this table with a view over the
-- bank's real HR / SSO system.
DROP TABLE IF EXISTS public.bfi_officers CASCADE;
CREATE TABLE public.bfi_officers (
    id             text        PRIMARY KEY,          -- e.g. "off-laxmi-01"
    bank_id        text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    name           text        NOT NULL,
    role           text        NOT NULL CHECK (role IN
                                    ('loan_officer','esg_officer','compliance','credit_committee')),
    email          text,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_officers_bank_idx ON public.bfi_officers (bank_id);


-- ---------------------------------------------------------------------------
-- ESDD responses (NRB ESRM Annex 5)
-- ---------------------------------------------------------------------------
-- One row per (loan, question) answered by an officer. Immutable — an
-- officer revising an answer inserts a new row with a later captured_at;
-- the latest row per (loan_id, question_id, bank_id) is the current answer.
-- This gives us a free audit trail without a separate history table.
DROP TABLE IF EXISTS public.bfi_esdd_responses CASCADE;
CREATE TABLE public.bfi_esdd_responses (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id        text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id        text        NOT NULL,             -- foreign to bfi_loans_denorm.id (no FK constraint; loan may be a Laxmi override)
    borrower_id    text        NOT NULL,
    officer_id     text        NOT NULL REFERENCES public.bfi_officers(id),
    question_id    text        NOT NULL,             -- e.g. "annex5.1.1", "annex5.2.3"
    answer         text        NOT NULL CHECK (answer IN ('a','b','c','d')),
    remarks        text,
    captured_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_esdd_bank_loan_idx      ON public.bfi_esdd_responses (bank_id, loan_id);
CREATE INDEX bfi_esdd_bank_question_idx  ON public.bfi_esdd_responses (bank_id, question_id);
CREATE INDEX bfi_esdd_captured_desc_idx  ON public.bfi_esdd_responses (captured_at DESC);


-- ---------------------------------------------------------------------------
-- Taxonomy assessments (NRB Green Finance Taxonomy Oct 2024)
-- ---------------------------------------------------------------------------
-- One row per completed taxonomy assessment for a loan. The
-- criterion_answers JSON captures the raw officer input; computed_color +
-- computed_rationale are what the engine derived from those inputs.
DROP TABLE IF EXISTS public.bfi_taxonomy_assessments CASCADE;
CREATE TABLE public.bfi_taxonomy_assessments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id             text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id             text        NOT NULL,
    borrower_id         text        NOT NULL,
    officer_id          text        NOT NULL REFERENCES public.bfi_officers(id),
    activity_id         text        NOT NULL,        -- e.g. "hydropower-under-25mw"
    criterion_answers   jsonb       NOT NULL,        -- {"criterion_3.4.1a": "yes", "criterion_3.4.1b": "no", ...}
    computed_color      text        NOT NULL CHECK (computed_color IN
                                        ('green','amber','red','unclassified')),
    computed_rationale  text        NOT NULL,
    citation            text,                        -- e.g. "NRB Oct 2024, §3.4.1a"
    captured_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_tax_bank_loan_idx     ON public.bfi_taxonomy_assessments (bank_id, loan_id);
CREATE INDEX bfi_tax_bank_activity_idx ON public.bfi_taxonomy_assessments (bank_id, activity_id);
CREATE INDEX bfi_tax_bank_color_idx    ON public.bfi_taxonomy_assessments (bank_id, computed_color);
CREATE INDEX bfi_tax_captured_desc_idx ON public.bfi_taxonomy_assessments (captured_at DESC);


-- ---------------------------------------------------------------------------
-- ESRM screening decisions (aggregated from ESDD responses)
-- ---------------------------------------------------------------------------
-- One row per completed ESRM screening for a loan. Snapshots the ESDD
-- answers used at decision time so a later revision to the ESDD responses
-- does not silently mutate the decision record.
DROP TABLE IF EXISTS public.bfi_esrm_screenings CASCADE;
CREATE TABLE public.bfi_esrm_screenings (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                 text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id                 text        NOT NULL,
    borrower_id             text        NOT NULL,
    officer_id              text        NOT NULL REFERENCES public.bfi_officers(id),
    computed_risk_class     text        NOT NULL CHECK (computed_risk_class IN
                                            ('low','medium','high','extreme')),
    computed_recommendation text        NOT NULL CHECK (computed_recommendation IN
                                            ('approve','approve-with-conditions','decline')),
    escalation_flag         boolean     NOT NULL DEFAULT false,
    computed_rationale      text        NOT NULL,
    esdd_snapshot           jsonb       NOT NULL,    -- {"annex5.1.1": {"answer":"c","remarks":"..."}, ...}
    captured_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_esrm_bank_loan_idx      ON public.bfi_esrm_screenings (bank_id, loan_id);
CREATE INDEX bfi_esrm_bank_risk_idx      ON public.bfi_esrm_screenings (bank_id, computed_risk_class);
CREATE INDEX bfi_esrm_bank_escalation_idx ON public.bfi_esrm_screenings (bank_id, escalation_flag)
    WHERE escalation_flag = true;
CREATE INDEX bfi_esrm_captured_desc_idx  ON public.bfi_esrm_screenings (captured_at DESC);


-- ---------------------------------------------------------------------------
-- Borrower / loan officer overrides
-- ---------------------------------------------------------------------------
-- Per the plan (decision Q2), officers can edit the borrower's basic
-- information (name, sector, EV) captured during the demo. These edits
-- override the synthesized/Supabase-backed borrower fields at read time,
-- scoped by tenant. The synthesizer is not modified.
DROP TABLE IF EXISTS public.bfi_borrower_overrides CASCADE;
CREATE TABLE public.bfi_borrower_overrides (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id        text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    borrower_id    text        NOT NULL,
    officer_id     text        NOT NULL REFERENCES public.bfi_officers(id),
    field_name     text        NOT NULL,             -- e.g. "name", "nrbSector", "enterpriseValueUsd"
    field_value    text        NOT NULL,             -- stored as text; caller casts based on field_name
    captured_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfi_ovr_bank_borrower_idx ON public.bfi_borrower_overrides (bank_id, borrower_id);
CREATE INDEX bfi_ovr_captured_desc_idx ON public.bfi_borrower_overrides (captured_at DESC);


-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
-- All capture tables use service-role access only (same as bfi_loans_denorm).
-- Enable RLS as a defence-in-depth measure even though we access via
-- service-role.
ALTER TABLE public.bfi_banks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_officers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_esdd_responses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_taxonomy_assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_esrm_screenings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_borrower_overrides      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_banks                   FROM anon, authenticated;
REVOKE ALL ON public.bfi_officers                FROM anon, authenticated;
REVOKE ALL ON public.bfi_esdd_responses          FROM anon, authenticated;
REVOKE ALL ON public.bfi_taxonomy_assessments    FROM anon, authenticated;
REVOKE ALL ON public.bfi_esrm_screenings         FROM anon, authenticated;
REVOKE ALL ON public.bfi_borrower_overrides      FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_banks                   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_officers                TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_esdd_responses          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_taxonomy_assessments    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_esrm_screenings         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_borrower_overrides      TO service_role;


-- ============================================================================
-- Done. Next step:
--   1. Run this SQL in the Supabase SQL Editor
--   2. Seed officer rosters via a small POST /api/admin/seed-officers endpoint
--      (built in Phase 1 alongside this migration).
--   3. Proceed to Phase 2 (ESDD wizard).
-- ============================================================================
