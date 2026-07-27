"use client";

/**
 * ESDD wizard — client component.
 *
 * Multi-step form that walks a signed-in officer through NRB ESRM Annex 5:
 *   Step 0: Basic Information (client name, sector, transaction id, etc.)
 *   Step 1: Section 1 — General Risk           (annex5.1.1 to 1.3)
 *   Step 2: Section 2 — Environmental Health   (annex5.2.1 to 2.4)
 *   Step 3: Section 3 — Social Risks           (annex5.3.1 to 3.4)
 *   Step 4: Review + submit (Phase 3 wires the final ESRM screening save)
 *
 * Each answer POSTs to /api/esdd/responses on change so nothing is lost if
 * the officer navigates away mid-wizard. Existing responses are loaded on
 * mount so the officer can resume where they left off.
 *
 * This session ships steps 0 and 1 fully wired. Steps 2, 3, and 4 render
 * placeholders — the pattern from step 1 is copied in a follow-up session
 * (small mechanical change).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Borrower, Loan } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import {
  ANNEX5_EHS_RISK,
  ANNEX5_GENERAL_RISK,
  ANNEX5_SECTOR_SUPPLEMENTS,
  ANNEX5_SOCIAL_RISK,
  type EsddAnswer,
  type EsddQuestion,
} from "@/lib/regulatory/esdd/annex5-questions";
import { sectorSlugFor } from "@/lib/regulatory/esdd/sector-slug";
import { formatNpr } from "@/components/bfi/ui";

// Steps: 0 basics, 1 general, 2 ehs, 3 social, 4 sector supplement
// (conditional), 5 review. When there is no sector supplement, the
// wizard skips 4 and goes directly from 3 to 5.
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

const SECTOR_TITLE: Record<string, string> = {
  hydropower: "Hydropower supplement",
  cement: "Cement supplement",
  textiles: "Textiles supplement",
  steel: "Steel supplement",
  chemicals: "Chemicals supplement",
  brick: "Brick supplement",
  agriculture: "Agriculture supplement",
};

type StoredResponse = {
  questionId: string;
  answer: EsddAnswer;
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

export function EsddWizard({
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
  // Guided-tour hook: when the URL carries ?tourStep=N, the wizard
  // renders that specific step and skips the auto-jump-to-Review
  // behavior that normally kicks in when a saved screening exists.
  // The loan-officer tour uses this to walk through every wizard step.
  const tourStep = (() => {
    const raw = searchParams?.get("tourStep");
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 5) return null;
    return n as WizardStep;
  })();
  const isTourDriven = tourStep !== null;
  const [step, setStep] = useState<WizardStep>(tourStep ?? 0);
  const [responses, setResponses] = useState<Record<string, StoredResponse>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [loading, setLoading] = useState(true);
  // Latest saved screening for this loan, if one exists. Loaded on mount
  // in parallel with the responses so the review step and the review
  // landing can render as "re-run" instead of "first save".
  const [priorScreening, setPriorScreening] = useState<SavedScreening | null>(
    null,
  );

  // Load existing responses + prior screening on mount so the officer can
  // resume or see the previously saved decision.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [respRes, scrRes] = await Promise.all([
          fetch(`/api/esdd/responses?loanId=${encodeURIComponent(loan.id)}`),
          fetch(`/api/esrm/screenings?loanId=${encodeURIComponent(loan.id)}`).catch(
            () => null,
          ),
        ]);
        if (cancelled) return;
        if (respRes.ok) {
          const body = (await respRes.json()) as { responses: StoredResponse[] };
          const map: Record<string, StoredResponse> = {};
          for (const r of body.responses) map[r.questionId] = r;
          setResponses(map);
        }
        if (scrRes && scrRes.ok) {
          const body = await scrRes.json();
          if (body?.latest) {
            setPriorScreening({
              id: body.latest.id,
              capturedAt: body.latest.captured_at,
              riskClass: body.latest.computed_risk_class,
              recommendation: body.latest.computed_recommendation,
              escalationFlag: body.latest.escalation_flag,
              rationale: body.latest.computed_rationale,
              drivingQuestionIds: [],
            });
            // Advance to the Review step so the sidebar highlight
            // matches the ScreeningResult that ReviewStep will render.
            // Sector-supplemented sectors have a Section 4 supplement,
            // pushing Review to index 5 (0-based). Otherwise Review is
            // at index 4.
            // Suppress this auto-jump when a tour is driving specific
            // steps via ?tourStep=N — the tour narration walks through
            // every step and does not want the wizard to short-circuit
            // to the Review pane.
            if (!isTourDriven) {
              const supplementSlug = sectorSlugFor(borrower.nrbSector);
              const supplement = supplementSlug
                ? ANNEX5_SECTOR_SUPPLEMENTS[supplementSlug]
                : undefined;
              setStep(supplement && supplement.length > 0 ? 5 : 4);
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loan.id]);

  // Sync the wizard step to the URL when the tour advances tourStep.
  // Without this, the wizard would stay on whatever step the officer
  // was last on while the tour narration talks about a different step.
  useEffect(() => {
    if (tourStep !== null) setStep(tourStep);
  }, [tourStep]);

  async function recordAnswer(
    question: EsddQuestion,
    answer: EsddAnswer,
    remarks?: string,
  ) {
    setSaveStatus((prev) => ({ ...prev, [question.id]: "saving" }));
    try {
      const res = await fetch("/api/esdd/responses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          borrowerId: borrower.id,
          questionId: question.id,
          answer,
          remarks: remarks?.trim() || null,
        }),
      });
      if (!res.ok) {
        setSaveStatus((prev) => ({ ...prev, [question.id]: "error" }));
        return;
      }
      const body = (await res.json()) as { capturedAt: string };
      setResponses((prev) => ({
        ...prev,
        [question.id]: {
          questionId: question.id,
          answer,
          remarks: remarks?.trim() || null,
          capturedAt: body.capturedAt,
        },
      }));
      setSaveStatus((prev) => ({ ...prev, [question.id]: "saved" }));
    } catch {
      setSaveStatus((prev) => ({ ...prev, [question.id]: "error" }));
    }
  }

  // Detect the borrower's sector supplement (if any) once — the wizard
  // conditionally shows a Section 4 step for sector-specific questions.
  const sectorSlug = sectorSlugFor(borrower.nrbSector);
  const sectorQuestions = sectorSlug
    ? ANNEX5_SECTOR_SUPPLEMENTS[sectorSlug] ?? []
    : [];
  const hasSectorSupplement = sectorQuestions.length > 0;

  const steps = useMemo(
    () =>
      hasSectorSupplement
        ? [
            { title: "Basic information", subtitle: "Client, transaction, and sector" },
            { title: "Section 1", subtitle: `General Risk (${ANNEX5_GENERAL_RISK.length} questions)` },
            { title: "Section 2", subtitle: `Environmental Health & Safety (${ANNEX5_EHS_RISK.length} questions)` },
            { title: "Section 3", subtitle: `Social Risks (${ANNEX5_SOCIAL_RISK.length} questions)` },
            {
              title: "Section 4",
              subtitle: `${SECTOR_TITLE[sectorSlug!] ?? "Sector supplement"} (${sectorQuestions.length} questions)`,
            },
            { title: "Review", subtitle: "Computed risk classification and recommendation" },
          ]
        : [
            { title: "Basic information", subtitle: "Client, transaction, and sector" },
            { title: "Section 1", subtitle: `General Risk (${ANNEX5_GENERAL_RISK.length} questions)` },
            { title: "Section 2", subtitle: `Environmental Health & Safety (${ANNEX5_EHS_RISK.length} questions)` },
            { title: "Section 3", subtitle: `Social Risks (${ANNEX5_SOCIAL_RISK.length} questions)` },
            { title: "Review", subtitle: "Computed risk classification and recommendation" },
          ],
    [hasSectorSupplement, sectorSlug, sectorQuestions.length],
  );

  // Navigation helpers: skip step 4 (sector) when there is no supplement,
  // so the wizard flows 3 → 5 directly.
  const advanceFromSocial = () =>
    setStep(hasSectorSupplement ? 4 : 5);
  const backFromReview = () =>
    setStep(hasSectorSupplement ? 4 : 3);

  return (
    <div className="min-h-screen bg-surface text-slate-100" data-tour="esdd-wizard">
      <TopBar
        tenantName={tenantName}
        officer={officer}
        loan={loan}
        borrower={borrower}
        onSaveExit={() => router.push("/")}
        onDiscardExit={() => router.push("/")}
      />
      <div className="mx-auto flex max-w-5xl gap-6 p-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <StepIndicator step={step} steps={steps} onJump={(s) => setStep(s as WizardStep)} />
        </aside>
        <main className="flex-1">
          {loading ? (
            <div className="rounded-2xl border border-line bg-panel p-6 text-sm text-slate-400">
              Loading existing answers…
            </div>
          ) : step === 0 ? (
            <BasicInfoStep loan={loan} borrower={borrower} onContinue={() => setStep(1)} />
          ) : step === 1 ? (
            <SectionStep
              title="Section 1 — General Risk"
              questions={ANNEX5_GENERAL_RISK}
              responses={responses}
              saveStatus={saveStatus}
              onAnswer={recordAnswer}
              onBack={() => setStep(0)}
              onContinue={() => setStep(2)}
            />
          ) : step === 2 ? (
            <SectionStep
              title="Section 2 — Environmental Health & Safety"
              questions={ANNEX5_EHS_RISK}
              responses={responses}
              saveStatus={saveStatus}
              onAnswer={recordAnswer}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          ) : step === 3 ? (
            <SectionStep
              title="Section 3 — Social Risks"
              questions={ANNEX5_SOCIAL_RISK}
              responses={responses}
              saveStatus={saveStatus}
              onAnswer={recordAnswer}
              onBack={() => setStep(2)}
              onContinue={advanceFromSocial}
            />
          ) : step === 4 && hasSectorSupplement ? (
            <SectionStep
              title={`Section 4 — ${SECTOR_TITLE[sectorSlug!] ?? "Sector supplement"}`}
              subtitle={`NRB expects these ${SECTOR_TITLE[sectorSlug!] ? SECTOR_TITLE[sectorSlug!].replace(" supplement", "").toLowerCase() : "sector-specific"} questions in addition to the core checklist.`}
              questions={sectorQuestions}
              responses={responses}
              saveStatus={saveStatus}
              onAnswer={recordAnswer}
              onBack={() => setStep(3)}
              onContinue={() => setStep(5)}
            />
          ) : (
            <ReviewStep
              loan={loan}
              borrower={borrower}
              responses={responses}
              priorScreening={priorScreening}
              sectorQuestions={sectorQuestions}
              onBack={backFromReview}
              onExit={() => router.push("/")}
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
        `/api/esdd/responses?loanId=${encodeURIComponent(loan.id)}`,
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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {tenantName} — ESDD checklist
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
            title="Discard every answer you have recorded for this loan"
          >
            Exit without saving
          </button>
          <button
            type="button"
            onClick={onSaveExit}
            className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            title="Answers are auto-saved as you record them. This just closes the wizard."
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
              Discard responses
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Exit without saving?
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              This will permanently delete every ESDD answer you have
              recorded for{" "}
              <span className="font-semibold text-white">{borrower.name}</span>{" "}
              (loan {loan.id}). Other officers&rsquo; work on this loan is
              not affected, and any ESRM screening already saved to the
              audit trail is preserved.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              If you just want to step away, use <em>Save &amp; exit</em>{" "}
              instead — your answers are already saved as you record them
              and you can resume later.
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

function BasicInfoStep({
  loan,
  borrower,
  onContinue,
}: {
  loan: Loan;
  borrower: Borrower;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <h2 className="text-lg font-semibold text-white">Basic information</h2>
      <p className="mt-1 text-sm text-slate-400">
        Prefilled from the loan and borrower record. NRB Annex 5 requires
        these fields to be captured at the top of every ESDD checklist.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" value={new Date().toISOString().slice(0, 10)} />
        <Field label="Transaction ID" value={loan.id} />
        <Field label="Client / Account" value={borrower.name} />
        <Field label="Industry / Sector" value={borrower.nrbSector} />
        <Field label="Location" value={loan.branch ?? "—"} />
        <Field label="Business line" value={loan.businessUnit ?? "—"} />
        <Field label="Product manufactured / traded" value={loan.purpose || "—"} />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          Continue to Section 1 →
        </button>
      </div>
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

function SectionStep({
  title,
  subtitle,
  questions,
  responses,
  saveStatus,
  onAnswer,
  onBack,
  onContinue,
}: {
  title: string;
  subtitle?: string;
  questions: EsddQuestion[];
  responses: Record<string, StoredResponse>;
  saveStatus: Record<string, SaveStatus>;
  onAnswer: (q: EsddQuestion, a: EsddAnswer, remarks?: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const answered = questions.filter((q) => responses[q.id]).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <div className="text-xs text-slate-400">
            {answered}/{questions.length} answered
          </div>
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        )}
      </div>

      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          stored={responses[q.id] ?? null}
          status={saveStatus[q.id] ?? "idle"}
          onAnswer={onAnswer}
        />
      ))}

      <div className="mt-2 flex justify-between">
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
          Continue →
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  stored,
  status,
  onAnswer,
}: {
  question: EsddQuestion;
  stored: StoredResponse | null;
  status: SaveStatus;
  onAnswer: (q: EsddQuestion, a: EsddAnswer, remarks?: string) => void;
}) {
  const [remarks, setRemarks] = useState<string>(stored?.remarks ?? "");
  const current = stored?.answer;

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Question {question.number}
      </div>
      <div className="mb-4 text-sm text-white">{question.prompt}</div>

      <div className="flex flex-col gap-2">
        {(["a", "b", "c", "d"] as const).map((letter) => {
          const isSelected = current === letter;
          return (
            <button
              key={letter}
              type="button"
              onClick={() =>
                onAnswer(question, letter, remarks || undefined)
              }
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                isSelected
                  ? "bg-white/5"
                  : "border-line bg-panelAlt hover:bg-white/5"
              }`}
              style={
                isSelected
                  ? { borderColor: "var(--brand-primary)" }
                  : undefined
              }
            >
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: isSelected
                    ? "var(--brand-primary)"
                    : "transparent",
                  color: isSelected ? "#fff" : "var(--brand-primary)",
                  borderWidth: isSelected ? 0 : 1,
                  borderStyle: "solid",
                  borderColor: "var(--brand-primary)",
                }}
              >
                {letter.toUpperCase()}
              </span>
              <span className="text-slate-200">
                {question.options[letter]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
          Remarks (optional)
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          onBlur={() => {
            if (current) onAnswer(question, current, remarks || undefined);
          }}
          rows={2}
          placeholder="Field notes, evidence references, mitigation commitments…"
          className="w-full rounded-md border border-line bg-panelAlt px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      {question.guidanceNotes && question.guidanceNotes.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
            NRB guidance notes
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-slate-400">
            {question.guidanceNotes.map((note, i) => (
              <li key={i} className="list-disc">
                {note}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 text-xs text-slate-500">
        {status === "saving" && "Saving…"}
        {status === "saved" && stored && (
          <>
            Saved{" "}
            <span className="text-slate-400">
              {new Date(stored.capturedAt).toLocaleString()}
            </span>
          </>
        )}
        {status === "error" && (
          <span className="text-red-400">Save failed — retry the answer.</span>
        )}
      </div>
    </div>
  );
}

type SavedScreening = {
  id: string;
  capturedAt: string;
  riskClass: "low" | "medium" | "high" | "extreme";
  recommendation: "approve" | "approve-with-conditions" | "decline";
  escalationFlag: boolean;
  rationale: string;
  drivingQuestionIds: string[];
};

function ReviewStep({
  loan,
  borrower,
  responses,
  priorScreening,
  sectorQuestions,
  onBack,
  onExit,
}: {
  loan: Loan;
  borrower: Borrower;
  responses: Record<string, StoredResponse>;
  priorScreening: SavedScreening | null;
  sectorQuestions: EsddQuestion[];
  onBack: () => void;
  onExit: () => void;
}) {
  const totalAnswered = Object.keys(responses).length;
  const totalQuestions =
    ANNEX5_GENERAL_RISK.length +
    ANNEX5_EHS_RISK.length +
    ANNEX5_SOCIAL_RISK.length +
    sectorQuestions.length;
  const [saving, setSaving] = useState(false);
  // If a prior screening exists, land on the result view rather than the
  // review form. The officer can still click "Re-run screening" to
  // re-compute against the current responses.
  const [saved, setSaved] = useState<SavedScreening | null>(priorScreening);
  const [error, setError] = useState<string | null>(null);
  const isRerun = priorScreening !== null;

  async function saveScreening() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/esrm/screenings", {
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
      setSaved(body.screening);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <ScreeningResult
        screening={saved}
        borrower={borrower}
        loan={loan}
        onExit={onExit}
        onRerun={() => {
          // Drop into the review form so the officer can re-compute
          // against the current responses. The prior screening stays in
          // the audit trail either way.
          setSaved(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-panel p-6">
        <h2 className="text-lg font-semibold text-white">
          {isRerun ? "Re-run screening" : "Review and save"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {isRerun ? (
            <>
              A screening was already saved for this loan. Re-running will
              score the current responses again and append a new screening
              row to the audit trail — the prior one is preserved.
            </>
          ) : (
            <>
              {totalAnswered} of {totalQuestions} question{totalQuestions === 1 ? "" : "s"} answered.
              Saving will run the scoring engine over the latest response
              for each question, derive a risk class and recommendation per
              NRB ESRM guidance, and record the final screening in the
              audit trail against your officer identity.
            </>
          )}
        </p>

        {totalAnswered < totalQuestions && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Some questions are unanswered. You can still save now — the
            engine will treat missing questions as not-applicable, but
            unanswered questions do NOT count as 'not applicable' per NRB.
            For a defensible screening, complete every question or record
            'd' (Not applicable) explicitly.
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
          <button
            type="button"
            onClick={saveScreening}
            disabled={saving || totalAnswered === 0}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {saving
              ? "Saving screening…"
              : isRerun
                ? "Re-run screening with current answers"
                : "Compute risk and save screening"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScreeningResult({
  screening,
  borrower,
  loan,
  onExit,
  onRerun,
}: {
  screening: SavedScreening;
  borrower: Borrower;
  loan: Loan;
  onExit: () => void;
  onRerun?: () => void;
}) {
  const RISK_COLORS: Record<SavedScreening["riskClass"], string> = {
    low: "#22c55e",
    medium: "#eab308",
    high: "#f97316",
    extreme: "#ef4444",
  };
  const REC_LABEL: Record<SavedScreening["recommendation"], string> = {
    approve: "Approve",
    "approve-with-conditions": "Approve with conditions",
    decline: "Decline",
  };
  return (
    <div className="flex flex-col gap-4">
      {screening.escalationFlag && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold">Escalated to credit committee</div>
          <div className="mt-1 text-xs">
            One or more questions received a 'c' answer per NRB ESRM Annex 5.
            This screening must be reviewed by the credit committee before
            approval per NRB guidance.
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-panel p-6">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          ESRM screening result
        </div>
        <div className="mt-1 text-lg font-semibold text-white">
          {borrower.name} · {loan.id}
        </div>
        <div className="text-xs text-slate-400">
          Saved {new Date(screening.capturedAt).toLocaleString()}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Risk class
            </div>
            <div
              className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: RISK_COLORS[screening.riskClass] }}
            >
              {screening.riskClass.toUpperCase()}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Recommendation
            </div>
            <div className="mt-2 text-sm text-white">
              {REC_LABEL[screening.recommendation]}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Rationale
          </div>
          <p className="mt-2 text-sm text-slate-200">{screening.rationale}</p>
        </div>

        {screening.drivingQuestionIds.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Driving questions
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {screening.drivingQuestionIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-line bg-panelAlt px-2 py-0.5 text-xs text-slate-300"
                >
                  {id.replace("annex5.", "Q ")}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {onRerun ? (
            <button
              type="button"
              onClick={onRerun}
              className="rounded-md border border-line bg-panel px-4 py-2 text-sm text-slate-200 hover:bg-line/30"
            >
              Re-run screening with current answers
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
    </div>
  );
}
