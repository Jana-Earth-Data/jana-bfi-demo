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
import { TenantThemeProvider } from "@/components/bfi/tenant-theme";
import { getBfiDemoData } from "@/lib/api/bfi";
import { getBorrowerDetail } from "@/lib/data/portfolio-query";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { suggestActivitiesForSector } from "@/lib/regulatory/taxonomy/activities";

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
