/**
 * Gate screen shown when a user tries to open the Taxonomy wizard for a
 * loan that has not yet been through ESRM screening.
 *
 * Rule source: NRB Green Finance Taxonomy 2024 §3.2.2 (p. 26).
 */

import Link from "next/link";
import type { Loan, Borrower } from "@/lib/types/bfi";

type Props = {
  tenantName: string;
  loan: Loan;
  borrower: Borrower;
  reason: "no-supabase" | "no-screening";
};

export function TaxonomyGateScreen({ tenantName, loan, borrower, reason }: Props) {
  const isConfigIssue = reason === "no-supabase";
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="border-b border-line bg-panel/40 px-6 py-4">
        <div className="mx-auto flex max-w-[900px] items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {tenantName}
            </div>
            <div className="text-lg font-semibold">
              Taxonomy classification — {borrower.name}
            </div>
          </div>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-6 py-10">
        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--brand-primary)",
            backgroundColor: "var(--brand-primary-soft)",
          }}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>
            ESRM screening required first
          </div>
          <h1 className="mb-4 text-xl font-semibold text-white">
            This loan needs an ESRM screening before it can be classified under
            the Green Finance Taxonomy.
          </h1>
          <p className="mb-3 text-sm text-slate-300">
            Per the NRB Green Finance Taxonomy 2024 §3.2.2 (p. 26):
          </p>
          <blockquote className="mb-4 border-l-2 border-slate-600 pl-4 text-sm italic text-slate-300">
            &ldquo;In the case of BFIs, Steps 1 and 2 of the Environment and
            Social Risk Management (ESRM) guidelines shall be applied first
            and then the taxonomy in terms of classifying activities.&rdquo;
          </blockquote>
          <p className="mb-6 text-sm text-slate-300">
            The rule is repeated in the Executive Summary &ldquo;Treatment of
            risk&rdquo; section (p. 11) and in Annex 3 Note (p. 141). ESRM
            screening captures whether the activity clears NRB&rsquo;s
            exclusion list and where the loan sits on the E&amp;S risk
            spectrum — inputs the Taxonomy classification then depends on.
          </p>

          <div className="mb-6 rounded bg-slate-900/60 p-4 text-sm">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              Loan
            </div>
            <div className="text-slate-200">
              {loan.id} · {borrower.name} · {borrower.nrbSector}
            </div>
          </div>

          {isConfigIssue ? (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              Supabase is not configured in this environment, so no ESRM
              screenings can be looked up. Configure Supabase or run against
              the seeded demo state to open the Taxonomy wizard.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/esdd/${loan.id}`}
                className="rounded px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                Open ESRM screening for this loan →
              </Link>
              <Link
                href="/#mywork"
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-slate-400"
              >
                Back to my work
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-500">
          After the ESRM screening is saved, this loan will unlock for
          Taxonomy classification automatically.
        </p>
      </main>
    </div>
  );
}
