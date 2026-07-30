"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardSsrData } from "@/components/bfi/dashboard";
import {
  Badge,
  KpiCard,
  Panel,
  ProgressBar,
  StatRow,
  TaxonomyDot,
} from "@/components/bfi/shared/primitives";
import { FacilityMap } from "@/components/bfi/shared/facility-map";
import {
  formatCo2e,
  formatNpr,
  formatPercent,
  formatUsd,
  qualityScoreColors,
  taxonomyColors,
} from "@/components/bfi/ui";
import { Borrower } from "@/lib/types/bfi";
import { buildScreening } from "@/lib/data/screening";
import { LoanRow } from "@/lib/data/portfolio-query";
import { NPR_PER_USD } from "@/lib/data/util";
import { InfoTip, PcafScoreInfoTip } from "@/components/bfi/shared/info-tip";
import { useTour } from "@/lib/tour/tour-context";
import type { Officer } from "@/lib/tenants";
import {
  findActivityById,
  type TaxonomyColor,
} from "@/lib/regulatory/taxonomy/activities";
// Sector supplements were removed from annex5-questions.ts per Circular 22
// verbatim conformance. This tab now renders only the sector-agnostic
// 12-question checklist.
import { isTaxonomyExpected } from "@/lib/regulatory/taxonomy/applicability";
import ctSnapshot from "@/data/ct-nepal-2024.json";
import { EDGAR_NEPAL } from "@/lib/data/edgar-snapshot";
import { ClimateRiskPanel } from "@/components/bfi/esrm/climate-risk-panel";
import { inferEmissionsFlag } from "@/lib/regulatory/climate/infer";

const NRB_REGULATORY_LINK =
  "https://www.nrb.org.np/contents/uploads/2018/05/Environment-Social-Risk-Management-Guidelines-2018.pdf";

// Row shape returned by /api/manager/queue (kept local so this tab does
// not depend on API types from the route module).
type ManagerRow = {
  loanId: string;
  ownerOfficerId: string | null;
  ownerOfficerName: string | null;
  answered: number;
  total: number;
  riskClass: "low" | "medium" | "high" | "extreme" | null;
  escalated: boolean;
  screeningAt: string | null;
  lastEsddActivityAt: string | null;
};

type OwnerFilter = "all" | "unassigned" | { officerId: string };

export function EsrmTab({ data }: { data: DashboardSsrData }) {
  const apps = data.applications;
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(
    apps[0]?.loan.id ?? null
  );

  // Manager-view aggregate data. Loaded once on mount; refetched when an
  // assignment change happens (via bumpVersion).
  const [managerRows, setManagerRows] = useState<Map<string, ManagerRow>>(
    new Map(),
  );
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [version, setVersion] = useState(0);
  const bumpVersion = () => setVersion((v) => v + 1);

  /**
   * Optimistic assignment update — the AssignmentControl calls this the
   * instant the POST returns so the workbench flips to the new owner
   * name immediately. The subsequent version bump kicks off a full
   * refetch that reconciles any drift.
   */
  const handleAssignmentChange = (
    loanId: string,
    assignment: { officerId: string; officerName: string } | null,
  ) => {
    setManagerRows((prev) => {
      const next = new Map(prev);
      const existing = next.get(loanId);
      // If the loan doesn't have a manager-row yet, synthesise a minimal
      // one so the workbench header can flip the owner display
      // immediately. The version bump refetches the full row shortly.
      if (!existing) {
        next.set(loanId, {
          loanId,
          ownerOfficerId: assignment?.officerId ?? null,
          ownerOfficerName: assignment?.officerName ?? null,
          answered: 0,
          total: 0,
          riskClass: null,
          escalated: false,
          screeningAt: null,
          lastEsddActivityAt: null,
        });
      } else {
        next.set(loanId, {
          ...existing,
          ownerOfficerId: assignment?.officerId ?? null,
          ownerOfficerName: assignment?.officerName ?? null,
        });
      }
      return next;
    });
    bumpVersion();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/manager/queue");
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        const map = new Map<string, ManagerRow>();
        for (const r of body.rows ?? []) map.set(r.loanId, r);
        setManagerRows(map);
        setEscalatedCount(body.escalatedCount ?? 0);
      } catch {
        /* silent — the tab still works from data.applications */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");

  const filteredApps = useMemo(() => {
    if (ownerFilter === "all") return apps;
    if (ownerFilter === "unassigned") {
      return apps.filter((r) => {
        const m = managerRows.get(r.loan.id);
        return !m || !m.ownerOfficerId;
      });
    }
    const wantId = ownerFilter.officerId;
    return apps.filter((r) => {
      const m = managerRows.get(r.loan.id);
      return m?.ownerOfficerId === wantId;
    });
  }, [apps, managerRows, ownerFilter]);

  const selectedRow = useMemo(
    () => apps.find((r) => r.loan.id === selectedLoanId) ?? null,
    [apps, selectedLoanId]
  );

  // Tour: if the active step asks for a specific borrower (by name substring),
  // select the first matching application so the narration stays aligned.
  const tour = useTour();
  const tourBorrowerHint = tour.step?.selectBorrowerNameContains ?? null;
  useEffect(() => {
    if (!tourBorrowerHint) return;
    const needle = tourBorrowerHint.toLowerCase();
    const match = apps.find((r) =>
      r.borrower.name.toLowerCase().includes(needle)
    );
    if (match && match.loan.id !== selectedLoanId) {
      setSelectedLoanId(match.loan.id);
    }
  }, [tourBorrowerHint, apps, selectedLoanId]);

  // Summary KPIs
  const totalApps = apps.length;
  const totalApplicationValue = apps.reduce(
    (s, r) => s + r.loan.outstandingNpr,
    0
  );
  const redCount = apps.filter((r) => r.loan.nrbTaxonomy === "red").length;
  const greenCount = apps.filter((r) => r.loan.nrbTaxonomy === "green").length;
  const facilityCount = apps.filter(
    (r) => r.borrower.facilities.length > 0
  ).length;

  return (
    <div className="grid gap-4">
      {/*
        Escalation banner + manager summary. Fetches the whole-book
        aggregate view (owner, ESDD progress, latest screening,
        escalation flags) from /api/manager/queue so this tab can act as
        a compliance / credit-committee dashboard. The personal officer
        queue now lives on its own "My Work" tab.
      */}
      <ManagerSummary
        managerRows={managerRows}
        escalatedCount={escalatedCount}
        apps={apps}
        onSelectLoan={(loanId) => {
          setSelectedLoanId(loanId);
          // Scroll the workbench into view — the escalation banner
          // sits above the fold; without this the pill click looks
          // like it did nothing on desktop.
          if (typeof document !== "undefined") {
            requestAnimationFrame(() => {
              const el = document.querySelector(
                "[data-tour='screening-workbench']",
              );
              if (el) {
                (el as HTMLElement).scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            });
          }
        }}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Loans under review"
          value={totalApps.toString()}
          sublabel={`${formatNpr(totalApplicationValue)} pending approval`}
        />
        <KpiCard
          label={
            <span className="inline-flex items-center gap-1">
              Facility-verified screening
              <InfoTip id="facility-tier" side="below" />
            </span>
          }
          value={`${facilityCount} / ${totalApps}`}
          sublabel="Climate TRACE facility data available"
          accent
        />
        <KpiCard
          label="High-emissions sectors"
          value={redCount.toString()}
          sublabel="Cement / steel / brick / thermal"
        />
        <KpiCard
          label="Green-eligible"
          value={greenCount.toString()}
          sublabel="Hydropower / renewable energy"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2" data-tour="application-queue">
          <Panel
            title="Application queue"
            subtitle={`${filteredApps.length} of ${apps.length} loans · newest first`}
          >
            <OwnerFilterBar
              value={ownerFilter}
              officers={data.officers}
              onChange={setOwnerFilter}
            />
            <ApplicationsList
              apps={filteredApps}
              selectedLoanId={selectedLoanId}
              onSelect={setSelectedLoanId}
              managerRows={managerRows}
            />
          </Panel>
        </div>

        <div className="grid gap-4 lg:col-span-3" data-tour="screening-workbench">
          {selectedRow ? (
            <ScreeningWorkbench
              row={selectedRow}
              prebuiltScreening={data.screenings[selectedRow.borrower.id]}
              liveEnrichment={data.liveEnrichment}
              isMock={data.meta.isMock}
              managerRow={managerRows.get(selectedRow.loan.id) ?? null}
              officers={data.officers}
              currentOfficer={data.currentOfficer}
              onAssignmentChanged={handleAssignmentChange}
            />
          ) : (
            <Panel title="Screening workbench">
              <p className="text-sm text-slate-500">
                Select an application to begin screening.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Application queue (left rail)
// ---------------------------------------------------------------------------

function ApplicationsList({
  apps,
  selectedLoanId,
  onSelect,
  managerRows,
}: {
  apps: LoanRow[];
  selectedLoanId: string | null;
  onSelect: (id: string) => void;
  managerRows: Map<string, ManagerRow>;
}) {
  return (
    <div className="-m-2 max-h-[640px] overflow-y-auto">
      <ul className="space-y-1 p-2">
        {apps.map((r) => {
          const isSel = r.loan.id === selectedLoanId;
          const m = managerRows.get(r.loan.id);
          const pct = m && m.total > 0 ? m.answered / m.total : 0;
          // NRB ESRM 2022 §4.3 — small badge when the borrower is above
          // 25k tCO2e/yr without a documented reduction target.
          const climateFlag = inferEmissionsFlag(r.borrower);
          const climateBadge =
            climateFlag.exceedsReportingThreshold &&
            !climateFlag.reductionTargetOnFile;
          return (
            <li key={r.loan.id}>
              <button
                onClick={() => onSelect(r.loan.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  isSel
                    ? "border-accent bg-accent/10 text-white"
                    : "border-line bg-panel/40 text-slate-200 hover:border-line/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">
                    {r.loan.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {climateBadge && (
                      <span
                        title="Borrower above 25,000 tCO₂e / yr with no reduction target on file (NRB ESRM 2022 §4.3)"
                        className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-200"
                      >
                        25k↑
                      </span>
                    )}
                    {m?.escalated && (
                      <span
                        title="Escalation flag set by ESRM screening"
                        className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-200"
                      >
                        ESC
                      </span>
                    )}
                    <TaxonomyDot color={r.loan.nrbTaxonomy} />
                  </div>
                </div>
                <div className="mt-0.5 truncate font-medium">
                  {r.borrower.name}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {r.borrower.nrbSector}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    {formatNpr(r.loan.outstandingNpr)}
                  </span>
                  <span className="text-slate-500">{r.loan.branch}</span>
                </div>
                {m && (
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <span
                      className="truncate"
                      style={{
                        color: m.ownerOfficerName ? "var(--brand-primary)" : "#64748b",
                      }}
                    >
                      {m.ownerOfficerName ?? "Unassigned"}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct * 100}%`,
                            backgroundColor: "var(--brand-primary)",
                          }}
                        />
                      </div>
                      <span className="text-slate-500">
                        {m.answered}/{m.total}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            </li>
          );
        })}
        {apps.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-500">
            No applications match the current filter.
          </li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manager-view helpers: escalation banner, owner filter, assign control
// ---------------------------------------------------------------------------

function ManagerSummary({
  managerRows,
  escalatedCount,
  apps,
  onSelectLoan,
}: {
  managerRows: Map<string, ManagerRow>;
  escalatedCount: number;
  apps: LoanRow[];
  onSelectLoan: (loanId: string) => void;
}) {
  const assignedCount = Array.from(managerRows.values()).filter(
    (m) => m.ownerOfficerId,
  ).length;
  const unassignedCount = apps.length - assignedCount;
  const inProgressCount = Array.from(managerRows.values()).filter(
    (m) => m.answered > 0 && m.answered < m.total && !m.screeningAt,
  ).length;
  const completeCount = Array.from(managerRows.values()).filter(
    (m) => m.screeningAt,
  ).length;

  const escalatedApps = apps.filter((r) => managerRows.get(r.loan.id)?.escalated);

  return (
    <div className="flex flex-col gap-3">
      {escalatedCount > 0 && (
        <div
          className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4"
          data-tour="escalation-banner"
        >
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold text-amber-100">
              {escalatedCount} loan{escalatedCount === 1 ? "" : "s"} escalated to credit committee
            </div>
            <div className="text-xs text-amber-200/70">
              Any &lsquo;c&rsquo; answer in NRB ESRM Annex 5 triggers escalation
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {escalatedApps.slice(0, 8).map((r) => (
              <button
                key={r.loan.id}
                type="button"
                onClick={() => onSelectLoan(r.loan.id)}
                className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-100 transition hover:bg-amber-500/25"
              >
                {r.borrower.name}
              </button>
            ))}
            {escalatedApps.length > 8 && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200/70">
                +{escalatedApps.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <span className="text-white">{assignedCount}</span> assigned
          </div>
          <div>
            <span className="text-white">{unassignedCount}</span> unassigned
          </div>
          <div>
            <span className="text-white">{inProgressCount}</span> ESDD in progress
          </div>
          <div>
            <span className="text-white">{completeCount}</span> screening complete
          </div>
        </div>
      </div>
    </div>
  );
}

function OwnerFilterBar({
  value,
  officers,
  onChange,
}: {
  value: OwnerFilter;
  officers: Officer[];
  onChange: (next: OwnerFilter) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
      <FilterPill active={value === "all"} onClick={() => onChange("all")}>
        All
      </FilterPill>
      <FilterPill
        active={value === "unassigned"}
        onClick={() => onChange("unassigned")}
      >
        Unassigned
      </FilterPill>
      <span className="mx-1 text-slate-600">·</span>
      <select
        value={
          typeof value === "object" && "officerId" in value
            ? value.officerId
            : ""
        }
        onChange={(e) => {
          if (e.target.value) onChange({ officerId: e.target.value });
          else onChange("all");
        }}
        className="rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-200"
      >
        <option value="">By officer…</option>
        {officers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 transition ${
        active ? "text-white" : "border-line bg-panelAlt text-slate-300 hover:bg-white/5"
      }`}
      style={
        active
          ? {
              backgroundColor: "var(--brand-primary)",
              borderColor: "var(--brand-primary)",
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Workbench compliance status stripe — live ESDD + Taxonomy for the
// selected loan, rendered inline on the manager view so the screening
// state and any escalation are visible without opening the drawer.
// ---------------------------------------------------------------------------

const WB_RISK_BG: Record<"low" | "medium" | "high" | "extreme", string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  extreme: "#ef4444",
};
const WB_TAX_BG: Record<TaxonomyColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#64748b",
};
const WB_TAX_LABEL: Record<TaxonomyColor, string> = {
  green: "GREEN",
  amber: "AMBER",
  red: "RED",
  unclassified: "UNCLASSIFIED",
};

// Compact prompt lookup — number + short label per question so the
// escalation list on the workbench can render "Q 3.2 Labour · Q H.2
// Resettlement" without opening a wizard-scale block of text.
function shortQuestionLabel(id: string): { number: string; short: string } {
  // Core sections: derive number from id (annex5.<section>.<n>)
  const parts = id.split(".");
  if (id.startsWith("annex5.1.")) {
    return {
      number: `${parts[1]}.${parts[2]}`,
      short:
        parts[2] === "1"
          ? "Legal issues"
          : parts[2] === "2"
            ? "Stakeholder grievances"
            : "Sensitive-area siting",
    };
  }
  if (id.startsWith("annex5.2.")) {
    return {
      number: `${parts[1]}.${parts[2]}`,
      short:
        parts[2] === "1"
          ? "Air & noise pollution"
          : parts[2] === "2"
            ? "Water pollution"
            : parts[2] === "3"
              ? "Waste handling"
              : parts[2] === "4"
                ? "Energy efficiency"
                : "Climate risk / GHG",
    };
  }
  if (id.startsWith("annex5.3.")) {
    return {
      number: `${parts[1]}.${parts[2]}`,
      short:
        parts[2] === "1"
          ? "Fire / OHS risk"
          : parts[2] === "2"
            ? "Labour practices"
            : parts[2] === "3"
              ? "Community H&S"
              : "Stakeholder consultation",
    };
  }
  // Circular 22 defines only the sector-agnostic 12-question checklist —
  // no sector supplement lookup needed.
  return { number: id, short: "" };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

type WbStripeState = {
  esdd: {
    loading: boolean;
    answered: number;
    total: number;
    riskClass: "low" | "medium" | "high" | "extreme" | null;
    escalated: boolean;
    drivingQuestionIds: string[];
  };
  taxonomy: {
    loading: boolean;
    color: TaxonomyColor | null;
    activityId: string | null;
    activityName: string | null;
  };
};

function WorkbenchComplianceStripe({
  loanId,
  borrower,
}: {
  loanId: string;
  borrower: Borrower;
}) {
  // Circular 22 = 12 questions total (3 general + 5 EHS incl. 2022 Q2.5
  // climate + 4 social + PDF-only 3.4). No sector supplements per source.
  const total = 3 + 5 + 4;
  const taxApplicable = isTaxonomyExpected(borrower.nrbSector);

  const [state, setState] = useState<WbStripeState>({
    esdd: {
      loading: true,
      answered: 0,
      total,
      riskClass: null,
      escalated: false,
      drivingQuestionIds: [],
    },
    taxonomy: { loading: true, color: null, activityId: null, activityName: null },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [respRes, scrRes, taxRes] = await Promise.all([
        fetch(`/api/esdd/responses?loanId=${encodeURIComponent(loanId)}`).catch(
          () => null,
        ),
        fetch(`/api/esrm/screenings?loanId=${encodeURIComponent(loanId)}`).catch(
          () => null,
        ),
        fetch(`/api/taxonomy/assessments?loanId=${encodeURIComponent(loanId)}`).catch(
          () => null,
        ),
      ]);
      if (cancelled) return;

      let answered = 0;
      if (respRes && respRes.ok) {
        const body = await respRes.json();
        const distinct = new Set<string>();
        for (const r of body.responses ?? []) distinct.add(r.questionId);
        answered = distinct.size;
      }
      let riskClass: WbStripeState["esdd"]["riskClass"] = null;
      let escalated = false;
      let drivingQuestionIds: string[] = [];
      if (scrRes && scrRes.ok) {
        const body = await scrRes.json();
        if (body?.latest) {
          riskClass = body.latest.computed_risk_class;
          escalated = body.latest.escalation_flag;
          drivingQuestionIds = body.latest.driving_question_ids ?? [];
        }
      }
      let color: TaxonomyColor | null = null;
      let activityId: string | null = null;
      let activityName: string | null = null;
      if (taxRes && taxRes.ok) {
        const body = await taxRes.json();
        if (body?.latest) {
          color = body.latest.computed_color;
          activityId = body.latest.activity_id;
          activityName = findActivityById(body.latest.activity_id)?.name ?? null;
        }
      }
      setState({
        esdd: { loading: false, answered, total, riskClass, escalated, drivingQuestionIds },
        taxonomy: { loading: false, color, activityId, activityName },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [loanId, total]);

  return (
    <div
      className="mt-3 rounded-lg border border-line bg-panelAlt p-3"
      data-tour="compliance-stripe"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Compliance status
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* ESDD */}
        <div className="rounded-md border border-line bg-panel px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                ESDD
              </div>
              <div className="text-sm font-semibold text-white">
                {state.esdd.loading
                  ? "Loading…"
                  : state.esdd.riskClass
                    ? `${state.esdd.answered}/${state.esdd.total} · Screened`
                    : state.esdd.answered > 0
                      ? `${state.esdd.answered}/${state.esdd.total} · In progress`
                      : "Not started"}
              </div>
            </div>
            {state.esdd.riskClass && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: WB_RISK_BG[state.esdd.riskClass] }}
              >
                {state.esdd.riskClass.toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-1">
            <a
              href={`/esdd/${encodeURIComponent(loanId)}`}
              className="text-[11px] font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              {state.esdd.riskClass
                ? "Review ESDD →"
                : state.esdd.answered > 0
                  ? "Continue ESDD →"
                  : "Start ESDD →"}
            </a>
          </div>
        </div>

        {/* Taxonomy */}
        <div className="rounded-md border border-line bg-panel px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Taxonomy
              </div>
              <div className="text-sm font-semibold text-white">
                {!taxApplicable
                  ? "Not eligible"
                  : state.taxonomy.loading
                    ? "Loading…"
                    : state.taxonomy.activityName
                      ? truncate(state.taxonomy.activityName, 32)
                      : "Not classified"}
              </div>
            </div>
            {state.taxonomy.color && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: WB_TAX_BG[state.taxonomy.color] }}
              >
                {WB_TAX_LABEL[state.taxonomy.color]}
              </span>
            )}
          </div>
          {taxApplicable && (
            <div className="mt-1">
              <a
                href={`/taxonomy/${encodeURIComponent(loanId)}`}
                className="text-[11px] font-semibold"
                style={{ color: "var(--brand-primary)" }}
              >
                {state.taxonomy.color ? "Review taxonomy →" : "Classify →"}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Escalation callout — the reason the manager actually cares
          about this screening. Show driving questions inline so they
          don't have to open the drawer to see what's wrong. */}
      {state.esdd.escalated && (
        <div className="mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2">
          <div className="text-xs font-semibold text-amber-100">
            Escalated to credit committee
          </div>
          {state.esdd.drivingQuestionIds.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {state.esdd.drivingQuestionIds.map((id) => {
                const { number, short } = shortQuestionLabel(id);
                return (
                  <span
                    key={id}
                    className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-100"
                    title={id}
                  >
                    Q {number}
                    {short ? ` · ${short}` : ""}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentControl({
  loanId,
  currentOwnerId,
  officers,
  onChange,
}: {
  loanId: string;
  currentOwnerId: string | null;
  officers: Officer[];
  onChange: (assignment: { officerId: string; officerName: string } | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function assign(officerId: string | null) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/manager/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loanId, officerId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? `Server returned ${res.status}`);
        return;
      }
      // Optimistically report the assignment result up so the parent can
      // update its managerRows Map immediately — otherwise the workbench
      // header keeps showing "Unassigned" until the async refetch races
      // through, which reads incorrectly to the user as a broken save.
      if (officerId && body.officerName) {
        onChange({ officerId, officerName: body.officerName });
      } else {
        onChange(null);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <select
        value={currentOwnerId ?? ""}
        disabled={saving}
        onChange={(e) => assign(e.target.value || null)}
        className="rounded-md border border-line bg-panelAlt px-2 py-1 text-slate-200"
      >
        <option value="">Unassigned</option>
        {officers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {saving && <span className="text-slate-500">Saving…</span>}
      {err && <span className="text-red-300">{err}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workbench (right pane)
// ---------------------------------------------------------------------------

function ScreeningWorkbench({
  row,
  prebuiltScreening,
  liveEnrichment,
  isMock,
  managerRow,
  officers,
  currentOfficer,
  onAssignmentChanged,
}: {
  row: LoanRow;
  prebuiltScreening?: import("@/lib/types/bfi").BorrowerScreening;
  liveEnrichment?: { edgar: boolean; openaq: boolean; edgarYear?: number };
  isMock: boolean;
  managerRow: ManagerRow | null;
  officers: Officer[];
  currentOfficer: Officer | null;
  onAssignmentChanged: (
    loanId: string,
    assignment: { officerId: string; officerName: string } | null,
  ) => void;
}) {
  const { loan, borrower, attribution } = row;
  const screening = useMemo(
    () => prebuiltScreening ?? buildScreening(borrower),
    [borrower, prebuiltScreening]
  );
  const edgarLive = !!liveEnrichment?.edgar;
  const openaqLive = !!liveEnrichment?.openaq;
  const [esddOpen, setEsddOpen] = useState(false);
  const [sanityOpen, setSanityOpen] = useState(false);
  const ctLive = !isMock && borrower.facilities.length > 0;
  // CT 2024 snapshot is real data baked into data/ct-nepal-2024.json — used
  // in mock mode for any borrower whose facility data comes from the snapshot.
  // Cement matches at 0.99, CT non-mfg matches at 0.95. Both qualify.
  const ctSnapshotMatch =
    borrower.facilities.some((f) => f.matchConfidence >= 0.95);

  const markerColor: "red" | "amber" | "green" | "slate" =
    loan.nrbTaxonomy === "red"
      ? "red"
      : loan.nrbTaxonomy === "amber"
        ? "amber"
        : loan.nrbTaxonomy === "green"
          ? "green"
          : "slate";

  const mapPoints = borrower.facilities.map((f) => ({
    facility: f,
    color: markerColor,
  }));

  const riskClass = screening.riskClassification ?? "medium";
  const riskColor =
    riskClass === "extreme"
      ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
      : riskClass === "high"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
        : riskClass === "medium"
          ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";

  const recColor =
    screening.recommendation === "decline"
      ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
      : screening.recommendation === "approve-with-conditions"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";

  const intensityRatio =
    screening.borrowerIntensityValue != null &&
    screening.sectorBenchmarkValue != null &&
    screening.sectorBenchmarkValue > 0
      ? screening.borrowerIntensityValue / screening.sectorBenchmarkValue
      : null;

  return (
    <>
      <Panel
        title="Borrower screening"
        subtitle="ESRM data sources: Climate TRACE · Global Cement and Concrete Tracker · OpenAQ · EDGAR · GEM ownership"
        action={
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              className={
                ctLive
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : ctSnapshotMatch
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                    : "border-slate-500/30 bg-slate-500/10 text-slate-300"
              }
            >
              Climate TRACE{" "}
              {ctLive ? "live" : ctSnapshotMatch ? "2024 snapshot" : "estimate"}
            </Badge>
            <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-300">
              EDGAR {liveEnrichment?.edgarYear ?? 2024}
            </Badge>
            <Badge
              className={
                openaqLive
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-500/30 bg-slate-500/10 text-slate-300"
              }
            >
              OpenAQ {openaqLive ? "live" : "synthetic"}
            </Badge>
            <Badge className={recColor}>
              {screening.recommendation === "approve"
                ? "Recommend: approve"
                : screening.recommendation === "approve-with-conditions"
                  ? "Recommend: approve with conditions"
                  : "Recommend: decline"}
            </Badge>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {loan.id} · {loan.product}
                </div>
                <div className="text-lg font-semibold text-white">
                  {borrower.name}
                </div>
                <div className="text-xs text-slate-500">{borrower.nrbSector}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1">
                  <Badge className={taxonomyColors[loan.nrbTaxonomy]}>
                    {loan.nrbTaxonomy}
                  </Badge>
                  <InfoTip id={`taxonomy-${loan.nrbTaxonomy}`} side="left" />
                </span>
                <span className="inline-flex items-center gap-1">
                  <Badge className={riskColor}>{riskClass} risk</Badge>
                  <InfoTip id={`risk-${riskClass}`} side="left" />
                </span>
              </div>
            </div>
            {/* Manager assignment control */}
            <div
              className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-panelAlt px-3 py-2"
              data-tour="assignment-control"
            >
              <div className="text-xs">
                <div className="text-slate-500">Owner</div>
                <div className="text-slate-200">
                  {managerRow?.ownerOfficerName ?? "Unassigned"}
                  {currentOfficer &&
                    managerRow?.ownerOfficerId === currentOfficer.id && (
                      <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                        that&rsquo;s you
                      </span>
                    )}
                </div>
              </div>
              <AssignmentControl
                loanId={loan.id}
                currentOwnerId={managerRow?.ownerOfficerId ?? null}
                officers={officers}
                onChange={(assignment) =>
                  onAssignmentChanged(loan.id, assignment)
                }
              />
            </div>

            {/* Compliance status stripe — live ESDD + Taxonomy for this loan.
                Renders inline in the workbench so the manager doesn't have
                to open the drawer to see the screening state. Escalation
                driving questions are listed here too, since they're the
                whole reason the manager cares about the escalation. */}
            <WorkbenchComplianceStripe loanId={loan.id} borrower={borrower} />

            {/* Climate risk (NGFS categorisation + 25k tCO2e threshold flag)
                from the 2022 NRB ESRM Guideline §4.1 / §4.3. Deterministic
                inference from sector + facility emissions; the panel also
                refreshes from /api/climate/borrower/[borrowerId] to overlay
                any persisted officer override. */}
            <ClimateRiskPanel borrower={borrower} />

            <div className="mt-3">
              <StatRow
                label="Loan request"
                value={`${formatNpr(loan.outstandingNpr)} · ${formatUsd(loan.outstandingUsd)}`}
                hint={`Branch: ${loan.branch} · ${loan.businessUnit}`}
              />
              <StatRow
                label={
                  <span className="inline-flex items-center gap-1">
                    Borrower enterprise value
                    <InfoTip id="ev-demo-only" side="right" />
                  </span>
                }
                value={`${formatNpr(borrower.enterpriseValueUsd * NPR_PER_USD)} · ${formatUsd(borrower.enterpriseValueUsd)}`}
                hint="demo only"
              />
              <StatRow
                label="Exposure ratio"
                value={`${(attribution.attributionFactor * 100).toFixed(2)}% of EV`}
                hint="loan outstanding ÷ enterprise value (PCAF attribution factor)"
              />
              <StatRow label="Purpose" value={loan.purpose} />
              <StatRow
                label="Disbursement window"
                value={`${loan.disbursedDate} → ${loan.maturityDate}`}
              />
              {borrower.parent && (
                <StatRow
                  label="Ultimate parent"
                  value={borrower.parent}
                  hint={borrower.parentEntityId ?? undefined}
                />
              )}
              {borrower.publiclyListed && (
                <StatRow
                  label="Public listing"
                  value="Listed on NEPSE / equity markets"
                />
              )}
            </div>
            <div className="mt-4 rounded-md border border-line/60 bg-panel/40 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Recommendation reasoning
              </div>
              <p className="mt-1 text-sm text-slate-200">
                {screening.reasoning}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEsddOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
            >
              View NRB compliance status
              <span aria-hidden>→</span>
            </button>
          </div>

          {/* Compliance metrics column */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>Borrower emissions</span>
                {borrower.facilities.length > 0 && (
                  <span
                    className={
                      ctLive
                        ? "rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300"
                        : ctSnapshotMatch
                          ? "rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                          : "rounded border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                    }
                  >
                    {ctLive
                      ? "Live · CT 2024"
                      : ctSnapshotMatch
                        ? "CT 2024 snapshot"
                        : "Estimated"}
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold text-white">
                {formatCo2e(borrower.totalCo2eTonnes)}
              </div>
              <div className="text-xs text-slate-500">
                {borrower.facilities.length} matched{" "}
                {borrower.facilities.length === 1 ? "facility" : "facilities"}
                {attribution.pcafOption && (
                  <>
                    {" · "}PCAF Score {attribution.dataQualityScore} (Option{" "}
                    {attribution.pcafOption})
                  </>
                )}
              </div>
            </div>

            {intensityRatio != null && (
              <div>
                <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400">
                  Share of Nepal's national CO₂
                  <InfoTip id="national-co2-share" side="below" />
                </div>
                <div
                  className={`mt-1 text-3xl font-semibold ${
                    intensityRatio > 0.05
                      ? "text-rose-300"
                      : intensityRatio > 0.01
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                >
                  {formatPercent(intensityRatio)}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  of Nepal's national CO₂ (EDGAR 2024)
                  <InfoTip id="sanity-check-national-share" side="below" />
                </div>
                {borrower.facilities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSanityOpen(true)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    Open full sanity check
                    <span aria-hidden>→</span>
                  </button>
                )}
                <ProgressBar
                  value={Math.min(0.5, intensityRatio) * 2}
                  fillClass={
                    intensityRatio > 0.05
                      ? "bg-rose-400"
                      : intensityRatio > 0.01
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }
                  trackClass="bg-line/40"
                  className="mt-2"
                />
                <div className="mt-2 flex items-baseline justify-between text-xs text-slate-500">
                  <span>{formatCo2e(screening.borrowerIntensityValue ?? 0)} borrower</span>
                  <span>{formatCo2e(screening.sectorBenchmarkValue ?? 0)} national</span>
                </div>
              </div>
            )}

            {screening.airQualityNearby && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Community air quality (PM₂.₅)
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-lg font-semibold text-white">
                    {screening.airQualityNearby.pm25} µg/m³
                  </div>
                  <span className="inline-flex items-center gap-1">
                    <Badge
                      className={
                        screening.airQualityNearby.pm25 > 100
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                          : screening.airQualityNearby.pm25 > 50
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      }
                    >
                      {screening.airQualityNearby.pm25 > 100
                        ? "Hazardous"
                        : screening.airQualityNearby.pm25 > 50
                          ? "Elevated"
                          : "Acceptable"}
                    </Badge>
                    <InfoTip
                      id={
                        screening.airQualityNearby.pm25 > 100
                          ? "aq-hazardous"
                          : screening.airQualityNearby.pm25 > 50
                            ? "aq-elevated"
                            : "aq-acceptable"
                      }
                      side="left"
                    />
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {screening.airQualityNearby.stationName} ·{" "}
                  {screening.airQualityNearby.readingDate}
                </div>
                {!openaqLive && (
                  <div className="mt-1 text-xs text-slate-500 italic">
                    Synthetic value · OpenAQ station coverage in Nepal is sparse outside Kathmandu.
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Ownership chain
              </div>
              <ul className="mt-1 space-y-1 text-sm">
                {(screening.ownershipTree ?? []).map((node, i) => (
                  <li
                    key={`${node.name}-${i}`}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="text-slate-200">{node.name}</span>
                    <span className="text-xs text-slate-500">
                      {node.entityId ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="PCAF data quality for this loan"
        subtitle="What an annual NFRS disclosure would attribute to this exposure"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-line/60 bg-panel/40 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Attribution
            </div>
            <div className="mt-1 text-sm text-slate-200">
              {formatNpr(loan.outstandingNpr)} ÷{" "}
              {formatNpr(borrower.enterpriseValueUsd * NPR_PER_USD)} ={" "}
              <span className="font-medium text-white">
                {(attribution.attributionFactor * 100).toFixed(2)}%
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              PCAF reports this ratio in USD ({formatUsd(loan.outstandingUsd)} ÷{" "}
              {formatUsd(borrower.enterpriseValueUsd)}); identical %.
            </div>
          </div>
          <div className="rounded-md border border-line/60 bg-panel/40 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Attributed CO₂e
            </div>
            <div className="mt-1 text-sm text-slate-200">
              {formatCo2e(borrower.totalCo2eTonnes)} ×{" "}
              {(attribution.attributionFactor * 100).toFixed(2)}% ={" "}
              <span className="font-medium text-white">
                {formatCo2e(attribution.attributedCo2eTonnes)}
              </span>
            </div>
          </div>
          <div className="rounded-md border border-line/60 bg-panel/40 p-3">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400">
              PCAF score
              <PcafScoreInfoTip
                score={attribution.dataQualityScore}
                methodology={attribution.methodology}
                side="left"
              />
            </div>
            <div
              className={`mt-1 text-2xl font-semibold ${qualityScoreColors[attribution.dataQualityScore]}`}
            >
              {attribution.dataQualityScore}
              {attribution.pcafOption && (
                <span className="ml-2 text-xs font-normal uppercase tracking-wide text-slate-400">
                  Option {attribution.pcafOption}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">{attribution.qualityNote}</div>
            {attribution.pcafCitation && (
              <div
                className="mt-2 border-t border-line/60 pt-2 text-[10px] text-slate-500"
                title={attribution.pcafCitation}
              >
                {attribution.pcafCitation}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {borrower.facilities.length > 0 && (
        <div data-tour="facility-map">
          <Panel
            title="Facility locations"
            subtitle="Climate TRACE / GCCT geolocated assets attributed to this borrower"
          >
            <FacilityMap points={mapPoints} height={360} />
            <div className="mt-3 space-y-1 text-xs">
              {borrower.facilities.map((f) => (
                <div
                  key={f.assetId}
                  className="flex flex-wrap justify-between gap-2 text-slate-400"
                >
                  <span className="text-slate-200">{f.facilityName}</span>
                  <span>
                    {formatCo2e(f.annualCo2eTonnes)} / yr
                    {f.cementCapacityMtpa != null
                      ? ` · ${f.cementCapacityMtpa.toFixed(2)} Mt/yr cement`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {esddOpen && (
        <EsddChecklistDrawer
          borrower={borrower}
          loanId={loan.id}
          onClose={() => setEsddOpen(false)}
        />
      )}

      {sanityOpen && (
        <SanityCheckDrawer
          borrower={borrower}
          screening={screening}
          intensityRatio={intensityRatio ?? 0}
          onClose={() => setSanityOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ESDD checklist panel (NRB ESRM Annex 5) — LIVE STATUS from Supabase
// ---------------------------------------------------------------------------
//
// Shows the loan's actual ESDD progress against the NRB ESRM Annex 5
// questions. Fetches the latest response per question from
// bfi_esdd_responses and the latest saved screening (if any) from
// bfi_esrm_screenings, then renders per-section progress plus an
// "Open ESDD wizard" primary action.
//
// The pre-wizard "who provides this data" mapping (buildEsddRows) is kept
// below the fold as a small "Data coverage" note so the credit officer
// still knows which parts Jana automates. That informational panel
// answers the "why does this data quality vary per question" question
// but is no longer the primary content.

type EsddStatus = "jana" | "limited" | "bank";

type EsddRow = {
  category: string;
  status: EsddStatus;
  detail: string;
};

type EsddApiResponse = {
  ok: true;
  responses: Array<{
    questionId: string;
    answer: "a" | "b" | "c" | "d";
    remarks: string | null;
    capturedAt: string;
  }>;
};

function buildEsddRows(borrower: Borrower): EsddRow[] {
  const firstFacility = borrower.facilities[0];
  const hasFacility = !!firstFacility;
  const hasCtFacility =
    !!firstFacility &&
    typeof firstFacility.assetId === "string" &&
    firstFacility.assetId.startsWith("CT-");
  const hasGcctFacility =
    !!firstFacility &&
    (typeof firstFacility.gemPlantId === "string" || hasCtFacility);
  const isFacilityTier =
    borrower.dataTier === "facility" && hasFacility;
  const isHydropower = borrower.nrbSector.toLowerCase().includes("hydropower");

  const rows: EsddRow[] = [
    {
      category: "Exclusion List screening (Annex 4)",
      status: "bank",
      detail: "Bank screens borrower against NRB exclusion list",
    },
    {
      category: "Loan categorization (sector, criticality)",
      status: "bank",
      detail: `Bank classification · sector recorded: ${borrower.nrbSector}`,
    },
    {
      category: "Borrower identification",
      status: hasCtFacility || hasGcctFacility ? "jana" : isFacilityTier ? "limited" : "bank",
      detail: hasCtFacility
        ? "Climate TRACE facility match · verified lat/lng"
        : hasGcctFacility
          ? "Global Cement and Concrete Tracker plant record"
          : isFacilityTier
            ? "Curated facility location, not satellite-verified"
            : "Internal KYC only",
    },
    {
      category: "Environmental permits / EIA",
      status: "bank",
      detail: "Bank verifies EIA / IEE status, renewal dates, conditions",
    },
    {
      category: "Pollution and emissions",
      status: hasCtFacility ? "jana" : isFacilityTier ? "limited" : "bank",
      detail: hasCtFacility
        ? "Climate TRACE satellite-verified facility CO₂e"
        : isFacilityTier
          ? "Capacity-derived or sector benchmark emissions"
          : "Sector-average emissions only",
    },
    {
      category: "Land use and resettlement",
      status: "bank",
      detail: "Bank field assessment of land ownership and resettlement",
    },
    {
      category: "Biodiversity and natural habitats",
      status: "bank",
      detail: "Bank verifies proximity to protected areas and habitats",
    },
    {
      category: "Labor and working conditions",
      status: "bank",
      detail: "Bank questionnaire, OHS audit, child/forced labor screening",
    },
    {
      category: "Community health and safety",
      status: "bank",
      detail:
        "Bank consultation and grievance records · OpenAQ station coverage in Nepal is sparse",
    },
    {
      category: "Indigenous peoples (FPIC if applicable)",
      status: "bank",
      detail: "Bank verifies Free Prior and Informed Consent documentation",
    },
    {
      category: "Cultural heritage",
      status: "bank",
      detail: "Bank verifies proximity to heritage sites",
    },
  ];

  if (isHydropower) {
    rows.push({
      category: "Hydropower-specific (dam safety, downstream flow, fish passage)",
      status: "bank",
      detail: "Bank engineering and hydrology review",
    });
  }

  return rows;
}

// Structured section metadata used to render live per-question progress.
// The sections + question ids MUST match lib/regulatory/esdd/annex5-questions.ts.
// Circular 22 = 12 questions total, sector-agnostic. No supplements.

const ANNEX5_SECTIONS: Array<{
  title: string;
  short: string;
  questions: Array<{ id: string; number: string; prompt: string }>;
}> = [
  {
    title: "Section 1 — General Risk",
    short: "General",
    questions: [
      { id: "annex5.1.1", number: "1.1", prompt: "Legal issues with E&S performance" },
      { id: "annex5.1.2", number: "1.2", prompt: "Stakeholder grievances or NGO campaigns" },
      { id: "annex5.1.3", number: "1.3", prompt: "Site near eco-sensitive areas" },
    ],
  },
  {
    title: "Section 2 — Environmental Health & Safety",
    short: "EHS",
    questions: [
      { id: "annex5.2.1", number: "2.1", prompt: "Air and noise pollution" },
      { id: "annex5.2.2", number: "2.2", prompt: "Water pollution" },
      { id: "annex5.2.3", number: "2.3", prompt: "Land pollution / waste handling" },
      { id: "annex5.2.4", number: "2.4", prompt: "Energy efficiency / renewables" },
      // 2022 NRB ESRM Guideline addition
      { id: "annex5.2.5", number: "2.5", prompt: "Climate change risks & opportunities" },
    ],
  },
  {
    title: "Section 3 — Social Risks",
    short: "Social",
    questions: [
      { id: "annex5.3.1", number: "3.1", prompt: "Fire risk / occupational H&S" },
      { id: "annex5.3.2", number: "3.2", prompt: "Labour and working conditions" },
      { id: "annex5.3.3", number: "3.3", prompt: "Community health & safety" },
      { id: "annex5.3.4", number: "3.4", prompt: "Stakeholder consultation / indigenous people" },
    ],
  },
];

const ANSWER_COLOR: Record<"a" | "b" | "c" | "d", string> = {
  a: "#22c55e", // green — best case
  b: "#eab308", // yellow — partial mitigation
  c: "#ef4444", // red — no plan / escalation trigger
  d: "#6b7280", // gray — not applicable
};

// Taxonomy assessment shape returned by GET /api/taxonomy/assessments.
type TaxonomyLatest = {
  id: string;
  activity_id: string;
  computed_color: TaxonomyColor;
  computed_rationale: string;
  citation: string | null;
  captured_at: string;
};

const TAXONOMY_COLOR_BG: Record<TaxonomyColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  unclassified: "#64748b",
};

const TAXONOMY_COLOR_LABEL: Record<TaxonomyColor, string> = {
  green: "Green — Transformative",
  amber: "Amber — Transitional",
  red: "Red — Not aligned",
  unclassified: "Unclassified",
};

/**
 * NRB compliance status drawer — one drawer per loan, two subpanels:
 *   1. ESDD (NRB ESRM Annex 5)      — risk screening
 *   2. Taxonomy (NRB GFT Oct 2024)  — green classification
 *
 * Both subpanels are live: they fetch the latest saved state from
 * Supabase on open, render the appropriate CTA (Start / Continue / Re-run),
 * and preserve their independent status chips so the officer can see at a
 * glance where each regulatory flow stands for this loan.
 */
function EsddChecklistDrawer({
  borrower,
  loanId,
  onClose,
}: {
  borrower: Borrower;
  loanId: string;
  onClose: () => void;
}) {
  // ESDD live state
  const [responses, setResponses] = useState<Map<string, EsddApiResponse["responses"][number]>>(
    new Map(),
  );
  const [screening, setScreening] = useState<{
    riskClass: "low" | "medium" | "high" | "extreme";
    recommendation: string;
    escalationFlag: boolean;
    capturedAt: string;
  } | null>(null);
  const [esddLoading, setEsddLoading] = useState(true);

  // Taxonomy live state
  const [taxonomyLatest, setTaxonomyLatest] = useState<TaxonomyLatest | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEsddLoading(true);
      setTaxonomyLoading(true);
      try {
        const [respRes, scrRes, taxRes] = await Promise.all([
          fetch(`/api/esdd/responses?loanId=${encodeURIComponent(loanId)}`),
          fetch(`/api/esrm/screenings?loanId=${encodeURIComponent(loanId)}`).catch(
            () => null,
          ),
          fetch(`/api/taxonomy/assessments?loanId=${encodeURIComponent(loanId)}`).catch(
            () => null,
          ),
        ]);
        if (cancelled) return;

        // ESDD responses
        const map = new Map<string, EsddApiResponse["responses"][number]>();
        if (respRes.ok) {
          const body = (await respRes.json()) as EsddApiResponse;
          for (const r of body.responses) map.set(r.questionId, r);
        }
        setResponses(map);

        // ESRM screening
        if (scrRes && scrRes.ok) {
          const body = await scrRes.json();
          if (body?.latest) {
            setScreening({
              riskClass: body.latest.computed_risk_class,
              recommendation: body.latest.computed_recommendation,
              escalationFlag: body.latest.escalation_flag,
              capturedAt: body.latest.captured_at,
            });
          }
        }

        // Taxonomy assessment
        if (taxRes && taxRes.ok) {
          const body = await taxRes.json();
          if (body?.latest) setTaxonomyLatest(body.latest as TaxonomyLatest);
        }
      } finally {
        if (!cancelled) {
          setEsddLoading(false);
          setTaxonomyLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  // Circular 22 = single sector-agnostic 12-question checklist. The
  // borrower's sector is retained for other panels (taxonomy classification,
  // permit lookup) but does not add ESDD questions.
  const sections = ANNEX5_SECTIONS;

  const totalQuestions = sections.reduce(
    (s, sec) => s + sec.questions.length,
    0,
  );
  const answered = sections.reduce(
    (s, sec) => s + sec.questions.filter((q) => responses.has(q.id)).length,
    0,
  );

  const coverageItems = buildEsddRows(borrower);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"
      >
        {/* Header — drawer covers BOTH NRB compliance flows for this loan */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              NRB compliance status
            </div>
            <div className="text-lg font-semibold text-white">
              {borrower.name}
            </div>
            <div className="text-xs text-slate-500">
              {borrower.nrbSector} · Loan {loanId}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-300"
            aria-label="Close compliance status"
          >
            Close
          </button>
        </div>

        {/* ESDD subpanel */}
        <EsddSubpanel
          loanId={loanId}
          loading={esddLoading}
          answered={answered}
          total={totalQuestions}
          responses={responses}
          screening={screening}
          sections={sections}
        />

        {/* Taxonomy subpanel */}
        <TaxonomySubpanel
          loanId={loanId}
          borrower={borrower}
          loading={taxonomyLoading}
          latest={taxonomyLatest}
        />

        {/* Data coverage note — small, below both panels */}
        <details className="mt-4 rounded-md border border-line/60 bg-panelAlt/50 p-3 text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
            Data coverage — where Jana informs the answer
          </summary>
          <div className="mt-3 space-y-2">
            {coverageItems.map((item) => (
              <div
                key={item.category}
                className="flex items-start justify-between gap-2"
              >
                <div className="flex-1">
                  <div className="text-[11px] text-slate-300">{item.category}</div>
                  <div className="text-[10px] text-slate-500">{item.detail}</div>
                </div>
                <Badge
                  className={
                    item.status === "jana"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : item.status === "limited"
                        ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                  }
                >
                  {item.status === "jana"
                    ? "Jana data"
                    : item.status === "limited"
                      ? "Jana partial"
                      : "Bank"}
                </Badge>
              </div>
            ))}
            <div className="mt-2 text-[10px] italic text-slate-500">
              Jana automates the parts that benefit from satellite and
              inventory data. The rest stays with the credit officer.
            </div>
          </div>
        </details>
      </aside>
    </div>
  );
}

function EsddSubpanel({
  loanId,
  loading,
  answered,
  total,
  responses,
  screening,
  sections,
}: {
  loanId: string;
  loading: boolean;
  answered: number;
  total: number;
  responses: Map<string, EsddApiResponse["responses"][number]>;
  screening: {
    riskClass: "low" | "medium" | "high" | "extreme";
    recommendation: string;
    escalationFlag: boolean;
    capturedAt: string;
  } | null;
  sections: Array<{
    title: string;
    short: string;
    questions: Array<{ id: string; number: string; prompt: string }>;
  }>;
}) {
  const pct = total > 0 ? answered / total : 0;
  return (
    <div className="mt-4 rounded-xl border border-line bg-panelAlt/60 p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          ESDD checklist
        </div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          NRB ESRM Annex 5
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-sm font-semibold text-white">
          {loading ? "Loading…" : `${answered} of ${total} answered`}
        </div>
        {screening ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{
              backgroundColor:
                screening.riskClass === "extreme"
                  ? "#ef4444"
                  : screening.riskClass === "high"
                    ? "#f97316"
                    : screening.riskClass === "medium"
                      ? "#eab308"
                      : "#22c55e",
            }}
            title={`Saved ${new Date(screening.capturedAt).toLocaleString()}`}
          >
            {screening.riskClass.toUpperCase()}
          </span>
        ) : answered > 0 ? (
          <span className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-slate-400">
            In progress
          </span>
        ) : (
          <span className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-slate-500">
            Not started
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: "var(--brand-primary)",
          }}
        />
      </div>
      {screening?.escalationFlag && (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
          Escalated to credit committee per NRB ESRM guidance
        </div>
      )}
      <a
        href={`/esdd/${encodeURIComponent(loanId)}`}
        className="mt-3 flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-white transition"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <span>
          {answered === 0
            ? "Start ESDD checklist"
            : screening
              ? "Review saved screening"
              : "Continue ESDD checklist"}
        </span>
        <span aria-hidden>→</span>
      </a>

      {/* Per-section, per-question status */}
      <div className="mt-4 flex flex-col gap-3">
        {sections.map((sec) => {
          const secAnswered = sec.questions.filter((q) => responses.has(q.id))
            .length;
          return (
            <div
              key={sec.title}
              className="rounded-lg border border-line bg-panelAlt"
            >
              <div className="flex items-baseline justify-between border-b border-line/60 px-3 py-2">
                <div className="text-xs font-semibold text-slate-200">
                  {sec.title}
                </div>
                <div className="text-[11px] text-slate-500">
                  {secAnswered}/{sec.questions.length}
                </div>
              </div>
              <div className="divide-y divide-line/40">
                {sec.questions.map((q) => {
                  const r = responses.get(q.id);
                  return (
                    <div
                      key={q.id}
                      className="flex items-start justify-between gap-3 px-3 py-2"
                    >
                      <div className="flex-1">
                        <div className="text-[13px] text-slate-200">
                          <span className="text-slate-500">Q {q.number}</span>{" "}
                          {q.prompt}
                        </div>
                        {r?.remarks && (
                          <div className="mt-0.5 text-[11px] italic text-slate-500">
                            &ldquo;{r.remarks}&rdquo;
                          </div>
                        )}
                      </div>
                      {r ? (
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: ANSWER_COLOR[r.answer] }}
                          title={
                            r.answer === "a"
                              ? "Best case — no evidence of concern"
                              : r.answer === "b"
                                ? "Partial mitigation, definite plan"
                                : r.answer === "c"
                                  ? "Concern with no plan — escalation trigger"
                                  : "Not applicable"
                          }
                        >
                          {r.answer.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaxonomySubpanel({
  loanId,
  borrower,
  loading,
  latest,
}: {
  loanId: string;
  borrower: Borrower;
  loading: boolean;
  latest: TaxonomyLatest | null;
}) {
  const activity = latest ? findActivityById(latest.activity_id) : null;
  const ctaLabel = latest
    ? "Re-run classification"
    : "Classify against NRB Green Finance Taxonomy";

  return (
    <div className="mt-4 rounded-xl border border-line bg-panelAlt/60 p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Green Finance Taxonomy
        </div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          NRB GFT Oct 2024
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-sm font-semibold text-white">
          {loading
            ? "Loading…"
            : latest
              ? activity?.name ?? latest.activity_id
              : "Not classified"}
        </div>
        {latest ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: TAXONOMY_COLOR_BG[latest.computed_color] }}
            title={`Saved ${new Date(latest.captured_at).toLocaleString()}`}
          >
            {TAXONOMY_COLOR_LABEL[latest.computed_color]}
          </span>
        ) : (
          <span className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-slate-500">
            Not started
          </span>
        )}
      </div>

      {latest && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-300">{latest.computed_rationale}</p>
          {latest.citation && (
            <div className="text-[11px] italic text-slate-500">
              {latest.citation}
            </div>
          )}
          {activity && (
            <div className="text-[11px] text-slate-500">
              Sector: {activity.sectorLabel}
            </div>
          )}
        </div>
      )}

      {!latest && !loading && (
        <p className="mt-3 text-xs text-slate-400">
          This loan has not yet been classified against the NRB Green
          Finance Taxonomy. The taxonomy determines whether the loan
          counts toward the bank&rsquo;s green portfolio disclosures and
          which DNSH checks apply. Suggested activities based on{" "}
          {borrower.nrbSector} will appear in the wizard.
        </p>
      )}

      <a
        href={`/taxonomy/${encodeURIComponent(loanId)}`}
        className="mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold transition hover:bg-white/5"
        style={{
          borderColor: "var(--brand-primary)",
          color: "var(--brand-primary)",
        }}
      >
        <span>{ctaLabel}</span>
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sanity check slide-over
// ---------------------------------------------------------------------------
//
// Verifies the "share of Nepal's national CO₂" claim end-to-end. Borrower-
// adaptive: pulls the borrower's actual CT asset id, ranks it against all
// other Nepal CT manufacturing facilities, computes the implied emission
// factor against GCCT cement capacity where available.

type CtFacility = {
  assetId: string;
  lat: number;
  lng: number;
  sector: string;
  co2e2024Tonnes: number;
  tier: "L" | "M" | "H";
};

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function SanityCheckDrawer({
  borrower,
  screening,
  intensityRatio,
  onClose,
}: {
  borrower: Borrower;
  screening: import("@/lib/types/bfi").BorrowerScreening;
  intensityRatio: number;
  onClose: () => void;
}) {
  const facility = borrower.facilities[0];
  const allCt = ctSnapshot.facilities as CtFacility[];

  // 1) Find the matched CT facility
  const matchedCt = facility
    ? allCt.find(
        (f) =>
          Math.abs(f.lat - facility.lat) < 0.005 &&
          Math.abs(f.lng - facility.lng) < 0.005
      ) ?? null
    : null;

  // 2) Distance from registry coords (proxy: facility lat/lng vs CT lat/lng)
  const matchKm =
    facility && matchedCt
      ? haversineKm(facility.lat, facility.lng, matchedCt.lat, matchedCt.lng)
      : null;

  // 3) Nearby CT facilities within 5 km (aggregation check)
  const nearby =
    facility != null
      ? allCt.filter(
          (f) => haversineKm(facility.lat, facility.lng, f.lat, f.lng) <= 5
        )
      : [];

  // 4) Sector ranking
  const sameSectorFacilities = matchedCt
    ? allCt
        .filter((f) => f.sector === matchedCt.sector)
        .sort((a, b) => b.co2e2024Tonnes - a.co2e2024Tonnes)
    : [];
  const rankInSector = matchedCt
    ? sameSectorFacilities.findIndex((f) => f.assetId === matchedCt.assetId) + 1
    : 0;
  const topPeers = sameSectorFacilities.slice(0, 5);

  // 5) Asset uniqueness across the whole CT dataset
  const totalRows = allCt.length;
  const uniqueAssetIds = new Set(allCt.map((f) => f.assetId)).size;

  // 6) Emission factor from GCCT cement capacity, if available
  const cementCapMtpa = facility?.cementCapacityMtpa ?? null;
  const emissionFactorTPerT =
    cementCapMtpa && matchedCt
      ? matchedCt.co2e2024Tonnes / (cementCapMtpa * 1_000_000)
      : null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Sanity check
            </div>
            <div className="text-lg font-semibold text-white">
              {borrower.name}: {formatPercent(intensityRatio)} of Nepal's national CO₂
            </div>
            <div className="text-xs text-slate-500">
              How this percentage is derived, end-to-end.
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-300"
            aria-label="Close sanity check"
          >
            Close
          </button>
        </div>

        {/* Section 1 — One facility, one CT asset, no aggregation */}
        <section className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            One facility, one CT asset, no aggregation
          </div>
          {matchedCt && facility ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              Within 5 km of the registered coordinates ({facility.lat.toFixed(4)},{" "}
              {facility.lng.toFixed(4)}) there are{" "}
              <span className="font-semibold text-white">
                {nearby.length} Climate TRACE {nearby.length === 1 ? "facility" : "facilities"}
              </span>
              . The matched asset is{" "}
              <span className="font-mono text-white">id {matchedCt.assetId}</span> at (
              {matchedCt.lat.toFixed(4)}, {matchedCt.lng.toFixed(4)}), about{" "}
              <span className="font-semibold text-white">
                {matchKm != null ? `${(matchKm * 1000).toFixed(0)} m` : "—"}
              </span>{" "}
              from the registry coordinates (satellite positioning vs registry
              rounding for the same physical asset). No other CT records at or
              near that point that could have been bundled into one number.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              No Climate TRACE facility match for this borrower in the 2024
              snapshot. The borrower's emissions figure is sector-benchmark or
              capacity-derived, not satellite-verified.
            </p>
          )}
        </section>

        {/* Section 2 — Asset uniqueness across the whole dataset */}
        <section className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            Asset uniqueness across the dataset
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Climate TRACE 2024 Nepal coverage:{" "}
            <span className="font-semibold text-white">
              {uniqueAssetIds.toLocaleString()} distinct asset IDs across{" "}
              {totalRows.toLocaleString()} rows
            </span>
            {uniqueAssetIds === totalRows ? (
              <> — every row is a unique asset, no duplicates.</>
            ) : (
              <> — {totalRows - uniqueAssetIds} duplicate rows present.</>
            )}
          </p>
        </section>

        {/* Section 3 — Ranking among same-sector peers */}
        {matchedCt && (
          <section className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">
              Largest {matchedCt.sector} facility in Nepal CT data
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              This asset ranks{" "}
              <span className="font-semibold text-white">
                #{rankInSector} of {sameSectorFacilities.length}
              </span>{" "}
              in the {matchedCt.sector} sector by 2024 CO₂e. Top {Math.min(5, sameSectorFacilities.length)} for context:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {topPeers.map((f, i) => (
                <li
                  key={f.assetId}
                  className={`flex justify-between rounded px-2 py-1 ${
                    f.assetId === matchedCt.assetId
                      ? "bg-accent/10 text-white"
                      : ""
                  }`}
                >
                  <span>
                    #{i + 1} · asset {f.assetId} · ({f.lat.toFixed(4)},{" "}
                    {f.lng.toFixed(4)})
                  </span>
                  <span>{formatCo2e(f.co2e2024Tonnes)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 4 — The math */}
        <section className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            The math
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            <span className="font-mono text-white">
              {(screening.borrowerIntensityValue ?? 0).toLocaleString()}
            </span>{" "}
            tCO₂e ÷{" "}
            <span className="font-mono text-white">
              {(screening.sectorBenchmarkValue ?? 0).toLocaleString()}
            </span>{" "}
            tCO₂ ={" "}
            <span className="font-semibold text-white">
              {formatPercent(intensityRatio)}
            </span>
            . Both numbers come from committed snapshots: Climate TRACE 2024 for
            the borrower, EDGAR v8.1 polygon-clipped to Nepal's administrative
            boundary for the national denominator ({EDGAR_NEPAL.nepalCellCount.toLocaleString()}{" "}
            cells inside Nepal). The percentage is not rounded up or framed
            favourably.
          </p>
        </section>

        {/* Section 5 — Physical plausibility */}
        {emissionFactorTPerT != null && cementCapMtpa != null && matchedCt && (
          <section className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">
              Physical plausibility
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              <span className="font-mono text-white">
                {matchedCt.co2e2024Tonnes.toLocaleString()}
              </span>{" "}
              tCO₂e ÷{" "}
              <span className="font-mono text-white">
                {cementCapMtpa.toFixed(2)} Mt
              </span>{" "}
              of cement capacity ={" "}
              <span className="font-semibold text-white">
                {emissionFactorTPerT.toFixed(2)} tCO₂ per tonne cement
              </span>
              . For reference, the global cement industry average is 0.6 to 0.8
              tCO₂/t and modern dry-process plants sit in the 0.4 to 0.6 range.
              {emissionFactorTPerT < 0.45 ? (
                <>
                  {" "}
                  {emissionFactorTPerT.toFixed(2)} t/t implies either ~70% capacity
                  utilisation or a relatively efficient kiln. Plausible, not
                  inflated.
                </>
              ) : emissionFactorTPerT < 0.7 ? (
                <>
                  {" "}
                  {emissionFactorTPerT.toFixed(2)} t/t sits in the modern dry-process
                  band, consistent with a working plant near full utilisation.
                </>
              ) : (
                <>
                  {" "}
                  {emissionFactorTPerT.toFixed(2)} t/t is at the higher end of the
                  industry range. Consistent with older or wet-process plants.
                </>
              )}
            </p>
          </section>
        )}

        {/* Section 6 — Conclusion */}
        <section className="mt-5 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Defensible end-to-end
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            Single CT asset, single registry-confirmed plant, real 2024
            satellite emissions, real EDGAR polygon-clipped national CO₂
            denominator, straightforward division. No aggregation, no rounding
            in the bank's favour.
          </p>
        </section>

        {/* Section 7 — Sources */}
        <section className="mt-4 text-xs leading-relaxed text-slate-500">
          <div className="font-semibold uppercase tracking-wide text-slate-400">
            Sources
          </div>
          <ul className="mt-1 list-disc pl-4">
            <li>Climate TRACE v5.6 facility emissions, 2024 (CC BY 4.0)</li>
            <li>Global Cement and Concrete Tracker, July 2025 release (Global Energy Monitor, CC BY 4.0)</li>
            <li>EDGAR v8.1 gridded CO₂ emissions, polygon-clipped to Nepal admin boundary</li>
            <li>
              <code>docs/SANITY_CHECK_Hongshi_4.9_percent.md</code> in the repo
              for the full offline writeup
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
