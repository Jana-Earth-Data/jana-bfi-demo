/**
 * Enforce the demo boundary at the import level.
 *
 * The rule: application code reaches the demo layer only through
 * lib/demo/provider.ts. Nothing in app/, components/ or the rest of lib/ may
 * import lib/demo/impl, lib/demo/fixtures, or the synthesizer directly.
 *
 * Why this needs a script rather than a convention
 * ------------------------------------------------
 * A boundary maintained by everyone remembering it is a boundary that erodes,
 * and the erosion is invisible: one direct import of the synthesizer compiles
 * fine, passes review, and quietly puts 80,035 fabricated loans back into a
 * production bundle. Nothing fails, nothing warns, and the loans look real.
 *
 * The same failure mode has already cost this codebase real bugs -- a
 * swallowed query error, a missing scope filter, a stale precompute -- all of
 * which produced confident wrong output rather than an error. The lesson each
 * time was that the check has to be mechanical.
 *
 * Run as part of the build and in CI:  node scripts/check-demo-imports.mjs
 * Exit 0 = boundary intact, 1 = violation.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Directories whose contents must respect the boundary. */
const SCANNED = ["app", "components", "lib"];

/**
 * Files allowed to reach past the provider: the demo layer itself, and
 * nothing else.
 *
 * This list was briefly longer. The synthesizer, its borrower catalogue and
 * its PRNG toolbox lived under lib/data/ and had to be excepted by path,
 * which meant three fabricated modules sat in a directory whose name implied
 * they were real. Moving them into lib/demo/ collapsed the exception list to
 * one entry -- the rule is now "demo code lives in the demo folder", with no
 * asterisks to remember.
 *
 * Dev scripts under scripts/ are not scanned. They are tooling, never
 * bundled, and inspecting the synthesizer is their job.
 */
const ALLOWED_PREFIXES = ["lib/demo/"];

/**
 * Import specifiers that constitute a violation outside lib/demo/.
 *
 * lib/demo/provider is deliberately absent -- that is the sanctioned door.
 */
const FORBIDDEN = [
  { pattern: /@\/lib\/demo\/impl["']/, what: "the demo provider implementation" },
  { pattern: /@\/lib\/demo\/fixtures["']/, what: "fabricated PCAF name fixtures" },
  { pattern: /@\/lib\/demo\/portfolio["']/, what: "the 80K-loan synthesizer" },
  { pattern: /@\/lib\/demo\/entities["']/, what: "the synthesized borrower catalogue" },
  { pattern: /@\/lib\/demo\/synth-util["']/, what: "the synthesizer's seeded-PRNG toolbox" },
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const violations = [];

for (const root of SCANNED) {
  for (const file of walk(join(repoRoot, root))) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    if (ALLOWED_PREFIXES.some((p) => rel.startsWith(p))) continue;

    const src = readFileSync(file, "utf8");
    for (const { pattern, what } of FORBIDDEN) {
      // Only flag real import/require statements. A path inside a comment
      // explaining the boundary is not a violation of it.
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (!/\b(import|require)\b/.test(line)) return;
        if (pattern.test(line)) {
          violations.push({ rel, line: i + 1, what, text: trimmed });
        }
      });
    }
  }
}

if (violations.length > 0) {
  console.error("\nDemo boundary violated.\n");
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}`);
    console.error(`    imports ${v.what}`);
    console.error(`    ${v.text}\n`);
  }
  console.error(
    "Application code must reach the demo layer only through\n" +
      "lib/demo/provider.ts, which returns null in a live build. Importing\n" +
      "directly compiles fine and silently returns fabricated data into a\n" +
      "production bundle.\n",
  );
  process.exit(1);
}

console.log(
  `[check-demo-imports] boundary intact — ${SCANNED.join(", ")} reach the ` +
    `demo layer only through the provider.`,
);
