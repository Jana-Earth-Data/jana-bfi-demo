/**
 * Verify JANA_DEMO reaches the Docker image — at build time AND at runtime.
 *
 * Why this exists
 * ---------------
 * Docker is the environment this demo actually runs in. The npm scripts are
 * incidental. But Phase 1 wired the demo flag through npm only, so the
 * Dockerfile ran a bare `npm run build` with JANA_DEMO unset -- which after
 * Phase 1 means a LIVE build. Rebuilding the demo image would have produced a
 * container with an empty loan book and no Demo menu, and nothing would have
 * errored. It would simply have looked like the data had vanished.
 *
 * There are two halves and both are required:
 *
 *   build ARG  -- decides whether the synthesizer is compiled into the bundle
 *                 and whether the precompute artifact is generated.
 *   runtime ENV -- isDemoBuild() reads process.env in the running server to
 *                 gate the Demo menu, the toggle route and the provider's
 *                 dynamic import.
 *
 * Setting only the ARG yields the worst case: an image that contains the demo
 * layer but refuses to serve it, failing silently.
 *
 * Usage:  node scripts/check-docker-demo-flag.mjs
 * Exit 0 = wired, 1 = a stage or compose file would produce a silent live build.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// --- Dockerfile: both stages need the flag ---------------------------------
const dockerfilePath = join(repoRoot, "Dockerfile");
if (!existsSync(dockerfilePath)) {
  failures.push("Dockerfile is missing.");
} else {
  const df = readFileSync(dockerfilePath, "utf8");
  // Split on FROM ... AS <stage> so each stage can be checked independently.
  const stages = df
    .split(/^FROM /m)
    .slice(1)
    .map((chunk) => {
      const name = chunk.match(/AS\s+(\S+)/i)?.[1] ?? "(unnamed)";
      return { name, body: chunk };
    });

  for (const stage of stages) {
    const hasEnv = /^ENV\s+JANA_DEMO=/m.test(stage.body);
    if (!hasEnv) {
      failures.push(
        `Dockerfile stage "${stage.name}": no \`ENV JANA_DEMO=\`. ` +
          (stage.name === "builder"
            ? "next build will run unflagged and produce a live bundle -- no " +
              "synthesizer, no precompute artifact."
            : "The running server reads process.env.JANA_DEMO; without it the " +
              "Demo menu and /api/demo/mode disappear from an image that does " +
              "contain the demo layer."),
      );
    }
    if (!/^ARG\s+JANA_DEMO/m.test(stage.body)) {
      failures.push(
        `Dockerfile stage "${stage.name}": no \`ARG JANA_DEMO\`. ARGs do not ` +
          `cross FROM boundaries, so each stage must re-declare it.`,
      );
    }
  }
}

// --- compose files: build arg AND runtime environment ----------------------
for (const file of ["docker-compose.yml", "docker-compose.offline.yml"]) {
  const p = join(repoRoot, file);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, "utf8");

  // Under `args:` (build-time) -- YAML mapping form `JANA_DEMO: ...`
  const inArgs = /^\s+JANA_DEMO:\s*\S/m.test(body);
  // Under `environment:` -- either mapping or `- JANA_DEMO=...` list form
  const inEnv = /^\s+-?\s*JANA_DEMO[=:]\s*\S/m.test(body);

  if (!inArgs) {
    failures.push(
      `${file}: no JANA_DEMO under build \`args:\`. The image would be built ` +
        `unflagged regardless of the Dockerfile default being overridden.`,
    );
  }
  if (!inEnv) {
    failures.push(
      `${file}: no JANA_DEMO under \`environment:\`. The container would run ` +
        `without the runtime flag.`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nJANA_DEMO does not reach the Docker image.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error(
    "Docker is where this demo runs. A live build there is not a fallback,\n" +
      "it is an empty product with no error explaining itself.\n",
  );
  process.exit(1);
}

console.log(
  "[check-docker-demo-flag] JANA_DEMO reaches both Dockerfile stages and " +
    "both compose files (build args + runtime env).",
);
