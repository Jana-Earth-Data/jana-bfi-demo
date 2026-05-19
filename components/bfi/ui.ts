/** Shared formatting utilities for BFI demo */

export function formatNpr(value: number): string {
  if (value >= 1_000_000_000) {
    return `NPR ${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `NPR ${(value / 1_000_000).toFixed(0)}M`;
  }
  return `NPR ${new Intl.NumberFormat("en-US").format(value)}`;
}

export function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

export function formatCo2e(tonnes: number): string {
  if (tonnes >= 1_000_000) {
    return `${(tonnes / 1_000_000).toFixed(1)}M tCO2e`;
  }
  if (tonnes >= 1_000) {
    return `${(tonnes / 1_000).toFixed(1)}K tCO2e`;
  }
  return `${new Intl.NumberFormat("en-US").format(Math.round(tonnes))} tCO2e`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export const taxonomyColors: Record<string, string> = {
  green: "bg-green-500/20 text-green-300 border-green-500/30",
  amber: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  red: "bg-red-500/20 text-red-300 border-red-500/30",
  unclassified: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export const qualityScoreColors: Record<number, string> = {
  1: "text-green-300",
  2: "text-green-400",
  3: "text-amber-300",
  4: "text-amber-400",
  5: "text-red-400",
};
