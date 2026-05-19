"use client";

import { DashboardSsrData } from "@/components/bfi/dashboard";
import { KpiCard, Panel } from "@/components/bfi/shared/primitives";
import { LoanTable } from "@/components/bfi/shared/loan-table";
import { formatNpr } from "@/components/bfi/ui";
import { InfoTip } from "@/components/bfi/shared/info-tip";

export function LoansTab({ data }: { data: DashboardSsrData }) {
  const s = data.portfolio;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total loans"
          value={s.totalLoans.toLocaleString()}
          sublabel={`across ${data.distinctValues.branches.length} branches`}
        />
        <KpiCard
          label="Total outstanding"
          value={formatNpr(s.totalOutstandingNpr)}
          sublabel={`First Bank of Nepal · ${data.meta.asOfDate ?? ""}`}
        />
        <KpiCard
          label="In-scope commercial"
          value={(s.funnel?.inScopeLoans ?? 0).toLocaleString()}
          sublabel={`${formatNpr(s.funnel?.inScopeOutstandingNpr ?? 0)} outstanding`}
        />
        <KpiCard
          label={
            <span className="inline-flex items-center gap-1">
              Facility-matched
              <InfoTip id="facility-tier" side="below" />
            </span>
          }
          value={(s.funnel?.facilityMatchedLoans ?? 0).toLocaleString()}
          sublabel="facility-tier data"
          accent
        />
      </div>

      <div data-tour="loan-table">
        <Panel
          title="Portfolio loan list"
          subtitle="Search, filter and drill into any loan in the book"
        >
          <LoanTable
            initialRows={data.initialLoans}
            initialTotal={data.totalLoanCount}
            pageSize={50}
            sectors={data.distinctValues.sectors}
            businessUnits={data.distinctValues.businessUnits}
          />
        </Panel>
      </div>
    </div>
  );
}
