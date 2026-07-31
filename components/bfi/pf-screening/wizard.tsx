"use client";

/**
 * PF Screening wizard — client component.
 *
 * Multi-step form that walks a signed-in officer through the 2022 NRB ESRM
 * Guideline Annex 5b Project Finance Screening Questionnaire (IFC-PS
 * aligned). One step per Performance Standard (PS1..PS8), plus a Review
 * step that surfaces the PS-breakdown, the aggregate flag count and the
 * computed PF risk classification.
 *
 * Answers auto-save to /api/pf-screening/responses on change; final submit
 * to /api/pf-screening/submit records the computed screening.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Borrower, Loan } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import {
  ANNEX5B_BY_PS,
  type Annex5bItem,
} from "@/lib/regulatory/esdd/annex5b-pf-questions";
import {
  IFC_PS_TITLE,
  type IfcPS,
  type PfAnswer,
  type PfScreeningResponse,
  type PfScreeningResult,
} from "@/lib/regulatory/esdd/annex5b-pf-types";
import { scorePfScreening } from "@/lib/regulatory/esdd/annex5b-pf-scoring";
import { formatNpr } from "@/components/bfi/ui";

const PS_ORDER: IfcPS[] = [
  "PS1",
  "PS2",
  "PS3",
  "PS4",
  "PS5",
  "PS6",
  "PS7",
  "PS8",
];

// Steps: 0..7 = one per PS; 8 = review.
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const REVIEW_STEP = 8 as const;

type StoredResponse = {
  itemId: string;
  ifcPS: string;
  answer: PfAnswer;
  remarks: string | null;
  capturedAt: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const ROLE_LABEL: Record<Officer["role"], string> = {
  loan_officer: "Loan officer",
  esg_officer: "ESG officer",
  compliance: "Compliance",
  credit_committee: "Credit committee",
};

const RISK_COLORS: Record<PfScreeningResult["riskClass"], string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const RISK_LABEL: Record<PfScreeningResult["riskClass"], string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

export function PfScreeningWizard({
  tenantName,
  officer,
  loan,
  borrower,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Guided-tour hook — same pattern as EsddWizard. When the URL carries
  // ?tourStep=N (0..8), render that specific step and suppress the
  // auto-jump-to-Review that fires when a saved result exists. Lets the
  // PF tour walk PS1→PS2→PS3→…→Review without the wizard collapsing.
  const tourStep = (() => {
    const raw = searchParams?.get("tourStep");
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > REVIEW_STEP) return null;
    return n as WizardStep;
  })();
  const isTourDriven = tourStep !== null;
  const [step, setStep] = useState<WizardStep>(tourStep ?? 0);
  const [responses, setResponses] = useState<Record<string, StoredResponse>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [loading, setLoading] = useState(true);
  const [priorResult, setPriorResult] = useState<PfScreeningResult | null>(null);

  // Track tourStep changes so navigating between /pf-screening/X?tourStep=1
  // and ?tourStep=2 within a live tour actually flips the wizard step.
  useEffect(() => {
    if (tourStep !== null) setStep(tourStep);
  }, [tourStep]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/pf-screening/loan/${encodeURIComponent(loan.id)}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          const map: Record<string, StoredResponse> = {};
          for (const r of body.responses as StoredResponse[]) {
            map[r.itemId] = r;
          }
          setResponses(map);
          if (body.latestResult) {
            const summary: PfScreeningResult = {
              totalItems: 0,
              itemsAnswered: body.latestResult.items_answered,
              itemsApplicable: body.latestResult.items_applicable,
              itemsFlagged: body.latestResult.items_flagged,
              criticalFlaggedItems: body.latestResult.critical_flagged_items ?? [],
              psBreakdown: body.latestResult.ps_breakdown ?? [],
              riskClass: body.latestResult.computed_risk_class,
              rationale: body.latestResult.computed_rationale,
            };
            setPriorResult(summary);
            // Only auto-jump to Review when NOT tour-driven. When the
            // tour is driving via ?tourStep, respect its cadence.
            if (!isTourDriven) setStep(REVIEW_STEP);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan.id]);

  async function recordAnswer(
    item: Annex5bItem,
    answer: PfAnswer,
    remarks?: string,
  ) {
    setSaveStatus((prev) => ({ ...prev, [item.id]: "saving" }));
    try {
      const res = await fetch("/api/pf-screening/responses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          borrowerId: borrower.id,
          itemId: item.id,
          ifcPS: item.ifcPS,
          answer,
          remarks: remarks?.trim() || null,
        }),
      });
      if (!res.ok) {
        setSaveStatus((prev) => ({ ...prev, [item.id]: "error" }));
        return;
      }
      const body = (await res.json()) as { capturedAt: string };
      setResponses((prev) => ({
        ...prev,
        [item.id]: {
          itemId: item.id,
          ifcPS: item.ifcPS,
          answer,
          remarks: remarks?.trim() || null,
          capturedAt: body.capturedAt,
        },
      }));
      setSaveStatus((prev) => ({ ...prev, [item.id]: "saved" }));
    } catch {
      setSaveStatus((prev) => ({ ...prev, [item.id]: "error" }));
    }
  }

  const steps = useMemo(
    () => [
      ...PS_ORDER.map((ps) => ({
        title: ps,
        subtitle: `${IFC_PS_TITLE[ps]} (${ANNEX5B_BY_PS[ps].length} items)`,
      })),
      {
        title: "Review",
        subtitle: "PS breakdown + overall PF risk classification",
      },
    ],
    [],
  );

  const currentPs = step < REVIEW_STEP ? PS_ORDER[step] : null;

  return (
    <div
      className="min-h-screen bg-surface text-slate-100"
      data-tour="pf-screening-wizard"
    >
      <TopBar
        tenantName={tenantName}
        officer={officer}
        loan={loan}
        borrower={borrower}
        onSaveExit={() => router.push("/")}
        onDiscardExit={() => router.push("/")}
      />
      <div className="mx-auto flex max-w-6xl gap-6 p-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <StepIndicator
            step={step}
            steps={steps}
            onJump={(s) => setStep(s as WizardStep)}
          />
        </aside>
        <main className="flex-1">
          {loading ? (
            <div className="rounded-2xl border border-line bg-panel p-6 text-sm text-slate-400">
              Loading existing answers…
            </div>
          ) : currentPs ? (
            <PsStep
              ifcPS={currentPs}
              items={ANNEX5B_BY_PS[currentPs]}
              responses={responses}
              saveStatus={saveStatus}
              onAnswer={recordAnswer}
              onBack={step > 0 ? () => setStep((step - 1) as WizardStep) : undefined}
              onContinue={() => setStep((step + 1) as WizardStep)}
            />
          ) : (
            <ReviewStep
              loan={loan}
              borrower={borrower}
              responses={responses}
              priorResult={priorResult}
              onBack={() => setStep(7)}
              onExit={() => router.push(`/esdd/${loan.id}`)}
              onSaved={(r) => setPriorResult(r)}
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
  onSaveExit,
  onDiscardExit,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
  onSaveExit: () => void;
  onDiscardExit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discardAndExit() {
    setDiscarding(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pf-screening/responses?loanId=${encodeURIComponent(loan.id)}`,
        { method: "DELETE" },
      );
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {tenantName} — Project Finance screening (Annex 5b)
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
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-md border border-rose-500/40 bg-rose-500/5 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/15"
            title="Discard every Annex 5b answer you have recorded for this loan"
          >
            Exit without saving
          </button>
          <button
            type="button"
            onClick={onSaveExit}
            className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            title="Answers auto-save. This just closes the wizard."
          >
            Save & exit
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
              Discard PF screening answers
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Exit without saving?
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              This will permanently delete every Annex 5b Project Finance
              answer you have recorded for{" "}
              <span className="font-semibold text-white">{borrower.name}</span>{" "}
              (loan {loan.id}). Other officers&rsquo; work on this loan is
              not affected, and any PF screening result already saved to
              the audit trail is preserved.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              If you just want to step away, use <em>Save &amp; exit</em>{" "}
              instead — answers are auto-saved as you record them and you
              can resume later.
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
                className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
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
}: {
  step: number;
  steps: { title: string; subtitle: string }[];
  onJump: (s: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const active = i === step;
        const past = i < step;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-white/20 bg-white/5"
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

function PsStep({
  ifcPS,
  items,
  responses,
  saveStatus,
  onAnswer,
  onBack,
  onContinue,
}: {
  ifcPS: IfcPS;
  items: Annex5bItem[];
  responses: Record<string, StoredResponse>;
  saveStatus: Record<string, SaveStatus>;
  onAnswer: (item: Annex5bItem, a: PfAnswer, remarks?: string) => void;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const answered = items.filter((it) => responses[it.id]).length;
  // Group by area so the wizard renders the sub-headings from the source.
  const areas: { area: string; items: Annex5bItem[] }[] = [];
  for (const it of items) {
    const last = areas[areas.length - 1];
    if (last && last.area === it.area) {
      last.items.push(it);
    } else {
      areas.push({ area: it.area, items: [it] });
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {ifcPS} — {IFC_PS_TITLE[ifcPS]}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              IFC Performance Standard {ifcPS.slice(2)} · Annex 5b screening
            </p>
          </div>
          <div className="text-xs text-slate-400">
            {answered}/{items.length} answered
          </div>
        </div>
      </div>

      {areas.map((group) => (
        <div key={group.area} className="flex flex-col gap-3">
          <div className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.area}
          </div>
          {group.items.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              stored={responses[it.id] ?? null}
              status={saveStatus[it.id] ?? "idle"}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      ))}

      <div className="mt-2 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  stored,
  status,
  onAnswer,
}: {
  item: Annex5bItem;
  stored: StoredResponse | null;
  status: SaveStatus;
  onAnswer: (i: Annex5bItem, a: PfAnswer, remarks?: string) => void;
}) {
  const [remarks, setRemarks] = useState<string>(stored?.remarks ?? "");
  const current = stored?.answer;
  const isFlagged =
    current !== undefined && current === item.flagOnAnswer;

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {item.id.replace("annex5b.", "")}
        </div>
        {item.ifcPsTerminationTrigger && (
          <div className="flex flex-col items-end">
            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-200">
              IFC PS termination trigger
            </span>
            {item.terminationCitation && (
              <span className="mt-1 text-[10px] text-rose-300/80">
                {item.terminationCitation}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mb-4 text-sm text-white">{item.prompt}</div>

      <div className="flex flex-wrap gap-2">
        {(["yes", "no", "n/a"] as const).map((opt) => {
          const isSelected = current === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(item, opt, remarks || undefined)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                isSelected
                  ? "border-transparent text-white"
                  : "border-line bg-panelAlt text-slate-200 hover:bg-white/5"
              }`}
              style={
                isSelected
                  ? { backgroundColor: "var(--brand-primary)" }
                  : undefined
              }
            >
              {opt.toUpperCase()}
            </button>
          );
        })}
        {isFlagged && (
          <span className="ml-2 self-center text-[11px] font-semibold text-amber-300">
            ⚠ Flagged
          </span>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
          Remarks (optional)
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          onBlur={() => {
            if (current) onAnswer(item, current, remarks || undefined);
          }}
          rows={2}
          placeholder="Evidence references, mitigation commitments…"
          className="w-full rounded-md border border-line bg-panelAlt px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      {item.guidanceNote.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
            Guidance
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-slate-400">
            {item.guidanceNote.map((note, i) => (
              <li key={i} className="list-disc">
                {note}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>{item.citation}</span>
        <span>
          {status === "saving" && "Saving…"}
          {status === "saved" && stored && (
            <>
              Saved{" "}
              <span className="text-slate-400">
                {new Date(stored.capturedAt).toLocaleTimeString()}
              </span>
            </>
          )}
          {status === "error" && (
            <span className="text-red-400">Save failed — retry.</span>
          )}
        </span>
      </div>
    </div>
  );
}

function ReviewStep({
  loan,
  borrower,
  responses,
  priorResult,
  onBack,
  onExit,
  onSaved,
}: {
  loan: Loan;
  borrower: Borrower;
  responses: Record<string, StoredResponse>;
  priorResult: PfScreeningResult | null;
  onBack: () => void;
  onExit: () => void;
  onSaved: (r: PfScreeningResult) => void;
}) {
  // Compute a live preview against the current in-memory answers.
  const live: PfScreeningResponse = useMemo(() => {
    const m: PfScreeningResponse = {};
    for (const r of Object.values(responses)) {
      m[r.itemId] = r.answer;
    }
    return m;
  }, [responses]);
  const preview = useMemo(() => scorePfScreening(live), [live]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<PfScreeningResult | null>(priorResult);
  const isRerun = priorResult !== null;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pf-screening/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          borrowerId: borrower.id,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `Server returned ${res.status}`);
        return;
      }
      const result: PfScreeningResult = body.screening.result;
      setSaved(result);
      onSaved(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const displayed = saved ?? preview;

  return (
    <div className="flex flex-col gap-4">
      {displayed.riskClass === "critical" && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <div className="font-semibold">
            IFC PS termination trigger flagged — elevated review required
          </div>
          <div className="mt-1 text-xs">
            One or more Annex 5b items whose answer maps onto termination-
            grade language in the underlying IFC Performance Standards has
            been flagged (child/forced labor, forced eviction, critical
            habitat impact, IP relocation without FPIC, etc.). This
            screening must be reviewed by the credit committee before any
            approval.
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-panel p-6">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Annex 5b PF screening — {saved ? "saved result" : "live preview"}
        </div>
        <div className="mt-1 text-lg font-semibold text-white">
          {borrower.name} · {loan.id}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryStat label="Items answered" value={`${displayed.itemsAnswered} / ${preview.totalItems || displayed.itemsAnswered}`} />
          <SummaryStat label="Items flagged" value={String(displayed.itemsFlagged)} />
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              PF risk class
            </div>
            <div
              className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: RISK_COLORS[displayed.riskClass] }}
            >
              {RISK_LABEL[displayed.riskClass]}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Rationale
          </div>
          <p className="mt-2 text-sm text-slate-200">{displayed.rationale}</p>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Per-PS breakdown
          </div>
          <div className="mt-2 divide-y divide-line/60 rounded-lg border border-line bg-panelAlt">
            {displayed.psBreakdown.map((b) => (
              <div
                key={b.ifcPS}
                className="grid grid-cols-6 items-center gap-2 px-3 py-2 text-xs text-slate-200"
              >
                <span className="col-span-1 font-semibold text-white">
                  {b.ifcPS}
                </span>
                <span className="col-span-3 truncate text-slate-300">
                  {b.title}
                </span>
                <span className="col-span-1 text-right text-slate-400">
                  {b.answered}/{b.total} answered
                </span>
                <span
                  className={`col-span-1 text-right font-semibold ${
                    b.criticalFlagged > 0
                      ? "text-rose-300"
                      : b.flagged > 0
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                >
                  {b.flagged} flag{b.flagged === 1 ? "" : "s"}
                  {b.criticalFlagged > 0 && ` · ${b.criticalFlagged}★`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {displayed.criticalFlaggedItems.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              IFC PS termination triggers flagged
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {displayed.criticalFlaggedItems.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-200"
                >
                  {id.replace("annex5b.", "")}
                </span>
              ))}
            </div>
          </div>
        )}

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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving || displayed.itemsAnswered === 0}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving
                ? "Saving…"
                : isRerun
                  ? "Re-run with current answers"
                  : "Compute & save PF screening"}
            </button>
            {saved && (
              <button
                type="button"
                onClick={onExit}
                className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30"
              >
                Back to ESDD
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
