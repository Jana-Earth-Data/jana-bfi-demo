-- ===========================================================================
-- 97-origin-column.sql — provenance for the OFFLINE stack
-- ===========================================================================
--
-- Byte-identical body to scripts/supabase-origin-column.sql, which is applied
-- by hand to Supabase Cloud. This copy runs automatically in the offline
-- Postgres, which has no migration runner.
--
-- Two copies is not ideal, but the alternatives are worse: a symlink breaks
-- the read-only bind mount, and pulling it from scripts/ would drag the whole
-- directory into the container. check-capture-client.mjs compares the table
-- list across BOTH files plus lib/data/capture-client.ts and fails the build
-- if any of the three drift.
--
-- Runs at 97, after every CREATE TABLE (10..96) and before 99-post-schema.
-- initdb runs on FIRST BOOT ONLY — an existing volume skips it entirely, so
-- an already-created offline stack needs `./run_demo.sh --offline --fresh`.
--
-- The backfill is a no-op here: the tables are empty at init time. The seeder
-- writes origin='demo' explicitly afterwards.
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
