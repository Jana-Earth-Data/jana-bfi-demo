/**
 * Report demo-origin rows. Never delete them.
 *
 * WHY REPORT AND NOT PURGE
 * The obvious move is a startup hook that clears demo rows when demo mode is
 * off. It is also the single most dangerous thing in this codebase, because
 * it is one bad heuristic away from deleting a bank's compliance records --
 * and ESDD responses, CAP items and screening results are exactly the
 * evidence a regulator asks for.
 *
 * The mislabelling risk is real, not theoretical: the backfill in
 * supabase-origin-column.sql marks every pre-existing row 'demo'. That is
 * correct today because no live data exists. If it is ever wrong, a purge
 * would be irreversible and a report is merely noisy.
 *
 * So this counts, prints, and exits 0. Deleting is a human decision made with
 * this output in front of you, using /api/admin/reset.
 *
 * Usage:
 *   node scripts/check-seeded-rows.mjs           # summary
 *   node scripts/check-seeded-rows.mjs --json    # machine-readable
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
 * environment (docker compose passes them via .env.local).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const asJson = process.argv.includes("--json");

// Derive the table list from the client so this cannot drift from what the
// app actually scopes.
const clientSrc = readFileSync(
  join(repoRoot, "lib/data/capture-client.ts"),
  "utf8",
);
const block = clientSrc.match(
  /export const CAPTURE_TABLES = \[([\s\S]*?)\] as const;/,
);
const TABLES = block
  ? [...block[1].matchAll(/"(bfi_[a-z_]+)"/g)].map((m) => m[1])
  : [];

// Pick up .env.local if the caller has not exported the vars.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const envPath = join(repoRoot, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log(
    "[check-seeded-rows] Supabase is not configured — nothing to report.",
  );
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows = [];
let demoTotal = 0;
let liveTotal = 0;
let unavailable = 0;

for (const table of TABLES) {
  const counts = {};
  let skipped = false;
  for (const origin of ["demo", "live"]) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("origin", origin);
    if (error) {
      // Surfaced, not swallowed. A missing origin column means the migration
      // has not been run, which is exactly what someone needs to be told.
      counts[origin] = null;
      skipped = true;
      counts._error = error.message;
    } else {
      counts[origin] = count ?? 0;
    }
  }
  if (skipped) {
    unavailable++;
  } else {
    demoTotal += counts.demo;
    liveTotal += counts.live;
  }
  rows.push({ table, ...counts });
}

if (asJson) {
  console.log(JSON.stringify({ rows, demoTotal, liveTotal }, null, 2));
  process.exit(0);
}

const w = Math.max(...TABLES.map((t) => t.length), 20);
console.log("\n  Capture-table provenance\n");
console.log(`  ${"table".padEnd(w)}  ${"demo".padStart(8)}  ${"live".padStart(8)}`);
console.log(`  ${"-".repeat(w)}  ${"-".repeat(8)}  ${"-".repeat(8)}`);
for (const r of rows) {
  if (r.demo === null) {
    console.log(`  ${r.table.padEnd(w)}  ${"— no origin column".padStart(19)}`);
  } else {
    console.log(
      `  ${r.table.padEnd(w)}  ${String(r.demo).padStart(8)}  ${String(r.live).padStart(8)}`,
    );
  }
}
console.log(`  ${"-".repeat(w)}  ${"-".repeat(8)}  ${"-".repeat(8)}`);
console.log(
  `  ${"TOTAL".padEnd(w)}  ${String(demoTotal).padStart(8)}  ${String(liveTotal).padStart(8)}\n`,
);

if (unavailable > 0) {
  console.log(
    `  ${unavailable} table(s) have no origin column. Run\n` +
      `  scripts/supabase-origin-column.sql — until then those tables are\n` +
      `  unfiltered and their rows appear in BOTH modes.\n`,
  );
}
if (demoTotal > 0) {
  console.log(
    `  ${demoTotal} demo-origin row(s) present. They are hidden when demo mode\n` +
      `  is off and are NOT deleted by anything automatic. To clear them,\n` +
      `  POST /api/admin/reset deliberately.\n`,
  );
}

process.exit(0);
