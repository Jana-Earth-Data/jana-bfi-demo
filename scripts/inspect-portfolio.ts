/**
 * Quick inspection of the synthesized portfolio. Run with:
 *   npx tsx scripts/inspect-portfolio.ts
 */
import { getPortfolio } from "@/lib/data/portfolio";

const p = getPortfolio();
console.log(`Bank: ${p.meta.bankName}`);
console.log(`As-of: ${p.meta.asOfDate}`);
console.log(`Borrowers: ${p.borrowers.length}`);
console.log(`Loans: ${p.loans.length}`);
console.log(`Attributions: ${p.attributions.length}`);

console.log("\n=== Portfolio summary ===");
const s = p.portfolio;
console.log(`Total loans: ${s.totalLoans.toLocaleString()}`);
console.log(`Total NPR outstanding: ${s.totalOutstandingNpr.toLocaleString()}`);
console.log(`Total USD outstanding: ${s.totalOutstandingUsd.toLocaleString()}`);
console.log(`Total attributed CO2e: ${s.totalAttributedCo2eTonnes.toLocaleString()} tCO2e`);
console.log(`Weighted PCAF data quality: ${s.weightedDataQuality}`);

console.log("\nTaxonomy (count):", s.taxonomyBreakdown);
console.log("Taxonomy (NPR):", Object.fromEntries(
  Object.entries(s.taxonomyBreakdownValue ?? {}).map(([k, v]) => [k, (v as number).toLocaleString()])
));

console.log("\nFunnel:");
console.log(s.funnel);

console.log("\nData quality distribution:");
console.table(s.dataQualityDistribution);

console.log("\nTop sectors by attributed CO2e:");
console.table(s.sectorBreakdown.slice(0, 10));

console.log("\nTrend:");
console.table(s.trend);

// Borrower spot checks
const cement = p.borrowers.find(b => b.id.startsWith("B-CEM-"));
const hydro = p.borrowers.find(b => b.id.startsWith("B-HYD-"));
console.log("\nFirst cement borrower:");
console.log({
  id: cement?.id, name: cement?.name, facilities: cement?.facilities.length,
  totalCo2eTonnes: cement?.totalCo2eTonnes, ev: cement?.enterpriseValueUsd,
});
console.log("First hydro borrower:");
console.log({
  id: hydro?.id, name: hydro?.name, facilities: hydro?.facilities.length,
  totalCo2eTonnes: hydro?.totalCo2eTonnes, ev: hydro?.enterpriseValueUsd,
});

// Sample loans
console.log("\nSample loans:");
console.log(p.loans.slice(0, 3));
console.log("...");
console.log(p.loans.slice(72000, 72003));
