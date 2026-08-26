/**
 * GET /api/climate/borrower/[borrowerId]
 *
 * Returns the NGFS-aligned climate risk categorisation + 25,000 tCO2e/yr
 * emissions threshold flag for a single borrower, computed from the
 * demo's borrower catalogue.
 *
 * Cited: NRB ESRM 2022 §4.1 (NGFS taxonomy), §4.3 (reporting threshold),
 * §4.4 (portfolio-level tracking expectation).
 *
 * Response shape (see lib/regulatory/climate/types.ts):
 *   {
 *     ok: true,
 *     borrowerId: string,
 *     borrower: { id, name, nrbSector },
 *     climateRisk: BorrowerClimateRisk,
 *     emissionsFlag: BorrowerEmissionsFlag,
 *   }
 *
 * 404 when the borrower id is not found in the demo catalogue.
 *
 * If Supabase is configured and the tenant has persisted an override in
 * `bfi_climate_risk_assessments`, the override supersedes the inferred
 * values. See scripts/supabase-climate-risk.sql for the shape.
 */

import { NextResponse } from "next/server";
import { getBfiDemoData } from "@/lib/api/bfi";

import { resolveCurrentTenant } from "@/lib/tenants";
import { getCaptureClient } from "@/lib/data/capture-client";
import {
  getBorrowerClimateBundle,
  inferClimateRisk,
  inferEmissionsFlag,
} from "@/lib/regulatory/climate/infer";
import type {
  BorrowerClimateRisk,
  BorrowerEmissionsFlag,
  NgfsPhysicalRiskCategory,
  NgfsTransitionRiskCategory,
  ClimateRiskRating,
} from "@/lib/regulatory/climate/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ borrowerId: string }> };

type OverrideRow = {
  physical_risks: NgfsPhysicalRiskCategory[] | null;
  transition_risks: NgfsTransitionRiskCategory[] | null;
  overall_rating: ClimateRiskRating | null;
  estimated_annual_tco2e: number | null;
  reduction_target_on_file: boolean | null;
  target_details: string | null;
  assessed_by: string | null;
  assessed_at: string | null;
};

async function loadOverride(
  bankId: string,
  borrowerId: string,
): Promise<OverrideRow | null> {
  const supabase = await getCaptureClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("bfi_climate_risk_assessments")
    .select(
      "physical_risks, transition_risks, overall_rating, estimated_annual_tco2e, reduction_target_on_file, target_details, assessed_by, assessed_at",
    )
    .eq("bank_id", bankId)
    .eq("borrower_id", borrowerId)
    .order("assessed_at", { ascending: false })
    .limit(1);
  if (error) {
    // Table may not exist yet in dev — treat as absent rather than 500.
    console.warn(
      "[climate/borrower] override lookup failed:",
      error.message,
    );
    return null;
  }
  return (data?.[0] as OverrideRow | undefined) ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const { borrowerId } = await params;
  if (!borrowerId) {
    return NextResponse.json(
      { error: "borrowerId is required" },
      { status: 400 },
    );
  }

  const data = await getBfiDemoData();
  const borrower = data.borrowers.find((b) => b.id === borrowerId);
  if (!borrower) {
    return NextResponse.json(
      { error: `Borrower ${borrowerId} not found` },
      { status: 404 },
    );
  }

  const inferred = getBorrowerClimateBundle(borrower);
  let climateRisk: BorrowerClimateRisk = inferred.climateRisk;
  let emissionsFlag: BorrowerEmissionsFlag = inferred.emissionsFlag;

  // Apply any persisted officer override on top of the inferred values.
  const tenant = await resolveCurrentTenant();
  const override = await loadOverride(tenant.id, borrowerId);
  if (override) {
    if (override.physical_risks || override.transition_risks || override.overall_rating) {
      climateRisk = {
        physicalRisks: override.physical_risks ?? inferred.climateRisk.physicalRisks,
        transitionRisks:
          override.transition_risks ?? inferred.climateRisk.transitionRisks,
        overallRating:
          override.overall_rating ?? inferred.climateRisk.overallRating,
        assessedAt: override.assessed_at
          ? new Date(override.assessed_at)
          : inferred.climateRisk.assessedAt,
        assessedBy:
          override.assessed_by ?? inferred.climateRisk.assessedBy,
      };
    }
    const overrideTco2e =
      override.estimated_annual_tco2e ?? inferred.emissionsFlag.estimatedAnnualTco2e;
    const targetOnFile =
      override.reduction_target_on_file ??
      inferred.emissionsFlag.reductionTargetOnFile;
    emissionsFlag = {
      estimatedAnnualTco2e: overrideTco2e,
      exceedsReportingThreshold: overrideTco2e >= 25_000,
      reductionTargetOnFile: targetOnFile,
      targetDetails:
        override.target_details ?? inferred.emissionsFlag.targetDetails,
    };
    // Fresh emissions estimate may change the derived rating.
    if (!override.overall_rating) {
      climateRisk = { ...climateRisk, overallRating: inferClimateRisk({
        ...borrower,
        totalCo2eTonnes: overrideTco2e,
      }).overallRating };
    }
  }

  // Fallback: if we lost the flag object above, recompute from borrower.
  if (!emissionsFlag) {
    emissionsFlag = inferEmissionsFlag(borrower);
  }

  return NextResponse.json({
    ok: true,
    borrowerId,
    borrower: {
      id: borrower.id,
      name: borrower.name,
      nrbSector: borrower.nrbSector,
    },
    climateRisk: {
      ...climateRisk,
      assessedAt: climateRisk.assessedAt.toISOString(),
    },
    emissionsFlag,
    citation: "NRB ESRM 2022 §4.1 (NGFS taxonomy), §4.3 (25k tCO2e threshold)",
  });
}
