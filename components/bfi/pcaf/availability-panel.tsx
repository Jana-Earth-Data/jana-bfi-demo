"use client";

/**
 * PCAF Data Availability collection panel.
 *
 * Mirrors ESRM / Taxonomy: the demo has always had a scoring engine and a
 * reporting histogram, but no officer-facing collection surface — this
 * panel closes that gap.  The officer confirms or overrides the four
 * flags that drive the PCAF §5 decision tree:
 *
 *   1. Borrower publishes verified GHG-Protocol emissions   → Score 1
 *   2. Borrower publishes unverified GHG-Protocol emissions → Score 2
 *   3. Bank captures primary physical activity data         → Score 3
 *   4. Bank captures borrower revenue                       → Score 4
 *
 * Each row asks one question -- does this data exist for the borrower --
 * and is answered Exists / Does not exist. Answers pre-fill from
 * `inferPcafAvailability`, and a separate Source badge says where the
 * current answer came from: Auto-suggested (nobody has reviewed it),
 * Confirmed by officer (reviewed and agreed), or Set by officer (changed).
 *
 * Answer and source are deliberately distinct controls. They were
 * previously a bare toggle with an AUTO / MANUAL badge stacked underneath,
 * which read as two competing answers, and could not distinguish a
 * reviewed-and-agreed row from one nobody had opened.
 *
 * Per-flag evidence textareas capture the URL / doc reference the officer
 * looked at — that's what an auditor asks for next to the score.
 *
 * Data flow:
 *   - On mount: fetch /api/pcaf/availability/[borrowerId], seed local
 *     state from `resolvedFlags` (inferred + any prior save).
 *   - On save: POST the full flag bundle + evidence, receive fresh
 *     `computed` (score / option / citation), pass it up to the
 *     workbench via `onSaved` so the neighbour PCAF panel can refresh
 *     without a round-trip to /api/pcaf/scores.
 *
 * Citation: every score option carries a PCAF Part A §5 pointer (see
 * PCAF_OPTION_LABEL in lib/regulatory/pcaf/types.ts).  The panel surfaces
 * the resolved citation in the footer so the officer can see exactly
 * which paragraph their flag choice mapped to.
 */

import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/bfi/shared/primitives";
import { EvidenceAttachments } from "@/components/bfi/shared/evidence-attachments";
import { useLoanLock } from "@/components/bfi/shared/loan-lock-context";
import { LockedByBanner } from "@/components/bfi/shared/locked-by-banner";
import type { Borrower } from "@/lib/types/bfi";
import type {
  PcafComputationResult,
  PcafDataAvailability,
} from "@/lib/regulatory/pcaf/types";

type Props = {
  borrower: Borrower;
  onSaved?: (result: {
    resolvedFlags: PcafDataAvailability;
    computed: PcafComputationResult | null;
  }) => void;
};

type FlagKey =
  | "borrower_publishes_verified"
  | "borrower_publishes_unverified"
  | "physical_activity_data_available"
  | "revenue_data_available";

type FlagMeta = {
  key: FlagKey;
  title: string;
  score: number;
  option: string;
  citation: string;
  blurb: string;
};

// The four flags the officer actually has agency over.  `sector_average_only`
// is always true (Score 5 is the PCAF-required fallback) and
// `energy_consumption_data_available` isn't yet exposed to officers in the
// demo — most Nepal banks don't have per-borrower kWh capture — so we
// don't include either as a toggle row.
const FLAG_ROWS: FlagMeta[] = [
  {
    key: "borrower_publishes_verified",
    title: "Borrower publishes VERIFIED GHG-Protocol emissions",
    score: 1,
    option: "Option 1a",
    citation: "PCAF Part A 3rd Edition §5.2 · Option 1a",
    blurb:
      "Borrower's annual report includes scope 1/2/3 emissions AND those figures carry a third-party assurance opinion (ISO 14064 / equivalent). Highest PCAF score achievable.",
  },
  {
    key: "borrower_publishes_unverified",
    title: "Borrower publishes UNVERIFIED GHG-Protocol emissions",
    score: 2,
    option: "Option 1b",
    citation: "PCAF Part A 3rd Edition §5.2 · Option 1b",
    blurb:
      "Borrower's annual report includes scope 1/2/3 emissions, but the figures are self-reported (no assurance statement). Common step-up for NEPSE-listed corporates.",
  },
  {
    key: "physical_activity_data_available",
    title: "Primary physical activity data available",
    score: 3,
    option: "Option 2b",
    citation: "PCAF Part A 3rd Edition §5.2 · Option 2b",
    blurb:
      "Bank has the borrower's own physical output (tonnes cement, MWh generated, MW installed) or a facility-level match via Climate TRACE / GCCT / GEM. Score 3 is the honest ceiling for most Nepal facilities.",
  },
  {
    key: "revenue_data_available",
    title: "Borrower revenue is knowable",
    score: 4,
    option: "Option 3a",
    citation: "PCAF Part A 3rd Edition §5.2 · Option 3a",
    blurb:
      "Borrower is publicly-listed or otherwise publishes revenue that can be multiplied by a sector-average emission factor per unit of revenue.",
  },
];

/** Where a flag's current value came from. Not the value itself. */
type FlagProvenance = "auto" | "confirmed" | "manual";

type ApiResponse = {
  ok: boolean;
  inferredFlags: PcafDataAvailability;
  savedFlags: PcafDataAvailability | null;
  resolvedFlags: PcafDataAvailability;
  evidence: Record<string, string>;
  notes: string | null;
  computed: PcafComputationResult | null;
  autoInferenceSources: {
    dataTier: string | null;
    publiclyListed: boolean;
    evSource: string;
    facilityCount: number;
    nrbSector: string;
  };
  updatedAt: string | null;
  capturedBy: string | null;
  loanCategory: string | null;
};

export function PcafAvailabilityPanel({ borrower, onSaved }: Props) {
  // Loan-lock context — P36. PCAF availability is per-BORROWER (not per
  // loan), but the workbench mounts this panel with a LoanLockProvider
  // scoped to the currently selected loan. When that lock says the
  // current officer is not the owner we disable every toggle / textarea
  // / save button. Non-loan surfaces just get isOwner=true from the
  // default context.
  const { isOwner, ownerOfficerName, loanId: lockedLoanId } = useLoanLock();
  const readOnly = !isOwner;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [state, setState] = useState<ApiResponse | null>(null);
  const [localFlags, setLocalFlags] = useState<PcafDataAvailability | null>(
    null,
  );
  const [localEvidence, setLocalEvidence] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSaveError(null);
    setSavedFlash(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/pcaf/availability/${encodeURIComponent(borrower.id)}`,
        );
        if (!res.ok) throw new Error(`GET ${res.status}`);
        const body = (await res.json()) as ApiResponse;
        if (cancelled || !body.ok) return;
        setState(body);
        setLocalFlags(body.resolvedFlags);
        setLocalEvidence(body.evidence ?? {});
      } catch (err) {
        console.warn("[pcaf-availability] load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [borrower.id]);

  const inferred = state?.inferredFlags ?? null;

  // Per-flag provenance. This used to be a boolean "is this an override?",
  // rendered as an AUTO / MANUAL badge sitting directly under the toggle --
  // which read as if it were a second answer rather than the source of the
  // first one, and could not distinguish "an officer reviewed this and
  // agreed" from "nobody has looked at this yet". Both showed AUTO.
  //
  // Three states, derived without a schema change. savedFlags is null until
  // the officer saves, which is exactly the "nobody has reviewed this"
  // signal:
  //   auto      - no saved row, value still matches the suggestion
  //   confirmed - a saved row exists and the officer agreed with it
  //   manual    - the value differs from the suggestion
  //
  // Compared against localFlags so the badge updates on toggle, before save.
  const provenanceByFlag = useMemo(() => {
    if (!inferred || !localFlags) return {} as Record<FlagKey, FlagProvenance>;
    const hasSaved = state?.savedFlags != null;
    const out: Partial<Record<FlagKey, FlagProvenance>> = {};
    for (const row of FLAG_ROWS) {
      if (inferred[row.key] !== localFlags[row.key]) out[row.key] = "manual";
      else out[row.key] = hasSaved ? "confirmed" : "auto";
    }
    return out as Record<FlagKey, FlagProvenance>;
  }, [inferred, localFlags, state?.savedFlags]);

  const dirty = useMemo(() => {
    if (!state || !localFlags) return false;
    const flagsChanged = FLAG_ROWS.some(
      (r) => state.resolvedFlags[r.key] !== localFlags[r.key],
    );
    if (flagsChanged) return true;
    // Evidence diff — key-by-key so a text change is treated as dirty.
    const prev = state.evidence ?? {};
    const keys = new Set([
      ...Object.keys(prev),
      ...Object.keys(localEvidence),
    ]);
    for (const k of keys) {
      if ((prev[k] ?? "") !== (localEvidence[k] ?? "")) return true;
    }
    return false;
  }, [state, localFlags, localEvidence]);

  function toggleFlag(key: FlagKey) {
    setSavedFlash(null);
    setSaveError(null);
    setLocalFlags((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  }

  function updateEvidence(key: FlagKey, value: string) {
    setSavedFlash(null);
    setLocalEvidence((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!localFlags || !state) return;
    setSaving(true);
    setSaveError(null);
    setSavedFlash(null);
    try {
      const res = await fetch(
        `/api/pcaf/availability/${encodeURIComponent(borrower.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flags: localFlags,
            evidence: localEvidence,
            loanCategory: state.loanCategory,
            // P36 — pass the currently-selected loan id from context so
            // the API can enforce the owner check. Falls back to null
            // when this panel is mounted outside a loan-scoped surface.
            loanId: lockedLoanId || undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `POST ${res.status}`);
      }
      const body = (await res.json()) as ApiResponse & {
        ok: true;
      };
      setState({
        ...state,
        inferredFlags: body.inferredFlags,
        savedFlags: body.savedFlags,
        resolvedFlags: body.resolvedFlags,
        evidence: body.evidence,
        computed: body.computed,
        updatedAt: new Date().toISOString(),
      });
      setLocalFlags(body.resolvedFlags);
      setLocalEvidence(body.evidence ?? {});
      setSavedFlash("Saved · workbench PCAF score refreshed.");
      onSaved?.({
        resolvedFlags: body.resolvedFlags,
        computed: body.computed,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Save failed — try again.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="PCAF Data Availability — analyst confirmation"
      subtitle="Which data does the borrower publish? Each row asks whether that data exists. Answers start as catalogue suggestions; the officer confirms or changes them, with evidence."
    >
      <div data-tour="pcaf-availability-panel" className="space-y-3">
        {readOnly && <LockedByBanner ownerName={ownerOfficerName} />}
        {loading && (
          <div className="rounded-md border border-line/60 bg-panel/40 p-3 text-sm text-slate-400">
            Loading availability flags…
          </div>
        )}

        {!loading && state && localFlags && (
          <>
            {state.computed && (
              <ResolvedSummary computed={state.computed} />
            )}

            <div className="space-y-2">
              {FLAG_ROWS.map((row) => (
                <FlagRow
                  key={row.key}
                  meta={row}
                  value={localFlags[row.key]}
                  provenance={provenanceByFlag[row.key] ?? "auto"}
                  evidence={localEvidence[row.key] ?? ""}
                  onToggle={() => toggleFlag(row.key)}
                  onEvidenceChange={(v) => updateEvidence(row.key, v)}
                  borrowerId={borrower.id}
                  readOnly={readOnly}
                />
              ))}
            </div>

            <AutoInferenceFooter sources={state.autoInferenceSources} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
              <div className="text-xs text-slate-500">
                {state.updatedAt ? (
                  <span>
                    Last saved{" "}
                    {new Date(state.updatedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {state.capturedBy ? ` · officer ${state.capturedBy}` : ""}
                  </span>
                ) : (
                  <span>
                    Not yet reviewed by an officer · answers below are
                    suggestions from the borrower catalogue.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {savedFlash && (
                  <span className="text-xs text-emerald-300">
                    {savedFlash}
                  </span>
                )}
                {saveError && (
                  <span className="text-xs text-rose-300">{saveError}</span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: dirty
                        ? "var(--brand-primary)"
                        : "rgba(148, 163, 184, 0.3)",
                      color: dirty ? "var(--brand-primary)" : "#94a3b8",
                      backgroundColor: dirty
                        ? "rgba(var(--brand-primary-rgb, 59, 130, 246), 0.08)"
                        : "transparent",
                    }}
                  >
                    {saving
                      ? "Saving…"
                      : dirty
                        ? "Save flags + evidence"
                        : "No changes"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Resolved summary — small header block showing the current computed score
// ---------------------------------------------------------------------------

function ResolvedSummary({
  computed,
}: {
  computed: PcafComputationResult;
}) {
  const scoreColor =
    computed.score <= 2
      ? "text-emerald-300"
      : computed.score === 3
        ? "text-sky-300"
        : computed.score === 4
          ? "text-amber-300"
          : "text-rose-300";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line/60 bg-panel/40 p-3">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          Resolved score with current flags
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className={`text-2xl font-semibold ${scoreColor}`}>
            {computed.score}
          </span>
          <span className="text-xs uppercase tracking-wide text-slate-400">
            Option {computed.option}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-400">{computed.method}</div>
      </div>
      <div className="text-right text-[10px] uppercase tracking-wide text-slate-500">
        {computed.citation}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flag row — toggle + auto/override badge + evidence textarea
// ---------------------------------------------------------------------------

const PROVENANCE_LABEL: Record<FlagProvenance, string> = {
  auto: "Auto-suggested",
  confirmed: "Confirmed by officer",
  manual: "Set by officer",
};

const PROVENANCE_HELP: Record<FlagProvenance, string> = {
  auto: "Suggested from the borrower catalogue. No officer has reviewed it yet.",
  confirmed: "An officer reviewed the suggestion and agreed with it.",
  manual: "An officer set this themselves; it differs from the suggestion.",
};

const PROVENANCE_CLASS: Record<FlagProvenance, string> = {
  auto: "bg-slate-500/20 text-slate-300",
  confirmed: "bg-emerald-500/15 text-emerald-200",
  manual: "bg-amber-500/20 text-amber-200",
};

function FlagRow({
  meta,
  value,
  provenance,
  evidence,
  onToggle,
  onEvidenceChange,
  borrowerId,
  readOnly = false,
}: {
  meta: FlagMeta;
  /** Does this data exist for the borrower? The answer. */
  value: boolean;
  /** Where the answer came from. NOT a second answer. */
  provenance: FlagProvenance;
  evidence: string;
  onToggle: () => void;
  onEvidenceChange: (v: string) => void;
  borrowerId: string;
  readOnly?: boolean;
}) {
  // Derive a stable field_key from the PCAF option letter (e.g.
  // "Option 1a" → "row_1a"). Matches the spec's `row_<option>` pattern.
  const optionKey = meta.option
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^option_/, "");
  const fieldKey = `row_${optionKey}`;
  return (
    <div className="rounded-md border border-line/60 bg-panel/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-slate-200">
              {meta.title}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Score {meta.score} · {meta.option}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{meta.blurb}</p>
        </div>
        {/* The answer, in words. A bare switch plus an AUTO badge beneath it
            read as two competing states; officers could not tell whether
            AUTO was the answer or the source of the answer. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div
            role="radiogroup"
            aria-label={`${meta.title} — does this data exist?`}
            className="inline-flex overflow-hidden rounded-md border border-line/60"
          >
            {([
              { on: true, label: "Exists" },
              { on: false, label: "Does not exist" },
            ] as const).map((opt) => {
              const active = value === opt.on;
              return (
                <button
                  key={opt.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={readOnly}
                  onClick={() => {
                    if (value !== opt.on) onToggle();
                  }}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "text-white"
                      : "bg-panelAlt text-slate-400 hover:text-slate-200"
                  }`}
                  style={
                    active
                      ? { backgroundColor: "var(--brand-primary)" }
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wide text-slate-600">
              Source
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${PROVENANCE_CLASS[provenance]}`}
              title={PROVENANCE_HELP[provenance]}
            >
              {PROVENANCE_LABEL[provenance]}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2">
        <label className="text-[10px] uppercase tracking-wide text-slate-500">
          Evidence · URL, sustainability report page, or assurance letter ref
        </label>
        <textarea
          value={evidence}
          onChange={(e) => onEvidenceChange(e.target.value)}
          rows={2}
          readOnly={readOnly}
          disabled={readOnly}
          placeholder="e.g. https://borrower.example.com/sustainability-2024.pdf · pp. 42-46 (KPMG assurance opinion)"
          className="mt-1 w-full rounded-md border border-line/60 bg-panel/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-line focus:outline-none disabled:opacity-60"
        />
        <EvidenceAttachments
          entityType="pcaf_availability"
          entityId={borrowerId}
          fieldKey={fieldKey}
          compact
          readOnly={readOnly}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">{meta.citation}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-inference footer — what borrower fields drove the suggested answers
// ---------------------------------------------------------------------------

function AutoInferenceFooter({
  sources,
}: {
  sources: {
    dataTier: string | null;
    publiclyListed: boolean;
    evSource: string;
    facilityCount: number;
    nrbSector: string;
  };
}) {
  return (
    <div className="rounded-md border border-dashed border-line/50 bg-panel/20 p-3 text-[11px] text-slate-500">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Auto-inference source
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
        <Kv label="Sector" value={sources.nrbSector} />
        <Kv label="Data tier" value={sources.dataTier ?? "unknown"} />
        <Kv label="Publicly listed" value={sources.publiclyListed ? "yes" : "no"} />
        <Kv label="EV source" value={sources.evSource} />
        <Kv
          label="Matched facilities"
          value={sources.facilityCount.toString()}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        These borrower-catalogue fields drive the suggested answers above.
        Change an answer when you have primary evidence (annual report,
        assurance letter, utility bill); saving records who decided it and
        when.
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>{" "}
      <span className="text-slate-300">{value}</span>
    </div>
  );
}
