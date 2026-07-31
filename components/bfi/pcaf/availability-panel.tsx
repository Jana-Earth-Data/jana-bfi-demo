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
 * Each flag pre-fills from `inferPcafAvailability` (an AUTO badge is
 * shown next to the toggle).  When the officer flips a toggle, the badge
 * changes to OVERRIDE (yellow) and the flag is persisted via POST on
 * save.  Per-flag evidence textareas capture the URL / doc reference
 * the officer looked at — that's what an auditor asks for next to the
 * score.
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

  // Per-flag override indicator: has the officer diverged from the inferred
  // value?  Uses the *local* state so the badge flips the instant a toggle
  // changes, not just after save.
  const overrideByFlag = useMemo(() => {
    if (!inferred || !localFlags) return {} as Record<FlagKey, boolean>;
    const out: Partial<Record<FlagKey, boolean>> = {};
    for (const row of FLAG_ROWS) {
      out[row.key] = inferred[row.key] !== localFlags[row.key];
    }
    return out as Record<FlagKey, boolean>;
  }, [inferred, localFlags]);

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
      subtitle="Which data does the borrower publish? What did we find? Officer confirms or overrides the auto-inferred flags."
    >
      <div data-tour="pcaf-availability-panel" className="space-y-3">
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
                  isOverride={!!overrideByFlag[row.key]}
                  evidence={localEvidence[row.key] ?? ""}
                  onToggle={() => toggleFlag(row.key)}
                  onEvidenceChange={(v) => updateEvidence(row.key, v)}
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
                    No override on file · inferred values shown from borrower
                    catalog.
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

function FlagRow({
  meta,
  value,
  isOverride,
  evidence,
  onToggle,
  onEvidenceChange,
}: {
  meta: FlagMeta;
  value: boolean;
  isOverride: boolean;
  evidence: string;
  onToggle: () => void;
  onEvidenceChange: (v: string) => void;
}) {
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
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={onToggle}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              value
                ? "border-transparent"
                : "border-line/60 bg-panelAlt"
            }`}
            style={
              value
                ? { backgroundColor: "var(--brand-primary)" }
                : undefined
            }
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                value ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              isOverride
                ? "bg-amber-500/20 text-amber-200"
                : "bg-slate-500/20 text-slate-300"
            }`}
            title={
              isOverride
                ? "Officer has overridden the auto-inferred value"
                : "Auto-inferred from borrower catalog"
            }
          >
            {isOverride ? "OVERRIDE" : "AUTO"}
          </span>
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
          placeholder="e.g. https://borrower.example.com/sustainability-2024.pdf · pp. 42-46 (KPMG assurance opinion)"
          className="mt-1 w-full rounded-md border border-line/60 bg-panel/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-line focus:outline-none"
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">{meta.citation}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-inference footer — what borrower fields drove the AUTO suggestion
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
        These borrower-catalog fields drive the AUTO suggestion. Override
        when you have primary evidence (annual report, assurance letter,
        utility bill).
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
