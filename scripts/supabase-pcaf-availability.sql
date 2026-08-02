-- ============================================================================
-- BFI Demo — PCAF data-availability override table
-- ============================================================================
-- Per-borrower manual override for the flags used by the PCAF §5 decision
-- tree (`lib/regulatory/pcaf/scoring.ts`).
--
-- The demo default is to *infer* the flags from the borrower catalog (see
-- `inferPcafAvailability` — Climate TRACE match → physical_activity_data,
-- publiclyListed → revenue_data, name-substring match → publishes_verified /
-- unverified).  This table lets an analyst override the inference on a
-- per-borrower basis after reviewing the borrower's actual annual report /
-- ISO 14064 assurance statement.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP TABLE IF EXISTS public.bfi_pcaf_availability CASCADE;

CREATE TABLE public.bfi_pcaf_availability (
    -- Identity ---------------------------------------------------------------
    bank_id                              text        NOT NULL,
    borrower_id                          text        NOT NULL,

    -- Availability flags (all default false; Score 5 is the fallback) --------
    borrower_publishes_verified          boolean     NOT NULL DEFAULT false,
    borrower_publishes_unverified        boolean     NOT NULL DEFAULT false,
    energy_consumption_data_available    boolean     NOT NULL DEFAULT false,
    physical_activity_data_available     boolean     NOT NULL DEFAULT false,
    revenue_data_available               boolean     NOT NULL DEFAULT false,
    sector_average_only                  boolean     NOT NULL DEFAULT true,
    out_of_scope                         boolean     NOT NULL DEFAULT false,

    -- Provenance -------------------------------------------------------------
    -- What the analyst looked at to set these flags.  Free-form.
    -- Examples: "Ghorahi Cement 2024 annual report, KPMG assurance opinion,
    -- pages 42-46".
    evidence_note                        text,
    -- PCAF Part A citation for the option letter this override maps to.
    -- Set on save from the compute engine; useful for auditor export.
    pcaf_citation                        text,

    -- Timestamps -------------------------------------------------------------
    captured_at                          timestamptz NOT NULL DEFAULT now(),
    captured_by                          text,
    updated_at                           timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (bank_id, borrower_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX bfi_pcaf_availability_bank_idx
    ON public.bfi_pcaf_availability (bank_id);
CREATE INDEX bfi_pcaf_availability_verified_idx
    ON public.bfi_pcaf_availability (bank_id)
    WHERE borrower_publishes_verified = true;

-- ============================================================================
-- Permissions
-- ============================================================================
-- Same posture as the other bfi_* tables: reachable only via the service-role
-- key from Next.js server routes.  RLS enabled + a single permissive policy
-- for service-role clients.

ALTER TABLE public.bfi_pcaf_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bfi_pcaf_availability_service_role
    ON public.bfi_pcaf_availability;
CREATE POLICY bfi_pcaf_availability_service_role
    ON public.bfi_pcaf_availability
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- Trigger — keep updated_at fresh on any UPDATE.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bfi_pcaf_availability_touch()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bfi_pcaf_availability_touch
    ON public.bfi_pcaf_availability;
CREATE TRIGGER bfi_pcaf_availability_touch
    BEFORE UPDATE ON public.bfi_pcaf_availability
    FOR EACH ROW
    EXECUTE FUNCTION public.bfi_pcaf_availability_touch();

-- ============================================================================
-- Optional seed
-- ============================================================================
-- The demo synthesizer already flags:
--   - Ghorahi Cement            → Score 1 (verified)
--   - Arghakhanchi Cement       → Score 2 (unverified)
--   - Hetauda Cement            → Score 2 (unverified)
--   - Butwal Power Company Ltd  → Score 2 (unverified)
-- via NAME_SUBSTRING_* lists in `lib/regulatory/pcaf/scoring.ts`, so this
-- table only needs rows when an analyst wants to *override* the inference
-- (e.g. flip a borrower off verified because the assurance opinion expired).
