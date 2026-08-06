/**
 * Precompute the ~80K-loan portfolio at build time.
 *
 * Runs `buildPortfolio()` once, serializes the result to
 * `lib/data/precomputed-portfolio.json`, and exits non-zero on failure.
 *
 * Wired into `prebuild` in package.json so `next build` picks up the JSON,
 * turning what was a ~50s per-cold-start synthesis into a ~500ms
 * `fs.readFileSync` + `JSON.parse` at request time.
 *
 * Run manually with:
 *   npx tsx scripts/precompute-portfolio.ts
 *
 * The returned `BfiDemoData` shape is already JSON-safe: any Maps/Sets used
 * inside `buildSummary()` are converted to plain arrays/objects before being
 * returned, and `meta.generatedAt` is a string (ISO date). No custom
 * replacer/reviver required.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { getPortfolio, PORTFOLIO_SCALE, PORTFOLIO_TOTAL_COUNT } from "@/lib/data/portfolio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(REPO_ROOT, "lib", "data", "precomputed-portfolio.json");

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const t0 = Date.now();

  console.log(`[precompute-portfolio] input scale: ${PORTFOLIO_TOTAL_COUNT.toLocaleString()} loans`);
  console.log(`[precompute-portfolio] scale breakdown: ${JSON.stringify(PORTFOLIO_SCALE)}`);

  console.log(`[precompute-portfolio] synthesizing portfolio...`);
  const synthT0 = Date.now();
  const data = getPortfolio();
  const synthMs = Date.now() - synthT0;
  console.log(`[precompute-portfolio] synthesis complete in ${synthMs} ms — ${data.loans.length.toLocaleString()} loans, ${data.borrowers.length.toLocaleString()} borrowers, ${data.attributions.length.toLocaleString()} attributions`);

  console.log(`[precompute-portfolio] serializing to JSON...`);
  const serT0 = Date.now();
  const json = JSON.stringify(data);
  const serMs = Date.now() - serT0;
  console.log(`[precompute-portfolio] serialized in ${serMs} ms — ${humanBytes(Buffer.byteLength(json, "utf8"))}`);

  // Ensure parent dir exists.
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  console.log(`[precompute-portfolio] writing ${OUT_PATH}`);
  fs.writeFileSync(OUT_PATH, json, "utf8");

  const stats = fs.statSync(OUT_PATH);
  const totalMs = Date.now() - t0;

  console.log(`[precompute-portfolio] ✓ wrote ${humanBytes(stats.size)} in ${totalMs} ms total`);
  console.log(`[precompute-portfolio] output: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(`[precompute-portfolio] FAILED: ${err?.stack || err}`);
  process.exit(1);
});
