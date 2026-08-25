/**
 * Every script the build runs must survive .dockerignore.
 *
 * Why this exists
 * ---------------
 * `scripts/` is excluded from the Docker build context because most of it is
 * dev tooling. But the `prebuild` hook runs out of that same directory, so
 * each guard added to the chain silently became a file the image did not have.
 *
 * The failure is at least loud -- MODULE_NOT_FOUND, build stops. But it stops
 * at `docker build`, which is minutes in and the last place you look, and the
 * error names one missing file rather than the pattern. Three guards were
 * added to prebuild in one sitting and all three broke the image the same way.
 *
 * So: derive the required set from package.json rather than maintaining a list
 * by hand, and check it against .dockerignore here, in milliseconds, before
 * Docker is involved at all.
 *
 * Usage:  node scripts/check-dockerignore-build-scripts.mjs
 * Exit 0 = every build script reaches the image, 1 = one would be excluded.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

/**
 * Scripts that run inside `docker build`. That is `prebuild` + `build`, plus
 * anything they shell out to. predev:* is excluded -- it runs on the host.
 */
const BUILD_CHAIN = ["prebuild", "build"];

/** Pull `scripts/whatever.ext` paths out of a command string. */
function referencedPaths(cmd) {
  return [...cmd.matchAll(/scripts\/[\w.-]+\.(?:mjs|js|ts|cjs)/g)].map(
    (m) => m[0],
  );
}

const required = new Set();
for (const name of BUILD_CHAIN) {
  for (const p of referencedPaths(scripts[name] ?? "")) required.add(p);
}
// precompute-portfolio.ts is invoked via `npm run precompute-portfolio` from
// the build, one level of indirection deeper than the regex above sees.
for (const p of referencedPaths(scripts["precompute-portfolio"] ?? "")) {
  required.add(p);
}

// --- parse .dockerignore ----------------------------------------------------
const dockerignorePath = join(repoRoot, ".dockerignore");
const lines = existsSync(dockerignorePath)
  ? readFileSync(dockerignorePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : [];

/** Does `pattern` (glob-lite: * within a path segment) match `path`? */
function matches(pattern, path) {
  const clean = pattern.replace(/\/$/, "");
  // A bare directory pattern excludes everything beneath it.
  if (!clean.includes("*") && path.startsWith(clean + "/")) return true;
  if (clean === path) return true;
  if (clean.includes("*")) {
    const rx = new RegExp(
      "^" + clean.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$",
    );
    return rx.test(path);
  }
  return false;
}

/** Last matching rule wins, exactly as Docker evaluates it. */
function isExcluded(path) {
  let excluded = false;
  for (const line of lines) {
    const negated = line.startsWith("!");
    const pattern = negated ? line.slice(1) : line;
    if (matches(pattern, path)) excluded = !negated;
  }
  return excluded;
}

const failures = [];
for (const path of [...required].sort()) {
  if (!existsSync(join(repoRoot, path))) {
    failures.push(`${path}: referenced by the build chain but does not exist.`);
    continue;
  }
  if (isExcluded(path)) {
    failures.push(
      `${path}: runs during \`npm run build\` but .dockerignore excludes it. ` +
        `\`docker build\` will fail with MODULE_NOT_FOUND. Add \`!${path}\` ` +
        `(or match the \`!scripts/*.mjs\` convention).`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nBuild scripts are missing from the Docker build context.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `[check-dockerignore-build-scripts] ${required.size} build script(s) all ` +
    `reach the Docker build context.`,
);
