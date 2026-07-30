/**
 * Taxonomy classification wizard page.
 *
 * Route: /taxonomy/<loanId>
 *
 * Mirrors the shape of the ESDD wizard: resolve tenant + officer + loan +
 * borrower, redirect to /? with an officer-picker hint if no officer is
 * signed in, notfound if the loan id is unknown. The client component
 * handles the actual step flow: activity picker → criterion answers →
 * saved result.
 */

import { notFound, redirect } from "next/navigation";
import { TaxonomyWizard } from "@/components/bfi/taxonomy/wizard";
import { TaxonomyGateScreen } from "@/components/bfi/taxonomy/gate-screen";
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { suggestActivitiesForSector } from "@/lib/regulatory/taxonomy/applicability";
import { checkEsrmBeforeTaxonomyGate } from "@/lib/regulatory/taxonomy/gate";

export const dynamic = "force-dynamic";

export default async function TaxonomyWizardPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const { loanId } = await params;
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  if (!officer) {
    redirect(
      `/?openOfficerPicker=1&returnTo=${encodeURIComponent(`/taxonomy/${loanId}`)}`,
    );
  }

  const data = await getBfiDemoData();
  const loan = data.loans.find((l) => l.id === loanId);
  if (!loan) notFound();
  const detail = getBorrowerDetail(data, loan.borrowerId);
  if (!detail.borrower) notFound();

  // NRB GFT 2024 §3.2.2 — ESRM Steps 1+2 required before Taxonomy
  // classification. Gate the wizard on a saved screening for this
  // loan; otherwise render the gate screen with a jump-to-ESRM CTA.
  const gate = await checkEsrmBeforeTaxonomyGate(tenant.id, loan.id);
  if (!gate.allowed) {
    return (
      <TenantThemeProvider tenant={tenant}>
        <TaxonomyGateScreen
          tenantName={tenant.branding.displayName}
          loan={loan}
          borrower={detail.borrower}
          reason={gate.reason}
        />
      </TenantThemeProvider>
    );
  }

  const suggestedActivityIds = suggestActivitiesForSector(
    detail.borrower.nrbSector,
  ).map((a) => a.id);

  return (
    <TenantThemeProvider tenant={tenant}>
      <TaxonomyWizard
        tenantName={tenant.branding.displayName}
        officer={officer}
        loan={loan}
        borrower={detail.borrower}
        suggestedActivityIds={suggestedActivityIds}
      />
    </TenantThemeProvider>
  );
}
