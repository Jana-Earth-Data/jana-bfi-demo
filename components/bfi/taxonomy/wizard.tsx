"use client";

/**
 * Taxonomy classification wizard — client component.
 *
 * Multi-step form that walks a signed-in officer through NRB Green
 * Finance Taxonomy (October 2024) classification for a single loan:
 *   Step 0: Loan and borrower basics (prefilled)
 *   Step 1: Activity picker — sector-suggested first, then full list
 *   Step 2: Criterion answers for the chosen activity
 *   Step 3: Review and save — runs activity.classify() and POSTs the
 *           derivation to /api/taxonomy/assessments, then renders the
 *           saved color, rationale, DNSH failures, and citation.
 *
 * Existing assessments are loaded on mount so a subsequent visit shows
 * the last saved classification, and the officer can re-run with fresh
 * answers if the underlying facts have changed.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Borrower, Loan } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import {
  TAXONOMY_ACTIVITIES,
  findActivityById,
  type TaxonomyActivity,
  type TaxonomyClassification,
  type TaxonomyColor,
  type TaxonomyCriterion,
} from "@/lib/regulatory/taxonomy/activities";
import { formatNpr } from "@/components/bfi/ui";
import { useLoanLock } from "@/components/bfi/shared/loan-lock-context";
import { LockedByBanner } from "@/components/bfi/shared/locked-by-banner";

type WizardStep = 0 | 1 | 2 | 3;

type SavedAssessment = {
  id: string;
  capturedAt: string;
  activityId: string;
  activityName: string;
  color: TaxonomyColor;
  rationale: string;
  citation: string;
  dnshFailures: string[];
  officer: { id: string; name: string; role: string };
};

const ROLE_LABEL: Record<Officer["role"], string> = {
  loan_officer: "Loan officer",
  esg_officer: "ESG officer",
  compliance: "Compliance",
  credit_committee: "Credit committee",
};

const COLOR_BG: Record<TaxonomyColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#64748b",
};

const COLOR_LABEL: Record<TaxonomyColor, string> = {
  green: "Green — Transformative",
  amber: "Amber — Transitional",
  red: "Red — Not aligned",
  unclassified: "Unclassified",
};

export function TaxonomyWizard({
  tenantName,
  officer,
  loan,
  borrower,
  suggestedActivityIds,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
  suggestedActivityIds: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Loan-lock context — P36. When the current officer is NOT the loan's
  // owner every input on this wizard renders read-only and the top of
  // the page shows a lock banner. The API also enforces this.
  const { isOwner, ownerOfficerName } = useLoanLock();
  const readOnly = !isOwner;
  // Guided-tour hook: when the URL carries ?tourStep=N the wizard
  // renders that step and suppresses the auto-jump-to-Review that
  // normally shows a saved assessment on mount. The loan-officer tour
  // walks the wizard through each step; taxonomy step range is 0-3.
  const tourStep = (() => {
    const raw = searchParams?.get("tourStep");
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 3) return null;
    return n as WizardStep;
  })();
  const isTourDriven = tourStep !== null;
  const [step, setStep] = useState<WizardStep>(tourStep ?? 0);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState<SavedAssessment | null>(null);
  const [savedFromApi, setSavedFromApi] = useState<{
    activityId: string;
    color: TaxonomyColor;
    rationale: string;
    citation: string;
    capturedAt: string;
  } | null>(null);
  // Newest captured_at present when this wizard opened, or null for a fresh
  // assessment. Scopes "Exit without saving" to this session's rows.
  const [baselineWatermark, setBaselineWatermark] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load prior assessment (if any) on mount so the officer lands on the
  // saved result view — and, if they click Edit criteria / Re-run, the
  // criterion answers are already pre-populated from the last save.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/taxonomy/assessments?loanId=${encodeURIComponent(loan.id)}`,
        );
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !body?.latest) return;
        const latest = body.latest;
        const activity = findActivityById(latest.activity_id);
        // Hydrate wizard state from the saved row.
        setSavedFromApi({
          activityId: latest.activity_id,
          color: latest.computed_color,
          rationale: latest.computed_rationale,
          citation: latest.citation,
          capturedAt: latest.captured_at,
        });
        // Watermark for a scoped discard — see the DELETE handler.
        setBaselineWatermark(latest.captured_at);
        setActivityId(latest.activity_id);
        if (latest.criterion_answers && typeof latest.criterion_answers === "object") {
          setAnswers(latest.criterion_answers as Record<string, unknown>);
        }
        // Land on the saved result view by default; officer can click
        // "Edit criteria" (in ResultCard) to jump into step 2 with the
        // prior answers already populated, or hit Re-run after editing.
        setSaved({
          id: latest.id,
          capturedAt: latest.captured_at,
          activityId: latest.activity_id,
          activityName: activity?.name ?? latest.activity_id,
          color: latest.computed_color,
          rationale: latest.computed_rationale,
          citation: latest.citation ?? "",
          dnshFailures: [],
          officer: {
            id: latest.officer_id,
            name: latest.officer_name ?? "prior assessment",
            role: "loan_officer",
          },
        });
        // Also advance the wizard step to Review so the sidebar
        // indicator matches the visible ResultCard. Without this the
        // left rail highlights step 1 (Loan basics) while the pane
        // shows the saved classification — visually inconsistent.
        // Suppressed under tour control so the tour can walk the wizard
        // through each step without the loading effect stealing focus.
        if (!isTourDriven) setStep(3);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loan.id]);

  // Sync wizard step to the tour URL param so the tour can drive
  // through each step by pushing distinct URLs.
  useEffect(() => {
    if (tourStep !== null) setStep(tourStep);
  }, [tourStep]);

  const activity = activityId ? findActivityById(activityId) : null;

  const steps = useMemo(
    () => [
      { title: "Loan basics", subtitle: "Client, transaction, sector" },
      {
        title: "Choose activity",
        subtitle: `${TAXONOMY_ACTIVITIES.length} taxonomy activities`,
      },
      {
        title: "Answer criteria",
        subtitle: activity ? activity.name : "Select activity first",
      },
      { title: "Review", subtitle: "Computed classification" },
    ],
    [activity],
  );

  async function saveAssessment() {
    if (!activity) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/taxonomy/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          borrowerId: borrower.id,
          activityId: activity.id,
          criterionAnswers: answers,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `Server returned ${res.status}`);
        return;
      }
      setSaved(body.assessment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100" data-tour="taxonomy-wizard">
      <TopBar
        tenantName={tenantName}
        officer={officer}
        loan={loan}
        borrower={borrower}
        hasPriorAssessment={savedFromApi !== null}
        onSaveExit={() => router.push("/")}
        onDiscardExit={() => router.push("/")}
        baselineWatermark={baselineWatermark}
        readOnly={readOnly}
      />
      <div className="mx-auto flex max-w-5xl gap-6 p-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <StepIndicator
            step={step}
            steps={steps}
            onJump={(s) => setStep(s as WizardStep)}
            canJumpToCriteria={activity !== null}
          />
        </aside>
        <main className="flex-1 flex flex-col gap-4">
          {readOnly && <LockedByBanner ownerName={ownerOfficerName} />}
          {loading ? (
            <div className="rounded-2xl border border-line bg-panel p-6 text-sm text-slate-400">
              Loading prior assessments…
            </div>
          ) : saved && !isTourDriven ? (
            <ResultCard
              saved={saved}
              onEdit={
                readOnly
                  ? undefined
                  : () => {
                      setSaved(null);
                      setStep(2);
                    }
              }
              onExit={() => router.push("/")}
            />
          ) : step === 0 ? (
            <BasicsStep
              loan={loan}
              borrower={borrower}
              savedFromApi={savedFromApi}
              onContinue={() => setStep(1)}
            />
          ) : step === 1 ? (
            <ActivityPickerStep
              suggestedIds={suggestedActivityIds}
              currentId={activityId}
              onPick={(id) => {
                if (readOnly) return;
                setActivityId(id);
                setAnswers({});
                setStep(2);
              }}
              onBack={() => setStep(0)}
              readOnly={readOnly}
            />
          ) : step === 2 ? (
            activity ? (
              <CriteriaStep
                activity={activity}
                answers={answers}
                onChange={setAnswers}
                onBack={() => setStep(1)}
                onContinue={() => setStep(3)}
                readOnly={readOnly}
              />
            ) : (
              <div className="rounded-2xl border border-line bg-panel p-6 text-sm text-slate-400">
                Choose an activity first.
                <button
                  onClick={() => setStep(1)}
                  className="ml-3 rounded-md px-3 py-1 text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  Back to picker
                </button>
              </div>
            )
          ) : (
            <ReviewStep
              activity={activity!}
              answers={answers}
              saving={saving}
              error={error}
              onBack={() => setStep(2)}
              onSave={saveAssessment}
              readOnly={readOnly}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function TopBar({
  tenantName,
  officer,
  loan,
  borrower,
  hasPriorAssessment,
  onSaveExit,
  onDiscardExit,
  baselineWatermark,
  readOnly = false,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
  hasPriorAssessment: boolean;
  onSaveExit: () => void;
  onDiscardExit: () => void;
  /** Newest captured_at present at mount; rows at or before it survive. */
  baselineWatermark: string | null;
  /** When true the destructive "Exit without saving" action is hidden. */
  readOnly?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discardAndExit() {
    setDiscarding(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ loanId: loan.id });
      if (baselineWatermark) qs.set("since", baselineWatermark);
      const res = await fetch(`/api/taxonomy/assessments?${qs.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Server returned ${res.status}`);
        setDiscarding(false);
        return;
      }
      onDiscardExit();
    } catch (e) {
      setError((e as Error).message);
      setDiscarding(false);
    }
  }

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {tenantName} — NRB Green Finance Taxonomy
          </div>
          <div className="text-base font-semibold text-white">
            {borrower.name}{" "}
            <span className="text-slate-500">· {loan.id}</span>
          </div>
          <div className="text-xs text-slate-400">
            {borrower.nrbSector} · Outstanding {formatNpr(loan.outstandingNpr)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-300">{officer.name}</div>
            <div className="text-slate-500">{ROLE_LABEL[officer.role]}</div>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md border border-rose-500/40 bg-rose-500/5 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/15"
              title={
                hasPriorAssessment
                  ? "Delete the prior taxonomy classification for this loan and discard any answers on this page"
                  : "Discard any answers on this page (nothing has been saved yet)"
              }
            >
              Exit without saving
            </button>
          )}
          <button
            type="button"
            onClick={onSaveExit}
            className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            title={
              readOnly
                ? "Close the wizard and return to the dashboard."
                : "Close the wizard. Any prior saved classification is preserved."
            }
          >
            {readOnly ? "Close" : "Save & exit"}
          </button>
        </div>
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(2,6,23,0.85)" }}
          onClick={() => (discarding ? undefined : setConfirming(false))}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line p-6 shadow-2xl"
            style={{ backgroundColor: "#111827" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-wide text-rose-300">
              Discard classification
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Exit without saving?
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              {hasPriorAssessment ? (
                <>
                  This will permanently delete the prior taxonomy
                  classification saved for{" "}
                  <span className="font-semibold text-white">
                    {borrower.name}
                  </span>{" "}
                  (loan {loan.id}). Any answers you have entered on this
                  page are also discarded. Other officers&rsquo;
                  classifications on this loan are not affected.
                </>
              ) : (
                <>
                  This discards any answers you have entered on this page.
                  Nothing has been saved to the audit trail yet for this
                  loan, so no saved record is affected.
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              If you just want to step away without changing anything, use{" "}
              <em>Save &amp; exit</em> instead — the prior classification
              (if any) stays in the audit trail and you can pick this
              back up later.
            </p>
            {error && (
              <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={discarding}
                className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-slate-200 hover:bg-line/30 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={discardAndExit}
                disabled={discarding}
                className="rounded-md border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
              >
                {discarding ? "Discarding…" : "Discard and exit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({
  step,
  steps,
  onJump,
  canJumpToCriteria,
}: {
  step: number;
  steps: { title: string; subtitle: string }[];
  onJump: (s: number) => void;
  canJumpToCriteria: boolean;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const active = i === step;
        const past = i < step;
        const disabled = i >= 2 && !canJumpToCriteria;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => (disabled ? undefined : onJump(i))}
              disabled={disabled}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-white/20 bg-white/5"
                  : disabled
                    ? "border-line bg-panel/30 opacity-50"
                    : "border-line bg-panel/50 hover:bg-white/5"
              }`}
              style={active ? { borderColor: "var(--brand-primary)" } : undefined}
            >
              <span
                className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: active
                    ? "var(--brand-primary)"
                    : past
                      ? "var(--brand-primary-soft)"
                      : "transparent",
                  color: active ? "#fff" : "var(--brand-primary)",
                  borderWidth: past || active ? 0 : 1,
                  borderStyle: "solid",
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  {s.title}
                </span>
                <span className="block text-xs text-slate-400">
                  {s.subtitle}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function BasicsStep({
  loan,
  borrower,
  savedFromApi,
  onContinue,
}: {
  loan: Loan;
  borrower: Borrower;
  savedFromApi: {
    activityId: string;
    color: TaxonomyColor;
    rationale: string;
    citation: string;
    capturedAt: string;
  } | null;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold text-white">Loan basics</h2>
        <p className="mt-1 text-sm text-slate-400">
          Prefilled from the loan and borrower record. Please confirm before
          proceeding to the activity picker.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" value={new Date().toISOString().slice(0, 10)} />
          <Field label="Transaction ID" value={loan.id} />
          <Field label="Client / Account" value={borrower.name} />
          <Field label="Industry / Sector" value={borrower.nrbSector} />
          <Field label="Business line" value={loan.businessUnit ?? "—"} />
          <Field label="Purpose" value={loan.purpose ?? "—"} />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white transition"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Continue to activity picker →
          </button>
        </div>
      </div>

      {savedFromApi && (
        <div className="rounded-2xl border border-line bg-panel p-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Prior taxonomy assessment
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: COLOR_BG[savedFromApi.color] }}
            >
              {COLOR_LABEL[savedFromApi.color]}
            </span>
            <span className="text-xs text-slate-400">
              Saved {new Date(savedFromApi.capturedAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-300">{savedFromApi.rationale}</p>
          <div className="mt-2 text-xs italic text-slate-500">
            {savedFromApi.citation}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Running a new classification below will replace this on future
            reads. The prior assessment stays in the audit trail.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-100">{value}</div>
    </div>
  );
}

function ActivityPickerStep({
  suggestedIds,
  currentId,
  onPick,
  onBack,
  readOnly = false,
}: {
  suggestedIds: string[];
  currentId: string | null;
  onPick: (id: string) => void;
  onBack: () => void;
  readOnly?: boolean;
}) {
  const suggested = TAXONOMY_ACTIVITIES.filter((a) =>
    suggestedIds.includes(a.id),
  );
  const rest = TAXONOMY_ACTIVITIES.filter(
    (a) => !suggestedIds.includes(a.id),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold text-white">
          Choose the applicable activity
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Activities suggested for this borrower&rsquo;s NRB sector appear
          first. If none fit, the full catalog is below. Each activity
          carries its own criterion list from the taxonomy.
        </p>

        {suggested.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Suggested for this sector
            </div>
            <div className="flex flex-col gap-2">
              {suggested.map((a) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  selected={currentId === a.id}
                  onPick={onPick}
                  disabled={readOnly}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {suggested.length > 0 ? "Full catalog" : "All activities"}
          </div>
          <div className="flex flex-col gap-2">
            {rest.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                selected={currentId === a.id}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  selected,
  onPick,
  disabled = false,
}: {
  activity: TaxonomyActivity;
  selected: boolean;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(activity.id)}
      className={`flex items-start justify-between gap-4 rounded-lg border bg-panelAlt px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? "" : "border-line hover:bg-white/5"
      }`}
      style={selected ? { borderColor: "var(--brand-primary)" } : undefined}
    >
      <div className="flex-1">
        <div className="text-sm font-semibold text-white">{activity.name}</div>
        <div className="text-xs text-slate-400">
          {activity.sectorLabel} · {activity.criteria.length} criteria
        </div>
        <div className="mt-1 text-xs italic text-slate-500">
          {activity.nrbCitation}
        </div>
      </div>
      <div className="text-xs" style={{ color: "var(--brand-primary)" }}>
        {selected ? "Selected" : "Choose →"}
      </div>
    </button>
  );
}

function CriteriaStep({
  activity,
  answers,
  onChange,
  onBack,
  onContinue,
  readOnly = false,
}: {
  activity: TaxonomyActivity;
  answers: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onBack: () => void;
  onContinue: () => void;
  readOnly?: boolean;
}) {
  const setAnswer = (id: string, value: unknown) =>
    onChange({ ...answers, [id]: value });
  const answered = activity.criteria.filter(
    (c) => answers[c.id] !== undefined,
  ).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-white">
            Criteria for {activity.name}
          </h2>
          <div className="text-xs text-slate-400">
            {answered}/{activity.criteria.length} answered
          </div>
        </div>
        <div className="mt-1 text-xs italic text-slate-500">
          {activity.nrbCitation}
        </div>
      </div>

      {activity.criteria.map((c) => (
        <CriterionCard
          key={c.id}
          criterion={c}
          value={answers[c.id]}
          onChange={(v) => setAnswer(c.id, v)}
          readOnly={readOnly}
        />
      ))}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          Continue to review →
        </button>
      </div>
    </div>
  );
}

function CriterionCard({
  criterion,
  value,
  onChange,
  readOnly = false,
}: {
  criterion: TaxonomyCriterion;
  value: unknown;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 text-sm text-white">{criterion.prompt}</div>
      {criterion.type === "yes_no" ? (
        <div className="flex gap-2">
          {[true, false].map((b) => {
            const selected = value === b;
            return (
              <button
                key={String(b)}
                type="button"
                disabled={readOnly}
                onClick={() => onChange(b)}
                className={`rounded-md border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected ? "text-white" : "border-line bg-panelAlt text-slate-200 hover:bg-white/5"
                }`}
                style={
                  selected
                    ? {
                        backgroundColor: "var(--brand-primary)",
                        borderColor: "var(--brand-primary)",
                      }
                    : undefined
                }
              >
                {b ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={typeof value === "number" ? value : ""}
            readOnly={readOnly}
            disabled={readOnly}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
            className="w-32 rounded-md border border-line bg-panelAlt px-3 py-1.5 text-sm text-slate-100 focus:outline-none disabled:opacity-60"
          />
          <span className="text-xs text-slate-400">{criterion.unit}</span>
        </div>
      )}
      {criterion.helpText && (
        <div className="mt-3 text-xs text-slate-500">{criterion.helpText}</div>
      )}
    </div>
  );
}

function ReviewStep({
  activity,
  answers,
  saving,
  error,
  onBack,
  onSave,
  readOnly = false,
}: {
  activity: TaxonomyActivity;
  answers: Record<string, unknown>;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onSave: () => void;
  readOnly?: boolean;
}) {
  const preview: TaxonomyClassification = useMemo(
    () => activity.classify(answers),
    [activity, answers],
  );
  const answered = activity.criteria.filter(
    (c) => answers[c.id] !== undefined,
  ).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold text-white">Review and save</h2>
        <p className="mt-1 text-sm text-slate-400">
          Preview of the derivation below is computed live from your answers.
          Saving records the classification, rationale, and citation to the
          audit trail against your officer identity.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Activity
            </div>
            <div className="mt-1 text-sm text-slate-100">{activity.name}</div>
            <div className="text-xs italic text-slate-500">
              {activity.nrbCitation}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Answered
            </div>
            <div className="mt-1 text-sm text-slate-100">
              {answered}/{activity.criteria.length}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Preview classification
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: COLOR_BG[preview.color] }}
            >
              {COLOR_LABEL[preview.color]}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-200">{preview.rationale}</p>
          <div className="mt-2 text-xs italic text-slate-500">
            {preview.citation}
          </div>
          {preview.dnshFailures && preview.dnshFailures.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <div className="text-xs font-semibold text-amber-200">
                Do No Significant Harm — flagged items
              </div>
              <ul className="mt-1 space-y-0.5 pl-4 text-xs text-amber-100">
                {preview.dnshFailures.map((f, i) => (
                  <li key={i} className="list-disc">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30"
          >
            ← Back
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving ? "Saving…" : "Save classification"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  saved,
  onEdit,
  onExit,
}: {
  saved: SavedAssessment;
  /** Undefined when the current officer is not the loan's owner —
   *  hides the "Edit criteria" button. */
  onEdit?: () => void;
  onExit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        Taxonomy classification saved
      </div>
      <div className="mt-1 text-lg font-semibold text-white">
        {saved.activityName}
      </div>
      <div className="text-xs text-slate-400">
        Saved {new Date(saved.capturedAt).toLocaleString()} by{" "}
        {saved.officer.name}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: COLOR_BG[saved.color] }}
        >
          {COLOR_LABEL[saved.color]}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-200">{saved.rationale}</p>
      <div className="mt-2 text-xs italic text-slate-500">{saved.citation}</div>
      {saved.dnshFailures.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <div className="text-xs font-semibold text-amber-200">
            Do No Significant Harm — flagged items
          </div>
          <ul className="mt-1 space-y-0.5 pl-4 text-xs text-amber-100">
            {saved.dnshFailures.map((f, i) => (
              <li key={i} className="list-disc">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30"
          >
            Edit criteria
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onExit}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
