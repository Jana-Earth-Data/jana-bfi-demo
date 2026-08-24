/**
 * Does officer PCAF input actually reach the disclosed number?
 *
 * The failure this guards against is silent by construction. getPortfolio()
 * runs at build time and cannot see officer data, so before the overlay
 * existed an officer could review a borrower's availability, save it, and the
 * headline weighted data-quality score would not move at all. Nothing errored;
 * the number was simply computed as though nobody had looked.
 *
 * Runs the real overlay against the real precomputed book with a stubbed
 * supabase reporting one reviewed borrower, and asserts both that the figure
 * moves and that nothing it should not touch has changed.
 *
 * Picks the highest-emitting eligible borrower deliberately. PCAF weights the
 * data-quality average by attributed tonnes, so reviewing a small emitter
 * moves the headline by less than display precision -- a real effect, but
 * useless as a test signal.
 *
 * Usage:  npx tsx scripts/check-pcaf-overlay.ts
 */
import { getPortfolio } from "@/lib/data/portfolio";
import { applyOfficerPcafOverlay } from "@/lib/api/pcaf-overlay";

const base = getPortfolio();

// Pick a real borrower with loans that are currently NOT score 1.
const byBorrower = new Map<string, string[]>();
for (const l of base.loans) {
  byBorrower.set(l.borrowerId, [...(byBorrower.get(l.borrowerId) ?? []), l.id]);
}
const attrByLoan = new Map(base.attributions.map((a) => [a.loanId, a]));
let target: string | null = null;
let bestTonnes = -1;
for (const [bid, loanIds] of byBorrower) {
  const scores = loanIds.map((id) => attrByLoan.get(id)?.dataQualityScore);
  if (!(loanIds.length >= 1 && scores.every((s) => s !== undefined && s > 1))) continue;
  const b = base.borrowers.find((x) => x.id === bid);
  if (!b || b.kind === "retail-pool" || b.facilities.length === 0) continue;
  const t = loanIds.reduce((sum, id) => sum + (attrByLoan.get(id)?.attributedCo2eTonnes ?? 0), 0);
  if (t > bestTonnes) { bestTonnes = t; target = bid; }
}
if (!target) throw new Error("no suitable borrower found");
const loanIds = byBorrower.get(target)!;
const before = base.portfolio.weightedDataQuality;

// Officer says: this borrower publishes third-party-verified emissions.
const stub = {
  from: () => ({
    select: () => ({
      eq: async () => ({
        data: [{
          borrower_id: target,
          borrower_publishes_verified: true,
          borrower_publishes_unverified: true,
          energy_consumption_data_available: false,
          physical_activity_data_available: true,
          revenue_data_available: true,
          sector_average_only: false,
          out_of_scope: false,
        }],
        error: null,
      }),
    }),
  }),
} as never;

(async () => {
  const r = await applyOfficerPcafOverlay(base, "default", stub);
  const after = r.data.portfolio.weightedDataQuality;
  const scoresBefore = loanIds.map((id) => attrByLoan.get(id)!.dataQualityScore);
  const afterAttr = new Map(r.data.attributions.map((a) => [a.loanId, a]));
  const scoresAfter = loanIds.map((id) => afterAttr.get(id)!.dataQualityScore);

  console.log(`  borrower           ${target} (${loanIds.length} loan(s))`);
  console.log(`  loan scores        ${scoresBefore.join(",")}  ->  ${scoresAfter.join(",")}`);
  console.log(`  overlayApplied     ${r.overlayApplied}`);
  console.log(`  rescored loans     ${r.rescoredLoanIds.length}`);
  const totT = base.attributions.reduce((s2, a) => s2 + a.attributedCo2eTonnes, 0);
  const myT = loanIds.reduce((s2, id) => s2 + attrByLoan.get(id)!.attributedCo2eTonnes, 0);
  console.log(`  borrower tonnes    ${myT.toLocaleString()} of ${totT.toLocaleString()} (${(100*myT/totT).toFixed(3)}% of book)`);
  console.log(`  weighted DQ        ${before.toFixed(9)}  ->  ${after.toFixed(9)}`);
  console.log(`  delta              ${(after-before).toExponential(3)}`);
  console.log("");
  console.log(`  [${r.overlayApplied ? "PASS" : "FAIL"}] overlay ran`);
  console.log(`  [${r.rescoredLoanIds.length > 0 ? "PASS" : "FAIL"}] loans were re-scored`);
  console.log(`  [${after !== before ? "PASS" : "FAIL"}] the disclosed figure moved`);
  console.log(`  [${after < before ? "PASS" : "FAIL"}] it moved in the right direction (lower = better)`);

  // untouched loans must be identical
  const untouched = base.loans.filter((l) => l.borrowerId !== target).slice(0, 500);
  const same = untouched.every(
    (l) => afterAttr.get(l.id)!.dataQualityScore === attrByLoan.get(l.id)!.dataQualityScore,
  );
  console.log(`  [${same ? "PASS" : "FAIL"}] unreviewed loans untouched (sampled 500)`);

  // attributed tonnes must not change
  const tonnesBefore = base.attributions.reduce((s, a) => s + a.attributedCo2eTonnes, 0);
  const tonnesAfter = r.data.attributions.reduce((s, a) => s + a.attributedCo2eTonnes, 0);
  console.log(`  [${tonnesBefore === tonnesAfter ? "PASS" : "FAIL"}] attributed tonnes unchanged`);
})();
