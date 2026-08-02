-- ============================================================================
-- BFI Demo — Climate risk overrides (NRB ESRM 2022 §4.1 / §4.3)
-- ============================================================================
-- Optional per-borrower persistence for the NGFS climate risk categorisation
-- and the 25,000 tCO2e/yr GHG reporting threshold flag.
--
-- The demo computes both from the borrower's sector + emissions signals
-- (see lib/regulatory/climate/infer.ts). This table lets an ESRM officer
-- override the inferred values with an assessed record — the columns
-- mirror BorrowerClimateRisk + BorrowerEmissionsFlag from
-- lib/regulatory/climate/types.ts.
--
-- Idempotent: safe to re-run. Scoped by bank_id so multiple tenants can
-- demo without cross-contamination.
--
-- Run in the Supabase SQL Editor after scripts/supabase-capture-schema.sql
-- (which creates bfi_banks + bfi_officers referenced here as FKs).
-- ============================================================================

DROP TABLE IF EXISTS public.bfi_climate_risk_assessments CASCADE;

CREATE TABLE public.bfi_climate_risk_assessments (
    id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                   text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    borrower_id               text        NOT NULL,          -- matches Borrower.id in the demo catalogue
    officer_id                text                REFERENCES public.bfi_officers(id),

    -- NGFS physical risk categories (NRB ESRM 2022 §4.1). Stored as text[]
    -- to preserve the verbatim NGFS wording — the code enforces the enum.
    physical_risks            text[]      NOT NULL DEFAULT '{}',
    -- NGFS transition risk categories (Policy / Technology / Market /
    -- Reputation) — same shape as physical_risks.
    transition_risks          text[]      NOT NULL DEFAULT '{}',
    overall_rating            text        NOT NULL CHECK (overall_rating IN
                                                ('low','medium','high')),

    -- 25,000 tCO2e/yr threshold flag (NRB ESRM 2022 §4.3, ESDD Q2.5)
    estimated_annual_tco2e    bigint      NOT NULL DEFAULT 0,
    reduction_target_on_file  boolean     NOT NULL DEFAULT false,
    target_details            text,

    -- Audit trail
    assessed_by               text        NOT NULL,          -- officer id, "system: ...", or override reason
    assessed_at               timestamptz NOT NULL DEFAULT now(),
    remarks                   text
);

-- Look up the latest assessment per (bank, borrower) fast. Assessment
-- history is preserved by not de-duplicating — the newest row wins.
CREATE INDEX bfi_climate_bank_borrower_idx
    ON public.bfi_climate_risk_assessments (bank_id, borrower_id);
CREATE INDEX bfi_climate_assessed_desc_idx
    ON public.bfi_climate_risk_assessments (assessed_at DESC);

-- Compliance-relevant subset: above threshold without reduction target.
-- Partial index so the NFRS callout query (see the NFRS tab) stays cheap.
CREATE INDEX bfi_climate_above_threshold_no_target_idx
    ON public.bfi_climate_risk_assessments (bank_id, borrower_id)
    WHERE estimated_annual_tco2e >= 25000
      AND reduction_target_on_file = false;

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Access via service-role only, matching the rest of the demo's capture
-- tables (bfi_esdd_responses, bfi_esrm_screenings, bfi_taxonomy_assessments).
ALTER TABLE public.bfi_climate_risk_assessments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_climate_risk_assessments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON public.bfi_climate_risk_assessments TO service_role;

-- Defence-in-depth policy: even if a role somehow gets SELECT, restrict
-- rows to a single tenant matching the JWT `bank_id` claim. Kept as a
-- policy comment because the demo currently uses service-role only.
-- CREATE POLICY tenant_scope_read ON public.bfi_climate_risk_assessments
--     FOR SELECT
--     USING (bank_id = current_setting('request.jwt.claim.bank_id', true));

-- ============================================================================
-- Done. Next step: any officer edit made via the ESRM tab is written here
-- with (bank_id, borrower_id, officer_id, ...). The GET /api/climate/borrower
-- route reads the latest row per (bank_id, borrower_id) and overlays it on
-- top of the inferred values from lib/regulatory/climate/infer.ts.
-- ============================================================================
