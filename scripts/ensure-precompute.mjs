/**
 * Make sure the demo dev server has its precomputed portfolio.
 *
 * The trap this closes
 * --------------------
 * precompute-guard.mjs deletes the artifact on every live build -- correctly,
 * because a live bundle must not ship 80,035 synthesized loans. But only
 * `next build` regenerates it, and `dev:demo` runs `next dev`, which does not.
 *
 * So the sequence "run a live build, then start the demo dev server" leaves
 * dev with no artifact. Nothing fails. lib/demo/portfolio.ts falls back to
 * synthesizing the whole book in-process on every single request, and page
 * loads go from under a second to fifty. The only symptom is slowness, which
 * reads as "Next.js dev is slow" rather than "a file is missing" -- and in
 * Safari it escalates: a 30-second fetch aborts and surfaces as
 * `TypeError: Load failed`, which looks like a bug in whatever you clicked.
 *
 * A missing cache that silently degrades into a 50x slowdown is the same
 * failure shape as every other bug in this codebase: no error, just a wrong
 * result. So dev regenerates it instead of assuming someone remembered.
 *
 * Wired as `predev:demo`, so it runs automatically before `npm run dev:demo`.
 * Regeneration takes ~15s and only happens when the file is actually absent.
 */

import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = join(repoRoot, "lib/demo/precomputed-portfolio.json.gz");

if (existsSync(artifact)) {
  const mb = (statSync(artifact).size / 1024 / 1024).toFixed(2);
  console.log(
    `[ensure-precompute] Portfolio artifact present (${mb} MB). Dev will ` +
      `load it rather than synthesizing per request.`,
  );
  process.exit(0);
}

console.log(
  "[ensure-precompute] No precomputed portfolio found — a live build removes\n" +
    "                    it, and `next dev` does not rebuild it. Generating\n" +
    "                    now (~15s). Without this every request would\n" +
    "                    re-synthesize 80,035 loans.",
);

try {
  execSync("npm run precompute-portfolio", {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, JANA_DEMO: "1" },
  });
} catch {
  console.error(
    "\n[ensure-precompute] Generation failed. `npm run dev:demo` will still\n" +
      "start, but expect ~50s page loads and aborted fetches in Safari.\n" +
      "Run `npm run precompute-portfolio` directly to see the error.\n",
  );
  // Deliberately not fatal: a slow dev server is more useful than none, and
  // the warning above says plainly what the cost is.
  process.exit(0);
}
