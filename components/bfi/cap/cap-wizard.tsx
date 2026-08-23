"use client";

/**
 * CAP wizard — client shell for the dedicated /cap/[loanId] route.
 *
 * The Corrective Action Plan + E&S Covenants + Monitoring surface is a
 * multi-row capture panel (three collapsible subsections mirroring
 * Circular 22 Annex 8 / 9 / 10), not a sequential wizard. This shell
 * exists so the officer working from the My Work loan card lands on a
 * focused per-loan surface with the same TopBar / Save & Exit chrome
 * every other wizard (ESDD, Taxonomy, PF Screening, PCAF) uses,
 * instead of being dumped into the Manager workbench CAP sub-tab which
 * is oriented toward portfolio-wide overdue oversight.
 *
 * The body of the wizard is `CapPanel` — the exact same component the
 * manager view mounts. It reads the loan-lock context internally so
 * read-only enforcement (P36) works automatically for non-owners.
 * The manager workbench CAP sub-tab is untouched by this route.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Borrower, Loan } from "@/lib/types/bfi";
import type { Officer } from "@/lib/tenants";
import { formatNpr } from "@/components/bfi/ui";
import { CapPanel } from "@/components/bfi/cap/cap-panel";
import { useLoanLock } from "@/components/bfi/shared/loan-lock-context";
import { LockedByBanner } from "@/components/bfi/shared/locked-by-banner";

const ROLE_LABEL: Record<Officer["role"], string> = {
  loan_officer: "Loan officer",
  esg_officer: "ESG officer",
  compliance: "Compliance",
  credit_committee: "Credit committee",
};

export function CapWizard({
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
  // loan's owner the CapPanel disables every editable input and the
  // read-only banner is shown up top. The API also enforces this, so
  // a URL-crafter can't bypass it.
  const { isOwner, ownerOfficerName } = useLoanLock();
  const readOnly = !isOwner;

  return (
    <div
      className="min-h-screen bg-surface text-slate-100"
      data-tour="cap-wizard"
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

        <CapPanel loanId={loan.id} borrowerId={borrower.id} />

        {/* Info footer — explains what this capture feeds. Officers
            opening this from a loan card rarely realise that the same
            rows drive the portfolio-wide overdue-CAP banner the
            compliance lead uses on the Manager tab. */}
        <div className="rounded-2xl border border-line bg-panel/40 p-5 text-sm text-slate-300">
          <div className="font-semibold text-white">Where this data flows</div>
          <p className="mt-2 text-slate-400">
            Corrective action plans are required on every Medium and
            High-risk loan under NRB ESRM Guideline 2022 §7.3.5. Each item you
            enter here has a time-bound deadline; the platform tracks
            completion via monitoring reports (§7.3.7). Overdue items
            appear on the
            <Link
              href="/#esrm"
              className="ml-1 text-brand-primary underline"
              style={{ color: "var(--brand-primary)" }}
            >
              Manager tab
            </Link>{" "}
            portfolio-wide overdue-CAP banner so the compliance lead
            sees at a glance which loans are slipping.
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
  // CAP writes go through the CapPanel's own "Save CAP + covenants"
  // button (and the monitoring modal's submit) — there's no
  // wizard-level draft to discard on exit, so we only ship the Save &
  // Exit control (matches the analyst mental model: "close this and
  // go back to my work"). Kept as a small component for parity with
  // the ESDD / PF / PCAF wizard TopBar shapes.
  const [confirmingClose, _setConfirmingClose] = useState(false);
  // Retained ref so `confirmingClose` isn't flagged unused; the
  // confirmation dialog belongs to wizards that mutate multiple rows
  // outside a save button. CAP saves are explicit inside the panel.
  void confirmingClose;

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {tenantName} — CAP · covenants · monitoring
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
                : "CAP items, covenants, and monitoring reports are saved via the panel's own buttons. This just closes the wizard."
            }
          >
            {readOnly ? "Close" : "Save & exit"}
          </button>
        </div>
      </div>
    </div>
  );
}
