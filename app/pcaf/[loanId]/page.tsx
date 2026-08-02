/**
 * PCAF data-availability wizard page.
 *
 * Route: /pcaf/<loanId>
 *
 * Mirrors the shape of the ESDD / PF-screening / Taxonomy wizards:
 * resolves the tenant, the current officer, and the loan/borrower
 * detail; redirects to /? with an officer-picker hint if no officer
 * is signed in; 404s if the loan id is unknown.
 *
 * Prior to P37 the "Start PCAF" CTA on the My Work loan card
 * deep-linked into the Manager workbench PCAF sub-tab. That surface
 * is oriented around portfolio oversight (histogram + per-loan
 * table), not around a single officer working a single loan; landing
 * on it from My Work was disorienting. This dedicated route swaps
 * the wizard shell in and keeps the PcafAvailabilityPanel exactly
 * as it renders inside the workbench — same auto/manual toggles,
 * same evidence textareas, same save button — but as a focused
 * single-panel surface with the same TopBar + Save & Exit chrome
 * every other wizard uses.
 *
 * Not a step-based wizard: PCAF availability is a single-panel
 * capture (4 flag rows) so there is no step indicator. Manager-view
 * oversight remains at /?loan=<id>&section=pcaf#esrm.
 */

import { notFound, redirect } from "next/navigation";
import { PcafWizard } from "@/components/bfi/pcaf/pcaf-wizard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { LoanLockProvider } from "@/components/bfi/shared/loan-lock-context";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveLoanLockFor } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";

export default async function PcafWizardPage({
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
        `/pcaf/${loanId}`,
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
  // /esdd/[loanId], /taxonomy/[loanId], /pf-screening/[loanId].
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
        <PcafWizard
          tenantName={tenant.branding.displayName}
          officer={officer}
          loan={loan}
          borrower={detail.borrower}
        />
      </LoanLockProvider>
    </TenantThemeProvider>
  );
}
