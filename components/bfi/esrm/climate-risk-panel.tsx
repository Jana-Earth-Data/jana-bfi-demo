"use client";

/**
 * Climate risk panel — compact borrower-level display of NGFS-aligned
 * physical + transition risk categories, overall rating, and the 25,000
 * tCO2e/yr NRB ESRM Guideline 2022 §4.3 threshold flag.
 *
 * Rendered inline on the ESRM tab's screening workbench under the
 * compliance status stripe. Uses the deterministic inference in
 * `lib/regulatory/climate/infer.ts` so the panel renders without a
 * database round-trip. When the officer navigates to a borrower for the
 * first time, the panel also `fetch`es
 * `/api/climate/borrower/[borrowerId]` in the background — that call
 * overlays any persisted override on top of the inferred values.
 *
 * Visual style follows the existing Panel primitives; badges reuse the
 * emerald / amber / rose colour semantics used elsewhere in the demo
 * (risk pill on the workbench, escalation banner, taxonomy chip).
 */

import { useEffect, useState } from "react";
import type { Borrower } from "@/lib/types/bfi";
import {
  getBorrowerClimateBundle,
} from "@/lib/regulatory/climate/infer";
import {
  NGFS_ACUTE_PHYSICAL,
  NGFS_CHRONIC_PHYSICAL,
  NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E,
  type BorrowerClimateBundle,
  type ClimateRiskRating,
  type NgfsPhysicalRiskCategory,
} from "@/lib/regulatory/climate/types";
import { formatCo2e } from "@/components/bfi/ui";

const RATING_STYLE: Record<
  ClimateRiskRating,
  { bg: string; label: string }
> = {
  low: { bg: "#22c55e", label: "LOW" },
  medium: { bg: "#eab308", label: "MEDIUM" },
  high: { bg: "#ef4444", label: "HIGH" },
};

function isAcute(cat: NgfsPhysicalRiskCategory): boolean {
  return (NGFS_ACUTE_PHYSICAL as string[]).includes(cat);
}

function isChronic(cat: NgfsPhysicalRiskCategory): boolean {
  return (NGFS_CHRONIC_PHYSICAL as string[]).includes(cat);
}

export function ClimateRiskPanel({ borrower }: { borrower: Borrower }) {
  // Seed from the deterministic in-memory inference so the panel renders
  // instantly on first paint — no loading flash for the manager.
  const [bundle, setBundle] = useState<BorrowerClimateBundle>(() =>
    getBorrowerClimateBundle(borrower),
  );

  // Refresh from the API — overlays any persisted override captured in
  // the bfi_climate_risk_assessments table (see
  // scripts/supabase-climate-risk.sql). Silent failure keeps the inline
  // baseline visible on network glitches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/climate/borrower/${encodeURIComponent(borrower.id)}`,
        );
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !body?.ok) return;
        setBundle({
          borrowerId: body.borrowerId,
          climateRisk: {
            ...body.climateRisk,
            assessedAt: new Date(body.climateRisk.assessedAt),
          },
          emissionsFlag: body.emissionsFlag,
        });
      } catch {
        /* silent — panel already shows inferred baseline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [borrower.id]);

  const { climateRisk, emissionsFlag } = bundle;
  const rating = RATING_STYLE[climateRisk.overallRating];
  const above = emissionsFlag.exceedsReportingThreshold;
  const missingTarget = above && !emissionsFlag.reductionTargetOnFile;

  const physicalAcute = climateRisk.physicalRisks.filter(isAcute);
  const physicalChronic = climateRisk.physicalRisks.filter(isChronic);

  return (
    <div
      className="mt-3 rounded-lg border border-line bg-panelAlt p-3"
      data-tour="climate-risk-panel"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Climate risk (NGFS)
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            NRB ESRM 2022 §4.1
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: rating.bg }}
          title={`Overall climate rating: ${climateRisk.overallRating}`}
        >
          {rating.label}
        </span>
      </div>

      {/* Physical risk badges (acute + chronic split) */}
      <div className="mt-3 space-y-1.5">
        <BadgeRow
          label="Physical (acute)"
          categories={physicalAcute}
          borderClass="border-amber-500/40 bg-amber-500/10 text-amber-100"
        />
        <BadgeRow
          label="Physical (chronic)"
          categories={physicalChronic}
          borderClass="border-sky-500/40 bg-sky-500/10 text-sky-100"
        />
        <BadgeRow
          label="Transition"
          categories={climateRisk.transitionRisks}
          borderClass="border-violet-500/40 bg-violet-500/10 text-violet-100"
        />
      </div>

      {/* Emissions threshold flag — the 25k tCO2e/yr rule from §4.3 */}
      <div
        className={`mt-3 rounded-md border px-3 py-2 text-xs ${
          missingTarget
            ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
            : above
              ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
              : "border-line bg-panel text-slate-300"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold uppercase tracking-wide text-[10px]">
            25,000 tCO₂e / yr threshold
          </div>
          <div className="text-[10px] opacity-70">NRB ESRM 2022 §4.3</div>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <div>
            Est. annual emissions:{" "}
            <span className="font-semibold text-white">
              {formatCo2e(emissionsFlag.estimatedAnnualTco2e)}
            </span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              above
                ? "bg-white/10 text-white"
                : "bg-slate-500/20 text-slate-300"
            }`}
          >
            {above ? "ABOVE" : "BELOW"}
          </span>
        </div>
        {above && (
          <div className="mt-1">
            {emissionsFlag.reductionTargetOnFile ? (
              <span>
                Reduction target on file:{" "}
                <span className="text-white">
                  {emissionsFlag.targetDetails ?? "documented"}
                </span>
              </span>
            ) : (
              <span className="font-semibold">
                No reduction target on file — flag under NRB ESRM 2022 §4.3
              </span>
            )}
          </div>
        )}
        {!above && (
          <div className="mt-1 text-[11px] opacity-80">
            Below the {NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E.toLocaleString()}{" "}
            tCO₂e/yr reporting threshold; no target expected.
          </div>
        )}
      </div>
    </div>
  );
}

function BadgeRow({
  label,
  categories,
  borderClass,
}: {
  label: string;
  categories: string[];
  borderClass: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-32 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {categories.length === 0 ? (
          <span className="text-[11px] text-slate-500">None identified</span>
        ) : (
          categories.map((cat) => (
            <span
              key={cat}
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${borderClass}`}
            >
              {cat}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
