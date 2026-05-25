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
  "taxonomy-green": {
    title: "Green classification",
    body:
      "Activities that substantially contribute to one of four NRB environmental objectives (climate mitigation, adaptation, natural resource conservation, pollution prevention) without significantly harming the others.\n\nIn this portfolio: hydropower operators and renewable-energy borrowers. Receives favourable loan terms, lower risk weights, and is the only category eligible for the bank's green-bond use of proceeds.",
    source: "NRB Green Finance Taxonomy 2024, sectoral classification criteria",
  },
  "taxonomy-amber": {
    title: "Amber (transitional) classification",
    body:
      "Borrowers with low-to-medium environmental impact whose activities are moving toward green alignment. Standard loan terms with improvement conditions; the bank expects a transition plan and emissions trajectory from the borrower.\n\nIn this portfolio: non-cement manufacturing, textiles, food processing, sugar, hospitality, real estate, logistics, and waste utilities.",
    source: "NRB Green Finance Taxonomy 2024, transition-pathway criteria",
  },
  "taxonomy-red": {
    title: "Red (high-emission) classification",
    body:
      "Hard-to-abate sectors with significant negative environmental impact and no demonstrated transition pathway. Carries higher interest rates and risk weights under NRB supervision, and may trigger a divestment timeline at the regulator's discretion.\n\nIn this portfolio: cement, steel, brick kilns, and thermal power.",
    source: "NRB Green Finance Taxonomy 2024, high-emission sector list",
  },
  "taxonomy-unclassified": {
    title: "Unclassified (out of scope)",
    body:
      "Loans not subject to the Green Finance Taxonomy. Most retail products (home mortgages, personal loans, education, auto, credit cards) fall outside the framework because they target individual consumers, not commercial activities with measurable environmental impact.",
    source: "NRB Green Finance Taxonomy 2024, scope definition",
  },

  // ---------------------------------------------------------------------------
  // Community air quality (PM2.5)
  // ---------------------------------------------------------------------------
  "aq-acceptable": {
    title: "Acceptable air quality",
    body:
      "PM₂.₅ at or below 50 µg/m³ near the facility. Within Nepal's National Ambient Air Quality Standard for 24-hour exposure (40 µg/m³) and consistent with WHO Interim Target 1 (35 µg/m³).\n\nUnder ESRM, no additional community health and safety covenants are typically required on this basis.",
    source: "Nepal NAAQS 2003 (PM₂.₅ 24-hour); WHO Global Air Quality Guidelines 2021",
  },
  "aq-elevated": {
    title: "Elevated air quality",
    body:
      "PM₂.₅ between 50 and 100 µg/m³. Above Nepal's NAAQS 24-hour limit and the WHO Interim Target 1. Common across urban and Terai industrial zones in Nepal, particularly in winter.\n\nUnder ESRM, the loan officer should consider whether the facility's operations contribute materially to the local exposure and document any community engagement / mitigation steps.",
    source: "Nepal NAAQS 2003 (PM₂.₅ 24-hour); WHO Global Air Quality Guidelines 2021",
  },
  "aq-hazardous": {
    title: "Hazardous air quality",
    body:
      "PM₂.₅ above 100 µg/m³. Well above Nepal's NAAQS 24-hour limit (40 µg/m³) and several multiples of WHO recommended exposure (5 µg/m³ annual mean). At these levels short-term exposure causes measurable cardiovascular and respiratory effects.\n\nUnder ESRM, a borrower operating in this airshed requires explicit community impact assessment, pollution-control covenants, and grievance mechanism documentation in the loan file.",
    source: "Nepal NAAQS 2003 (PM₂.₅ 24-hour); WHO Global Air Quality Guidelines 2021",
  },

  // ---------------------------------------------------------------------------
  // ESRM risk classification
  // ---------------------------------------------------------------------------
  "risk-low": {
    title: "Low ESRM risk",
    body:
      "Renewable-energy or low-emissions borrower with minimal community impact. Typically aligns with NRB Green Finance Taxonomy 'Green' classification. Eligible for sustainable-finance pricing. Standard ESDD documentation; no extra covenants.",
    source: "NRB ESRM Guidelines 2018, §3.4(a)",
  },
  "risk-medium": {
    title: "Medium ESRM risk",
    body:
      "Commercial profile with a notable environmental footprint but no extreme emissions exposure. Standard ESDD checklist plus sector-specific covenants. Monitored as part of routine credit review.",
    source: "NRB ESRM Guidelines 2018, §3.4(b)",
  },
  "risk-high": {
    title: "High ESRM risk",
    body:
      "Sector and emissions profile place this borrower in NRB ESRM's elevated-risk bucket (typically cement, steel, brick, or large facility-level emitters at 50-1,000 kt CO₂e/yr). Approval should include efficiency-improvement covenants, pollution-control verification, and quarterly E&S reporting.",
    source: "NRB ESRM Guidelines 2018, §3.4(c)",
  },
  "risk-extreme": {
    title: "Extreme ESRM risk",
    body:
      "Facility-level emissions exceed 1 Mt CO₂e per year. Approval requires transition-plan covenants, quarterly emissions reporting, and the highest level of ESDD scrutiny. Subject to enhanced ongoing monitoring through the life of the loan.",
    source: "NRB ESRM Guidelines 2018, §3.4(c)",
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
