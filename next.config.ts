import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
  // pdfkit loads its AFM font files via runtime require.resolve() calls
  // that Next.js's output tracer cannot statically detect. Without this
  // hint the standalone Docker build ships without the font data, and
  // buildTaxonomyPdf() silently produces a non-PDF blob that Adobe
  // Acrobat rejects with "not a supported file type or has been
  // damaged". Trace all pdfkit runtime files so the standalone image
  // has what it needs.
  outputFileTracingIncludes: {
    "/api/reports/nrb-taxonomy": [
      "./node_modules/pdfkit/js/data/**/*",
      "./node_modules/pdfkit/js/data/*",
    ],
  },
};

export default nextConfig;
