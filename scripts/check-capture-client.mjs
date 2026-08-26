/**
 * Verify every capture-table access is provenance-scoped.
 *
 * lib/data/capture-client.ts applies the origin filter in one place so that
 * ~104 query chains do not each have to remember. That only holds while
 * everything actually goes through it. One route reaching for the raw admin
 * client reintroduces the exact leak Phase 3 exists to close -- and it leaks
 * silently, because a missing filter returns MORE rows, not an error.
 *
 * Three things are checked:
 *
 *   1. No direct getSupabaseAdmin() outside the allowlist.
 *   2. CAPTURE_TABLES matches the table list in the migration. A table with an
 *      `origin` column that the client does not know about is never filtered;
 *      a table in the client without the column makes every query fail on a
 *      missing column. Both are silent-ish and both are bad.
 *   3. No .rpc() touching a capture table. The Proxy wraps .from() only, so an
 *      RPC bypasses provenance entirely.
 *
 * Usage:  node scripts/check-capture-client.mjs
 * Exit 0 = every path is scoped, 1 = something bypasses it.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

/**
 * Pure-Node source walk. Deliberately not `grep`.
 *
 * This guard runs inside `docker build` on node:20-alpine, where grep is
 * BusyBox and has no --include. The first version shelled out to GNU grep,
 * passed on macOS, and died in the container with a usage dump. A guard whose
 * own portability is worse than the code it checks is not a guard.
 */
function sourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(join(repoRoot, dir));
  } catch {
    return out;
  }
  for (const name of entries) {
    const rel = `${dir}/${name}`;
    const abs = join(repoRoot, rel);
    if (statSync(abs).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      sourceFiles(rel, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(rel);
    }
  }
  return out;
}

const SOURCE_FILES = [...sourceFiles("app"), ...sourceFiles("lib")];

/**
 * Files permitted to use the unscoped client, each for a stated reason.
 * Adding to this list should require justifying it out loud.
 */
const ALLOWLIST = new Map([
  ["lib/data/supabase.ts", "defines it"],
  ["lib/data/capture-client.ts", "wraps it — this is the chokepoint"],
  [
    "app/api/admin/seed-demo-data/route.ts",
    "forces origin='demo' via withOrigin()",
  ],
  ["app/api/admin/seed/route.ts", "forces origin='demo' via withOrigin()"],
  [
    "app/api/admin/seed-officers/route.ts",
    "forces origin='demo' via withOrigin()",
  ],
  [
    "app/api/admin/reset/route.ts",
    "must clear BOTH origins — scoping it would half-reset and report success",
  ],
  [
    "scripts/check-seeded-rows.mjs",
    "reports across both origins by design",
  ],
]);

// --- 1. direct admin-client use --------------------------------------------
for (const file of SOURCE_FILES) {
  if (ALLOWLIST.has(file)) continue;
  const src = readFileSync(join(repoRoot, file), "utf8");
  if (!/getSupabaseAdmin/.test(src)) continue;
  failures.push(
    `${file} calls getSupabaseAdmin() directly. Capture-table queries from ` +
      `here are NOT provenance-filtered, so demo rows will appear when demo ` +
      `mode is off. Use \`await getCaptureClient()\`.`,
  );
}

// --- 2. the three table lists must agree ------------------------------------
//
// The same set of tables is declared in three places, because there are three
// consumers and no shared runtime between them:
//
//   lib/data/capture-client.ts          what the app filters
//   scripts/supabase-origin-column.sql  applied by hand to Supabase Cloud
//   docker/…/97-origin-column.sql       applied automatically to offline PG
//
// Drift is silent in both directions. A table with the column but missing
// from the client is never filtered — demo rows leak. A table in the client
// without the column makes every query fail on a missing column — and if only
// ONE of the two SQL files is updated, it breaks in exactly one environment,
// which is the kind of thing that surfaces in Kathmandu rather than here.
const SOURCES = [
  {
    path: "lib/data/capture-client.ts",
    re: /export const CAPTURE_TABLES = \[([\s\S]*?)\] as const;/,
    label: "app filter list",
  },
  {
    path: "scripts/supabase-origin-column.sql",
    re: /capture_tables text\[\] := ARRAY\[([\s\S]*?)\];/,
    label: "Supabase Cloud migration",
  },
  {
    path: "docker/postgres/initdb.d/97-origin-column.sql",
    re: /capture_tables text\[\] := ARRAY\[([\s\S]*?)\];/,
    label: "offline Postgres init",
  },
];

const parsed = [];
for (const src of SOURCES) {
  const full = join(repoRoot, src.path);
  if (!existsSync(full)) {
    failures.push(`${src.path} is missing (${src.label}).`);
    continue;
  }
  const block = readFileSync(full, "utf8").match(src.re);
  if (!block) {
    failures.push(`Could not parse the table list from ${src.path}.`);
    continue;
  }
  parsed.push({
    ...src,
    tables: new Set([...block[1].matchAll(/['"](bfi_[a-z_]+)['"]/g)].map((m) => m[1])),
  });
}

if (parsed.length === SOURCES.length) {
  const union = new Set(parsed.flatMap((p) => [...p.tables]));
  for (const table of [...union].sort()) {
    const missing = parsed.filter((p) => !p.tables.has(table));
    if (missing.length === 0) continue;
    failures.push(
      `${table} is declared in ${parsed.length - missing.length} of ` +
        `${parsed.length} places — missing from ` +
        missing.map((m) => `${m.path} (${m.label})`).join(", ") +
        `. All three must agree or the behaviour differs between Supabase ` +
        `Cloud and the offline stack.`,
    );
  }
}

// --- 3. RPC bypass ----------------------------------------------------------
const rpcHits = [];
for (const file of SOURCE_FILES) {
  const lines = readFileSync(join(repoRoot, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.includes(".rpc(")) rpcHits.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}
for (const hit of rpcHits) {
  // Ignore comments — this file's own docstring discusses .rpc(), and a
  // guard that trips on prose about itself trains people to ignore it.
  const code = hit.replace(/^[^:]*:\d+:/, "").trim();
  if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) {
    continue;
  }
  failures.push(
    `${hit.trim()} — .rpc() bypasses the capture-client Proxy, which only ` +
      `wraps .from(). If this touches a capture table it is unfiltered. ` +
      `Either move the logic into a .from() chain or scope origin inside the ` +
      `function itself and document it here.`,
  );
}

if (failures.length > 0) {
  console.error("\nCapture-table access is not fully provenance-scoped.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(
  `[check-capture-client] all capture-table access goes through ` +
    `getCaptureClient(); ${ALLOWLIST.size} documented exceptions.`,
);
