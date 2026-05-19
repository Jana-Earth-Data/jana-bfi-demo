/**
 * Standalone inspection using relative imports (so Node 22 can run it directly).
 *   node --experimental-strip-types --experimental-transform-types \
 *     scripts/inspect-portfolio-rel.mts
 */
// @ts-ignore - relative resolution at runtime
import { getPortfolio } from "../lib/data/portfolio.ts";

const t0 = Date.now();
const p = getPortfolio();
console.log(`Built portfolio in ${Date.now() - t0} ms`);
console.log(`Bank: ${p.meta.bankName} | as-of: ${p.meta.asOfDate}`);
console.log(`Borrowers: ${p.borrowers.length} | Loans: ${p.loans.length}`);

const s = p.portfolio;
console.log(`Total NPR outstanding: NPR ${s.totalOutstandingNpr.toLocaleString()}`);
console.log(`Total USD outstanding: USD ${s.totalOutstandingUsd.toLocaleString()}`);
console.log(`Total attributed CO2e: ${s.totalAttributedCo2eTonnes.toLocaleString()} tCO2e`);
console.log(`Weighted PCAF: ${s.weightedDataQuality}`);
console.log(`Taxonomy count:`, s.taxonomyBreakdown);
console.log(`Taxonomy by NPR:`, Object.fromEntries(
  Object.entries(s.taxonomyBreakdownValue ?? {}).map(([k, v]) =>
    [k, (v as number).toLocaleString()])));
console.log(`Funnel:`, s.funnel);
console.log(`Data quality dist:`);
console.table(s.dataQualityDistribution);
console.log(`Top sectors:`);
console.table(s.sectorBreakdown.slice(0, 8));
console.log(`Trend:`);
console.table(s.trend);
