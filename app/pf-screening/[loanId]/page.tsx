/**
 * Annex 5b Project Finance Screening wizard page.
 *
 * Route: /pf-screening/<loanId>
 *
 * Applies the 2022 NRB ESRM Guideline Annex 5b screening questionnaire —
 * 148 IFC-PS-aligned Yes/No items — to a loan categorised as Project
 * Finance. This wizard is a companion to the sector-agnostic Annex 5 ESDD
 * flow at /esdd/<loanId>; both must be completed for a Project-Finance
 * loan to be ready-for-review.
 *
 * Gate: if the loan is not a Project Finance loan (checked via
 * loan.businessUnit and loan.category), redirect to /esdd/<loanId> with a
 * hint so the officer lands on the right wizard.
 */

import { notFound, redirect } from "next/navigation";
import { PfScreeningWizard } from "@/components/bfi/pf-screening/wizard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { LoanLockProvider } from "@/components/bfi/shared/loan-lock-context";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveLoanLockFor } from "@/lib/officers/loan-lock";
import { isProjectFinanceLoanWithOverride } from "@/lib/regulatory/esdd/pf-loan-gate";
import { getCaptureClient } from "@/lib/data/capture-client";

export const dynamic = "force-dynamic";

export default async function PfScreeningWizardPage({
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
        `/pf-screening/${loanId}`,
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

  // Gate: this wizard applies ONLY to Project Finance loans per NRB ESRM
  // 2022 Annex 5b + NRB ESRM Guideline 2022 §5. P45 — honour the officer's
  // ESDD-wizard override when present, so a loan whose raw
  // loan.category disagrees with the officer's explicit
  // "project-finance" selection is still admitted here (and vice
  // versa — an override to a non-PF bucket bounces back to ESDD).
  let loanCategoryOverride: string | null = null;
  const supabase = await getCaptureClient();
  if (supabase) {
    try {
      const { data: assign } = await supabase
        .from("bfi_loan_assignments")
        .select("loan_category_override")
        .eq("bank_id", tenant.id)
        .eq("loan_id", loan.id)
        .maybeSingle();
      loanCategoryOverride =
        (assign?.loan_category_override as string | null | undefined) ?? null;
    } catch (err) {
      console.warn(
        "[pf-screening/page] loan-category override lookup failed (non-fatal):",
        err,
      );
    }
  }
  if (!isProjectFinanceLoanWithOverride(loan, loanCategoryOverride)) {
    redirect(`/esdd/${loanId}?notice=not-project-finance`);
  }

  // First-toucher owns it (P36): auto-claim on load if the loan is
  // currently unassigned; otherwise resolve the existing owner so the
  // wizard can render read-only for non-owners.
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
        <PfScreeningWizard
          tenantName={tenant.branding.displayName}
          officer={officer}
          loan={loan}
          borrower={detail.borrower}
        />
      </LoanLockProvider>
    </TenantThemeProvider>
  );
}
