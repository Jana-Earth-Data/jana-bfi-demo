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
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";

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

  return (
    <TenantThemeProvider tenant={tenant}>
      <EsddWizard
        tenantName={tenant.branding.displayName}
        officer={officer}
        loan={loan}
        borrower={detail.borrower}
      />
    </TenantThemeProvider>
  );
}
