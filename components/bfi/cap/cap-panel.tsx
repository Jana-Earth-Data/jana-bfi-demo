/**
 * Corrective Action Plan + E&S Covenants + Monitoring capture panel.
 *
 * NRB Circular 22 §7.3.5 requires a time-bound CAP (Annex 8) + E&S
 * covenants (Annex 9) for every loan rated Medium / High. §7.3.7
 * requires periodic monitoring using the Annex 10 checklist. This panel
 * is the officer-facing capture surface for all three.
 *
 * The parent (ScreeningWorkbench in components/bfi/tabs/esrm-tab.tsx)
 * decides whether to mount this component based on the loan's saved
 * ESRM risk_class — it's hidden for Low-risk loans because Circular 22
 * doesn't require a CAP or covenants for them. The component itself
 * bails out to a "not required" note if the API says the same, as a
 * defence-in-depth check.
 *
 * Bank-branded via CSS variables (`--brand-primary`, `--panel`,
 * `--panelAlt`, `--line`) — no hardcoded palette. Status pill colours
 * follow the red / amber / green convention the rest of the demo uses.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/bfi/shared/primitives";
import { EvidenceAttachments } from "@/components/bfi/shared/evidence-attachments";
import { useLoanLock } from "@/components/bfi/shared/loan-lock-context";
import { LockedByBanner } from "@/components/bfi/shared/locked-by-banner";
import {
  ANNEX10_CHECKLIST_ITEMS,
  COVENANT_LIBRARY,
  frequencyForRiskClass,
} from "@/lib/regulatory/cap/library";
import type {
  CapBundle,
  CapItem,
  CapItemStatus,
  ComplianceStatus,
  Covenant,
  CovenantStatus,
  CovenantType,
  MonitoringChecklistResponse,
  MonitoringReport,
} from "@/lib/regulatory/cap/types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const CAP_STATUS_COLOR: Record<CapItemStatus, string> = {
  not_started: "#64748b", // slate
  in_progress: "#f59e0b", // amber
  completed: "#22c55e", // green
  overdue: "#ef4444", // red
};
const CAP_STATUS_LABEL: Record<CapItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};

const COVENANT_TYPE_LABEL: Record<CovenantType, string> = {
  positive: "Positive",
  negative: "Negative",
  condition_precedent: "Condition precedent",
  event_of_default: "Event of default",
  cap_covenant: "CAP covenant",
};
const COVENANT_TYPE_COLOR: Record<CovenantType, string> = {
  positive: "#22c55e",
  negative: "#f59e0b",
  condition_precedent: "#3b82f6",
  event_of_default: "#ef4444",
  cap_covenant: "#a855f7",
};
const COVENANT_STATUS_LABEL: Record<CovenantStatus, string> = {
  active: "Active",
  breached: "Breached",
  waived: "Waived",
  expired: "Expired",
};

const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  fully: "Fully implemented",
  partial: "Partially implemented",
  not: "Not implemented",
  delayed: "Delayed",
};
const COMPLIANCE_COLOR: Record<ComplianceStatus, string> = {
  fully: "#22c55e",
  partial: "#f59e0b",
  not: "#ef4444",
  delayed: "#f97316",
};

function formatNpr(n: number | null): string {
  if (n == null) return "—";
  return `NPR ${n.toLocaleString("en-IN")}`;
}
function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function addMonthsIso(base: string, months: number): string {
  const d = new Date(base + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Editable draft shape for CAP items — `id` present means "existing row";
// missing means "new".
type CapDraft = Partial<CapItem> & {
  areaOfConcern: string;
  correctiveAction: string;
  status: CapItemStatus;
};

type CovenantDraft = Partial<Covenant> & {
  covenantType: CovenantType;
  clauseText: string;
  status: CovenantStatus;
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function CapPanel({
  loanId,
  borrowerId,
}: {
  loanId: string;
  borrowerId: string;
}) {
  // Loan-lock context — P36. When the current officer is not the loan's
  // owner every editable input in this panel is disabled (buttons, row
  // fields, monitoring submit). Enforcement lives in the API too.
  const { isOwner, ownerOfficerName, loanId: lockLoanId } = useLoanLock();
  // Only respect the lock when the surrounding provider is scoped to
  // this loan. Prevents a mismatched context from another loan bleeding
  // through when this panel is briefly mounted during a switch.
  const readOnly = !isOwner && lockLoanId === loanId;

  const [data, setData] = useState<CapBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable drafts — copied from the loaded bundle on load, saved on
  // click. Deleted-ids sets tracked separately so a delete during an
  // edit-in-flight isn't silently lost.
  const [capDrafts, setCapDrafts] = useState<CapDraft[]>([]);
  const [capDeleted, setCapDeleted] = useState<Set<string>>(new Set());
  const [covDrafts, setCovDrafts] = useState<CovenantDraft[]>([]);
  const [covDeleted, setCovDeleted] = useState<Set<string>>(new Set());

  // Subsection collapsibles
  const [openCap, setOpenCap] = useState(true);
  const [openCov, setOpenCov] = useState(true);
  const [openMon, setOpenMon] = useState(true);
  const [monitoringOpen, setMonitoringOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const res = await fetch(`/api/cap/${encodeURIComponent(loanId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `Server returned ${res.status}`);
        setData(null);
        return;
      }
      const body: CapBundle = await res.json();
      setData(body);
      setCapDrafts(body.items.map((i) => ({ ...i })));
      setCovDrafts(body.covenants.map((c) => ({ ...c })));
      setCapDeleted(new Set());
      setCovDeleted(new Set());
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

  async function saveAll() {
    if (!data) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/cap/${encodeURIComponent(loanId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          borrowerId,
          items: capDrafts,
          itemsToDelete: Array.from(capDeleted),
          covenants: covDrafts,
          covenantsToDelete: Array.from(covDeleted),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `Server returned ${res.status}`);
        return;
      }
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitMonitoring(report: {
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    nextDueDate: string;
    frequencyMonths: 1 | 3 | 6 | 12;
    covenantComplianceStatus: ComplianceStatus;
    capComplianceStatus: ComplianceStatus;
    notes: string;
    checklistSnapshot: Record<string, MonitoringChecklistResponse>;
  }) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/cap/${encodeURIComponent(loanId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          borrowerId,
          monitoring: [report],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `Server returned ${res.status}`);
        return;
      }
      setMonitoringOpen(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Bail out if the loan isn't in scope for §7.3.5 (defence-in-depth —
  // the workbench already gates on risk class). Do not render a "not
  // required" note while loading, only after the fetch has resolved.
  if (data && !data.applicable) return null;

  return (
    <div data-tour="cap-panel">
      <Panel
        title="Corrective Action Plan + Covenants + Monitoring"
        subtitle={
          data && data.riskClass
            ? `NRB Circular 22 §7.3.5 requires a time-bound CAP + covenants for medium/high risk (this loan: ${data.riskClass}). §7.3.7 requires periodic monitoring.`
            : "NRB Circular 22 §7.3.5 requires a time-bound CAP + covenants for medium/high risk. §7.3.7 requires periodic monitoring."
        }
        action={
          readOnly ? null : (
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={saving || loading}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving ? "Saving…" : "Save CAP + covenants"}
            </button>
          )
        }
      >
        {readOnly && (
          <div className="mb-3">
            <LockedByBanner ownerName={ownerOfficerName} />
          </div>
        )}
        {err && (
          <div className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {err}
          </div>
        )}
        {loading && (
          <div className="rounded-md border border-line bg-panel px-3 py-3 text-xs text-slate-400">
            Loading CAP + covenants + monitoring…
          </div>
        )}

        {!loading && data && (
          <div className="flex flex-col gap-4">
            {/* -------- CAP items -------- */}
            <Subsection
              title="Corrective Action Plan (Annex 8)"
              subtitle="Time-bound mitigation actions the borrower has committed to. Row structure follows NRB Annex 8 verbatim."
              open={openCap}
              onToggle={() => setOpenCap((o) => !o)}
              badge={`${capDrafts.length} row${capDrafts.length === 1 ? "" : "s"}`}
            >
              <CapItemsTable
                drafts={capDrafts}
                onChange={setCapDrafts}
                onDelete={(id) => {
                  setCapDeleted((prev) => new Set(prev).add(id));
                  setCapDrafts((prev) =>
                    prev.filter((r) => !("id" in r && r.id === id)),
                  );
                }}
                readOnly={readOnly}
              />
            </Subsection>

            {/* -------- Covenants -------- */}
            <Subsection
              title="E&S Covenants (Annex 9)"
              subtitle="Loan-agreement clauses. Pick from the library or draft custom text. Positive / Negative / Condition Precedent / Event of Default / CAP covenant."
              open={openCov}
              onToggle={() => setOpenCov((o) => !o)}
              badge={`${covDrafts.length} row${covDrafts.length === 1 ? "" : "s"}`}
            >
              <CovenantsTable
                drafts={covDrafts}
                onChange={setCovDrafts}
                onDelete={(id) => {
                  setCovDeleted((prev) => new Set(prev).add(id));
                  setCovDrafts((prev) =>
                    prev.filter((r) => !("id" in r && r.id === id)),
                  );
                }}
                readOnly={readOnly}
              />
            </Subsection>

            {/* -------- Monitoring -------- */}
            <Subsection
              title="Monitoring schedule + reports (Annex 10)"
              subtitle="Periodic supervision — 13-item checklist per cycle. Frequency defaults to the ESRR-based cadence and can be tightened per cycle if non-compliance is found."
              open={openMon}
              onToggle={() => setOpenMon((o) => !o)}
              badge={`${data.monitoring.length} submitted`}
            >
              <MonitoringSection
                monitoring={data.monitoring}
                riskClass={data.riskClass}
                onOpenSubmit={() => setMonitoringOpen(true)}
                readOnly={readOnly}
              />
            </Subsection>

            <div className="border-t border-line pt-3 text-xs italic text-slate-500">
              {data.citation}
            </div>
          </div>
        )}
      </Panel>

      {monitoringOpen && data && (
        <MonitoringSubmitModal
          existing={data.monitoring[0] ?? null}
          riskClass={data.riskClass}
          onSubmit={submitMonitoring}
          onClose={() => setMonitoringOpen(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible subsection wrapper
// ---------------------------------------------------------------------------

function Subsection({
  title,
  subtitle,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="rounded-full border border-line bg-panelAlt px-2 py-0.5 text-[10px] text-slate-300">
              {badge}
            </span>
          )}
          <span className="text-xs text-slate-400">{open ? "▾" : "▸"}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-line p-3">{children}</div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CAP items table
// ---------------------------------------------------------------------------

function CapItemsTable({
  drafts,
  onChange,
  onDelete,
  readOnly = false,
}: {
  drafts: CapDraft[];
  onChange: (next: CapDraft[]) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  function updateAt(idx: number, patch: Partial<CapDraft>) {
    onChange(drafts.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([
      ...drafts,
      {
        areaOfConcern: "",
        correctiveAction: "",
        deadlineDate: null,
        completionIndicator: null,
        responsibleParty: null,
        costNpr: null,
        status: "not_started",
        linkedEsddQuestionId: null,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      {drafts.length === 0 && (
        <div className="rounded-md border border-line bg-panelAlt px-3 py-4 text-center text-xs text-slate-400">
          No CAP items yet. Add rows below to capture mitigation actions.
        </div>
      )}
      {drafts.map((row, idx) => {
        const derivedStatus: CapItemStatus =
          row.status !== "completed" &&
          row.deadlineDate &&
          row.deadlineDate < todayIso()
            ? "overdue"
            : row.status;
        return (
          <div
            key={row.id ?? `draft-${idx}`}
            className="rounded-md border border-line bg-panelAlt p-3"
          >
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <LabeledField label="Area of concern">
                <textarea
                  value={row.areaOfConcern}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, { areaOfConcern: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
              <LabeledField label="Corrective action required">
                <textarea
                  value={row.correctiveAction}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, { correctiveAction: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
              <LabeledField label="Deadline">
                <input
                  type="date"
                  value={row.deadlineDate ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, { deadlineDate: e.target.value || null })
                  }
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
              <LabeledField label="Completion indicator">
                <input
                  type="text"
                  value={row.completionIndicator ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, {
                      completionIndicator: e.target.value || null,
                    })
                  }
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
              <LabeledField label="Responsible party">
                <input
                  type="text"
                  value={row.responsibleParty ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, {
                      responsibleParty: e.target.value || null,
                    })
                  }
                  placeholder="e.g. Client HR + third-party auditor"
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
              <LabeledField label="Cost involved (NPR — optional)">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={row.costNpr ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, {
                      costNpr:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: CAP_STATUS_COLOR[derivedStatus] }}
                >
                  {CAP_STATUS_LABEL[derivedStatus]}
                </span>
                <select
                  value={row.status}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, {
                      status: e.target.value as CapItemStatus,
                    })
                  }
                  className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
                {row.linkedEsddQuestionId && (
                  <span
                    className="rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] text-slate-400"
                    title="Auto-seeded from an ESDD 'c' answer"
                  >
                    from {row.linkedEsddQuestionId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                {row.costNpr != null && (
                  <span>{formatNpr(row.costNpr)}</span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      if (row.id) onDelete(row.id);
                      else
                        onChange(
                          drafts.filter((_, i) => i !== idx),
                        );
                    }}
                    className="text-rose-300 hover:text-rose-200"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {row.id ? (
              <EvidenceAttachments
                entityType="cap_item"
                entityId={row.id}
                fieldKey="evidence"
                compact
                readOnly={readOnly}
              />
            ) : (
              <div className="mt-2 text-[10px] italic text-slate-500">
                Save this row before uploading supporting evidence.
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="self-start rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          + Add CAP item
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Covenants table
// ---------------------------------------------------------------------------

function CovenantsTable({
  drafts,
  onChange,
  onDelete,
  readOnly = false,
}: {
  drafts: CovenantDraft[];
  onChange: (next: CovenantDraft[]) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const [addFromLibrary, setAddFromLibrary] = useState<string>("");

  function updateAt(idx: number, patch: Partial<CovenantDraft>) {
    onChange(drafts.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addFromTemplate(id: string) {
    const tpl = COVENANT_LIBRARY.find((c) => c.id === id);
    if (!tpl) return;
    onChange([
      ...drafts,
      {
        covenantType: tpl.type,
        clauseText: tpl.clauseText,
        deadlineDate: null,
        status: "active",
        libraryTemplateId: tpl.id,
      },
    ]);
    setAddFromLibrary("");
  }

  function addCustom() {
    onChange([
      ...drafts,
      {
        covenantType: "positive",
        clauseText: "",
        deadlineDate: null,
        status: "active",
        libraryTemplateId: null,
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-panelAlt px-2 py-1.5 text-xs">
          <span className="text-slate-400">Add from library:</span>
          <select
            value={addFromLibrary}
            onChange={(e) => {
              if (e.target.value) addFromTemplate(e.target.value);
            }}
            className="flex-1 rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-200"
          >
            <option value="">Choose a template…</option>
            {COVENANT_LIBRARY.map((c) => (
              <option key={c.id} value={c.id}>
                [{COVENANT_TYPE_LABEL[c.type]}] {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-200 hover:bg-white/5"
          >
            + Custom
          </button>
        </div>
      )}

      {drafts.length === 0 && (
        <div className="rounded-md border border-line bg-panelAlt px-3 py-4 text-center text-xs text-slate-400">
          No covenants attached yet. Pick from the library or add custom text.
        </div>
      )}

      {drafts.map((row, idx) => (
        <div
          key={row.id ?? `draft-${idx}`}
          className="rounded-md border border-line bg-panelAlt p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: COVENANT_TYPE_COLOR[row.covenantType] }}
            >
              {COVENANT_TYPE_LABEL[row.covenantType]}
            </span>
            <select
              value={row.covenantType}
              disabled={readOnly}
              onChange={(e) =>
                updateAt(idx, {
                  covenantType: e.target.value as CovenantType,
                })
              }
              className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
            >
              {(
                [
                  "positive",
                  "negative",
                  "condition_precedent",
                  "event_of_default",
                  "cap_covenant",
                ] as CovenantType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {COVENANT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select
              value={row.status}
              disabled={readOnly}
              onChange={(e) =>
                updateAt(idx, { status: e.target.value as CovenantStatus })
              }
              className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
            >
              {(Object.keys(COVENANT_STATUS_LABEL) as CovenantStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {COVENANT_STATUS_LABEL[s]}
                  </option>
                ),
              )}
            </select>
            {row.libraryTemplateId && (
              <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] text-slate-400">
                library: {row.libraryTemplateId}
              </span>
            )}
            <div className="ml-auto">
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    if (row.id) onDelete(row.id);
                    else onChange(drafts.filter((_, i) => i !== idx));
                  }}
                  className="text-xs text-rose-300 hover:text-rose-200"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="md:col-span-3">
              <LabeledField label="Clause text">
                <textarea
                  value={row.clauseText}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, { clauseText: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
            </div>
            <div>
              <LabeledField label="Deadline (optional)">
                <input
                  type="date"
                  value={row.deadlineDate ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateAt(idx, { deadlineDate: e.target.value || null })
                  }
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100 disabled:opacity-60"
                />
              </LabeledField>
            </div>
          </div>

          {row.id ? (
            <EvidenceAttachments
              entityType="covenant"
              entityId={row.id}
              fieldKey="evidence"
              compact
              readOnly={readOnly}
            />
          ) : (
            <div className="mt-2 text-[10px] italic text-slate-500">
              Save this covenant before uploading supporting evidence.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monitoring section
// ---------------------------------------------------------------------------

function MonitoringSection({
  monitoring,
  riskClass,
  onOpenSubmit,
  readOnly = false,
}: {
  monitoring: MonitoringReport[];
  riskClass: CapBundle["riskClass"];
  onOpenSubmit: () => void;
  readOnly?: boolean;
}) {
  const latest = monitoring[0] ?? null;
  const defaultFreq = frequencyForRiskClass(riskClass);
  const nextDue = latest?.nextDueDate ?? null;
  const daysToNext = nextDue ? daysUntil(nextDue) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <MetricTile
          label="Default cadence"
          value={`Every ${defaultFreq} month${defaultFreq === 1 ? "" : "s"}`}
          hint={`ESRR = ${riskClass ?? "—"}`}
        />
        <MetricTile
          label="Next report due"
          value={nextDue ?? "Not scheduled"}
          hint={
            daysToNext == null
              ? "Submit first report to schedule cadence"
              : daysToNext < 0
                ? `${-daysToNext} day${daysToNext === -1 ? "" : "s"} overdue`
                : `In ${daysToNext} day${daysToNext === 1 ? "" : "s"}`
          }
          accent={daysToNext != null && daysToNext < 0 ? "danger" : "brand"}
        />
        <MetricTile
          label="Submitted reports"
          value={monitoring.length.toString()}
          hint={
            latest
              ? `Last: ${latest.reportingPeriodStart} → ${latest.reportingPeriodEnd}`
              : "No history yet"
          }
        />
      </div>

      {!readOnly && (
        <div>
          <button
            type="button"
            onClick={onOpenSubmit}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Submit monitoring report
          </button>
        </div>
      )}

      {monitoring.length > 0 && (
        <div className="rounded-md border border-line bg-panel">
          <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Submitted reports
          </div>
          <ul className="divide-y divide-line">
            {monitoring.map((r) => (
              <li key={r.id} className="px-3 py-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-slate-200">
                    {r.reportingPeriodStart} → {r.reportingPeriodEnd}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{
                        backgroundColor:
                          COMPLIANCE_COLOR[r.covenantComplianceStatus],
                      }}
                      title="Covenant compliance"
                    >
                      Cov: {COMPLIANCE_LABEL[r.covenantComplianceStatus]}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{
                        backgroundColor:
                          COMPLIANCE_COLOR[r.capComplianceStatus],
                      }}
                      title="CAP compliance"
                    >
                      CAP: {COMPLIANCE_LABEL[r.capComplianceStatus]}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      submitted {new Date(r.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {r.notes && (
                  <div className="mt-1 text-[11px] italic text-slate-400">
                    {r.notes}
                  </div>
                )}
                <EvidenceAttachments
                  entityType="monitoring_report"
                  entityId={r.id}
                  fieldKey="evidence"
                  compact
                  readOnly={readOnly}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "brand" | "danger";
}) {
  const color =
    accent === "danger"
      ? "#ef4444"
      : accent === "brand"
        ? "var(--brand-primary)"
        : "#e2e8f0";
  return (
    <div className="rounded-md border border-line bg-panelAlt px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold" style={{ color }}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monitoring submission modal (Annex 10 13 items)
// ---------------------------------------------------------------------------

function MonitoringSubmitModal({
  existing,
  riskClass,
  onSubmit,
  onClose,
  saving,
}: {
  existing: MonitoringReport | null;
  riskClass: CapBundle["riskClass"];
  onSubmit: (report: {
    reportingPeriodStart: string;
    reportingPeriodEnd: string;
    nextDueDate: string;
    frequencyMonths: 1 | 3 | 6 | 12;
    covenantComplianceStatus: ComplianceStatus;
    capComplianceStatus: ComplianceStatus;
    notes: string;
    checklistSnapshot: Record<string, MonitoringChecklistResponse>;
  }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const defaultFreq = frequencyForRiskClass(riskClass);
  const defaultEnd = todayIso();
  const defaultStart = useMemo(
    () =>
      existing?.nextDueDate ??
      addMonthsIso(defaultEnd, -defaultFreq),
    [existing, defaultEnd, defaultFreq],
  );
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [freq, setFreq] = useState<1 | 3 | 6 | 12>(defaultFreq);
  const nextDue = useMemo(() => addMonthsIso(end, freq), [end, freq]);
  const [covCompliance, setCovCompliance] =
    useState<ComplianceStatus>("fully");
  const [capCompliance, setCapCompliance] =
    useState<ComplianceStatus>("fully");
  const [notes, setNotes] = useState("");
  const [responses, setResponses] = useState<
    Record<string, MonitoringChecklistResponse>
  >(() => {
    const seed: Record<string, MonitoringChecklistResponse> = {};
    for (const item of ANNEX10_CHECKLIST_ITEMS) {
      seed[item.id] = { response: "", flag: "ok" };
    }
    return seed;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panelAlt p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Submit monitoring report — Annex 10
            </div>
            <div className="text-xs text-slate-500">
              13-item checklist per NRB Circular 22 §7.3.7. All rows visible
              to the credit committee.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-300"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <LabeledField label="Period start">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100"
            />
          </LabeledField>
          <LabeledField label="Period end">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100"
            />
          </LabeledField>
          <LabeledField label="Frequency (months)">
            <select
              value={freq}
              onChange={(e) =>
                setFreq(Number(e.target.value) as 1 | 3 | 6 | 12)
              }
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100"
            >
              <option value={1}>1 (extreme)</option>
              <option value={3}>3 (high)</option>
              <option value={6}>6 (medium)</option>
              <option value={12}>12 (low)</option>
            </select>
          </LabeledField>
          <LabeledField label="Next due">
            <input
              type="date"
              value={nextDue}
              readOnly
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-400"
            />
          </LabeledField>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <LabeledField label="Covenant compliance">
            <select
              value={covCompliance}
              onChange={(e) =>
                setCovCompliance(e.target.value as ComplianceStatus)
              }
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100"
            >
              {(Object.keys(COMPLIANCE_LABEL) as ComplianceStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {COMPLIANCE_LABEL[s]}
                  </option>
                ),
              )}
            </select>
          </LabeledField>
          <LabeledField label="CAP compliance">
            <select
              value={capCompliance}
              onChange={(e) =>
                setCapCompliance(e.target.value as ComplianceStatus)
              }
              className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100"
            >
              {(Object.keys(COMPLIANCE_LABEL) as ComplianceStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {COMPLIANCE_LABEL[s]}
                  </option>
                ),
              )}
            </select>
          </LabeledField>
        </div>

        <LabeledField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-100"
          />
        </LabeledField>

        <div className="mt-4 rounded-md border border-line bg-panel p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Annex 10 checklist (13 items)
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {ANNEX10_CHECKLIST_ITEMS.map((item) => {
              const resp = responses[item.id];
              return (
                <li
                  key={item.id}
                  className="rounded-md border border-line bg-panelAlt p-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-300">
                      Sl. {item.serial} · {item.section}
                    </div>
                    <select
                      value={resp.flag}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...prev[item.id],
                            flag: e.target.value as
                              | "ok"
                              | "issue"
                              | "n/a",
                          },
                        }))
                      }
                      className="rounded-md border border-line bg-panel px-2 py-0.5 text-[10px] text-slate-200"
                    >
                      <option value="ok">OK</option>
                      <option value="issue">Issue</option>
                      <option value="n/a">N/A</option>
                    </select>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300">
                    {item.prompt}
                  </div>
                  <textarea
                    value={resp.response}
                    onChange={(e) =>
                      setResponses((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          response: e.target.value,
                        },
                      }))
                    }
                    rows={2}
                    placeholder="RM response…"
                    className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-slate-100"
                  />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSubmit({
                reportingPeriodStart: start,
                reportingPeriodEnd: end,
                nextDueDate: nextDue,
                frequencyMonths: freq,
                covenantComplianceStatus: covCompliance,
                capComplianceStatus: capCompliance,
                notes,
                checklistSnapshot: responses,
              })
            }
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {saving ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small labelled-field helper (kept local to this file)
// ---------------------------------------------------------------------------

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
