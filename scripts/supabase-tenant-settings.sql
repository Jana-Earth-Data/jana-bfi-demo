-- ============================================================================
-- BFI Demo — Tenant Settings (per-bank configuration blob)
-- ============================================================================
-- One row per tenant. `settings` is a free-form JSONB blob whose shape is
-- codified in lib/settings/types.ts and validated + merged with defaults
-- via lib/settings/schema.ts resolveSettings() at read time. Storing as a
-- JSONB blob rather than a normalised table means: adding a new setting is
-- a one-file TS edit, no migration; officers can save partial updates and
-- the read side rehydrates the missing keys from defaults.
--
-- Same RLS + service-role posture as bfi_hydro_doc_status and every other
-- capture table in the demo: RLS on, everything revoked from anon /
-- authenticated, service_role has full CRUD, tenant scoping enforced at
-- the application layer via resolveCurrentTenant().
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP TABLE IF EXISTS public.bfi_tenant_settings CASCADE;

CREATE TABLE public.bfi_tenant_settings (
    -- One row per bank. bank_id doubles as the primary key + the unique
    -- constraint upsert POST /api/settings targets.
    bank_id     text        PRIMARY KEY,

    -- Free-form JSONB blob. Shape codified in lib/settings/types.ts.
    -- Defaults live in code (lib/settings/defaults.ts) not in this
    -- column, so evolving the defaults doesn't require a migration.
    settings    jsonb       NOT NULL DEFAULT '{}'::jsonb,

    -- Audit — updated_by is an officer id (bfi_officers.id) but not
    -- enforced as an FK to keep the seed path portable across
    -- environments where the officer table may be empty.
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  text,

    -- Optimistic-concurrency version. Bumped by POST /api/settings on
    -- every write. Reserved for a future "settings changed underneath
    -- you" collision detector; not read yet.
    version     int         NOT NULL DEFAULT 1
);


-- ---------------------------------------------------------------------------
-- Bump updated_at on UPDATE
-- ---------------------------------------------------------------------------
-- Shares the same trigger function as bfi_cap_items / bfi_covenants
-- (bfi_cap_bump_updated_at). We recreate a local function scoped to this
-- table so this file stays independently runnable — supabase-cap.sql
-- doesn't have to be applied first for this trigger to install.
CREATE OR REPLACE FUNCTION public.bfi_tenant_settings_bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bfi_tenant_settings_bump_updated_at
    ON public.bfi_tenant_settings;
CREATE TRIGGER bfi_tenant_settings_bump_updated_at
BEFORE UPDATE ON public.bfi_tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.bfi_tenant_settings_bump_updated_at();


-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Access via service-role only, matching the rest of the demo's capture
-- tables. Tenant scoping is enforced at the application layer through
-- resolveCurrentTenant() before every query.

ALTER TABLE public.bfi_tenant_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_tenant_settings FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON public.bfi_tenant_settings TO service_role;

-- ============================================================================
-- Done. Next step:
--   1. Run this SQL in the Supabase SQL Editor.
--   2. Hit POST /api/admin/seed-demo-data to prime each tenant's row.
-- ============================================================================
