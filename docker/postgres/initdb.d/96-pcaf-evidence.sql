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
-- Scope: mostly borrower, sometimes loan
-- --------------------------------------
-- Whether a borrower publishes an assured GHG inventory is a fact about the
-- borrower, so reviewing it once serves every loan the bank has to them.
-- Those rows carry loan_id IS NULL.
--
-- Activity evidence is different. PCAF Part A 3rd Edition §5.3 attributes
-- project-finance emissions to the PROJECT: the numerator is the project's
-- physical output, not the company's total. A hydro developer with five
-- plants where the bank financed one needs that plant's generation figures.
-- So production and energy records carry a loan_id when the loan is project
-- finance, and NULL otherwise. See evidenceScopeKey() in
-- lib/regulatory/pcaf/evidence-matrix.ts.
--
-- Known limitation: bfi_pcaf_availability remains keyed
-- (bank_id, borrower_id), so the resolved FLAGS are still borrower-level
-- even where the evidence behind them is project-scoped. Two project-finance
-- loans to the same borrower cannot yet carry different flag sets. Recording
-- the evidence correctly now means that fix is a change to one table rather
-- than a re-collection exercise.
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
-- Note the asymmetry, which is intentional: review state can be loan-scoped
-- but FILES never are. The attachment key has no loan component, so an
-- officer uploads a borrower's annual report once and every loan to that
-- borrower sees it. Adding loan_id to the attachment key would force the
-- same PDF to be uploaded per facility. Two project-finance loans to one
-- developer therefore share a document library while reaching their own
-- conclusions about their own plant. bfi_evidence_attachments indexes its
-- key non-uniquely, so one key holds as many files as the review needs.
--
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bfi_pcaf_evidence_docs (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id           text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,
    borrower_id       text        NOT NULL,

    -- NULL for company-level documents (the common case); set for activity
    -- documents on project-finance loans, per PCAF §5.3. No FK: loan ids
    -- come from the synthesized book, matching bfi_hydro_doc_status.
    loan_id           text,

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

    -- Uniqueness has to treat NULL loan_id as a value, which a plain UNIQUE
    -- constraint will not do: two NULL loan_ids would not collide and the
    -- borrower-level row could be inserted twice. Enforced by the two
    -- partial indexes below instead.
    CONSTRAINT bfi_pcaf_evidence_scope_ck CHECK (
        loan_id IS NULL OR length(loan_id) > 0
    )
);

-- One borrower-level row per document.
CREATE UNIQUE INDEX IF NOT EXISTS bfi_pcaf_evidence_borrower_uk
    ON public.bfi_pcaf_evidence_docs (bank_id, borrower_id, document_id)
    WHERE loan_id IS NULL;

-- One loan-level row per document per loan.
CREATE UNIQUE INDEX IF NOT EXISTS bfi_pcaf_evidence_loan_uk
    ON public.bfi_pcaf_evidence_docs (bank_id, borrower_id, document_id, loan_id)
    WHERE loan_id IS NOT NULL;

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

COMMENT ON COLUMN public.bfi_pcaf_evidence_docs.loan_id IS
  'NULL for company-level documents, which serve every loan to the borrower. Set for activity documents (production, energy) on project-finance loans, where PCAF 5.3 scopes the numerator to the financed project rather than the company.';

COMMENT ON COLUMN public.bfi_pcaf_evidence_docs.reporting_year IS
  'Reporting year the document covers, not the year it was filed. A verified document from a year earlier than the disclosure year is treated as stale and does not support the claim.';

-- ============================================================================
-- Done. Run this SQL in the Supabase SQL Editor.
-- The offline stack picks it up automatically via
-- docker/postgres/initdb.d/ on a fresh volume.
-- ============================================================================
