/**
 * Verify the build guards are actually reachable from every build entrypoint.
 *
 * Why this exists
 * ---------------
 * The guards were wired to npm's `prebuild` hook, which fires only for the
 * script literally named `build`. Convenience aliases were then added --
 * `build:demo` and `build:live` calling `next build` directly -- and both
 * silently bypassed every guard. A "live" build ran the import check zero
 * times and left 2.7 MB of synthesized loans in the bundle.
 *
 * Nothing failed. The build succeeded in 1.5 seconds and looked perfect. The
 * only symptom was an absence: no guard output in a log nobody was reading
 * line by line.
 *
 * That is the same failure shape as every other bug this codebase has
 * produced -- a silent omission that renders as success. So the wiring gets
 * a test, not a convention.
 *
 * Usage:  node scripts/check-build-wiring.mjs
 * Exit 0 = every build entrypoint runs the guards, 1 = one bypasses them.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

/** Scripts a human might plausibly run to produce a deployable build. */
const BUILD_ENTRYPOINTS = Object.keys(scripts).filter(
  (name) => name === "build" || name.startsWith("build:"),
);

/**
 * A script is guarded if it is `build` itself (which npm decorates with
 * prebuild) or if it delegates to `npm run build`, inheriting the hook.
 * Calling `next build` directly skips it.
 */
function isGuarded(name) {
  if (name === "build") return Boolean(scripts.prebuild);
  const body = scripts[name] ?? "";
  return /\bnpm run build\b/.test(body);
}

const failures = [];
for (const name of BUILD_ENTRYPOINTS) {
  if (!isGuarded(name)) {
    failures.push({ name, body: scripts[name] });
  }
}

if (!scripts.prebuild) {
  failures.push({
    name: "prebuild",
    body: "(missing) — nothing runs the guards at all",
  });
}

if (failures.length > 0) {
  console.error("\nBuild guards are bypassable.\n");
  for (const f of failures) {
    console.error(`  npm run ${f.name}`);
    console.error(`    ${f.body}`);
    console.error(
      `    does not run prebuild, so the import guard and the precompute\n` +
        `    guard are skipped.\n`,
    );
  }
  console.error(
    "npm only applies the prebuild hook to the script named `build`.\n" +
      "Aliases must delegate to it -- `JANA_DEMO=1 npm run build` rather\n" +
      "than `JANA_DEMO=1 next build`.\n",
  );
  process.exit(1);
}

console.log(
  `[check-build-wiring] ${BUILD_ENTRYPOINTS.length} build entrypoint(s) ` +
    `(${BUILD_ENTRYPOINTS.join(", ")}) all run the guards.`,
);
