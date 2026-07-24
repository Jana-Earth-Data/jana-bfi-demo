"use client";

/**
 * Officer work queue — the signed-in officer's pending ESRM view.
 *
 * Shows loans that need the officer's attention, grouped by state:
 *   - In progress:  ESDD started by this officer, not yet screened
 *   - Complete:     ESDD screened and saved to bfi_esrm_screenings
 *   - Awaiting:     under-review loans this officer hasn't started
 *
 * Fetches from /api/esdd/officer-queue on mount and every time the
 * signed-in officer changes. If no officer is signed in, this component
 * renders nothing (the panel is hidden from the ESRM tab).
 */

import { useEffect, useState } from "react";
import { formatNpr } from "@/components/bfi/ui";
import type { Officer } from "@/lib/tenants";

type QueueRow = {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  answered: number;
  total: number;
  state: "complete" | "in-progress" | "awaiting";
  lastActivityAt: string | null;
  riskClass?: "low" | "medium" | "high" | "extreme" | null;
};

type QueueBody = {
  ok: true;
  officer: { id: string; name: string; role: string };
  inProgress: QueueRow[];
  complete: QueueRow[];
  awaiting: QueueRow[];
};

const RISK_COLORS: Record<
  NonNullable<QueueRow["riskClass"]>,
  string
> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  extreme: "#ef4444",
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
          Your ESRM queue
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-base font-semibold text-white">
            {currentOfficer.name}
          </div>
          {data && (
            <div className="text-xs text-slate-400">
              {data.inProgress.length} in progress ·{" "}
              {data.complete.length} completed ·{" "}
              {data.awaiting.length} awaiting review
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
            title="In progress"
            rows={data.inProgress}
            emptyLabel="No ESDD checklists in progress."
          />
          {data.complete.length > 0 && (
            <QueueSection
              title="Completed"
              rows={data.complete}
              emptyLabel=""
            />
          )}
          <QueueSection
            title="Awaiting your review"
            rows={data.awaiting}
            emptyLabel="No under-review loans need attention right now."
          />
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
  rows: QueueRow[];
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
          {rows.map((row) => (
            <QueueRowCard key={row.loanId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueRowCard({ row }: { row: QueueRow }) {
  const pct = row.total > 0 ? row.answered / row.total : 0;
  return (
    <a
      href={`/esdd/${encodeURIComponent(row.loanId)}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panelAlt px-4 py-3 transition hover:bg-white/5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-white">
            {row.borrowerName}
          </span>
          <span className="text-xs text-slate-500">{row.loanId}</span>
        </div>
        <div className="text-xs text-slate-400">
          {row.sector} · {formatNpr(row.outstandingNpr)} outstanding
        </div>
        {row.lastActivityAt && (
          <div className="mt-0.5 text-xs text-slate-500">
            Last activity {new Date(row.lastActivityAt).toLocaleString()}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {row.state === "complete" && row.riskClass ? (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: RISK_COLORS[row.riskClass] }}
          >
            {row.riskClass.toUpperCase()}
          </span>
        ) : row.state === "in-progress" ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
              <div
                className="h-full"
                style={{
                  width: `${pct * 100}%`,
                  backgroundColor: "var(--brand-primary)",
                }}
              />
            </div>
            <span className="text-xs text-slate-400">
              {row.answered}/{row.total}
            </span>
          </div>
        ) : (
          <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-slate-400">
            Not started
          </span>
        )}
        <span className="text-xs" style={{ color: "var(--brand-primary)" }}>
          {row.state === "complete"
            ? "View screening →"
            : row.state === "in-progress"
              ? "Continue ESDD →"
              : "Start ESDD →"}
        </span>
      </div>
    </a>
  );
}
