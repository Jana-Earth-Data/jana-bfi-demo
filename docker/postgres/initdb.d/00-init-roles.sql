-- ============================================================================
-- Offline demo — PostgREST roles bootstrap
-- ============================================================================
-- Postgres runs the files in this directory in lexical order on first boot.
-- This one MUST run before any of the supabase-*.sql scripts because those
-- scripts REVOKE / GRANT against the "anon", "authenticated", and
-- "service_role" roles that Supabase creates for you but bare Postgres does
-- not.
--
-- Notes:
--   * `service_role` gets BYPASSRLS to mirror Supabase's semantics — every
--     Row Level Security policy in the demo assumes the service role can
--     see everything.
--   * `anon` and `authenticated` are created NOLOGIN — PostgREST authenticator
--     switches into them via SET ROLE based on the JWT claim.
--   * We GRANT the three roles TO the "postgres" superuser so PostgREST's
--     authenticator (running as postgres) can SET ROLE into any of them.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT anon           TO postgres;
GRANT authenticated  TO postgres;
GRANT service_role   TO postgres;

-- pgcrypto is available in Postgres core but the extension needs to be
-- explicitly enabled for gen_random_uuid() to resolve in some builds.
-- Postgres 13+ has gen_random_uuid() in core so this is defensive.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
