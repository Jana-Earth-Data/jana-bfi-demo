-- ============================================================================
-- BFI Demo — Supabase schema
-- ============================================================================
-- Run this once in the Supabase SQL Editor for the project that holds the
-- demo data. Idempotent: re-running drops and recreates the table cleanly.
--
-- Strategy: a single denormalized table holds everything the Loan Book tab
-- needs for filtered pagination. The dashboard summary / aggregates stay
-- computed in the Node process (small, cheap), so we don't need a forest of
-- tables for the demo.
-- ============================================================================

-- One-shot reset. Safe because nothing else depends on this table.
DROP TABLE IF EXISTS public.bfi_loans_denorm CASCADE;

CREATE TABLE public.bfi_loans_denorm (
    -- Loan identification
    id                       text        PRIMARY KEY,
    borrower_id              text        NOT NULL,
    borrower_name            text        NOT NULL,
    borrower_sector          text        NOT NULL,
    borrower_ev_usd          bigint      NOT NULL DEFAULT 0,
    borrower_data_tier       text,         -- 'facility' / 'sector-benchmark' / 'revenue-estimate' / 'n/a'

    -- Loan attributes
    product                  text        NOT NULL,
    category                 text,         -- 'retail-mortgage' / 'sme-working-capital' / ...
    business_unit            text,         -- 'Retail' / 'SME' / 'Corporate' / 'Project Finance'
    branch                   text,
    branch_code              text,
    outstanding_npr          bigint      NOT NULL,
    outstanding_usd          bigint      NOT NULL,
    disbursed_date           date,
    maturity_date            date,
    status                   text        NOT NULL,
    nrb_taxonomy             text        NOT NULL,    -- 'green' / 'amber' / 'red' / 'unclassified'
    purpose                  text,

    -- PCAF attribution (denormalized for fast read)
    methodology              text,
    attribution_factor       numeric(10,8) NOT NULL DEFAULT 0,
    attributed_co2e_tonnes   bigint      NOT NULL DEFAULT 0,
    data_quality_score       smallint    NOT NULL DEFAULT 5,
    quality_note             text
);

-- ============================================================================
-- Indexes
-- ============================================================================
-- Single-column indexes for the common sort axes
CREATE INDEX bfi_loans_outstanding_npr_desc_idx
    ON public.bfi_loans_denorm (outstanding_npr DESC);

CREATE INDEX bfi_loans_attributed_co2e_desc_idx
    ON public.bfi_loans_denorm (attributed_co2e_tonnes DESC);

CREATE INDEX bfi_loans_disbursed_desc_idx
    ON public.bfi_loans_denorm (disbursed_date DESC);

-- Filter columns
CREATE INDEX bfi_loans_taxonomy_idx     ON public.bfi_loans_denorm (nrb_taxonomy);
CREATE INDEX bfi_loans_business_unit_idx ON public.bfi_loans_denorm (business_unit);
CREATE INDEX bfi_loans_sector_idx       ON public.bfi_loans_denorm (borrower_sector);
CREATE INDEX bfi_loans_category_idx     ON public.bfi_loans_denorm (category);
CREATE INDEX bfi_loans_status_idx       ON public.bfi_loans_denorm (status);
CREATE INDEX bfi_loans_branch_idx       ON public.bfi_loans_denorm (branch_code);
CREATE INDEX bfi_loans_borrower_idx     ON public.bfi_loans_denorm (borrower_id);

-- Trigram index for free-text search across loan id, borrower name, branch
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX bfi_loans_text_search_idx
    ON public.bfi_loans_denorm
    USING gin ((id || ' ' || borrower_name || ' ' || coalesce(branch, '') || ' ' || borrower_sector) gin_trgm_ops);

-- ============================================================================
-- Permissions
-- ============================================================================
-- We access this table only with the service-role key from Next.js server
-- routes, so RLS is not strictly required. Enable it anyway and add a single
-- permissive policy gated by the service role, so anon-key access is blocked
-- as a defence-in-depth measure.
ALTER TABLE public.bfi_loans_denorm ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default, so no policy needed for our reads.
-- Lock down anon access explicitly:
REVOKE ALL ON public.bfi_loans_denorm FROM anon;
REVOKE ALL ON public.bfi_loans_denorm FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_loans_denorm TO service_role;

-- ============================================================================
-- Done. Next step: hit POST /api/admin/seed?token=<SEED_ADMIN_TOKEN> from
-- the running app to populate this table from the in-memory synthesizer.
-- ============================================================================
