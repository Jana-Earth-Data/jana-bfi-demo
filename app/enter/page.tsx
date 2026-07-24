/**
 * Landing page: bank access-code entry.
 *
 * Two paths:
 *   1. ?bank=CODE in the URL → resolve, set cookie, redirect to /
 *      (server-side; the visitor never actually sees this page).
 *   2. No query param → render <EnterForm/>, which POSTs to
 *      /api/tenant/set-code and then navigates to /.
 *
 * Visitors without a code can click "Continue as First Bank of Nepal (demo)"
 * to land on the default tenant.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  findTenantByCode,
  getDefaultTenant,
  TENANT_COOKIE_MAX_AGE_SECONDS,
  TENANT_COOKIE_NAME,
} from "@/lib/tenants";
import { EnterForm } from "./enter-form";

export const dynamic = "force-dynamic";

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const params = await searchParams;
  const raw = params.bank?.trim() ?? "";

  // Path 1: ?bank=CODE — resolve on the server, set cookie, redirect.
  // Unknown codes fall back to the default tenant so a mistyped link
  // never leaves the visitor on a broken screen.
  if (raw) {
    const tenant = findTenantByCode(raw) ?? getDefaultTenant();
    const jar = await cookies();
    jar.set(TENANT_COOKIE_NAME, tenant.id, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: TENANT_COOKIE_MAX_AGE_SECONDS,
    });
    redirect("/");
  }

  // Path 2: no query param — show the form.
  const defaultTenant = getDefaultTenant();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-16 text-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="text-2xl font-semibold text-emerald-300">
          Jana Financed Emissions Dashboard
        </div>
        <div className="text-center text-sm text-slate-400">
          Welcome. If you received a bank access code with your invitation,
          please enter it below. Otherwise you can continue as the default
          demonstration bank.
        </div>
      </div>
      <EnterForm defaultBankLabel={defaultTenant.branding.displayName} />
    </main>
  );
}
