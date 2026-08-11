"use client";

/**
 * Officer work queue — the signed-in officer's loan-oriented view.
 *
 * Each row is a LOAN, not a compliance flow. Every loan card shows
 * both the ESDD chip and the Taxonomy chip side by side so the
 * officer sees the full regulatory obligation at a glance rather than
 * having to open one wizard, then hunt through a different tab for the
 * other.
 *
 * Sections:
 *   - Needs your attention: any required flow incomplete OR escalated
 *   - In review:            all required flows saved, awaiting manager /
 *                           committee sign-off
 *   - Recently closed:      approved / declined / withdrawn in the last
 *                           30 days (stubbed; requires a loan-status
 *                           change model to populate for real)
 *
 * Data source: /api/esdd/officer-queue (returns loan-cards, not flow rows).
 */

import { useEffect, useState } from "react";
import { formatNpr } from "@/components/bfi/ui";
import type { Officer } from "@/lib/tenants";

type RiskClass = "low" | "medium" | "high" | "extreme";
type TaxColor = "green" | "amber" | "red" | "unclassified";

type LoanCard = {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  lastActivityAt: string | null;
  reason: string;
  esdd: {
    answered: number;
    total: number;
    riskClass: RiskClass | null;
    escalated: boolean;
  };
  taxonomy: {
    applicable: boolean;
    color: TaxColor | null;
    activityId: string | null;
    activityName: string | null;
  };
  /**
   * NRB ESRM 2022 §4.3 climate flag — the officer sees a small badge
   * on the card when the loan's borrower is above the 25,000 tCO2e/yr
   * threshold without a reduction target on file.
   */
  climate?: {
    aboveThreshold: boolean;
    reductionTargetOnFile: boolean;
    estimatedAnnualTco2e: number;
  };
  /**
   * NRB ESRM 2022 Annex 5b — Project Finance Screening Questionnaire.
   * Rendered as a CTA only when `required` is true.
   */
  pfScreening?: {
    required: boolean;
    itemsAnswered: number;
    itemsTotal: number;
    riskClass: "low" | "medium" | "high" | "critical" | null;
    completed: boolean;
  };
  /**
   * PCAF Global GHG Standard Part A §5 data-availability confirmation.
   * Required on every loan under NFRS — always rendered as a CTA.
   */
  pcafAvailability?: {
    flagsConfirmed: number;
    flagsTotal: 4;
    completed: boolean;
  };
  /**
   * NRB Circular 22 §7.3.5 Corrective Action Plan summary. Only
   * rendered as a CTA when the loan's ESRR risk class is Medium /
   * High / Extreme — Low-risk loans don't require a CAP per §7.3.5.
   */
  cap?: {
    total: number;
    completed: number;
    overdue: number;
  };
};

type QueueBody = {
  ok: true;
  officer: { id: string; name: string; role: string };
  /** P36 split: assigned-or-touched loans (full compliance CTAs). */
  myLoans?: LoanCard[];
  /** P36 split: unassigned loans (single Open CTA that auto-claims). */
  availableToClaim?: LoanCard[];
  // Legacy fields (still returned for backward compatibility).
  needsAttention: LoanCard[];
  inReview: LoanCard[];
  recentlyClosed: LoanCard[];
};

const RISK_COLORS: Record<RiskClass, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  extreme: "#ef4444",
};

const TAX_COLORS: Record<TaxColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#64748b",
};

const TAX_LABEL: Record<TaxColor, string> = {
  green: "GREEN",
  amber: "AMBER",
  red: "RED",
  unclassified: "UNCLASSIFIED",
};

export function OfficerWorkQueue({
  currentOfficer,
}: {
  currentOfficer: Officer | null;
}) {
  const [data, setData] = useState<QueueBody | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOfficer) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/esdd/officer-queue");
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? `Server returned ${res.status}`);
          return;
        }
        setData(body as QueueBody);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOfficer?.id]);

  if (!currentOfficer) return null;

  // Prefer the P36 split fields when the API returns them; fall back
  // to the legacy needsAttention/inReview if it hasn't been redeployed.
  const myLoans = data?.myLoans ?? [
    ...(data?.needsAttention ?? []),
    ...(data?.inReview ?? []),
  ];
  const availableToClaim = data?.availableToClaim ?? [];

  return (
    <div className="rounded-2xl border border-line bg-panel">
      <div className="border-b border-line/60 px-6 py-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Your loans
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-base font-semibold text-white">
            {currentOfficer.name}
          </div>
          {data && (
            <div className="text-xs text-slate-400">
              {myLoans.length} assigned to you ·{" "}
              {availableToClaim.length} available to claim
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="px-6 py-4 text-sm text-slate-400">
          Loading your queue…
        </div>
      )}
      {error && (
        <div className="px-6 py-4 text-sm text-red-300">{error}</div>
      )}
      {data && !loading && !error && (
        <div className="divide-y divide-line/60">
          {/* -------- My loans -------- */}
          <QueueSection
            title={`My loans (${myLoans.length})`}
            rows={myLoans}
            emptyLabel="You have no assigned loans yet. Pick one below."
          />

          {/* -------- Available to claim --------
              Simple row per loan: borrower · loan id · category ·
              single Open CTA. Clicking navigates to the ESDD wizard,
              which auto-claims on load (P36). No "Claim" button — the
              first click IS the claim. */}
          <AvailableClaimSection rows={availableToClaim} />

          {data.recentlyClosed.length > 0 && (
            <QueueSection
              title="Recently closed"
              rows={data.recentlyClosed}
              emptyLabel=""
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Simpler section for the unassigned loans below the officer's own
 * work. Each row is a single tap-target — clicking anywhere on it
 * navigates to /esdd/{loanId}, which server-side auto-claims the loan
 * for the current officer.
 */
function AvailableClaimSection({ rows }: { rows: LoanCard[] }) {
  return (
    <div className="px-6 py-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Available to claim ({rows.length})
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">
          No loans currently available to claim. New applications will
          appear here as underwriting sends them.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <AvailableClaimRow key={row.loanId} card={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function AvailableClaimRow({ card }: { card: LoanCard }) {
  // Clicking the Open link auto-claims the loan on page load (P36 —
  // resolveLoanLock upserts the assignment for the current officer).
  return (
    <a
      href={`/esdd/${encodeURIComponent(card.loanId)}`}
      className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-panelAlt px-4 py-3 transition hover:bg-white/5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {card.borrowerName}
          </span>
          <span className="text-xs text-slate-500">{card.loanId}</span>
        </div>
        <div className="text-xs text-slate-400">
          {card.sector} · {formatNpr(card.outstandingNpr)} outstanding
        </div>
      </div>
      <span
        className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition group-hover:opacity-90"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        Open →
      </span>
    </a>
  );
}

function QueueSection({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: LoanCard[];
  emptyLabel: string;
}) {
  return (
    <div className="px-6 py-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">{emptyLabel}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, idx) => (
            <LoanCardRow
              key={row.loanId}
              card={row}
              tourAttr={idx === 0 ? "loan-card-primary" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LoanCardRow({
  card,
  tourAttr,
}: {
  card: LoanCard;
  tourAttr?: string;
}) {
  // Priority determines which CTA is styled as primary (filled brand
  // color); the other is a plain link. Officer can always click either.
  //   1. Escalated → ESDD (officer reviews the escalation trigger)
  //   2. ESDD incomplete → ESDD wizard
  //   3. ESDD done + taxonomy applicable but not done → taxonomy wizard
  //   4. Everything done → ESDD (review the saved screening)
  const esddDone = card.esdd.riskClass !== null;
  const taxDone = card.taxonomy.color !== null;
  const primaryFlow: "esdd" | "taxonomy" =
    card.esdd.escalated
      ? "esdd"
      : !esddDone
        ? "esdd"
        : card.taxonomy.applicable && !taxDone
          ? "taxonomy"
          : "esdd";

  const esddLabel = card.esdd.escalated
    ? "Review escalation"
    : esddDone
      ? "Review ESDD"
      : card.esdd.answered > 0
        ? "Continue ESDD"
        : "Start ESDD";
  const taxLabel = taxDone ? "Review taxonomy" : "Classify taxonomy";

  // PF-screening label mirrors ESDD's start/continue/review states.
  // Only rendered when card.pfScreening?.required is true (see below).
  const pfScreening = card.pfScreening;
  const pfLabel = pfScreening
    ? pfScreening.itemsAnswered === 0
      ? "Start PF screening"
      : pfScreening.completed
        ? "Review PF screening"
        : `Continue ${pfScreening.itemsAnswered}/${pfScreening.itemsTotal}`
    : "Start PF screening";

  // PCAF is always shown — flagsConfirmed is 0 or 4 in the current
  // schema (the four flags save together as a single row), so the
  // "Continue N/4" branch is defensive against future partial-save UX.
  const pcaf = card.pcafAvailability;
  const pcafLabel = pcaf
    ? pcaf.flagsConfirmed === 0
      ? "Start PCAF"
      : pcaf.completed
        ? "Review PCAF"
        : `Continue ${pcaf.flagsConfirmed}/4`
    : "Start PCAF";

  // CAP CTA — only shown when the loan's ESRR class requires one
  // (Medium / High / Extreme per NRB Circular 22 §7.3.5). Label
  // reflects total vs completed row count so the officer can tell at
  // a glance whether the CAP needs new items, more work on existing
  // items, or is just being reviewed.
  const cap = card.cap;
  const capApplicable =
    card.esdd.riskClass === "medium" ||
    card.esdd.riskClass === "high" ||
    card.esdd.riskClass === "extreme";
  const capLabel = !cap || cap.total === 0
    ? "Start CAP"
    : cap.completed === cap.total
      ? "Review CAP"
      : `Continue ${cap.completed}/${cap.total} actions`;

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panelAlt px-4 py-3"
      data-tour={tourAttr}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {card.borrowerName}
          </span>
          <span className="text-xs text-slate-500">{card.loanId}</span>
        </div>
        <div className="text-xs text-slate-400">
          {card.sector} · {formatNpr(card.outstandingNpr)} outstanding
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <EsddChip esdd={card.esdd} />
          <TaxonomyChip taxonomy={card.taxonomy} />
          {card.esdd.escalated && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
              ESCALATED
            </span>
          )}
          {card.climate?.aboveThreshold &&
            !card.climate.reductionTargetOnFile && (
              <span
                className="rounded-full border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-200"
                title="Borrower is above 25,000 tCO₂e/yr with no reduction target on file (NRB ESRM 2022 §4.3)"
              >
                &gt;25k tCO₂e · NO TARGET
              </span>
            )}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {card.reason}
          {card.lastActivityAt && (
            <>
              {" · "}
              <span title={new Date(card.lastActivityAt).toLocaleString()}>
                last activity{" "}
                {new Date(card.lastActivityAt).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Independent CTAs — officer picks the flow they want to work
          on next. Primary flow is filled brand; the others are plain
          outline links. Taxonomy CTA is hidden when the borrower's
          sector is not taxonomy-eligible; PF CTA is hidden unless the
          loan is Project Finance; PCAF CTA is always shown (required
          on every loan under NFRS). Order: ESDD → Taxonomy → PF → PCAF. */}
      <div className="flex shrink-0 flex-col items-stretch gap-1.5 text-xs">
        <CardCta
          href={`/esdd/${encodeURIComponent(card.loanId)}`}
          label={esddLabel}
          primary={primaryFlow === "esdd"}
        />
        {card.taxonomy.applicable && (
          <CardCta
            href={`/taxonomy/${encodeURIComponent(card.loanId)}`}
            label={taxLabel}
            primary={primaryFlow === "taxonomy"}
          />
        )}
        {card.pfScreening?.required && (
          <CardCta
            href={`/pf-screening/${encodeURIComponent(card.loanId)}`}
            label={pfLabel}
            primary={false}
            title="Annex 5b · 148 items across 8 IFC Performance Standards (NRB Circular 22 §5)"
          />
        )}
        {capApplicable && (
          <CardCta
            href={`/cap/${encodeURIComponent(card.loanId)}`}
            label={capLabel}
            primary={false}
            title="Corrective action plan · covenants · monitoring reports (NRB Circular 22 §7.3.5 + §7.3.7)"
          />
        )}
        <CardCta
          href={`/pcaf/${encodeURIComponent(card.loanId)}`}
          label={pcafLabel}
          primary={false}
          title="PCAF Global GHG Standard Part A · 4 flag rows per loan"
        />
      </div>
    </div>
  );
}

function CardCta({
  href,
  label,
  primary,
  title,
}: {
  href: string;
  label: string;
  primary: boolean;
  title?: string;
}) {
  if (primary) {
    return (
      <a
        href={href}
        title={title}
        className="rounded-md px-3 py-1.5 text-center text-xs font-semibold text-white transition hover:opacity-90"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        {label} →
      </a>
    );
  }
  return (
    <a
      href={href}
      title={title}
      className="rounded-md border px-3 py-1.5 text-center text-xs font-semibold transition hover:bg-white/5"
      style={{
        borderColor: "var(--brand-primary)",
        color: "var(--brand-primary)",
      }}
    >
      {label} →
    </a>
  );
}

function EsddChip({ esdd }: { esdd: LoanCard["esdd"] }) {
  if (esdd.riskClass) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ backgroundColor: RISK_COLORS[esdd.riskClass] }}
      >
        <span className="opacity-70">ESDD</span>
        <span>{esdd.riskClass.toUpperCase()}</span>
      </span>
    );
  }
  if (esdd.answered > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2 py-0.5 text-[10px] text-slate-300">
        <span className="opacity-70">ESDD</span>
        <span>
          {esdd.answered}/{esdd.total}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-panel/60 px-2 py-0.5 text-[10px] text-slate-500">
      <span>ESDD</span>
      <span>Not started</span>
    </span>
  );
}

function TaxonomyChip({ taxonomy }: { taxonomy: LoanCard["taxonomy"] }) {
  if (!taxonomy.applicable) {
    // Non-eligible sector — small muted chip so the officer knows we
    // deliberately skipped taxonomy rather than forgot it.
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-line/40 bg-panel/40 px-2 py-0.5 text-[10px] text-slate-600"
        title="Not eligible for NRB Green Finance Taxonomy classification based on sector"
      >
        <span>Taxonomy</span>
        <span>N/A</span>
      </span>
    );
  }
  if (taxonomy.color) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ backgroundColor: TAX_COLORS[taxonomy.color] }}
        title={taxonomy.activityName ?? undefined}
      >
        <span className="opacity-70">Taxonomy</span>
        <span>{TAX_LABEL[taxonomy.color]}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-panel/60 px-2 py-0.5 text-[10px] text-slate-500">
      <span>Taxonomy</span>
      <span>Not classified</span>
    </span>
  );
}
