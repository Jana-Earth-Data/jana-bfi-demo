/**
 * Tour registry — resolves a (tenantId × tourName) pair to a TourScript.
 *
 * Every script is a static JSON import so bundling is trivial and there's
 * no runtime fetch. When onboarding a new tenant, copy the default/ tree
 * to <newTenant>/, edit the strings, and add three imports here.
 */

import type { TourName, TourScript } from "./types";
import type { TenantId } from "@/lib/tenants";

// Default tenant (First Bank of Nepal — the platform-agnostic demo tour set).
import defaultDashboard from "@/data/tour-scripts/default/dashboard.json";
import defaultLoanOfficer from "@/data/tour-scripts/default/loan-officer.json";
import defaultManager from "@/data/tour-scripts/default/manager.json";
import defaultPfScreening from "@/data/tour-scripts/default/pf-screening.json";
import defaultPcaf from "@/data/tour-scripts/default/pcaf.json";

// Laxmi Sunrise Bank.
import laxmiDashboard from "@/data/tour-scripts/laxmi_sunrise/dashboard.json";
import laxmiLoanOfficer from "@/data/tour-scripts/laxmi_sunrise/loan-officer.json";
import laxmiManager from "@/data/tour-scripts/laxmi_sunrise/manager.json";
import laxmiPfScreening from "@/data/tour-scripts/laxmi_sunrise/pf-screening.json";
import laxmiPcaf from "@/data/tour-scripts/laxmi_sunrise/pcaf.json";

type TourMap = Partial<Record<TourName, TourScript>>;

const REGISTRY: Record<TenantId, TourMap> = {
  default: {
    dashboard: defaultDashboard as TourScript,
    "loan-officer": defaultLoanOfficer as TourScript,
    manager: defaultManager as TourScript,
    "pf-screening": defaultPfScreening as TourScript,
    pcaf: defaultPcaf as TourScript,
  },
  laxmi_sunrise: {
    dashboard: laxmiDashboard as TourScript,
    "loan-officer": laxmiLoanOfficer as TourScript,
    manager: laxmiManager as TourScript,
    "pf-screening": laxmiPfScreening as TourScript,
    pcaf: laxmiPcaf as TourScript,
  },
};

export function getTourScript(
  tenantId: TenantId | string,
  tourName: TourName,
): TourScript | null {
  const tours = REGISTRY[tenantId as TenantId];
  if (!tours) return null;
  return tours[tourName] ?? null;
}

/**
 * List which tours are available for a given tenant. Used by the header
 * selector to show / hide options that the tenant doesn't have scripts
 * (and audio) for.
 */
export function availableTours(tenantId: TenantId | string): TourName[] {
  const tours = REGISTRY[tenantId as TenantId];
  if (!tours) return [];
  return (Object.keys(tours) as TourName[]).filter(
    (name) => tours[name] !== undefined,
  );
}
