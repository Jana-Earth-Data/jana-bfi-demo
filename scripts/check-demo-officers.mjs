/**
 * The officer roster must be reached through the demo-mode gate.
 *
 * Riya Sharma, Anish Rai, Priya Karki and Bikram Thapa are invented people,
 * hardcoded as `demoOfficers` in lib/tenants/registry.ts. Because they live in
 * TypeScript rather than a table, they slipped past both earlier boundaries:
 * the build-time demo layer (Phase 1) and the `origin` column (Phase 3). With
 * demo mode off the portfolio was empty, the work queue was empty, and the
 * header still read "As Riya Sharma · Loan officer".
 *
 * This is not cosmetic. Officers are the attribution subjects for captured
 * compliance work — an ESDD response records who answered it, a CAP item
 * records who signed it off. A fabricated name attached to a real assessment
 * is a false statement about who performed the review.
 *
 * Rule: everything goes through currentOfficerRoster(), which returns [] when
 * demo mode is off. The seeders are exempt because they write demo rows by
 * definition, and the registry is exempt because it is the definition.
 *
 * Usage:  node scripts/check-demo-officers.mjs
 * Exit 0 = gated, 1 = a raw roster read escapes the gate.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Pure Node — this runs inside node:20-alpine where grep is BusyBox. */
function sourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(join(repoRoot, dir));
  } catch {
    return out;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    if (statSync(join(repoRoot, rel)).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      sourceFiles(rel, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(rel);
    }
  }
  return out;
}

const ALLOWLIST = new Map([
  ["lib/tenants/registry.ts", "defines the rosters"],
  ["lib/tenants/types.ts", "types them"],
  ["lib/officers/resolve.ts", "the gate itself — currentOfficerRoster()"],
  [
    "app/api/admin/seed-demo-data/route.ts",
    "seeds demo rows; demo officers are correct here",
  ],
  [
    "app/api/admin/seed-officers/route.ts",
    "seeds the demo roster into bfi_officers",
  ],
]);

const failures = [];
for (const file of [
  ...sourceFiles("app"),
  ...sourceFiles("lib"),
  ...sourceFiles("components"),
]) {
  if (ALLOWLIST.has(file)) continue;
  const lines = readFileSync(join(repoRoot, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!line.includes("demoOfficers")) return;
    const t = line.trim();
    if (t.startsWith("*") || t.startsWith("//")) return;
    failures.push(
      `${file}:${i + 1} reads tenant.demoOfficers directly:\n      ${t}\n` +
        `    This bypasses the demo-mode gate — invented officers will appear ` +
        `with demo mode off. Use \`await currentOfficerRoster()\`.`,
    );
  });
}

if (failures.length > 0) {
  console.error("\nOfficer roster is reachable outside the demo gate.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `[check-demo-officers] roster reached only via currentOfficerRoster(); ` +
    `${ALLOWLIST.size} documented exceptions.`,
);
