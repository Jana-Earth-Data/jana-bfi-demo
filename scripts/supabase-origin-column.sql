-- ===========================================================================
-- Phase 3 — provenance on every capture table
-- ===========================================================================
--
-- THE REQUIREMENT
--   No demo-manufactured record may appear when demo mode is off.
--
-- Phases 1 and 2 separated the SYNTHESIZED layer: the 80,035-loan book, the
-- PCAF name fixtures, generated air quality. Those are computed, so removing
-- them was a matter of not computing them.
--
-- This is the CAPTURED layer, and it is different in kind. These are real
-- rows in real tables, written by the demo seeder and indistinguishable from
-- rows an officer created. Turning demo mode off emptied the loan book but
-- left Riya Sharma holding three assignments, a CAP item and a follow-up
-- against a portfolio containing zero loans.
--
-- You cannot compute your way out of that. The provenance has to be recorded
-- at write time, because after the fact there is nothing to distinguish a
-- seeded ESDD response from a genuine one.
--
-- THE RULE
--   origin = 'demo'  -- written while demo mode was ON (seeder, or an officer
--                       clicking through during a demo)
--   origin = 'live'  -- written while demo mode was OFF (real work)
--
--   Reads are partitioned strictly: demo mode on shows only 'demo', off shows
--   only 'live'. Not "off hides demo" -- strict both ways, so real captured
--   data cannot bleed into a demo either. A one-way filter is the kind that
--   looks correct until the direction you did not test.
--
-- WHY DEFAULT 'live'
--   A row written by code that has not been taught about origin is real work
--   by default. If the wiring is ever broken, the failure is a demo row
--   showing up in demo mode (visible, harmless) rather than a demo row
--   surviving into live (invisible, and the thing we are preventing).
--
-- WHY BACKFILL 'demo'
--   Every row that exists today was seeded or entered during demo work. There
--   is no live customer yet. Backfilling 'demo' is therefore accurate, and it
--   is the safe direction: mislabelling real data as demo would hide it, but
--   there is no real data to hide.
--
--   *** If that is not true by the time you run this -- if any real customer
--   data has been captured -- STOP and partition it by created_at or tenant
--   before running the backfill. ***
--
-- WHAT THIS DOES NOT DO
--   It does not delete anything. Seeded rows are labelled, never purged.
--   Startup reports what it finds (see scripts/check-seeded-rows.mjs); a
--   process that silently deletes rows it believes are demo is one bad
--   heuristic away from destroying customer data.
--
-- Idempotent. Safe to re-run.
-- ===========================================================================

BEGIN;

DO $$
DECLARE
  t text;
  capture_tables text[] := ARRAY[
    -- Officer-captured review data
    'bfi_loan_assignments',
    'bfi_taxonomy_assessments',
    'bfi_esrm_screenings',
    'bfi_esdd_responses',
    'bfi_cap_items',
    'bfi_evidence_attachments',
    'bfi_pf_screening_responses',
    'bfi_pf_screening_results',
    'bfi_pcaf_availability',
    'bfi_pcaf_evidence_docs',
    'bfi_covenants',
    'bfi_monitoring_reports',
    'bfi_climate_risk_assessments',
    'bfi_hydro_doc_status',
    'bfi_borrower_overrides',
    -- Denormalised mirror of the loan book. In a demo build these rows ARE
    -- the synthesized portfolio, so they carry provenance like everything else.
    'bfi_loans_denorm',
    -- Written by the seeder, therefore demo. A real deployment gets its own
    -- officer roster and tenant settings.
    'bfi_officers',
    'bfi_tenant_settings'
  ];
BEGIN
  FOREACH t IN ARRAY capture_tables LOOP
    -- Skip tables that do not exist in this environment. The offline stack
    -- and Supabase Cloud have drifted before; a missing table should not
    -- abort the migration for the other seventeen.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'skip % (table not present)', t;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'origin'
    ) THEN
      RAISE NOTICE 'skip % (origin already present)', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN origin text NOT NULL DEFAULT ''live''', t
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (origin IN (''demo'',''live''))',
      t, t || '_origin_check'
    );

    -- Backfill: everything that exists today predates provenance and is demo.
    EXECUTE format('UPDATE public.%I SET origin = ''demo''', t);

    -- Every read filters on origin, and most also filter on tenant_id.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, origin)',
        'idx_' || t || '_tenant_origin', t
      );
    ELSE
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (origin)',
        'idx_' || t || '_origin', t
      );
    END IF;

    RAISE NOTICE 'origin added to % (existing rows backfilled to demo)', t;
  END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification. Run this after the migration and keep the output.
-- Every table should report origin_rows = total_rows, and at this point
-- demo_rows should equal total_rows.
-- ---------------------------------------------------------------------------
--
--   SELECT table_name,
--          (SELECT count(*) FROM information_schema.columns c
--            WHERE c.table_schema='public' AND c.table_name=t.table_name
--              AND c.column_name='origin') AS has_origin
--     FROM information_schema.tables t
--    WHERE t.table_schema='public' AND t.table_name LIKE 'bfi_%'
--    ORDER BY 1;
