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
};

type QueueBody = {
  ok: true;
  officer: { id: string; name: string; role: string };
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
              {data.needsAttention.length} need attention ·{" "}
              {data.inReview.length} in review
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
          <QueueSection
            title="Needs your attention"
            rows={data.needsAttention}
            emptyLabel="Nothing needs your attention right now."
          />
          {data.inReview.length > 0 && (
            <QueueSection
              title="In review"
              rows={data.inReview}
              emptyLabel=""
            />
          )}
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

      {/* Two independent CTAs — officer picks the flow they want to
          work on next. Primary flow is filled brand; the other is a
          plain outline link. Taxonomy CTA is hidden entirely when the
          borrower's sector is not taxonomy-eligible. */}
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
      </div>
    </div>
  );
}

function CardCta({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary: boolean;
}) {
  if (primary) {
    return (
      <a
        href={href}
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
