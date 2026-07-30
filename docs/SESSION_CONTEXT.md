# Jana BFI Demo - Session Context for Cowork

Use this document to quickly brief a new Claude Cowork session on this project. Mount `~/Projects/repos/jana-bfi-demo` as a folder and paste this or reference it.

---

## What This Is

A **Next.js 15 / React 19** single-page dashboard that demonstrates Jana Earth Data's financed emissions product for Nepal's banking sector (BFIs - Banks and Financial Institutions). It shows a loan officer view of a bank's commercial/industrial loan portfolio with PCAF (Partnership for Carbon Accounting Financials) Scope 3 Category 15 attribution calculations.

This is a **sales demo tool** - shown to bankers to illustrate what Jana's data can do for their ESRM, Green Taxonomy, and NFRS compliance workflows.

---

## Tech Stack

- **Framework:** Next.js 15.5 with App Router (TypeScript)
- **Styling:** Tailwind CSS 3.4 with custom dark theme (see `tailwind.config.ts` for color tokens: surface, panel, panelAlt, line, muted, accent, success, warning)
- **Charts:** Recharts 2.15 (horizontal bar chart for sector emissions, donut chart for NRB taxonomy breakdown)
- **Auth:** Device code OAuth flow against `auth-dev.jana.earth` (client_id: `jana-sdk`)
- **Docker:** Multi-stage build, `node:20-alpine`, standalone output mode
- **No database.** All loan/borrower data is mock. Only facility emissions can go live.

---

## How to Run

```bash
# Local dev
cd ~/Projects/repos/jana-bfi-demo
npm run dev
# -> http://localhost:3000

# Docker
docker compose up --build
# -> http://localhost:3001
```

---

## Environment Variables

In `.env.local` (and as Docker build args in `docker-compose.yml`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api-test.jana.earth` | Jana API base URL for Climate TRACE data |
| `NEXT_PUBLIC_AUTH_URL` | `https://auth-dev.jana.earth` | Jana auth service for device code flow |
| `NEXT_PUBLIC_DEMO_USE_MOCKS` | `true` | When `true`, always returns mock data. When `false`, SSR still uses mock (no server-side token), but client-side fetches live data after user authenticates. |

---

## Project Structure

```
jana-bfi-demo/
  app/
    layout.tsx              # Root layout, metadata
    page.tsx                # SSR entry - calls getBfiDemoData(), renders BfiPageClient
    globals.css             # Tailwind imports + dark theme base
    api/
      auth/
        device-code/route.ts  # Proxies device code request to auth-dev.jana.earth
        device-token/route.ts # Proxies token poll to auth-dev.jana.earth
      bfi-data/route.ts       # GET /api/bfi-data - returns mock or live BFI data
  components/bfi/
    page-client.tsx         # Main dashboard component (client-side, ~560 lines)
    charts.tsx              # Recharts: SectorEmissionsChart, TaxonomyPieChart
    login-button.tsx        # Device code login UI (3 states: signed out, pending, signed in)
    ui.ts                   # Formatting helpers (formatNpr, formatUsd, formatCo2e, formatPercent) + color maps
  lib/
    api/
      client.ts             # Generic apiFetch/apiFetchAll with pagination support
      bfi.ts                # BFI data layer: mock vs live, Climate TRACE fetch, PCAF calc, borrower matching
    auth/
      auth-context.tsx      # React context for device code auth state
      device-code.ts        # Device code OAuth client (requestDeviceCode, pollForToken)
    mock/
      bfi-data.ts           # 8 borrowers, 10 loans, realistic Nepal facilities, PCAF attributions
    types/
      bfi.ts                # Core types: Borrower, Loan, MatchedFacility, PcafAttribution, PortfolioSummary, BfiDemoData
      region.ts             # Region configs (Nepal, India, Australia, UK, Japan) - inherited from demo-starter, not yet used in BFI
  public/
    green_logo.png          # Jana logo
```

---

## Data Architecture

### Two modes: Mock and Live

**Mock mode** (`NEXT_PUBLIC_DEMO_USE_MOCKS=true` or no auth token):
- All data comes from `lib/mock/bfi-data.ts`
- 8 borrowers with hardcoded Climate TRACE facility matches
- 10 loans with NRB taxonomy classifications
- Pre-calculated PCAF attributions

**Live mode** (user authenticates via device code flow):
- Client calls `GET /api/bfi-data` with Bearer token
- Server fetches real Climate TRACE emissions for Nepal from `api-test.jana.earth`
- Name-matching rules in `MATCH_RULES` array (lib/api/bfi.ts, line 72-84) match CT assets to mock borrowers
- Live emissions replace mock emissions; loans/borrowers stay mock (banks don't expose loan books via API)
- Falls back to mock on any error

### Mock Borrowers (lib/mock/bfi-data.ts)

| ID | Name | Sector | Facilities | Annual CO2e |
|----|------|--------|------------|-------------|
| B001 | Hongshi Shivam Cement | Manufacturing - Cement | 1 cement plant | 1,245,000 t |
| B002 | Chilime Hydropower | Energy - Hydropower | 1 hydro station | 2,800 t |
| B003 | Himal Cement | Manufacturing - Cement | 1 cement factory | 520,000 t |
| B004 | Bottlers Nepal (Terai) | Manufacturing - Beverages | 1 plant | 18,500 t |
| B005 | Butwal Power Company | Energy - Hydropower | 2 hydro stations | 2,600 t |
| B006 | Unilever Nepal | Manufacturing - FMCG | 1 factory | 12,000 t |
| B007 | Nepal Electricity Authority | Energy - Thermal | 2 diesel/thermal plants | 143,000 t |
| B008 | Shree Ram Sugar Mills | Agriculture - Processing | 1 sugar mill | 35,000 t |

### PCAF Calculation

```
Attribution Factor = Loan Outstanding (USD) / Borrower Enterprise Value (USD)
Attributed Emissions = Attribution Factor x Borrower Total CO2e
```

Data quality score (1-5, 1=best):
- Score 2: borrower publishes GHG-Protocol-conformant emissions (unverified is fine). Rare for Nepal SPVs today.
- Score 3: physical production data × sector emission factor (Option 2b). Realistic ceiling with Jana for Nepal cement and hydropower borrowers.
- Score 4: sector-average intensity × borrower revenue
- Score 5: sector-average intensity × outstanding amount (no borrower data)

### NRB Taxonomy Colors

Loans are classified as green/amber/red/unclassified per Nepal's Green Finance Taxonomy (Oct 2024):
- **Green:** Hydropower, renewable energy
- **Amber:** Beverage/FMCG manufacturing, sugar processing (transition)
- **Red:** Cement, thermal power (high emissions)

---

## UI Layout

The dashboard has these sections top-to-bottom:

1. **Header bar** - Jana logo, title, mock/live badge, login button
2. **KPI row** - 4 cards: Total Loans, Total Outstanding (NPR + USD), Total Financed Emissions (tCO2e), Avg Data Quality
3. **Main content** - Two-column layout:
   - Left: scrollable loan list (click to select)
   - Right: detailed view of selected loan showing borrower info, loan details, PCAF attribution math, matched Climate TRACE facilities
4. **Charts row** - Two-column:
   - Left: horizontal bar chart of attributed emissions by sector
   - Right: donut chart of NRB taxonomy breakdown (green/amber/red/unclassified)
5. **Methodology note** - Text block explaining PCAF methodology
6. **Footer**

Design: dark theme (#0b1220 background), accent blue (#7dd3fc), rounded-3xl panels, Tailwind utility classes throughout.

---

## Auth Flow

1. User clicks "Sign in for live data"
2. Client POST to `/api/auth/device-code` (proxied to `auth-dev.jana.earth/api/auth/device-code/`)
3. Browser opens verification URL in new tab
4. Client polls `/api/auth/device-token` every N seconds
5. On success, stores access_token in React state (no localStorage)
6. Client fetches `GET /api/bfi-data` with Bearer token
7. Dashboard updates from mock to live data, badge changes to "Live data"

---

## What Needs Work Next

These are known gaps and improvement areas (not prioritized):

### Must-have for demo readiness
- **Test that it actually runs.** The docker build and local dev have not been verified end-to-end by the user yet. Run `npm run dev` or `docker compose up --build` and fix any build errors.
- **Verify live mode works.** Authenticate and confirm the Climate TRACE API fetch + name matching produces valid data. The Jana dev environment (`api-test.jana.earth`) needs to be running.
- **Check mobile responsiveness.** The grid layouts may not work well on smaller screens.

### UI improvements
- **Map view.** Show matched facilities on a map (Leaflet or Mapbox). Coordinates are already in the facility data.
- **Loan filtering/sorting.** By taxonomy color, by sector, by emissions amount.
- **Export.** PDF or CSV export of portfolio summary for the banker to take away.
- **Comparison view.** Show what data quality looks like with Jana (Score 2-3) vs without (Score 5).
- **Loading states.** The live data fetch shows a spinner but there's no skeleton UI.

### Data improvements
- **More borrowers.** 8 is thin for a demo. Add brick kilns, steel, mining, textiles.
- **Multi-year emissions.** Show emissions trends (2020-2023). The API supports date ranges.
- **Sector benchmarking.** "This borrower emits X; the sector average is Y."
- **Risk scoring.** Beyond taxonomy color - transition risk, physical risk indicators.

### Architecture
- **The region.ts types are inherited from jana-demo-starter and not used.** They're there for potential multi-country expansion but currently dead code.
- **No tests.** No unit tests, no integration tests, no e2e tests.
- **No CI/CD.** No GitHub Actions workflow for build/deploy.

---

## Related Project Context

This demo lives in the broader Jana sales ecosystem:

- **Jana API** (`api-test.jana.earth`): The backend serving Climate TRACE, EDGAR, OpenAQ data. Source repo: `~/Projects/repos/Jana`
- **Auth service** (`auth-dev.jana.earth`): Device code OAuth. Part of the Jana platform.
- **Corporate documents** (`~/Projects/repos/corporate-documents`): Sales strategy docs, sector targeting, NRB regulatory cheat sheet, commercial lending analysis
- **Demo starter** (`~/Projects/repos/jana-demo-starter`): The original multi-purpose demo dashboard this was forked from. BFI demo is specialized for banking.

### Key business context for the demo

- Nepal has 20 Class A commercial banks. Two NRB regulations bind them directly (ESRM 2022 and the Green Finance Taxonomy 2024); NFRS S1/S2 is issued by ICAN and is currently in exposure draft (comment period through June 2026). NRB is expected to reference NFRS for bank climate disclosure once ICAN finalises.
- Banks have 80K-100K loans each but 60-70% are retail mortgages - emissions measurement applies to the commercial/industrial slice
- Climate TRACE covers 323 facilities in Nepal (cement, brick, steel, mining) - these are the biggest emitters and biggest loan values
- PCAF data quality: Jana moves banks from Score 5 (outstanding × sector-average intensity) to Score 3 (borrower physical production data × sector emission factor — Option 2b) for their highest-risk exposures. Score 2 requires the borrower to publish GHG-Protocol-conformant emissions, which almost no Nepal SPV does today.
- The demo is designed to show a loan officer exactly how this works loan-by-loan

### Nepal sustainability frameworks (what drives the sale)

Three frameworks shape Nepal bank sustainability compliance — two from NRB, one from ICAN with NRB supervisory oversight:

1. **NRB ESRM (2022, supersedes 2018):** Environmental and Social Risk Management - screen every commercial loan before approval. Adds climate as a sub-category of environmental risk (Q2.5) and the Annex 5b Project Finance Screening Questionnaire.
2. **NRB Green Finance Taxonomy (Oct 2024):** Classify lending as green/amber/red/unclassified. Chapter 3.2.2 requires ESRM to be applied before the taxonomy is used to classify.
3. **NFRS S1 / S2 (ICAN, exposure draft April 2026):** Nepal's IFRS S1/S2-aligned sustainability and climate disclosure standards. Comment period closes 6 June 2026; mandatory application date is a placeholder (`XX XX 202X`) pending ICAN finalisation. Year 1 waives Scope 3 (including financed emissions). NFRS does not cite ESRM, the Taxonomy, or PCAF by name — the ESRM → Taxonomy → NFRS → PCAF chain is Jana editorial framing, not a regulator-mandated crosswalk.

---

## Quick Reference Commands

```bash
# Dev server
npm run dev

# Build
npm run build

# Docker build and run
docker compose up --build

# Type check
npx tsc --noEmit

# Find all source files (excluding node_modules)
find . -not -path './node_modules/*' -not -path './.next/*' -name '*.ts' -o -name '*.tsx' | sort
```
