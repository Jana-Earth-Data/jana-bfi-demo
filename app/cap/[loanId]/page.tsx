/**
 * Corrective Action Plan + Covenants + Monitoring wizard page.
 *
 * Route: /cap/<loanId>
 *
 * Mirrors the shape of the ESDD / Taxonomy / PF-screening / PCAF
 * wizards: resolves the tenant, the current officer, and the
 * loan/borrower detail; redirects to /? with an officer-picker hint if
 * no officer is signed in; 404s if the loan id is unknown.
 *
 * Prior to P44 the CAP capture surface was only reachable through the
 * Manager workbench's CAP sub-tab, which is oriented around portfolio
 * oversight (overdue-CAP banner, per-loan drill-in). That was
 * disorienting when a loan officer clicked from a My Work loan card —
 * they wanted to enter items for the loan they were looking at, not
 * navigate a manager surface. This dedicated route swaps the wizard
 * shell in and keeps the CapPanel exactly as it renders inside the
 * workbench — same Annex 8 CAP items, same Annex 9 covenants, same
 * Annex 10 monitoring modal — but as a focused single-panel surface
 * with the same TopBar + Save & Exit chrome every other wizard uses.
 *
 * Not a step-based wizard: CAP is multi-item capture (rows in three
 * subsections), not a sequential flow. Manager oversight remains at
 * /?loan=<id>&section=cap#esrm.
 */

import { notFound, redirect } from "next/navigation";
import { CapWizard } from "@/components/bfi/cap/cap-wizard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { LoanLockProvider } from "@/components/bfi/shared/loan-lock-context";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveLoanLockFor } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";

export default async function CapWizardPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    redirect(
      `/?openOfficerPicker=1&returnTo=${encodeURIComponent(
        `/cap/${loanId}`,
      )}`,
    );
  }

  const data = await getBfiDemoData();
  const loan = data.loans.find((l) => l.id === loanId);
  if (!loan) {
    notFound();
  }

  const detail = getBorrowerDetail(data, loan.borrowerId);
  if (!detail.borrower) {
    notFound();
  }

  // First-toucher owns it (P36): auto-claim on load if the loan is
  // currently unassigned; otherwise resolve the existing owner so the
  // wizard can render read-only for non-owners. Same helper used by
  // /esdd/[loanId], /taxonomy/[loanId], /pf-screening/[loanId],
  // /pcaf/[loanId].
  const lock = await resolveLoanLockFor(loan.id, tenant, officer);

  return (
    <TenantThemeProvider tenant={tenant}>
      <LoanLockProvider
        value={{
          loanId: loan.id,
          isOwner: lock.isOwner,
          ownerOfficerId: lock.ownerOfficerId,
          ownerOfficerName: lock.ownerOfficerName,
        }}
      >
        <CapWizard
          tenantName={tenant.branding.displayName}
          officer={officer}
          loan={loan}
          borrower={detail.borrower}
        />
      </LoanLockProvider>
    </TenantThemeProvider>
  );
}
