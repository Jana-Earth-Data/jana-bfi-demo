/**
 * Hydropower documentation matrix panel (NRB Circular 22 Annex 2).
 *
 * Surfaced on the ESRM workbench for hydropower loans. Renders the
 * verbatim list of documents Annex 2 requires for the borrower's
 * capacity band, each with a status pill + dropdown + notes field.
 *
 * The parent is expected to only mount this component for hydro-sector
 * borrowers (see components/bfi/tabs/esrm-tab.tsx). The component itself
 * still bails to null if the API says the loan is not applicable, as a
 * defence-in-depth check.
 *
 * Bank-branded via CSS variables (`--brand-primary`, `--panel`,
 * `--panelAlt`, `--line`) — no hardcoded palette colors. Status pill
 * colors follow the same red / amber / green convention the rest of the
 * demo uses, tuned to match the ESRM stripe.
 */

"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/bfi/shared/primitives";
import {
  HYDRO_DOCUMENT_STATUSES,
  type HydroDocumentStatus,
} from "@/lib/regulatory/hydro/doc-matrix";

// ---------------------------------------------------------------------------
// API response shape — kept local so this component doesn't reach into the
// route module's types. Fields mirror what /api/hydro/docs/[loanId] returns.
// ---------------------------------------------------------------------------
type DocRow = {
  id: string;
  name: string;
  citation: string;
  required: boolean;
  status: HydroDocumentStatus;
  notes: string | null;
  updatedAt: string | null;
  officerId: string | null;
};

type MatrixResponse = {
  ok: true;
  applicable: boolean;
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  nrbSector: string;
  capacityMw?: number;
  capacityBand?: string;
  capacityBandLabel?: string;
  capacityBandAssessment?: string;
  documents?: DocRow[];
  completion?: { verified: number; required: number; percent: number };
  citation?: string;
};

// ---------------------------------------------------------------------------
// Status → pill color (branded via CSS variables where possible, semantic
// colors for the traffic-light convention).
// ---------------------------------------------------------------------------
const STATUS_COLOR: Record<HydroDocumentStatus, string> = {
  "not-required": "#64748b",   // slate — greyed out
  "not-collected": "#ef4444",  // red — outstanding
  "in-progress": "#f59e0b",    // amber — being worked
  received: "#3b82f6",         // blue — in-hand, unverified
  verified: "#22c55e",         // green — cleared
};

const STATUS_LABEL: Record<HydroDocumentStatus, string> = {
  "not-required": "Not required",
  "not-collected": "Not collected",
  "in-progress": "In progress",
  received: "Received",
  verified: "Verified",
};

// ---------------------------------------------------------------------------
// Panel props
// ---------------------------------------------------------------------------
export function HydroDocMatrixPanel({
  loanId,
  borrowerId,
}: {
  loanId: string;
  borrowerId: string;
}) {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Track per-doc save-in-flight so the dropdown can disable itself.
  const [saving, setSaving] = useState<Set<string>>(new Set());
  // Local notes buffer per doc so typing is not swallowed by the async
  // refetch. Flushed to the server on blur.
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  async function load() {
    try {
      setErr(null);
      const res = await fetch(`/api/hydro/docs/${encodeURIComponent(loanId)}`);
      if (!res.ok) {
        setErr(`Server returned ${res.status}`);
        setData(null);
        return;
      }
      const body: MatrixResponse = await res.json();
      setData(body);
      // Seed the notes drafts from the loaded data — but preserve any
      // in-flight edits the officer is currently typing.
      setNotesDraft((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const doc of body.documents ?? []) {
          if (next[doc.id] === undefined) next[doc.id] = doc.notes ?? "";
        }
        return next;
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
    // We deliberately ignore lint here — `load` is stable across renders
    // because it only reads state on demand. Re-invoking it on loanId
    // change is the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  async function updateStatus(
    documentId: string,
    status: HydroDocumentStatus,
    notes: string | null,
  ) {
    setSaving((prev) => new Set(prev).add(documentId));
    try {
      const res = await fetch("/api/hydro/docs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanId,
          borrowerId,
          documentId,
          status,
          notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `Server returned ${res.status}`);
        return;
      }
      // Reload rather than optimistically update — cheap and keeps the
      // completion percentage in lockstep with the server.
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  }

  // Non-hydro loan (defence-in-depth — the parent already gates on this).
  if (data && !data.applicable) return null;

  const docs = (data?.documents ?? []).filter((d) => d.required);
  const completion = data?.completion;

  return (
    <div data-tour="hydro-doc-matrix">
      <Panel
        title="Hydropower documentation matrix (NRB Circular 22 Annex 2)"
        subtitle={
          loading
            ? "Loading documentation status…"
            : data
              ? `Documents required before disbursement — ${
                  data.capacityBandLabel ?? "unknown"
                } capacity band${
                  typeof data.capacityMw === "number"
                    ? ` · ${data.capacityMw.toFixed(1)} MW installed`
                    : ""
                }${
                  data.capacityBandAssessment
                    ? ` · ${data.capacityBandAssessment}`
                    : ""
                }`
              : "Documents required before disbursement"
        }
      >
        {err && (
          <div className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {err}
          </div>
        )}

        {!loading && docs.length === 0 && !err && (
          <div className="rounded-md border border-line bg-panel px-3 py-3 text-xs text-slate-400">
            No documents required for this capacity band.
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {docs.map((doc) => {
            const isSaving = saving.has(doc.id);
            const draft = notesDraft[doc.id] ?? "";
            return (
              <li
                key={doc.id}
                className="rounded-lg border border-line bg-panel px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100">
                      {doc.name}
                    </div>
                    {doc.updatedAt && (
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                        Updated {new Date(doc.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: STATUS_COLOR[doc.status] }}
                    >
                      {STATUS_LABEL[doc.status]}
                    </span>
                    <select
                      className="rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                      value={doc.status}
                      disabled={isSaving}
                      onChange={(e) => {
                        const next = e.target.value as HydroDocumentStatus;
                        void updateStatus(doc.id, next, draft || null);
                      }}
                    >
                      {HYDRO_DOCUMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="text-[10px] uppercase tracking-wide text-slate-500">
                    Notes
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
                    placeholder="Optional — reference no., intake date, follow-ups"
                    value={draft}
                    disabled={isSaving}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({
                        ...prev,
                        [doc.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      const currentDraft = draft.trim();
                      const currentSaved = (doc.notes ?? "").trim();
                      if (currentDraft === currentSaved) return;
                      void updateStatus(
                        doc.id,
                        doc.status,
                        currentDraft || null,
                      );
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {/* Footer: completion + citation */}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-xs">
          <div className="text-slate-300">
            {completion
              ? `${completion.verified} of ${completion.required} verified · ${Math.round(
                  completion.percent * 100,
                )}% complete`
              : loading
                ? "Calculating completion…"
                : "—"}
          </div>
          <div className="italic text-slate-500">
            {data?.citation ??
              "NRB Circular 22 Annex 2 (ESRM Guideline PDF p. 25)"}
          </div>
        </div>

        {/* Slim progress bar tied to completion percentage. */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full"
            style={{
              width: `${((completion?.percent ?? 0) * 100).toFixed(1)}%`,
              backgroundColor: "var(--brand-primary)",
            }}
          />
        </div>
      </Panel>
    </div>
  );
}
