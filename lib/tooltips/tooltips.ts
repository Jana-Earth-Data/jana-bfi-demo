/**
 * Central registry of explainer tooltips used across the dashboard.
 *
 * Adding a new tooltip:
 *   1. Add an entry to TOOLTIPS keyed by a stable ID (kebab-case, e.g. "pcaf-score-3")
 *   2. Use `<InfoTip id="pcaf-score-3" />` from any client component
 *   3. (Optional) Add a `source` line citing the regulation or document
 *
 * Why a registry: lets non-engineers update copy in one file, makes it easy to
 * audit which explainers exist and where they're surfaced, and avoids
 * scattering long-form content through component code.
 */

export type TooltipContent = {
  title: string;
  /** Body text — supports basic line breaks via newlines. Keep under ~80 words. */
  body: string;
  /** Optional source citation rendered as muted text at the bottom. */
  source?: string;
};

export const TOOLTIPS: Record<string, TooltipContent> = {
  // ---------------------------------------------------------------------------
  // PCAF scores (one tooltip per score so a banker can hover on any number)
  // ---------------------------------------------------------------------------
  "pcaf-score-2": {
    title: "PCAF Score 2",
    body:
      "Best score routinely achievable for corporate loans. Facility-level emissions from Climate TRACE satellite verification, paired with an enterprise value drawn from public financial filings or audited statements.\n\nScore 1 requires third-party-audited emissions reported by the company itself — rare for Nepali industrial borrowers.",
    source:
      "PCAF Global GHG Accounting and Reporting Standard, Part A §5, Table 5-1",
  },
  "pcaf-score-3": {
    title: "PCAF Score 3",
    body:
      "Facility-level emissions data (Climate TRACE) downgraded one tier because the enterprise value is estimated, not verified from public filings.\n\nThe emissions side is the same quality as Score 2; the score reflects uncertainty in the financial denominator only.",
    source:
      "PCAF Global GHG Standard §5 — Option 2b (physical-activity emissions, estimated EV)",
  },
  "pcaf-score-4": {
    title: "PCAF Score 4",
    body:
      "Sector-average emission intensity multiplied by the borrower's revenue or asset proxy. No facility-level data — the emissions number is back-calculated from a sector benchmark.\n\nUsed when a borrower isn't covered by Climate TRACE or other facility-level satellite data.",
    source:
      "PCAF Global GHG Standard §5 — Option 3 (economic activity-based)",
  },
  "pcaf-score-5": {
    title: "PCAF Score 5",
    body:
      "Worst tier. National sector-average emissions per dollar of revenue, applied to the borrower's loan size. No company-specific data of any kind.\n\nWithout Jana, this is the default for every commercial loan in a bank's book.",
    source: "PCAF Global GHG Standard §5 — Option 3, geographic average",
  },
  "pcaf-out-of-scope": {
    title: "Out of scope for PCAF Cat. 15",
    body:
      "Retail loans — mortgages, personal, education, vehicle — aren't classified under PCAF Category 15 (corporate financed emissions). They have their own asset class with separate methodology.\n\nFor disclosure purposes, residential mortgages fall under PCAF Cat. 15 §6 (mortgage emissions) which uses building-floor-area methodology and isn't part of this demo.",
    source: "PCAF Global GHG Standard, Category 15 asset class taxonomy",
  },

  // ---------------------------------------------------------------------------
  // Financial / methodology
  // ---------------------------------------------------------------------------
  "ev-demo-only": {
    title: "Enterprise value (demo only)",
    body:
      "In production, the EV used here would come from the bank's own credit underwriting system — the same number their credit officers use to size the loan. Jana doesn't compute or provide this value.\n\nFor the demo we synthesize a plausible EV so the PCAF math runs end-to-end. Don't read anything into the specific number.",
  },
  "attribution-factor": {
    title: "PCAF attribution factor",
    body:
      "The share of a borrower's emissions attributable to this specific loan: outstanding loan ÷ borrower enterprise value.\n\nIt's a ratio, so the percentage is identical whether you compute it in NPR or USD. PCAF convention is to report it in USD for cross-border comparability.",
    source: "PCAF Global GHG Standard, Part A §5.1 (attribution factor)",
  },
  "national-co2-share": {
    title: "Share of Nepal's national CO₂",
    body:
      "Borrower's annual CO₂ emissions as a percentage of Nepal's total national CO₂ from EDGAR's gridded inventory, polygon-clipped to Nepal's administrative boundary.\n\nA dramatic single-number metric for credit committees: when one facility is multiple percent of a country's emissions, the regulatory exposure on a loan to that facility is significant.",
    source:
      "EDGAR v8.1 gridded CO₂ emissions, 2024, clipped to Nepal admin polygon",
  },
  "facility-tier": {
    title: "Facility-tier borrower",
    body:
      "A borrower for which we have facility-level emissions data — coordinates plus annual CO₂e from Climate TRACE, the Global Cement and Concrete Tracker, or equivalent satellite verification.\n\nQualifies for PCAF Score 2 or 3 depending on EV quality. Compared to sector-benchmark borrowers (Score 4) or revenue-estimate borrowers (Score 5).",
  },

  // ---------------------------------------------------------------------------
  // Taxonomy
  // ---------------------------------------------------------------------------
  "nrb-taxonomy": {
    title: "NRB Green Finance Taxonomy",
    body:
      "Nepal Rastra Bank's October 2024 framework classifies commercial loans by environmental impact:\n\nGreen — beneficial activities (renewables, sustainable agriculture).\nAmber — transitional (food, textiles, construction).\nRed — high-emission (cement, steel, brick, thermal power).\nUnclassified — out of scope (retail, services with no environmental criteria).",
    source: "NRB Green Finance Taxonomy, October 2024",
  },

  // ---------------------------------------------------------------------------
  // Data sources
  // ---------------------------------------------------------------------------
  "climate-trace-2024": {
    title: "Climate TRACE 2024 snapshot",
    body:
      "Real facility-level CO₂ equivalent emissions for 2024, derived from satellite observation by Climate TRACE (the coalition of NGOs and research institutions). The snapshot covers 213 Nepal facilities across manufacturing, transportation, buildings, waste, and agriculture.\n\n\"Snapshot\" means this is committed data, not a live API call. After authentication, the same numbers refresh from Jana's live API and the badge flips to \"Live\".",
    source: "Climate TRACE v5.6 facility emissions for Nepal, 2024",
  },
};

export function getTooltip(id: string): TooltipContent | null {
  return TOOLTIPS[id] ?? null;
}
