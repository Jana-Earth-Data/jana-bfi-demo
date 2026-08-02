"use client";

/**
 * Regulatory-filing button trio for the NRBSIS Green Finance Statement.
 *
 * This mirrors the shape of NrbTaxonomyExportButton, but the semantics
 * are different: the classification report is *supporting evidence*,
 * while THIS export is the *actual submitted filing* keyed into the
 * NRB Supervisory Information System (SIS) per Annex 4b. To keep that
 * distinction unmissable in the UI, we style this variant with the
 * accent colour and a filing badge instead of the muted brand-primary
 * background used by the sibling classification-report button.
 *
 * Same three formats hitting /api/reports/nrbsis-green-statement:
 * JSON / xlsx / PDF.
 */

import { useState } from "react";

type ExportFormat = "json" | "xlsx" | "pdf";

const FORMATS: Array<{
  id: ExportFormat;
  label: string;
  hint: string;
  extension: string;
}> = [
  { id: "json", label: "JSON", hint: "Structured data (17-sector shape)", extension: "json" },
  { id: "xlsx", label: "Excel", hint: "SIS keying template (bank-branded)", extension: "xlsx" },
  { id: "pdf", label: "PDF", hint: "Signable filing document (bank-branded)", extension: "pdf" },
];

function todayStamp(): string {
  return new Date().toISOString().split("T")[0];
}

export function NrbsisGreenStatementButton() {
  const [pending, setPending] = useState<ExportFormat | null>(null);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-slate-100">
            NRBSIS Green Finance Statement (Annex 4b)
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{
              backgroundColor: "var(--brand-accent)",
              color: "var(--brand-fg)",
            }}
          >
            Filed
          </span>
        </div>
        <div className="text-xs text-slate-400">
          Annual aggregate 17-sector Green Finance Statement keyed into the
          NRB Supervisory Information System per NRB Green Finance Taxonomy
          2024, Annex 4b. Excel and PDF exports carry the bank's logo, colors,
          and letterhead.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((f) => (
          <a
            key={f.id}
            href={`/api/reports/nrbsis-green-statement?format=${f.id}`}
            download={`nrbsis-green-statement-${todayStamp()}.${f.extension}`}
            onClick={() => {
              setPending(f.id);
              window.setTimeout(() => setPending(null), 2500);
            }}
            title={f.hint}
            aria-label={`Download ${f.label} filing`}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors"
            style={{
              borderColor: "var(--brand-accent)",
              backgroundColor:
                pending === f.id
                  ? "var(--brand-accent)"
                  : "transparent",
              color:
                pending === f.id
                  ? "var(--brand-fg)"
                  : "var(--brand-accent)",
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
