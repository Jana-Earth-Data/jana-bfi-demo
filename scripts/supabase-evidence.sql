-- ============================================================================
-- BFI Demo — Evidence attachments (P31)
-- ============================================================================
-- One row per uploaded file attached to any "remarks-style" field across the
-- platform: ESDD wizard answers, CAP items, covenants, monitoring reports,
-- PCAF availability flags, PF screening items. Analysts drop in the source
-- PDF / image / Word doc that supports whatever they wrote in the paired
-- textarea, so the audit trail carries both the narrative and the primary
-- evidence next to it.
--
-- Design notes
-- ------------
-- 1) Blob storage, not Supabase Storage. This is demo scale — a handful of
--    files per loan at most — and Storage adds a bucket policy + presigned
--    URL round-trip that the demo doesn't need. Keeping the bytes in the
--    same Postgres row also means /api/admin/reset can wipe evidence in one
--    DELETE like every other capture table.
--
-- 2) `bytea` chosen over `text`+base64. The Supabase JS client handles bytea
--    fine when the payload is uploaded via multipart to a Next.js route (the
--    route reads `file.arrayBuffer()`, hands Buffer to `.insert()`). Reads
--    stream the raw bytes back out through a Node Response with the correct
--    Content-Type. Base64 would inflate storage ~33% for no win.
--
-- 3) Keyed by (bank_id, entity_type, entity_id, field_key) rather than a
--    single opaque owner_id. Every remarks-bearing surface already has a
--    stable (entity_type, entity_id, field_key) triple (loanId + questionId
--    for ESDD, capItem.id + 'evidence' for CAP items, borrowerId + 'row_1a'
--    for PCAF, etc.), and the lookup index below makes list-by-triple cheap.
--
-- 4) Service-role only, matching every other bfi_* capture table. Tenant
--    isolation is enforced at the app layer via resolveCurrentTenant()
--    before every query — RLS is on as belt-and-suspenders.
--
-- Idempotent: safe to re-run.
-- ============================================================================

DROP TABLE IF EXISTS public.bfi_evidence_attachments CASCADE;

CREATE TABLE public.bfi_evidence_attachments (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id       text        NOT NULL REFERENCES public.bfi_banks(id) ON DELETE CASCADE,

    -- What surface this attachment belongs to. Kept as text + CHECK so
    -- future surfaces (taxonomy notes, hydro docs, etc.) can be added
    -- with a one-line SQL change.
    entity_type   text        NOT NULL CHECK (entity_type IN
                                    ('esdd',
                                     'cap_item',
                                     'covenant',
                                     'monitoring_report',
                                     'pcaf_availability',
                                     'pf_screening')),
    -- Owning row id — loan_id for ESDD / PCAF / PF, cap_item.id for CAP,
    -- covenant.id for covenants, monitoring_report.id for monitoring.
    entity_id     text        NOT NULL,
    -- Field-level key within the entity. Examples:
    --   ESDD:              'annex5.3.2'  (question id)
    --   CAP item:          'evidence'    (single evidence bucket per row)
    --   Covenant:          'evidence'
    --   Monitoring report: 'evidence'   OR 'annex10.4' for per-item notes
    --   PCAF availability: 'row_1a' | 'row_1b' | 'row_2b' | 'row_3a'
    --   PF screening:      'annex5b.PS5.12' (item id — already namespaced)
    field_key     text        NOT NULL,

    -- File payload
    filename      text        NOT NULL,
    mime_type     text,
    size_bytes    int         NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 10 * 1024 * 1024),
    data          bytea       NOT NULL,

    -- Audit
    uploaded_by   text        REFERENCES public.bfi_officers(id),
    uploaded_at   timestamptz NOT NULL DEFAULT now()
);

-- The panel's on-open fetch is a list-by-triple, so the composite index
-- lines up with the query.
CREATE INDEX idx_bfi_evidence_lookup
    ON public.bfi_evidence_attachments (bank_id, entity_type, entity_id, field_key);


-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Service-role only, matching bfi_cap_items / bfi_tenant_settings / etc.
-- Tenant scoping happens at the application layer via resolveCurrentTenant().

ALTER TABLE public.bfi_evidence_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bfi_evidence_attachments FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    ON public.bfi_evidence_attachments TO service_role;

-- ============================================================================
-- Done. Next step:
--   1. Run this SQL in the Supabase SQL Editor.
--   2. Hit POST /api/admin/seed-demo-data to prime the Hongshi CAP item +
--      Himal Power ESDD Section 3 remarks with a couple of demo attachments.
-- ============================================================================
