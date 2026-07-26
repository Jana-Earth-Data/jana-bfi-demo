"use client";

/**
 * Regulatory-export button trio for the NRB Green Finance Taxonomy filing.
 *
 * Three sibling <a download> links hitting /api/reports/nrb-taxonomy in
 * JSON / xlsx / PDF. Rendered on the NSRS tab so a bank officer preparing
 * the regulatory submission can grab the file they need.
 *
 * Uses the tenant brand-primary CSS variable set upstream by
 * TenantThemeProvider (see components/bfi/tenant-theme.tsx). No hard-coded
 * hex — the same component looks right in every tenant.
 */

import { useState } from "react";

type ExportFormat = "json" | "xlsx" | "pdf";

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: "json", label: "JSON", hint: "Structured data (per-loan)" },
  { id: "xlsx", label: "Excel", hint: "Bank-branded spreadsheet" },
  { id: "pdf", label: "PDF", hint: "Bank-branded filing document" },
];

export function NrbTaxonomyExportButton() {
  // State only used to blip a visual "downloading" pulse on the clicked
  // button so an officer doesn't tap twice on a slow connection.
  const [pending, setPending] = useState<ExportFormat | null>(null);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-slate-100">
          NRB Green Finance Taxonomy — regulatory export
        </div>
        <div className="text-xs text-slate-400">
          Full portfolio classification report. Formats accepted by NRB
          filings (Excel · PDF) plus a machine-readable JSON copy.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((f) => (
          <a
            key={f.id}
            href={`/api/reports/nrb-taxonomy?format=${f.id}`}
            download
            onClick={() => {
              setPending(f.id);
              // Reset after the browser has had time to start the download.
              window.setTimeout(() => setPending(null), 2500);
            }}
            title={f.hint}
            aria-label={`Download ${f.label} export`}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
            style={{
              borderColor: "var(--brand-primary)",
              backgroundColor:
                pending === f.id
                  ? "var(--brand-primary)"
                  : "var(--brand-primary-soft)",
              color:
                pending === f.id
                  ? "var(--brand-fg)"
                  : "var(--brand-primary)",
            }}
          >
            <span>{f.label}</span>
            <span aria-hidden className="text-[10px] opacity-60">
              ↓
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
