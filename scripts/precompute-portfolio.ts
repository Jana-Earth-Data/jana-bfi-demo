/**
 * Precompute the ~80K-loan portfolio at build time.
 *
 * Runs `buildPortfolio()` once, serializes the result, and writes it
 * GZIPPED to `lib/demo/precomputed-portfolio.json.gz`. Exits non-zero on failure.
 *
 * Wired into `prebuild` in package.json so `next build` picks up the file,
 * turning what was a ~50s per-cold-start synthesis into a ~300ms
 * `fs.readFileSync` + `zlib.gunzipSync` + `JSON.parse` at request time.
 *
 * WHY GZIP: the raw JSON is ~62 MB. Bundled into the Vercel serverless
 * function that made the function bundle large and pushed first cold-start
 * decompression past 2 minutes. Gzip at level 9 brings JSON down ~10x
 * (~6 MB), which shrinks the function bundle correspondingly and eliminates
 * the multi-minute first cold-start.
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
import * as zlib from "node:zlib";
import { fileURLToPath } from "node:url";

import { getPortfolio, PORTFOLIO_SCALE, PORTFOLIO_TOTAL_COUNT } from "@/lib/demo/portfolio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(REPO_ROOT, "lib", "demo", "precomputed-portfolio.json.gz");

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
  const data = await getPortfolio();
  const synthMs = Date.now() - synthT0;
  console.log(`[precompute-portfolio] synthesis complete in ${synthMs} ms — ${data.loans.length.toLocaleString()} loans, ${data.borrowers.length.toLocaleString()} borrowers, ${data.attributions.length.toLocaleString()} attributions`);

  console.log(`[precompute-portfolio] serializing to JSON...`);
  const serT0 = Date.now();
  const json = JSON.stringify(data);
  const serMs = Date.now() - serT0;
  const rawBytes = Buffer.byteLength(json, "utf8");
  console.log(`[precompute-portfolio] serialized in ${serMs} ms — ${humanBytes(rawBytes)} raw`);

  console.log(`[precompute-portfolio] gzipping (level 9)...`);
  const gzipT0 = Date.now();
  const gzipped = zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  const gzipMs = Date.now() - gzipT0;
  const ratio = ((1 - gzipped.length / rawBytes) * 100).toFixed(1);
  console.log(`[precompute-portfolio] gzipped in ${gzipMs} ms — ${humanBytes(gzipped.length)} (${ratio}% smaller)`);

  // Ensure parent dir exists.
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  console.log(`[precompute-portfolio] writing ${OUT_PATH}`);
  fs.writeFileSync(OUT_PATH, gzipped);

  const stats = fs.statSync(OUT_PATH);
  const totalMs = Date.now() - t0;

  console.log(`[precompute-portfolio] ✓ wrote ${humanBytes(stats.size)} in ${totalMs} ms total`);
  console.log(`[precompute-portfolio] output: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(`[precompute-portfolio] FAILED: ${err?.stack || err}`);
  process.exit(1);
});
