/** Shared UI primitives for the BFI dashboard. */
"use client";

import React from "react";

export function Panel({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-panelAlt ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sublabel,
  accent = false,
}: {
  label: React.ReactNode;
  value: string;
  sublabel?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panelAlt p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${accent ? "text-accent" : "text-white"}`}
      >
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-slate-500">{sublabel}</div>
      )}
    </div>
  );
}

export function StatRow({
  label,
  value,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-b-0">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
      <div className="text-sm font-medium text-white">{value}</div>
    </div>
  );
}

export function TaxonomyDot({
  color,
}: {
  color: "green" | "amber" | "red" | "unclassified";
}) {
  const bg =
    color === "green"
      ? "bg-emerald-400"
      : color === "amber"
        ? "bg-amber-400"
        : color === "red"
          ? "bg-rose-400"
          : "bg-slate-500";
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${bg}`} aria-hidden />
  );
}

export function MutedText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`text-slate-500 ${className}`}>{children}</span>;
}

export function ProgressBar({
  value,
  className = "",
  trackClass = "bg-line",
  fillClass = "bg-accent",
}: {
  value: number; // 0..1
  className?: string;
  trackClass?: string;
  fillClass?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className={`relative h-1.5 w-full overflow-hidden rounded-full ${trackClass} ${className}`}>
      <div
        className={`absolute inset-y-0 left-0 ${fillClass}`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function SegmentToggle<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-lg border border-line bg-panel p-0.5 text-xs ${className}`}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 transition-colors ${
            value === o.value
              ? "bg-line text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
