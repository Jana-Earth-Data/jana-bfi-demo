import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  // Force the standalone tracer to include the precomputed portfolio JSON.
  // Runtime code loads it via a dynamic fs.readFileSync path that the
  // tracer can't detect statically. Without this the standalone build
  // silently falls back to in-memory synthesis (~50s cold-start).
  outputFileTracingIncludes: {
    "/**/*": ["./lib/data/precomputed-portfolio.json"],
  },
};

export default nextConfig;
