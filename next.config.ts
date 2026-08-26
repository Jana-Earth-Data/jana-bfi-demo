import type { NextConfig } from "next";

/**
 * JANA_DEMO gates whether the demo layer exists in this build at all.
 * See lib/demo/provider.ts for the full reasoning.
 */
const isDemoBuild = process.env.JANA_DEMO === "1";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),

  // Force the standalone tracer to include the precomputed portfolio, but
  // ONLY in a demo build.
  //
  // Runtime code loads it through a dynamic fs.readFileSync path the tracer
  // cannot detect statically, so without this a standalone demo build falls
  // back to in-memory synthesis and pays a ~20s cold start.
  //
  // The condition matters as much as the include. This directive previously
  // ran unconditionally, which meant a live build would copy 2.7 MB of
  // fabricated loans into its bundle -- reachable by anything that read the
  // file, and protected only by a runtime branch elsewhere. The guarantee is
  // supposed to be that synthesized data is absent from a live artifact, not
  // that nothing happens to read it.
  ...(isDemoBuild
    ? {
        outputFileTracingIncludes: {
          "/**/*": ["./lib/demo/precomputed-portfolio.json.gz"],
        },
      }
    : {}),
};

export default nextConfig;
