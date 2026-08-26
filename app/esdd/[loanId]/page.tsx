/**
 * ESDD wizard page.
 *
 * Route: /esdd/<loanId>
 *
 * Resolves the tenant, the current officer, and the loan/borrower detail
 * from the in-memory synthesizer. If no officer is signed in we redirect
 * to the dashboard with a query flag so the officer picker opens
 * automatically. If the loan id is unknown we render a 404.
 *
 * The client wizard component (EsddWizard) handles the actual step-by-step
 * flow, saving each answer to /api/esdd/responses as it goes.
 */

import { notFound, redirect } from "next/navigation";
import { EsddWizard } from "@/components/bfi/esdd/wizard";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { LoanLockProvider } from "@/components/bfi/shared/loan-lock-context";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveLoanLockFor } from "@/lib/officers/loan-lock";
import { getCaptureClient } from "@/lib/data/capture-client";

export const dynamic = "force-dynamic";

export default async function EsddWizardPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    // Punt back to the dashboard with a hint so the officer picker opens.
    redirect(`/?openOfficerPicker=1&returnTo=${encodeURIComponent(`/esdd/${loanId}`)}`);
  }

  // Fetch the demo data. The synthesizer runs on every request but is
  // cached in-module so this is cheap.
  const data = await getBfiDemoData();

  // Find the loan (linear scan is fine for the demo). The wizard needs
  // the borrower to prefill the Basic Information step.
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
  // wizard can render read-only for non-owners.
  const lock = await resolveLoanLockFor(loan.id, tenant, officer);

  // P45 — hydrate the ESDD loan-category override from bfi_loan_assignments
  // so the wizard's Basic Info step lands on the officer's saved value
  // instead of re-deriving on every mount. Null when no override is
  // recorded — the wizard falls back to deriveEsddLoanCategory(...).
  let initialLoanCategoryOverride: string | null = null;
  const supabase = await getCaptureClient();
  if (supabase) {
    try {
      const { data: assign } = await supabase
        .from("bfi_loan_assignments")
        .select("loan_category_override")
        .eq("bank_id", tenant.id)
        .eq("loan_id", loan.id)
        .maybeSingle();
      initialLoanCategoryOverride =
        (assign?.loan_category_override as string | null | undefined) ?? null;
    } catch (err) {
      console.warn(
        "[esdd/page] loan-category override lookup failed (non-fatal):",
        err,
      );
    }
  }

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
        <EsddWizard
          tenantName={tenant.branding.displayName}
          officer={officer}
          loan={loan}
          borrower={detail.borrower}
          initialLoanCategoryOverride={initialLoanCategoryOverride}
        />
      </LoanLockProvider>
    </TenantThemeProvider>
  );
}
