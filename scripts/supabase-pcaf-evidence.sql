-- ============================================================================
-- BFI Demo — PCAF evidence document status
-- ============================================================================
-- Backs lib/regulatory/pcaf/evidence-matrix.ts.
--
-- Why this table exists
-- ---------------------
-- The PCAF availability flags decide a loan's data-quality score, and that
-- score is disclosed. Until now the flags were either inferred or asserted by
-- an officer, and nothing recorded WHY a flag was true. Two of the five were
-- inferred from a hardcoded list of borrower names in scoring.ts, which is
-- demo scaffolding rather than evidence.
--
-- This table records the document review that establishes each flag: what was
-- asked for, what came back, whether anyone read it, and which reporting year
-- it covers. An auditor asking "show me the basis for Score 1 on this
-- borrower" now has something to read.
--
-- Scoped per BORROWER, not per loan
-- ---------------------------------
-- Whether a borrower publishes an assured GHG inventory is a fact about the
-- borrower. Reviewing it once should serve every loan the bank has to them.
-- This mirrors bfi_pcaf_availability, which is already borrower-scoped, and
-- differs deliberately from bfi_hydro_doc_status, where the required document
-- set depends on the individual project's capacity band.
--
-- Reporting year
-- --------------
-- PCAF is re-run annually. A 2024 annual report supports a FY2024 disclosure
-- and is stale for FY2025. bfi_evidence_attachments records only uploaded_at,
-- which is when the bank filed the PDF, not what period it covers -- so the
-- year is captured here explicitly and evidence-matrix.ts treats a verified
-- document from an earlier year as no longer supporting the claim.
--
-- The document files themselves continue to live in
-- bfi_evidence_attachments, keyed (entity_type='pcaf_availability',
-- entity_id=<borrower_id>, field_key='doc_<document_id>'). This table holds
-- the review state; that one holds the bytes.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bfi_pcaf_evidence_docs (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id           text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    borrower_id       text        NOT NULL,
    officer_id        text        REFERENCES public.bfi_officers(id),

    -- Document primary key from lib/regulatory/pcaf/evidence-matrix.ts
    -- (e.g. "assurance-opinion", "ghg-inventory", "production-records").
    -- Text rather than an enum so the catalogue can grow without a migration.
    document_id       text        NOT NULL,

    -- Lifecycle. Text + CHECK for the same reason as bfi_hydro_doc_status:
    -- renaming a status stays a code change plus one line of SQL.
    --
    -- 'unavailable' is deliberately distinct from 'not-collected'.
    -- Establishing that a borrower does NOT publish emissions is a finding,
    -- and it is the finding that justifies dropping to Score 4 or 5. Without
    -- it there is no way to distinguish checked-and-absent from unchecked.
    status            text        NOT NULL DEFAULT 'not-collected'
                                  CHECK (status IN
                                    ('not-applicable',
                                     'not-collected',
                                     'requested',
                                     'received',
                                     'verified',
                                     'unavailable')),

    -- Reporting year the document covers. Nullable: an officer can mark a
    -- document requested before knowing which year will come back.
    reporting_year    integer     CHECK (reporting_year IS NULL
                                         OR (reporting_year BETWEEN 1990 AND 2100)),

    -- Officer note, e.g. "2024 report published Sept 2025, no assurance
    -- statement; confirmed with CFO that none was commissioned".
    notes             text,

    captured_at       timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    UNIQUE (bank_id, borrower_id, document_id)
);

-- Panel fetch: everything for one borrower.
CREATE INDEX IF NOT EXISTS bfi_pcaf_evidence_bank_borrower_idx
    ON public.bfi_pcaf_evidence_docs (bank_id, borrower_id);

-- Portfolio rollup: "which borrowers still have outstanding PCAF evidence".
-- Partial, because the resolved rows are the majority once review is under
-- way and the query only ever asks about the unresolved ones.
CREATE INDEX IF NOT EXISTS bfi_pcaf_evidence_outstanding_idx
    ON public.bfi_pcaf_evidence_docs (bank_id, borrower_id)
    WHERE status IN ('not-collected', 'requested', 'received');

COMMENT ON TABLE public.bfi_pcaf_evidence_docs IS
  'Per-borrower PCAF evidence review. Each row is one document from the catalogue in lib/regulatory/pcaf/evidence-matrix.ts, with the status of the review and the reporting year it covers. Verified in-year rows establish the corresponding data-availability flag; see resolveAvailability().';

COMMENT ON COLUMN public.bfi_pcaf_evidence_docs.status IS
  'not-applicable | not-collected | requested | received | verified | unavailable. Only "verified" establishes a claim: "received" means on file but unread, and an unread document is not evidence.';

COMMENT ON COLUMN public.bfi_pcaf_evidence_docs.reporting_year IS
  'Reporting year the document covers, not the year it was filed. A verified document from a year earlier than the disclosure year is treated as stale and does not support the claim.';

-- ============================================================================
-- Done. Run this SQL in the Supabase SQL Editor.
-- The offline stack picks it up automatically via
-- docker/postgres/initdb.d/ on a fresh volume.
-- ============================================================================
