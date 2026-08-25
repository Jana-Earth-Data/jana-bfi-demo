/**
 * Verify the demo-mode toggle actually gates the data, not just the chrome.
 *
 * Why this exists
 * ---------------
 * There are two switches with similar names and very different jobs:
 *
 *   isDemoBuild()  build-time  -- is the synthesizer compiled in at all?
 *   isDemoMode()   runtime     -- is it switched on for this request?
 *
 * Every read path into the portfolio must consult BOTH. Consulting only
 * isDemoBuild() produces the worst available outcome: the banner disappears,
 * the menu says "off", the footer stops saying "synthesized" -- and the
 * dashboard carries on reporting 80,035 fabricated loans as though they were
 * the bank's own. A switch that visibly does nothing is safer than one that
 * looks like it worked.
 *
 * This is the same failure shape as the bypassed build guards: no error, no
 * crash, just a confident wrong number. So it gets a test rather than a
 * convention.
 *
 * Usage:  node scripts/check-demo-mode-gate.mjs
 * Exit 0 = every portfolio entry point is gated, 1 = one is not.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The single function every server read path funnels through. If a future
 * change adds a second door into the synthesizer, the import guard
 * (check-demo-imports.mjs) is what catches it; this file checks that the
 * one existing door is bolted.
 */
const GATE_FILE = "lib/api/bfi.ts";
const failures = [];

const src = readFileSync(join(repoRoot, GATE_FILE), "utf8");

// basePortfolio() is the chokepoint. Pull its body and assert the runtime
// check precedes the provider call.
const fn = src.match(
  /async function basePortfolio\s*\([^)]*\)\s*:[^{]*\{([\s\S]*?)\n\}/,
);

if (!fn) {
  failures.push(
    `${GATE_FILE}: could not locate basePortfolio(). It was renamed or ` +
      `restructured -- update this guard rather than deleting it.`,
  );
} else {
  const body = fn[1];
  const modeAt = body.indexOf("isDemoMode");
  const providerAt = body.indexOf("getDemoProvider");

  if (modeAt === -1) {
    failures.push(
      `${GATE_FILE}: basePortfolio() never calls isDemoMode(). The header ` +
        `toggle will repaint the chrome while the dashboard keeps serving ` +
        `the synthetic loan book.`,
    );
  } else if (providerAt !== -1 && modeAt > providerAt) {
    failures.push(
      `${GATE_FILE}: basePortfolio() calls getDemoProvider() before ` +
        `isDemoMode(). The gate must come first, or the synthesizer is ` +
        `loaded regardless of the toggle.`,
    );
  }
}

// The banner must be driven by the same function, or it can disagree with
// the data it is warning about.
const layout = join(repoRoot, "app/layout.tsx");
if (existsSync(layout)) {
  const l = readFileSync(layout, "utf8");
  if (!l.includes("isDemoMode")) {
    failures.push(
      `app/layout.tsx: the DEMO MODE banner is not driven by isDemoMode(). ` +
        `Banner and portfolio must resolve from one source or they will ` +
        `disagree.`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nDemo-mode gate is not wired to the data.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  "[check-demo-mode-gate] basePortfolio() gates on isDemoMode() before " +
    "loading the provider; banner reads the same source.",
);
