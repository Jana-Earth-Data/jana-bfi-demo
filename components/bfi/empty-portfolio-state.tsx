/**
 * What the dashboard shows when there is no loan book.
 *
 * Two ways to arrive here, and they are the same state:
 *   - a live build, before core-banking import has run;
 *   - a demo build with demo mode toggled off.
 *
 * That equivalence is the point. Turning the toggle off in front of a
 * prospect shows them their own day-one instance, not a mockup of one.
 *
 * Why an empty frame rather than a "no data" message
 * --------------------------------------------------
 * The tiles and charts still render, showing zeros and an empty trend axis.
 * A bank evaluating this needs to see the shape of what they are buying --
 * which metrics exist, what the disclosure looks like -- and a single grey
 * paragraph tells them nothing. The zeros are honest: nothing has been
 * measured yet, so nothing is reported.
 *
 * What it must never do is imply a finding. weightedDataQuality is 0 here,
 * not 5. A 5 would be PCAF's worst score and would assert that every loan
 * was assessed and found to have no data -- a claim about a portfolio that
 * does not exist. See lib/data/empty-portfolio.ts.
 */

export function EmptyPortfolioState({ demoBuild }: { demoBuild: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-panel/40 px-6 py-10 text-center">
      <div className="mx-auto max-w-lg">
        <h2 className="text-base font-semibold text-slate-200">
          No portfolio loaded
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          This instance has no loan book yet. Financed emissions, ESRM
          screening and NFRS disclosure all read from the portfolio, so they
          will stay empty until loans are imported from your core banking
          system.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          The metrics and disclosures below are live — they are reporting zero
          because nothing has been measured, not because anything is broken.
        </p>
        {demoBuild && (
          <p className="mt-4 rounded border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90">
            Demo mode is off. Turn it back on from the Demo menu to reload the
            synthetic portfolio.
          </p>
        )}
      </div>
    </div>
  );
}
