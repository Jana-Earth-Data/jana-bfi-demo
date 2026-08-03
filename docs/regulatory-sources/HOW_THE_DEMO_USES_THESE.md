# How the demo uses these documents

Source-to-code cross-reference. Every regulatory concept in the demo traces back to a paragraph, table, or annex in one of the PDFs under `docs/regulatory-sources/`. This file exists so an analyst can quickly locate where a specific NRB / NFRS / PCAF / IFC rule lives in the codebase.

Paths are relative to the repo root (`/`). All paths listed here have been verified to exist as of `2026-08-03`.

---

## 1. NRB ESRM Guideline 2022 (Circular 22)

Local: `01-nrb-esrm/nrb-esrm-guideline-2022.pdf`

- **§5 Applicability rules (loan size / sector / tenor bucketing)** → `lib/regulatory/esdd/loan-category-derive.ts`
- **§5 Critical sectors list** → `lib/regulatory/esdd/sector-slug.ts`
- **§7.3 8-step E&S procedure (screen → categorise → ESDD → rate → decide → escalate → monitor → report)** → `components/bfi/esrm/officer-work-queue.tsx`, `components/bfi/esdd/wizard.tsx`
- **§7.3.4 ESRR aggregation rule (Low / Medium / High from a/b/c/d answers, Q2.4 excluded)** → `lib/regulatory/esdd/scoring.ts`
- **§7.3.5 Corrective Action Plans + covenants** → `components/bfi/cap/cap-panel.tsx`, `lib/regulatory/cap/library.ts`, `lib/regulatory/cap/types.ts`, `scripts/supabase-cap.sql`, `app/api/cap/[loanId]/route.ts`
- **§7.3.6 Escalation rule ("one level higher" for Medium/High)** → `components/bfi/esrm/officer-work-queue.tsx`, manager queue at `app/api/manager/queue/route.ts`
- **§7.3.7 Monitoring** → `components/bfi/followups/followups-panel.tsx`, `app/api/followups/route.ts` (backing evidence attachments in `components/bfi/shared/evidence-attachments.tsx` and `app/api/evidence/route.ts`)
- **§7.3.8 Annual NRB reporting** → `lib/reports/nrbsis-green-statement.ts`, `components/bfi/reports/nrbsis-green-statement-button.tsx`, `app/api/reports/nrbsis-green-statement/route.ts`
- **Annex 2 Hydropower — capacity-tier documentation matrix** → `components/bfi/hydro/doc-matrix-panel.tsx`, `scripts/supabase-hydro-docs.sql`, `app/api/hydro/docs/route.ts`
- **Annex 4 Exclusion List** → seeded in `app/api/admin/seed-demo-data/route.ts`; screening surface in `components/bfi/tabs/esrm-tab.tsx`; exclusion narrative in `lib/reports/nrbsis-green-statement.ts` §3.1 outputs
- **Annex 5 ESDD Checklist (13 questions, a/b/c/d schema, guidance notes)** → **verbatim** in `lib/regulatory/esdd/annex5-questions.ts`; wizard is `components/bfi/esdd/wizard.tsx` at route `app/esdd/[loanId]/page.tsx`; capture schema `scripts/supabase-capture-schema.sql`
- **Q2.5 Climate change risks + opportunities (new in 2022)** → `components/bfi/esrm/climate-risk-panel.tsx`, `lib/regulatory/climate/types.ts`, `lib/regulatory/climate/infer.ts`, `scripts/supabase-climate-risk.sql`, `app/api/climate/borrower/[borrowerId]/route.ts`
- **Annex 5b Project Finance E&S Screening Questionnaire (~85 IFC PS-aligned Yes/No items)** → `lib/regulatory/esdd/annex5b-pf-questions.ts` (every question tagged `ifcPS: "PS1".."PS8"`), scoring in `lib/regulatory/esdd/annex5b-pf-scoring.ts`, types in `lib/regulatory/esdd/annex5b-pf-types.ts`; wizard at `components/bfi/pf-screening/wizard.tsx` served from `app/pf-screening/[loanId]/page.tsx`; API in `app/api/pf-screening/**`; DB in `scripts/supabase-pf-screening.sql`
- **Annex 6 Permit matrix by sector** → sector-to-permit lookup lives inside `lib/regulatory/esdd/annex5-questions.ts` guidance and drives permit checks in `components/bfi/tabs/esrm-tab.tsx`
- **Annex 7 E&S Risk Summary** → auto-populated from `lib/regulatory/esdd/scoring.ts` and rendered inside the ESDD wizard summary step
- **Annex 8 CAP template** → `lib/regulatory/cap/library.ts`, `components/bfi/cap/cap-panel.tsx`
- **Annex 9 Covenants library** → `lib/regulatory/cap/library.ts` (covenants alongside CAP items)
- **Annex 10 Monitoring checklist** → `components/bfi/followups/followups-panel.tsx`
- **Annex 11 Annual reporting template to NRB (Sections 1–3)** → `lib/reports/nrbsis-green-statement.ts`

## 2. NRB Green Finance Taxonomy 2024

Local: `02-nrb-taxonomy/nepal-green-finance-taxonomy-2024-v1.pdf`

- **Chapter 2.2 Four Environmental Principles (A/M/N/P)** → `lib/regulatory/taxonomy/activities.ts` (each activity tagged with principles)
- **Chapter 2.3 DNSH conditions (Table 1)** → `lib/regulatory/taxonomy/dnsh.ts`
- **§2.5 ESRM-before-Taxonomy rule** → `components/bfi/taxonomy/gate-screen.tsx` (blocks the Taxonomy wizard until ESRM steps 1–2 are complete)
- **§3.2.2 Colour system + decision tree (Green / Amber / Red)** → `components/bfi/taxonomy/wizard.tsx`, `lib/regulatory/taxonomy/activities.ts`
- **Annex 2 (17-sector, ~94 sub-sector activity catalogue)** → `lib/regulatory/taxonomy/activities.ts`, with the sector index rendered by `components/bfi/tabs/taxonomy-tab.tsx`
- **Annex 3 Investment Proposal Assessment checklist** → wizard flow in `components/bfi/taxonomy/wizard.tsx`
- **Annex 4b SIS reporting format** → `lib/reports/nrb-taxonomy-export.ts`, `components/bfi/reports/nrb-taxonomy-export-button.tsx`, `app/api/reports/nrb-taxonomy/route.ts`
- **§7.1 Hydropower Green threshold (life-cycle GHG < 100 gCO₂e/kWh; power density > 5 W/m² or run-of-river)** → hydropower classification logic inside `lib/regulatory/taxonomy/activities.ts`

## 3. NFRS S1 & S2 (ASB Nepal / ICAN, April 2026 exposure drafts)

Local: `03-nfrs-icann/nfrs-s1-exposure-draft-2026.pdf` and `nfrs-s2-exposure-draft-2026.pdf` (both TBD — see README retrieval note)

- **NFRS S1 §§25–53 four-pillar structure (Governance / Strategy / Risk / Metrics + Targets)** → framing of `components/bfi/tabs/nfrs-tab.tsx`
- **NFRS S1 §72 Statement of Compliance** → NFRS tab preview section
- **NFRS S1 §70 Comparatives** → NFRS tab preview annotations
- **NFRS S2 §22 Scenario analysis (annual resilience assessment)** → NFRS tab narrative
- **NFRS S2 §29(a) Absolute gross Scope 1/2/3** → `lib/regulatory/pcaf/scoring.ts`, `components/bfi/pcaf/pcaf-wizard.tsx`, dashboard totals in `components/bfi/dashboard.tsx`
- **NFRS S2 §29(a)(ii) GHG Protocol Corporate Standard 2004 mandate** → `lib/regulatory/pcaf/types.ts` (methodology metadata)
- **NFRS S2 §29(a)(vi) + §§B58–B63 Financed emissions matrix (industry GICS × asset class × scope) for commercial banks** → `components/bfi/tabs/nfrs-tab.tsx`, `lib/data/portfolio.ts`
- **NFRS S2 §B62(a) Asset-class mandatory minimum (loans / project finance / bonds / equity / undrawn commitments)** → `lib/regulatory/pcaf/types.ts` (asset-class enum), `components/bfi/pcaf/pcaf-wizard.tsx`
- **NFRS S2 §B62(c) Coverage percentage disclosure** → NFRS tab preview coverage annotation
- **NFRS S2 §B62(d) Attribution methodology disclosure** → `lib/regulatory/pcaf/scoring.ts` (attribution factor computation + methodology metadata)
- **NFRS S2 §§B55–B56 Data quality / verification disclosure** → PCAF DQS surfaced in `components/bfi/pcaf/pcaf-wizard.tsx`, `components/bfi/pcaf/availability-panel.tsx`, and the NFRS tab

## 4. PCAF Global GHG Standard — Part A (3rd Edition, Dec 2025)

Local: `04-pcaf/pcaf-part-a-3rd-edition-2025.pdf`

- **§4 Attribution formula (Attribution × Emissions; denominator per asset class)** → `lib/regulatory/pcaf/scoring.ts`
- **§4.2 Denominator per asset class (EVIC for listed; equity+debt for private; project cost for PF; property value for CRE/mortgages)** → `lib/regulatory/pcaf/scoring.ts`, `lib/regulatory/pcaf/types.ts`
- **§5.1 Listed equity + corporate bonds** → asset-class enum in `lib/regulatory/pcaf/types.ts`
- **§5.2 Business Loans & Unlisted Equity option ladder (1a/1b/2a/2b/3a/3b/3c → Score 1..5)** → `lib/regulatory/pcaf/scoring.ts`, exposed via `app/api/pcaf/scores/route.ts` and `components/bfi/pcaf/pcaf-wizard.tsx`
- **§5.3 Project Finance** → same scoring engine; project-cost denominator branch in `lib/regulatory/pcaf/scoring.ts`
- **§5.4–5.6 CRE, Mortgages, Motor Vehicle Loans** → asset-class enum in `lib/regulatory/pcaf/types.ts`
- **§5.9 Sovereign debt** → asset-class enum only (not scored in the demo)
- **§4.4 Weighted DQS + disclosure obligations** → `components/bfi/pcaf/availability-panel.tsx` (per-loan DQS), `components/bfi/tabs/nfrs-tab.tsx` (portfolio weighted DQS)
- **§6.2 Optional undrawn-commitment reporting (new in 3rd edition)** → `lib/data/portfolio.ts`
- **Emission-factor conventions per sector (implicit in §5)** → seed data in `app/api/admin/seed-demo-data/route.ts` and `lib/mock/bfi-data.ts`

Supporting docs used to reconcile ambiguity:

- **CDP × PCAF (`cdp-pcaf-data-quality-importance-2023.pdf`)** — score-mapping cross-check for `lib/regulatory/pcaf/scoring.ts`
- **CDFI process documentation (`pcaf-cdfi-process-documentation-2022.pdf`)** — verbatim reproduction of the 2nd-edition Annex option tables; primary reference for scoring branches whose 3rd-edition PDF didn't extract cleanly
- **PCAF Disclosure Checklist Part A (`pcaf-disclosure-checklist-part-a-may-2025.pdf`)** — column-set reference for the NFRS tab preview
- **NMB Bank 2022 disclosure (`nmb-bank-carbon-disclosure-2022.pdf`)** — Nepal reference implementation; drives the "what a real Nepali bank disclosure looks like" narrative

## 5. IFC Performance Standards (2012)

Local: `05-ifc-performance-standards/ifc-performance-standards-handbook-2012-en.pdf` (TBD retrieval)

- **PS1–PS8 paragraph-level references** → every question in `lib/regulatory/esdd/annex5b-pf-questions.ts` carries an `ifcPS: "PS1".."PS8"` tag, e.g.:
  - "IFC PS1 §5, §7-8, §17, §25-26, §27, §31, §35" — Assessment & Management, stakeholder engagement, grievance
  - "IFC PS2 §8, §14-15, §16, §17, §20, §21-22" — Labour, migrant workers, freedom of association, retrenchment, worker grievance, child/forced labour
  - "IFC PS3 …" — Resource efficiency & pollution prevention
  - "IFC PS4 …" — Community H&S
  - "IFC PS5 …" — Land acquisition & involuntary resettlement
  - "IFC PS6 …" — Biodiversity
  - "IFC PS7 …" — Indigenous Peoples
  - "IFC PS8 …" — Cultural heritage
- Rendered in `components/bfi/pf-screening/wizard.tsx` at route `app/pf-screening/[loanId]/page.tsx`; scoring in `lib/regulatory/esdd/annex5b-pf-scoring.ts`

## 6. IFC EHS Guidelines

Local: `06-ifc-ehs-guidelines/*.pdf` and `.html`

- **Hydropower GPN (`hydropower-gpn-2018.pdf`)** → backs hydropower sector questions and `components/bfi/hydro/doc-matrix-panel.tsx`
- **Cement & Lime Manufacturing (`cement-and-lime-manufacturing-2022.pdf`)** → cement supplement questions (C.1–C.3) inside `lib/regulatory/esdd/annex5-questions.ts` (or its successor sector-supplement file if renamed per `research/02-circular-22-authoritative.md` §5.5)
- **Integrated Steel Mills / Foundries (`integrated-steel-mills-2007.pdf`, `foundries-2007.pdf`)** → steel supplement questions (S.1–S.3)
- **Textile Manufacturing (hub HTML)** → textile supplement questions (T.1–T.3)
- **Chemicals (hub HTML)** → chemicals supplement questions (Ch.1–Ch.3); analyst must pick correct sub-sector guideline per borrower
- **Annual + Perennial Crop Production (`annual-crop-production-2016.pdf`, `perennial-crop-production-2016.pdf`)** → agriculture supplement questions (A.1–A.4)
- **General EHS Guidelines (hub HTML)** → composite anchor for brick sector (no dedicated brick guideline) together with the MinErgy/ICIMOD Nepal Brick Policy Framework in `08-sector-context/`

Note: `research/02-circular-22-authoritative.md` §5.5 flags that the sector supplements are Jana-authored (not verbatim NRB), anchored to IFC EHS. If they have been renamed since (e.g. `JANA_SECTOR_SUPPLEMENTS` per the recommendation), grep for `hydro.H\.`, `cement.C\.`, `textile.T\.`, `steel.S\.`, `chem.Ch\.`, `brick.B\.`, `agri.A\.` under `lib/regulatory/esdd/` to relocate them.

## 7. Nepal legislation

Local: `07-nepal-legislation/`

- **MoFE Hydropower EIA Manual 2018 (`mofe-hydropower-eia-manual-2018.pdf`)** → practitioner reference behind `components/bfi/hydro/doc-matrix-panel.tsx` and the Annex 2 hydropower supplement
- **EPR 2020 (`nepal-epr-2020.pdf`, TBD)** → drives the EIA / IEE / BES threshold logic in the ESDD wizard (referenced in `lib/regulatory/esdd/annex5-questions.ts` guidance notes)

## 8. Sector context

Local: `08-sector-context/`

- **Nepal Brick Sector Policy Framework 2017 (`nepal-brick-sector-policy-framework-2017.pdf`)** → Nepal-specific context for brick supplement questions (kiln type, seasonal migrant labour, child labour risk, Kathmandu Valley air-quality) alongside IFC General EHS Guidelines

## 9. NBA industry publications

Local: `09-nba-industry/`

- **NBA ESRM Implementation Handbook (Feb 2026, PDF TBD)** — not currently ingested. If a copy is obtained and it contains sector-specific Q&A, revisit the sector-supplement design in `lib/regulatory/esdd/` (currently anchored to IFC EHS per §5 of `research/05-nepal-sector-esrm-hunt.md`).
- **NBA press release (`nba-esrm-handbook-press-release.html`)** — provenance only
- **NBA Climate Transition Maturity report announcement** — narrative color for `components/bfi/tabs/nfrs-tab.tsx`

## 10. Secondary references

Local: `10-secondary-references/`

Not load-bearing for code — background material for orientation and stakeholder framing.

- **SBFN Nepal country page** — external confirmation of NRB SBFN membership (referenced in the ESRM Guideline foundations)
- **Green Finance Platform Nepal ESRM entry** — external policy-database record
- **AFI Nepal GFT announcement** — third-party endorsement of the 2024 taxonomy
- **IIN ESG Landscape Analysis Report 2024** — Nepal-market orientation
- **Cadmus articles** — climate-transition narrative
- **MyRepublica ESRM opinion** — industry-press summary

---

## Reverse index — where a code file gets its authority from

Handy when you're touching a file and need to know which PDFs to have open on the other monitor.

| Code path | Primary source(s) |
|---|---|
| `lib/regulatory/esdd/annex5-questions.ts` | NRB ESRM 2022 §Annex 5 (verbatim) + §7.3.4 ESRR rule |
| `lib/regulatory/esdd/annex5b-pf-questions.ts` | NRB ESRM 2022 §Annex 5b + IFC PS1–PS8 (2012) |
| `lib/regulatory/esdd/annex5b-pf-scoring.ts` | NRB ESRM 2022 §Annex 5b scoring conventions |
| `lib/regulatory/esdd/loan-category-derive.ts` | NRB ESRM 2022 §5 (applicability) |
| `lib/regulatory/esdd/scoring.ts` | NRB Circular 22 Excel `ESRR_criteria` sheet |
| `lib/regulatory/esdd/sector-slug.ts` | NRB ESRM 2022 §5 critical-sector list |
| `lib/regulatory/taxonomy/activities.ts` | NRB Green Finance Taxonomy 2024 Annex 2 (17-sector, ~94 sub-sector) |
| `lib/regulatory/taxonomy/dnsh.ts` | NRB Green Finance Taxonomy 2024 §2.3 Table 1 |
| `lib/regulatory/climate/*` | NRB ESRM 2022 pre-Annex 2 climate chapter + Q2.5 |
| `lib/regulatory/cap/*` | NRB ESRM 2022 Annexes 8 + 9 |
| `lib/regulatory/pcaf/scoring.ts` | PCAF Part A 3rd Ed §4 + §5.2 + §5.3 |
| `lib/regulatory/pcaf/types.ts` | PCAF Part A 3rd Ed §5.1–5.10 (asset-class enum) |
| `lib/reports/nrbsis-green-statement.ts` | NRB ESRM 2022 Annex 11 |
| `lib/reports/nrb-taxonomy-export.ts` | NRB Green Finance Taxonomy 2024 Annex 4b |
| `components/bfi/esdd/wizard.tsx` | NRB ESRM 2022 §7.3 + Annex 5 |
| `components/bfi/pf-screening/wizard.tsx` | NRB ESRM 2022 §Annex 5b + IFC PS 2012 |
| `components/bfi/pcaf/pcaf-wizard.tsx` | PCAF Part A 3rd Ed §5.2 / §5.3 + NFRS S2 §B62 |
| `components/bfi/pcaf/availability-panel.tsx` | PCAF Part A 3rd Ed §4.4 + NFRS S2 §§B55–B56 |
| `components/bfi/taxonomy/wizard.tsx` | NRB Green Finance Taxonomy 2024 Chapters 2–3 + Annex 3 |
| `components/bfi/tabs/nfrs-tab.tsx` | NFRS S1 §§25–53 + NFRS S2 §29 + §§B58–B63 |
| `components/bfi/tabs/esrm-tab.tsx` | NRB ESRM 2022 §7 + Annex 4 |
| `components/bfi/tabs/taxonomy-tab.tsx` | NRB Green Finance Taxonomy 2024 Annex 2 |
| `components/bfi/cap/cap-panel.tsx` | NRB ESRM 2022 §7.3.5 + Annexes 8 + 9 |
| `components/bfi/hydro/doc-matrix-panel.tsx` | NRB ESRM 2022 Annex 2 + MoFE Hydropower EIA Manual 2018 |
| `components/bfi/esrm/climate-risk-panel.tsx` | NRB ESRM 2022 Q2.5 + pre-Annex 2 climate chapter |
| `components/bfi/esrm/officer-work-queue.tsx` | NRB ESRM 2022 §7.3.6 escalation |
| `components/bfi/followups/followups-panel.tsx` | NRB ESRM 2022 §7.3.7 + Annex 10 |
| `scripts/supabase-cap.sql` | NRB ESRM 2022 Annexes 8 + 9 |
| `scripts/supabase-climate-risk.sql` | NRB ESRM 2022 climate chapter + Q2.5 |
| `scripts/supabase-hydro-docs.sql` | NRB ESRM 2022 Annex 2 |
| `scripts/supabase-pf-screening.sql` | NRB ESRM 2022 Annex 5b |
| `scripts/supabase-capture-schema.sql` | NRB ESRM 2022 Annex 5 |
