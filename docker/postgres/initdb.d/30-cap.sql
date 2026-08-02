-- ============================================================================
-- BFI Demo — Corrective Action Plan + E&S Covenants + Monitoring
-- ============================================================================
-- Persistence for NRB Circular 22:
--   * §7.3.5 — time-bound Corrective Action Plan (Annex 8) + E&S covenants
--     (Annex 9) for every loan rated Medium / High / Extreme ESRR
--   * §7.3.7 — periodic monitoring using the Annex 10 checklist
--
-- Three tables — each a first-class capture surface for the officer:
--   bfi_cap_items          One row per CAP item (Annex 8 six-column table)
--   bfi_covenants          One row per covenant attached to a loan (Annex 9)
--   bfi_monitoring_reports One row per monitoring cycle (Annex 10 snapshot)
--
-- All three follow the same RLS + service-role posture as
-- bfi_hydro_doc_status: RLS on, everything revoked from anon/authenticated,
-- service_role has full CRUD, tenant scoping done at the application layer
-- via resolveCurrentTenant().
--
-- Idempotent: safe to re-run. Follows the ESRM capture-table conventions in
-- scripts/supabase-capture-schema.sql (bfi_banks + bfi_officers FKs).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) bfi_cap_items — Annex 8 rows
-- ---------------------------------------------------------------------------
-- Verbatim column mapping from NRB Circular 22 Annex 8 (Sample Corrective
-- Action Plan template, ESRM Guideline PDF p. 65):
--   area_of_concern       — "Area of E&S concern as identified through ESDD"
--   corrective_action     — "Corrective Actions required"
--   deadline_date         — "Date for Completion"
--   completion_indicator  — "Action completion indicator"
--   responsible_party     — "Responsibility (Client staff, management or board)"
--   cost_npr              — "Cost involved" (nullable — Annex 8 leaves this
--                            blank for two of its three sample rows)
--
-- Additional non-Annex 8 fields we need for a live workbench:
--   status                — lifecycle pill (not_started/in_progress/completed/overdue)
--   linked_esdd_question_id — pointer to the ESDD "c" answer that raised
--                             this CAP row (nullable — some CAP items are
--                             added ad-hoc during monitoring per §7.3.7)
DROP TABLE IF EXISTS public.bfi_cap_items CASCADE;

CREATE TABLE public.bfi_cap_items (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                  text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id                  text        NOT NULL,       -- foreign to bfi_loans_denorm.id (no FK; may be an override)
    borrower_id              text        NOT NULL,

    -- Annex 8 columns (verbatim)
    area_of_concern          text        NOT NULL,
    corrective_action        text        NOT NULL,
    deadline_date            date,                       -- nullable — perpetual actions or TBD
    completion_indicator     text,
    responsible_party        text,                       -- free text — Annex 8 shows "Board" / "Management" / "Client staff" but banks phrase this per role
    cost_npr                 numeric,                    -- Annex 8 "Cost involved" — nullable

    -- Lifecycle. Kept as text + CHECK so future demo-only statuses (e.g.
    -- "waived") can be added with a one-line SQL change instead of an
    -- ALTER TYPE round trip.
    status                   text        NOT NULL DEFAULT 'not_started'
                                          CHECK (status IN
                                            ('not_started',
                                             'in_progress',
                                             'completed',
                                             'overdue')),

    -- Optional back-reference to the ESDD "c" answer this CAP row was
    -- raised from — populated when deriveCapFromEscalation seeds a row
    -- straight off the screening driver, cleared when officers add
    -- monitoring-cycle CAP items ad-hoc per §7.3.7.
    linked_esdd_question_id  text,

    -- Audit
    created_by               text        REFERENCES public.bfi_officers(id),
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup by (bank, loan) for the panel's on-open fetch.
CREATE INDEX bfi_cap_items_bank_loan_idx
    ON public.bfi_cap_items (bank_id, loan_id);

-- Partial index over open items ordered by deadline so the P26 reminder
-- engine can surface "CAP items due this month" cheaply. Only rows that
-- are not yet completed count as open.
CREATE INDEX bfi_cap_items_bank_deadline_open_idx
    ON public.bfi_cap_items (bank_id, deadline_date)
    WHERE status <> 'completed';


-- ---------------------------------------------------------------------------
-- 2) bfi_covenants — Annex 9 rows
-- ---------------------------------------------------------------------------
-- Covenant text is stored verbatim in the row (rather than an FK into a
-- covenant library table) so historical rows survive library edits and
-- the loan-agreement paper trail matches exactly what was signed.
-- library_template_id is a soft reference to lib/regulatory/cap/library.ts
-- and lets the panel highlight "this row is unedited from the template".
DROP TABLE IF EXISTS public.bfi_covenants CASCADE;

CREATE TABLE public.bfi_covenants (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id             text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id             text        NOT NULL,
    borrower_id         text        NOT NULL,

    -- Annex 9 five-way classification. cap_covenant is the sixth type
    -- introduced by Annex 9's own guidance ("Corrective Action Plan is
    -- typically included as an annex to the legal agreement…").
    covenant_type       text        NOT NULL CHECK (covenant_type IN
                                        ('positive',
                                         'negative',
                                         'condition_precedent',
                                         'event_of_default',
                                         'cap_covenant')),

    -- Verbatim clause text as inserted into the loan agreement. Copied
    -- from the library entry then optionally edited by legal.
    clause_text         text        NOT NULL,

    -- Optional deadline — perpetual covenants (most positives, most
    -- negatives) leave this null; condition_precedent + cap_covenant
    -- usually have one.
    deadline_date       date,

    -- Lifecycle for the covenant panel. Kept as text + CHECK.
    status              text        NOT NULL DEFAULT 'active'
                                     CHECK (status IN
                                        ('active',
                                         'breached',
                                         'waived',
                                         'expired')),

    -- Soft reference to a COVENANT_LIBRARY entry in lib/regulatory/cap/library.ts.
    -- Null when legal drafted this covenant from scratch. When set + the
    -- clause_text matches the library entry byte-for-byte, the panel
    -- shows "Library template (unedited)".
    library_template_id text,

    -- Audit
    created_by          text        REFERENCES public.bfi_officers(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bfi_covenants_bank_loan_idx
    ON public.bfi_covenants (bank_id, loan_id);


-- ---------------------------------------------------------------------------
-- 3) bfi_monitoring_reports — Annex 10 rows
-- ---------------------------------------------------------------------------
-- One row per monitoring cycle. checklist_snapshot captures the officer's
-- Annex 10 13-item responses at submission — pinned so re-runs of the
-- library don't rewrite history.
-- next_due_date is the field the P26 reminder engine polls to surface
-- "monitoring due this month" in the officer's My Work tab.
DROP TABLE IF EXISTS public.bfi_monitoring_reports CASCADE;

CREATE TABLE public.bfi_monitoring_reports (
    id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id                       text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    loan_id                       text        NOT NULL,
    borrower_id                   text        NOT NULL,

    -- Annex 10 Sl. 1: "Reporting period covered by this supervision report"
    reporting_period_start        date        NOT NULL,
    reporting_period_end          date        NOT NULL,

    -- Derived: the next cycle's due date. Driven by frequencyForRiskClass
    -- helper — extreme=1mo, high=3mo, medium=6mo, low=12mo.
    next_due_date                 date        NOT NULL,
    frequency_months              int         NOT NULL CHECK (frequency_months IN (1,3,6,12)),

    -- Annex 10 Sl. 4: "Status of implementation of covenants / corrective
    -- action plan". Enum matches the four-way Annex 10 phrasing exactly:
    -- fully implemented, partially implemented, not implemented, delayed.
    covenant_compliance_status    text        NOT NULL CHECK (covenant_compliance_status IN
                                                ('fully','partial','not','delayed')),
    cap_compliance_status         text        NOT NULL CHECK (cap_compliance_status IN
                                                ('fully','partial','not','delayed')),

    -- Free-text notes — Annex 10's RM-response column bleeds through here.
    notes                         text,

    -- 13-item Annex 10 responses at submission time. Shape:
    --   { "annex10.<n>": { response: string, flag: "ok"|"issue"|"n/a" } }
    -- Snapshot rather than a normalised responses table because Annex 10
    -- items rarely change and this keeps the whole cycle in one row.
    checklist_snapshot            jsonb       NOT NULL DEFAULT '{}'::jsonb,

    -- Audit
    submitted_by                  text        NOT NULL REFERENCES public.bfi_officers(id),
    submitted_at                  timestamptz NOT NULL DEFAULT now(),
    created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bfi_monitoring_reports_bank_loan_idx
    ON public.bfi_monitoring_reports (bank_id, loan_id);
CREATE INDEX bfi_monitoring_reports_bank_next_due_idx
    ON public.bfi_monitoring_reports (bank_id, next_due_date);


-- ---------------------------------------------------------------------------
-- Bump updated_at on UPDATE for the two mutable tables
-- (monitoring reports are append-only per cycle — no updated_at trigger).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bfi_cap_bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bfi_cap_items_bump_updated_at ON public.bfi_cap_items;
CREATE TRIGGER bfi_cap_items_bump_updated_at
BEFORE UPDATE ON public.bfi_cap_items
FOR EACH ROW EXECUTE FUNCTION public.bfi_cap_bump_updated_at();

DROP TRIGGER IF EXISTS bfi_covenants_bump_updated_at ON public.bfi_covenants;
CREATE TRIGGER bfi_covenants_bump_updated_at
BEFORE UPDATE ON public.bfi_covenants
FOR EACH ROW EXECUTE FUNCTION public.bfi_cap_bump_updated_at();


-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Access via service-role only, matching the rest of the demo's capture
-- tables. Tenant scoping is enforced at the application layer through
-- resolveCurrentTenant() before every query.

ALTER TABLE public.bfi_cap_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_covenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfi_monitoring_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_cap_items          FROM anon, authenticated;
REVOKE ALL ON public.bfi_covenants          FROM anon, authenticated;
REVOKE ALL ON public.bfi_monitoring_reports FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_cap_items          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_covenants          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.bfi_monitoring_reports TO service_role;

-- ============================================================================
-- Done. Next step:
--   1. Run this SQL in the Supabase SQL Editor.
--   2. Hit POST /api/admin/seed-demo-data to prime the Hongshi cement
--      loan with 3 CAP items + 4 covenants + 1 monitoring cycle.
-- ============================================================================
