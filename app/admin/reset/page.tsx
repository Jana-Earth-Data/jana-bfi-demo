/**
 * /admin/reset — Multi-tenant reset admin page.
 *
 * Server component. Lists every registered tenant and hands them to the
 * client form. The reset action itself is a POST to /api/admin/reset,
 * gated by the SEED_ADMIN_TOKEN bearer token — see route.ts.
 *
 * This page is intentionally not linked from any user-facing nav. It is
 * meant to be reached only by the demo team via direct URL.
 */

import { listTenants } from "@/lib/tenants";
import { ResetForm, type ResetTenantSummary } from "./reset-form";

export const dynamic = "force-dynamic";

export default function ResetAdminPage() {
  const tenants: ResetTenantSummary[] = listTenants().map((t) => ({
    id: t.id,
    displayName: t.branding.displayName,
    shortName: t.branding.shortName,
  }));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-xs uppercase tracking-wide text-rose-300">
          Jana admin — destructive action
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Reset tenant demo data
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Wipes the captured demo output for a single tenant so the demo
          team can start fresh before a rehearsal. Deletes ESDD responses,
          taxonomy assessments, ESRM screenings, loan assignments, and
          borrower overrides scoped to the selected tenant&rsquo;s{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">bank_id</code>.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Seeded infrastructure (banks, officers) is preserved. Other
          tenants&rsquo; data is not touched.
        </p>

        <div className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/[0.03] p-6">
          <ResetForm tenants={tenants} />
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Requires the admin bearer token. Paste it into the form for each
          reset — it is not persisted client-side.
        </p>
      </div>
    </main>
  );
}
