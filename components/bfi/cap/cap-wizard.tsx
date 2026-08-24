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

import { useCallback, useRef, useState } from "react";
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

  // CAP rows are drafts in the panel's local state until they are posted,
  // so "Save & exit" has to actually save. The panel hands its save routine
  // up through registerSave and reports whether anything is unsaved.
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const exit = useCallback(() => {
    router.push(`/?loan=${encodeURIComponent(loan.id)}#mywork`);
  }, [router, loan.id]);

  const saveThenExit = useCallback(async () => {
    if (readOnly || !saveRef.current) {
      exit();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const ok = await saveRef.current();
    setSaving(false);
    if (ok) exit();
    else setSaveError("Save failed. Your rows are still here — see the panel for details.");
  }, [readOnly, exit]);

  const registerSave = useCallback((fn: () => Promise<boolean>) => {
    saveRef.current = fn;
  }, []);

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
        onSaveExit={() => void saveThenExit()}
        onDiscardExit={() => (dirty ? setConfirming(true) : exit())}
        saving={saving}
        dirty={dirty}
        readOnly={readOnly}
      />

      {saveError && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {saveError}
          </div>
        </div>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(2,6,23,0.85)" }}
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line p-6 shadow-2xl"
            style={{ backgroundColor: "#111827" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-wide text-rose-300">
              Discard unsaved rows
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Exit without saving?
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              The corrective action and covenant rows you have edited for{" "}
              <span className="font-semibold text-white">{borrower.name}</span>{" "}
              (loan {loan.id}) have not been saved and will be discarded.
              Anything previously saved to the audit trail is untouched.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-slate-300 hover:bg-line/30"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={exit}
                className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"
              >
                Discard and exit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {readOnly && <LockedByBanner ownerName={ownerOfficerName} />}

        <CapPanel
          loanId={loan.id}
          borrowerId={borrower.id}
          registerSave={registerSave}
          onDirtyChange={setDirty}
        />

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
  onDiscardExit,
  saving = false,
  dirty = false,
  readOnly = false,
}: {
  tenantName: string;
  officer: Officer;
  loan: Loan;
  borrower: Borrower;
  onSaveExit: () => void;
  onDiscardExit: () => void;
  saving?: boolean;
  dirty?: boolean;
  readOnly?: boolean;
}) {
  // Previously this shipped only "Save & exit", which did not save: CAP
  // rows are drafts until the panel posts them, so an officer who typed a
  // corrective action and clicked it lost the row. Both controls are real
  // now — Save & exit posts the drafts, Exit without saving discards them
  // after a confirmation when there is unsaved work.

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
          {!readOnly && (
            <button
              type="button"
              onClick={onDiscardExit}
              disabled={saving}
              className="rounded-md border border-rose-500/40 bg-rose-500/5 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/15 disabled:opacity-50"
              title={
                dirty
                  ? "Discard the corrective action and covenant rows you have edited but not saved"
                  : "Close the wizard. Nothing is unsaved."
              }
            >
              Exit without saving
            </button>
          )}
          <button
            type="button"
            onClick={onSaveExit}
            disabled={saving}
            className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30 disabled:opacity-50"
            title={
              readOnly
                ? "Close the wizard and return to My Work."
                : "Save the corrective action and covenant rows, then return to My Work."
            }
          >
            {readOnly ? "Close" : saving ? "Saving…" : "Save & exit"}
          </button>
        </div>
      </div>
    </div>
  );
}
