"use client";

/**
 * PCAF evidence review — the document work behind the availability answers.
 *
 * Sits above the flag rows because it is what should drive them. Each row is
 * one document from lib/regulatory/pcaf/evidence-matrix.ts: what to ask the
 * borrower for, what the officer found, which reporting year it covers, and
 * the attached file.
 *
 * Two things the layout is trying to make obvious.
 *
 * Each document says which flag it establishes, so the officer can see that
 * marking the assurance opinion verified is what produces Score 1, rather
 * than setting a Score 1 toggle and separately attaching a PDF beside it.
 *
 * Documents scoped to this loan are labelled as such. On a project-finance
 * loan the production records belong to the financed plant, not the company
 * (PCAF §5.3), and an officer looking at one of two facilities to the same
 * developer needs to know which they are answering for. The FILES are shared
 * across all the borrower's loans either way -- the upload happens once.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { EvidenceAttachments } from "@/components/bfi/shared/evidence-attachments";
import {
  PCAF_EVIDENCE_STATUS_LABEL,
  type PcafEvidenceStatus,
} from "@/lib/regulatory/pcaf/evidence-matrix";

type DocumentView = {
  id: string;
  name: string;
  lookFor: string;
  establishes: string;
  supportsOption: string;
  citation: string;
  scope: "borrower" | "activity";
  scopedToLoanId: string | null;
  attachmentFieldKey: string;
  status: PcafEvidenceStatus;
  reportingYear: number | null;
  notes: string | null;
  updatedAt: string | null;
};

type EvidenceResponse = {
  ok: boolean;
  loanId: string;
  borrowerId: string;
  isProjectFinance: boolean;
  disclosureYear: number;
  statuses: PcafEvidenceStatus[];
  documents: DocumentView[];
  progress: { resolved: number; total: number };
  /** Why each flag has the value it has. Keyed by flag column name. */
  basis: Record<string, { source: string }>;
};

const STATUS_CLASS: Record<PcafEvidenceStatus, string> = {
  verified: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  unavailable: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  "not-applicable": "border-slate-500/30 bg-slate-500/5 text-slate-400",
  received: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  requested: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  "not-collected": "border-line/60 bg-panelAlt text-slate-400",
};

export function PcafEvidenceSection({
  loanId,
  borrowerId,
  readOnly = false,
  onChanged,
  onBasis,
}: {
  loanId: string;
  borrowerId: string;
  readOnly?: boolean;
  /** Fired after a save so the parent can refetch the derived flags. */
  onChanged?: () => void;
  /**
   * Reports which flags are now document-established, on load and after every
   * save. The flag rows below use it for their Source badge, so a row backed
   * by a verified annual report says so instead of claiming an officer
   * toggled it.
   */
  onBasis?: (basis: Record<string, { source: string }>) => void;
}) {
  const [state, setState] = useState<EvidenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  // Held in a ref so load() keeps a stable identity: taking onBasis as a
  // dependency would refetch on every parent render.
  const onBasisRef = useRef(onBasis);
  onBasisRef.current = onBasis;

  const load = useCallback(async () => {
    try {
      setErr(null);
      const res = await fetch(
        `/api/pcaf/evidence/${encodeURIComponent(loanId)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `Server returned ${res.status}`);
        return;
      }
      const body = (await res.json()) as EvidenceResponse;
      setState(body);
      onBasisRef.current?.(body.basis ?? {});
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function save(
    doc: DocumentView,
    patch: Partial<Pick<DocumentView, "status" | "reportingYear" | "notes">>,
  ) {
    setSavingId(doc.id);
    setErr(null);
    try {
      const res = await fetch(
        `/api/pcaf/evidence/${encodeURIComponent(loanId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            documentId: doc.id,
            status: patch.status ?? doc.status,
            reportingYear:
              patch.reportingYear !== undefined
                ? patch.reportingYear
                : doc.reportingYear,
            notes: patch.notes !== undefined ? patch.notes : doc.notes,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error ?? `Server returned ${res.status}`);
        return;
      }
      setState(body as EvidenceResponse);
      onBasisRef.current?.((body as EvidenceResponse).basis ?? {});
      onChanged?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border border-line/60 bg-panel/40 p-3 text-sm text-slate-400">
        Loading evidence review…
      </div>
    );
  }
  if (!state) {
    return err ? (
      <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {err}
      </div>
    ) : null;
  }

  const { resolved, total } = state.progress;

  return (
    <div className="rounded-2xl border border-line/60 bg-panel/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-white">
            Evidence review
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            The documents behind the answers below. Verified evidence sets the
            flag; a document nobody has read does not.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-line/60 bg-panelAlt px-2 py-0.5 text-[11px] text-slate-300">
            {resolved}/{total} resolved
          </span>
          <span className="text-slate-500">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-line/60 p-4">
          {err && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {err}
            </div>
          )}
          <div className="text-[11px] text-slate-500">
            Disclosure year {state.disclosureYear}. Evidence covering an
            earlier year is treated as stale and stops supporting its claim.
          </div>

          {state.documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-md border border-line/60 bg-panel/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {doc.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      {doc.supportsOption}
                    </span>
                    {doc.scopedToLoanId && (
                      <span
                        className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-200"
                        title="Project finance: PCAF §5.3 scopes this to the financed project, so this answer applies to this loan only. The uploaded file is still shared across the borrower's loans."
                      >
                        THIS LOAN
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{doc.lookFor}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <select
                    value={doc.status}
                    disabled={readOnly || savingId === doc.id}
                    onChange={(e) =>
                      void save(doc, {
                        status: e.target.value as PcafEvidenceStatus,
                      })
                    }
                    className={`rounded-md border px-2 py-1 text-[11px] disabled:opacity-60 ${STATUS_CLASS[doc.status]}`}
                  >
                    {state.statuses.map((s) => (
                      <option key={s} value={s} className="bg-panel text-slate-200">
                        {PCAF_EVIDENCE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] uppercase tracking-wide text-slate-600">
                      Year
                    </span>
                    <input
                      type="number"
                      value={doc.reportingYear ?? ""}
                      placeholder="—"
                      min={1990}
                      max={2100}
                      disabled={readOnly || savingId === doc.id}
                      onChange={(e) => {
                        const v = e.target.value;
                        void save(doc, {
                          reportingYear: v === "" ? null : Number(v),
                        });
                      }}
                      className="w-20 rounded-md border border-line/60 bg-panel/60 px-1.5 py-0.5 text-[11px] text-slate-200 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                Establishes:{" "}
                <span className="text-slate-400">
                  {FLAG_LABEL[doc.establishes] ?? doc.establishes}
                </span>
                {" · "}
                {doc.citation}
              </div>

              <EvidenceAttachments
                entityType="pcaf_availability"
                entityId={borrowerId}
                fieldKey={doc.attachmentFieldKey}
                compact
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Plain-language names for the flags, so the row does not show a column name. */
const FLAG_LABEL: Record<string, string> = {
  borrower_publishes_verified: "Borrower publishes verified emissions",
  borrower_publishes_unverified: "Borrower publishes unverified emissions",
  energy_consumption_data_available: "Primary energy data available",
  physical_activity_data_available: "Primary physical activity data available",
  revenue_data_available: "Borrower revenue is knowable",
};
