"use client";

/**
 * PCAF wizard — client shell for the dedicated /pcaf/[loanId] route.
 *
 * PCAF availability capture is a single-panel surface (4 flag rows +
 * per-row evidence textareas), not a multi-step wizard. This shell
 * exists so the officer working from the My Work loan card lands on
 * a focused per-loan surface with the same TopBar / Save & Exit
 * chrome every other wizard (ESDD, Taxonomy, PF Screening) uses,
 * instead of being dumped into the Manager workbench PCAF sub-tab
 * which is oriented toward portfolio oversight.
 *
 * The body of the wizard is `PcafAvailabilityPanel` — the exact
 * same component the manager view mounts. It reads the loan-lock
 * context so read-only enforcement (P36) works automatically for
 * non-owners. The manager workbench PCAF sub-tab is untouched by
 * this route.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Borrower, Loan } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import { formatNpr } from "@/components/bfi/ui";
import { PcafAvailabilityPanel } from "@/components/bfi/pcaf/availability-panel";
import { useLoanLock } from "@/components/bfi/shared/loan-lock-context";
import { LockedByBanner } from "@/components/bfi/shared/locked-by-banner";

const ROLE_LABEL: Record<Officer["role"], string> = {
  loan_officer: "Loan officer",
  esg_officer: "ESG officer",
  compliance: "Compliance",
  credit_committee: "Credit committee",
};

export function PcafWizard({
  tenantName,
  officer,
  loan,
  borrower,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
}) {
  const router = useRouter();
  // Loan-lock context — P36. When the current officer is NOT the
  // loan's owner the availability panel disables every input and we
  // render the read-only banner up top. The API also enforces this,
  // so a URL-crafter can't bypass it.
  const { isOwner, ownerOfficerName } = useLoanLock();
  const readOnly = !isOwner;

  return (
    <div
      className="min-h-screen bg-surface text-slate-100"
      data-tour="pcaf-wizard"
    >
      <TopBar
        tenantName={tenantName}
        officer={officer}
        loan={loan}
        borrower={borrower}
        onSaveExit={() =>
          router.push(`/?loan=${encodeURIComponent(loan.id)}#mywork`)
        }
        readOnly={readOnly}
      />

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {readOnly && <LockedByBanner ownerName={ownerOfficerName} />}

        <PcafAvailabilityPanel borrower={borrower} />

        {/* Info section — explains how this capture feeds the PCAF
            Score computation and where oversight lives. Analysts open
            this from a loan card and rarely know that the same flags
            drive the portfolio-wide distribution the manager sees. */}
        <div className="rounded-2xl border border-line bg-panel/40 p-5 text-sm text-slate-300">
          <div className="font-semibold text-white">Where this data flows</div>
          <p className="mt-2 text-slate-400">
            Every flag you confirm feeds the PCAF Score computed for
            this loan. PCAF Global GHG Standard Part A §5.3 derives a
            Score 1–5 from the highest-quality data source available.
            Score drops as flags fall back from Verified reported
            (Score 1) to Physical activity data (Score 3) to
            Revenue-only (Score 4). The computed score, alongside the
            portfolio-wide data-quality distribution, is visible on
            the
            <Link
              href={`/?loan=${encodeURIComponent(loan.id)}&section=pcaf#esrm`}
              className="ml-1 text-brand-primary underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Manager workbench PCAF panel
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function TopBar({
  tenantName,
  officer,
  loan,
  borrower,
  onSaveExit,
  readOnly = false,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
  onSaveExit: () => void;
  readOnly?: boolean;
}) {
  // PCAF availability writes go through the panel's own save button —
  // there's no wizard-level draft to discard on exit, so we only ship
  // the Save & Exit control (matches the analyst mental model:
  // "close this and go back to my work"). Kept as a small component
  // for parity with the ESDD / PF wizard TopBar shapes.
  const [confirmingClose, _setConfirmingClose] = useState(false);
  // Retained variable ref so `confirmingClose` isn't flagged as unused;
  // the confirmation dialog belongs to wizards that mutate multiple
  // rows before save. PCAF doesn't, so we skip that flow.
  void confirmingClose;

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {tenantName} — PCAF data availability
          </div>
          <div className="text-base font-semibold text-white">
            {borrower.name}{" "}
            <span className="text-slate-500">· {loan.id}</span>
          </div>
          <div className="text-xs text-slate-400">
            {borrower.nrbSector} · Outstanding {formatNpr(loan.outstandingNpr)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-300">{officer.name}</div>
            <div className="text-slate-500">{ROLE_LABEL[officer.role]}</div>
          </div>
          <button
            type="button"
            onClick={onSaveExit}
            className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
            title={
              readOnly
                ? "Close the wizard and return to My Work."
                : "Flags are saved via the panel's Save button. This just closes the wizard."
            }
          >
            {readOnly ? "Close" : "Save & exit"}
          </button>
        </div>
      </div>
    </div>
  );
}
