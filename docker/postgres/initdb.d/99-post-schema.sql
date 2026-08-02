-- ============================================================================
-- Offline demo — post-schema privileges + PostgREST schema reload signal
-- ============================================================================
-- Belt-and-suspenders privilege pass that runs LAST. Mirrors what Supabase
-- does when a table is added via its dashboard: the individual supabase-*.sql
-- files already GRANT service_role on each new table one at a time, but this
-- catches anything that slipped through and ensures every future extension
-- also inherits the correct posture.
--
-- Rules:
--   * `service_role` has BYPASSRLS + full CRUD on every public table + full
--     use of every public sequence.  This mirrors Supabase's semantics
--     exactly: server routes use the service-role JWT and get unfettered
--     access.
--   * `anon` gets USAGE on the schema but SELECT on nothing.  PostgREST will
--     still expose the /openapi endpoint (via the anon role) but every table
--     will 401/403 without a service-role JWT.
--   * `authenticated` is created for schema compatibility (Supabase creates
--     it for you) but is unused in the offline demo — the app hits everything
--     via the service-role key.
-- ============================================================================

-- Schema-level access
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- All existing tables — service_role gets full CRUD, anon/authenticated stay
-- locked out.  Individual scripts have already done this per-table; this is
-- a safety net for anything that slipped through.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON ALL TABLES IN SCHEMA public
    TO service_role;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Sequences (uuid PKs use gen_random_uuid() but any future serial columns
-- would need this).  Match Supabase's default posture — service_role gets
-- everything, anon nothing.
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Functions (bfi_*_touch triggers etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Default privileges for any tables/sequences/functions created AFTER the
-- initdb.d scripts have run.  Guarantees the same posture applies when a
-- migration adds a new object during a demo session.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO service_role;

-- PostgREST notices new tables via a schema-cache reload triggered by a
-- NOTIFY on the pgrst channel.  Not strictly needed on first boot (PostgREST
-- discovers everything at startup) but future manual SQL changes can trigger
-- a live reload by running:  NOTIFY pgrst, 'reload schema';
