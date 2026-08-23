"use client";

/**
 * Follow-ups panel — sits above the OfficerWorkQueue on the My Work tab.
 *
 * Surfaces CAP items and monitoring reports that the signed-in officer
 * owes action on. Three buckets, most-urgent first:
 *
 *   Overdue         — deadline passed; loan gets an "Overdue CAP" flag
 *   Due this week   — deadline in the next 7 days
 *   Due this month  — deadline in the next 8-30 days
 *
 * NRB authority:
 *   - NRB ESRM Guideline 2022 §7.3.5 (CAP + covenants, time-bound)
 *   - NRB ESRM Guideline 2022 §7.3.7 (periodic monitoring)
 *   - NRB ESRM Guideline 2022 §8 (RM/LO owns follow-up)
 *
 * Data comes from /api/followups which computes on read — no scheduler.
 * At demo scale (~3-5 open items per officer) this is cheap.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FollowupCard } from "@/app/api/followups/route";
import { formatNpr } from "@/components/bfi/ui";

type FollowupsResponse = {
  ok: boolean;
  officer: { id: string; name: string; role: string };
  overdue: FollowupCard[];
  dueThisWeek: FollowupCard[];
  dueThisMonth: FollowupCard[];
  totalCount: number;
};

export function FollowupsPanel() {
  const [data, setData] = useState<FollowupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/followups", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error ?? `Server returned ${res.status}`);
          return;
        }
        const body = (await res.json()) as FollowupsResponse;
        setData(body);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-line bg-panel p-4 text-sm text-slate-400"
        data-tour="followups-panel"
      >
        Loading follow-ups…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-line bg-panel p-4 text-sm text-slate-400"
        data-tour="followups-panel"
      >
        Follow-ups unavailable: {error}
      </div>
    );
  }

  // Hide the panel entirely when the officer has nothing due. Compliance
  // officers with an empty queue shouldn't see a "You have 0 follow-ups"
  // ghost panel — that's noise. When something IS due, the panel
  // becomes the top-of-page attention grabber.
  if (!data || data.totalCount === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-line bg-panel p-4"
      data-tour="followups-panel"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Follow-ups due
          </div>
          <h2 className="mt-1 text-base font-semibold text-white">
            {data.totalCount} item{data.totalCount === 1 ? "" : "s"} to action
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            NRB ESRM Guideline 2022 §7.3.5 (CAP deadlines) · §7.3.7 (monitoring
            cycles). Sorted most-urgent first.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge
            label="Overdue"
            count={data.overdue.length}
            tone="rose"
          />
          <Badge
            label="This week"
            count={data.dueThisWeek.length}
            tone="amber"
          />
          <Badge
            label="This month"
            count={data.dueThisMonth.length}
            tone="slate"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {data.overdue.map((f) => (
          <FollowupRow key={`ov-${keyFor(f)}`} card={f} tone="rose" />
        ))}
        {data.dueThisWeek.map((f) => (
          <FollowupRow key={`wk-${keyFor(f)}`} card={f} tone="amber" />
        ))}
        {data.dueThisMonth.map((f) => (
          <FollowupRow key={`mo-${keyFor(f)}`} card={f} tone="slate" />
        ))}
      </div>
    </div>
  );
}

function keyFor(f: FollowupCard): string {
  return f.followupType === "cap-item"
    ? `cap-${f.cap!.itemId}`
    : `mon-${f.monitoring!.reportId}`;
}

function Badge({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "rose" | "amber" | "slate";
}) {
  const bg =
    tone === "rose"
      ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
      : tone === "amber"
        ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
        : "bg-slate-500/15 border-slate-500/40 text-slate-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${bg}`}
    >
      {label} · {count}
    </span>
  );
}

function FollowupRow({
  card,
  tone,
}: {
  card: FollowupCard;
  tone: "rose" | "amber" | "slate";
}) {
  const border =
    tone === "rose"
      ? "border-rose-500/30"
      : tone === "amber"
        ? "border-amber-500/30"
        : "border-line";
  const dot =
    tone === "rose"
      ? "bg-rose-400"
      : tone === "amber"
        ? "bg-amber-400"
        : "bg-slate-500";

  const dueLabel =
    card.daysUntilDue < 0
      ? `${Math.abs(card.daysUntilDue)}d overdue`
      : card.daysUntilDue === 0
        ? "Due today"
        : `Due in ${card.daysUntilDue}d`;

  const typeLabel =
    card.followupType === "cap-item"
      ? "CAP item"
      : "Monitoring report";
  const primary =
    card.followupType === "cap-item"
      ? card.cap!.areaOfConcern
      : `Annex 10 monitoring cycle (every ${card.monitoring!.frequencyMonths} mo)`;
  const secondary =
    card.followupType === "cap-item"
      ? card.cap!.correctiveAction
      : card.monitoring!.lastPeriodEnd
        ? `Last period ended ${card.monitoring!.lastPeriodEnd}`
        : "First monitoring cycle for this loan";

  const targetHref =
    card.followupType === "cap-item"
      ? `/?tab=esrm&loan=${encodeURIComponent(card.loanId)}#cap-panel`
      : `/?tab=esrm&loan=${encodeURIComponent(card.loanId)}#cap-panel`;

  return (
    <Link
      href={targetHref}
      className={`group flex items-center gap-3 rounded-lg border ${border} bg-panelAlt/60 px-3 py-2.5 transition hover:bg-panelAlt`}
    >
      <span
        className={`mt-1 h-2 w-2 shrink-0 self-start rounded-full ${dot}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="truncate text-sm font-semibold text-white">
            {card.borrowerName}
            <span className="ml-2 text-[11px] font-normal text-slate-500">
              {card.loanId} · {card.sector}
            </span>
          </div>
          <div className="shrink-0 text-[11px] uppercase tracking-wide text-slate-400">
            {typeLabel}
          </div>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-200">
          {primary}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-500">
          {secondary}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={`text-xs font-semibold ${
            tone === "rose"
              ? "text-rose-300"
              : tone === "amber"
                ? "text-amber-300"
                : "text-slate-300"
          }`}
        >
          {dueLabel}
        </div>
        <div className="text-[11px] text-slate-500">{card.dueDate}</div>
        <div className="text-[11px] text-slate-500">
          {formatNpr(card.outstandingNpr)}
        </div>
      </div>
    </Link>
  );
}
