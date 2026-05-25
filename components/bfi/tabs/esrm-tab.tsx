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

const NRB_REGULATORY_LINK =
  "https://www.nrb.org.np/contents/uploads/2018/05/Environment-Social-Risk-Management-Guidelines-2018.pdf";

export function EsrmTab({ data }: { data: DashboardSsrData }) {
  const apps = data.applications;
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(
    apps[0]?.loan.id ?? null
  );

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
            subtitle="Pending ESRM screening — newest first"
          >
            <ApplicationsList
              apps={apps}
              selectedLoanId={selectedLoanId}
              onSelect={setSelectedLoanId}
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
}: {
  apps: LoanRow[];
  selectedLoanId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="-m-2 max-h-[640px] overflow-y-auto">
      <ul className="space-y-1 p-2">
        {apps.map((r) => {
          const isSel = r.loan.id === selectedLoanId;
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
                  <TaxonomyDot color={r.loan.nrbTaxonomy} />
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
              </button>
            </li>
          );
        })}
        {apps.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-500">
            No applications currently under review.
          </li>
        )}
      </ul>
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
}: {
  row: LoanRow;
  prebuiltScreening?: import("@/lib/types/bfi").BorrowerScreening;
  liveEnrichment?: { edgar: boolean; openaq: boolean; edgarYear?: number };
  isMock: boolean;
}) {
  const { loan, borrower, attribution } = row;
  const screening = useMemo(
    () => prebuiltScreening ?? buildScreening(borrower),
    [borrower, prebuiltScreening]
  );
  const edgarLive = !!liveEnrichment?.edgar;
  const openaqLive = !!liveEnrichment?.openaq;
  const [esddOpen, setEsddOpen] = useState(false);
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
              View ESDD checklist (NRB ESRM Annex 5)
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
                {borrower.facilities.length === 1 ? "facility" : "facilities"} ·
                {" "}{borrower.facilities.length > 0
                  ? "PCAF Score 2-3"
                  : "Score 4 (benchmark)"}
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
                <div className="text-xs text-slate-500">
                  of Nepal's national CO₂ (EDGAR 2024)
                </div>
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
        subtitle="What an annual NSRS disclosure would attribute to this exposure"
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
            </div>
            <div className="text-xs text-slate-500">{attribution.qualityNote}</div>
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
          onClose={() => setEsddOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ESDD checklist panel (NRB ESRM Annex 5)
// ---------------------------------------------------------------------------
//
// Honest mapping of which ESDD categories Jana actually informs versus those
// the bank must own. Only two categories carry Jana data today: borrower
// identification (where we have a Climate TRACE or GCCT match) and pollution
// /emissions (where Climate TRACE has facility-level coverage). Everything
// else, including OpenAQ-based community health (sparse in Nepal),
// biodiversity, EIA, labor, indigenous, and hydropower-specific reviews,
// stays in the bank's ESDD workflow.

type EsddStatus = "jana" | "limited" | "bank";

type EsddRow = {
  category: string;
  status: EsddStatus;
  detail: string;
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

function EsddChecklistDrawer({
  borrower,
  onClose,
}: {
  borrower: Borrower;
  onClose: () => void;
}) {
  const items = buildEsddRows(borrower);
  const janaCount = items.filter((r) => r.status === "jana").length;
  const limitedCount = items.filter((r) => r.status === "limited").length;
  const bankCount = items.filter((r) => r.status === "bank").length;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              NRB ESRM Annex 5
            </div>
            <div className="text-lg font-semibold text-white">
              ESDD checklist
            </div>
            <div className="text-xs text-slate-500">
              {borrower.name} · {borrower.nrbSector}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-panelAlt px-2 py-1 text-xs text-slate-300"
            aria-label="Close ESDD checklist"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            {janaCount} Jana data
          </Badge>
          {limitedCount > 0 && (
            <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-300">
              {limitedCount} Jana partial
            </Badge>
          )}
          <Badge className="border-slate-500/30 bg-slate-500/10 text-slate-400">
            {bankCount} Bank review
          </Badge>
        </div>

        <div className="mt-4 divide-y divide-line/40">
          {items.map((item) => (
            <div
              key={item.category}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="flex-1">
                <div className="text-sm text-slate-200">{item.category}</div>
                <div className="text-xs text-slate-500">{item.detail}</div>
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
                    : "Bank review"}
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-line/60 bg-panelAlt p-3 text-xs text-slate-400">
          ESDD is fundamentally a bank workflow. Jana automates the parts
          that benefit from satellite and inventory data. The rest stays
          with the credit officer.
        </div>
      </aside>
    </div>
  );
}
