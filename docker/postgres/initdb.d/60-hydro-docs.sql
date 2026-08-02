-- ============================================================================
-- BFI Demo — Hydropower documentation matrix (NRB Circular 22 Annex 2)
-- ============================================================================
-- Persistence for the per-loan hydropower documentation checklist. Every
-- (bank, loan, document) tuple gets one row tracking the current status
-- of that document. Updates are UPSERTs, keyed on
-- (bank_id, loan_id, document_id).
--
-- The document catalogue itself lives in code
-- (lib/regulatory/hydro/doc-matrix.ts) and is NOT stored here — that keeps
-- the verbatim NRB source in one place and lets us re-cite Annex 2 without
-- a schema change. This table only records officer-input status.
--
-- Idempotent: safe to re-run. Follows the RLS + service-role pattern from
-- scripts/supabase-capture-schema.sql (bfi_esdd_responses,
-- bfi_taxonomy_assessments, bfi_esrm_screenings).
--
-- Run this in the Supabase SQL Editor after
-- scripts/supabase-capture-schema.sql (which creates bfi_banks + bfi_officers
-- referenced here as FKs).
-- ============================================================================

DROP TABLE IF EXISTS public.bfi_hydro_doc_status CASCADE;

CREATE TABLE public.bfi_hydro_doc_status (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id           text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id           text        NOT NULL,          -- foreign to bfi_loans_denorm.id (no FK constraint; may be an override)
    borrower_id       text        NOT NULL,
    officer_id        text        NOT NULL REFERENCES public.bfi_officers(id),

    -- Document primary key from lib/regulatory/hydro/doc-matrix.ts
    -- (e.g. "company-registration", "eia-approval-letter", "ppa").
    -- Text rather than an enum so the code can add / rename verbatim doc
    -- entries without a migration.
    document_id       text        NOT NULL,

    -- Lifecycle: not-required | not-collected | in-progress | received | verified
    -- Kept as text + CHECK so a status rename is a code + one-line SQL change
    -- rather than an ALTER TYPE.
    status            text        NOT NULL DEFAULT 'not-collected'
                                  CHECK (status IN
                                    ('not-required',
                                     'not-collected',
                                     'in-progress',
                                     'received',
                                     'verified')),

    -- Optional free-text officer note (e.g. "IEE approval pending — DEOD
    -- confirmed intake on 2026-03-14").
    notes             text,

    -- Audit trail. captured_at is preserved on the initial insert;
    -- updated_at bumps on every UPSERT.
    captured_at       timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    UNIQUE (bank_id, loan_id, document_id)
);

-- Fast lookup by (bank, loan) for the panel's on-open fetch.
CREATE INDEX bfi_hydro_doc_bank_loan_idx
    ON public.bfi_hydro_doc_status (bank_id, loan_id);

-- Fast lookup by (bank, borrower) for a borrower-scoped rollup.
CREATE INDEX bfi_hydro_doc_bank_borrower_idx
    ON public.bfi_hydro_doc_status (bank_id, borrower_id);

-- Partial index over incomplete documents so the officer queue can
-- surface "loans with outstanding hydro paperwork" cheaply. Only
-- 'not-collected' and 'in-progress' count as incomplete for this index —
-- 'received' means the doc is in-hand pending review and 'verified'
-- means fully cleared.
CREATE INDEX bfi_hydro_doc_incomplete_idx
    ON public.bfi_hydro_doc_status (bank_id, loan_id, document_id)
    WHERE status IN ('not-collected', 'in-progress');

-- Recency probe (for change feeds / audit displays).
CREATE INDEX bfi_hydro_doc_updated_desc_idx
    ON public.bfi_hydro_doc_status (updated_at DESC);


-- ---------------------------------------------------------------------------
-- Bump updated_at on every UPDATE. Small trigger so the API layer does
-- not have to remember to set it explicitly on UPSERT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bfi_hydro_doc_status_bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bfi_hydro_doc_status_bump_updated_at
    ON public.bfi_hydro_doc_status;
CREATE TRIGGER bfi_hydro_doc_status_bump_updated_at
BEFORE UPDATE ON public.bfi_hydro_doc_status
FOR EACH ROW EXECUTE FUNCTION public.bfi_hydro_doc_status_bump_updated_at();


-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Access via service-role only, matching the rest of the demo's capture
-- tables (bfi_esdd_responses, bfi_esrm_screenings, bfi_taxonomy_assessments,
-- bfi_climate_risk_assessments).

ALTER TABLE public.bfi_hydro_doc_status ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_hydro_doc_status FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON public.bfi_hydro_doc_status TO service_role;

-- Defence-in-depth policy: even if a role somehow gets SELECT, restrict
-- rows to a single tenant matching the JWT `bank_id` claim. Kept as a
-- comment because the demo currently uses service-role only.
-- CREATE POLICY tenant_scope_read ON public.bfi_hydro_doc_status
--     FOR SELECT
--     USING (bank_id = current_setting('request.jwt.claim.bank_id', true));

-- ============================================================================
-- Done. Next step:
--   1. Run this SQL in the Supabase SQL Editor.
--   2. Hit POST /api/admin/seed-demo-data to prime the Himal Power loan
--      with a mix of statuses so the panel has something to render.
-- ============================================================================
