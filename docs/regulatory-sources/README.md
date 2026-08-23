# Regulatory Source Pack — Jana BFI Demo

This folder is the **source-document library** behind the Jana Nepal BFI demo. Everything the demo cites — every ESDD question, every taxonomy criterion, every disclosure column, every P-CAF option — traces back to one of the PDFs listed here.

## Current status (updated 2026-08-03)

**41 files collected, ~51 MB total.** `./download.sh` completed with most sources fetched successfully.

| Folder | Contents on disk | Missing |
|---|---|---|
| `01-nrb-esrm/` | NRB Guideline 2022 (with-cover + without-cover copies), Circular 22 attachment landing page + checklist landing page (HTML), Circular 22 ESDD Checklist (Excel), NRB Guideline 2018 (historical) | — |
| `02-nrb-taxonomy/` | Oct 2024 V1 (2 copies from different URLs) | — |
| `03-nfrs-icann/` | NFRS S1 + S2 exposure drafts (April 2026) | — |
| `04-pcaf/` | Part A 3rd Ed (2025) + 2nd Ed (2022) + Exec Summary + Disclosure Checklist (May 2025) + CDP × PCAF data quality (2023) + CDFI process guide (2022) + NMB Bank Nepal disclosure (2022) | — |
| `05-ifc-performance-standards/` | *(empty)* | **IFC PS 1-8 (2012) — manual download from `https://www.ifc.org/en/sustainability/ifc-performance-standards`** |
| `06-ifc-ehs-guidelines/` | Cement & Lime (2022), Hydropower GPN (2018), Integrated Steel Mills (2007), Foundries (2007), Annual + Perennial Crop (2016), plus 4 HTML hub captures (General, Chemicals, Textile, alt) | Chemicals + Textile sector PDFs (behind IFC Connect login) |
| `07-nepal-legislation/` | Lawsagar EPR explainer (HTML) | **EPR 2020 Gazette PDF (moljpa.gov.np) + MoFE Hydropower EIA Manual 2018** |
| `08-sector-context/` | MinErgy / ICIMOD Brick Sector Policy Framework (2017) | — |
| `09-nba-industry/` | NBA press release + publications index + climate transition report (HTML) | **NBA ESRM Implementation Handbook (Feb 2026) — no direct URL; request from Laxmi Sunrise ESRM team or `nba@nepalbankers.com.np`** |
| `10-secondary-references/` | ESRM + Green Finance Taxonomy Origins essays, Global Climate Disclosure Cheat Sheet, ISSB IFRS Adoption Map, IIN ESG Landscape 2024, + 4 HTML captures (AFI, Cadmus × 2, SBFN) | — |

**Three items still need manual retrieval** (all called out above in bold): IFC Performance Standards 2012, Nepal EPR 2020 + MoFE EIA Manual, NBA ESRM Handbook.

`./download.sh` skips files that are already on disk, so it's safe to re-run.

---

## Tiering

Not every PDF in this pack carries the same weight. Each manifest entry below is tagged with one of three tiers so a new analyst can see, at a glance, which documents actually drive the code vs. which are background context.

- **LOAD-BEARING** — code cites this document directly. If you want to understand *any* implementation question (a specific ESDD question, a taxonomy criterion, a PCAF option, a disclosure column), you must read the load-bearing source. **~7 files.** These are the non-negotiable reads.

- **REFERENCE** — the research pack corroborates from this document but no application code cites it directly. Read when you need to defend a design decision, cross-check wording, or dig deeper on the methodology. **~15 files.** Common examples: earlier PCAF editions, sector EHS Guidelines that inform the research but were removed from the wizard per Circular 22 verbatim conformance.

- **CONTEXT** — background reading. Industry commentary, historical editions superseded by newer ones, adoption trackers, third-party explainers, HTML captures of source pages. Read for orientation, customer conversations, and general framing — not needed to touch the code. **~20 files.**

The tier appears on a `- **Tier:**` line inside every manifest entry below.

---

## Who this is for

An analyst who has just joined the Jana BFI demo project and needs to understand *why* the app screens loans a certain way, *what regulatory basis* every wizard question has, and *where to look* when a customer disputes a specific rule.

If you are a developer touching regulatory code (`lib/regulatory/**`, `components/bfi/**`, `lib/reports/**`), the companion file `HOW_THE_DEMO_USES_THESE.md` maps each source directly to the app surface it powers.

---

## Suggested reading order (approx. 2–3 working days)

### Quick priority guide

> **If you have 4 hours:** read the LOAD-BEARING files in order (they layer cleanly from ESRM foundations up through PCAF scoring). Skip everything else.
>
> **If you have 2 days:** LOAD-BEARING + REFERENCE. You'll have full context on every design decision.
>
> **If you're onboarding at a slower pace:** work through the full pack; CONTEXT files are excellent for team-wide framing and customer conversations.

The Nepal BFI stack layers cleanly from Nepal-specific ESRM foundations up to international disclosure standards. Read in this order:

1. **NRB ESRM Guideline 2022** (`01-nrb-esrm/`) — the foundation. Everything the app calls "ESRM" traces back to this 70-page guideline: exclusion list, small/term/project categorisation, Annex 5 ESDD checklist, Annex 5b PF screening, corrective action plans, covenants, monitoring, annual NRB reporting. Read the whole thing, but pay closest attention to §5 (applicability rules), §7 (the 8-step procedure), and Annexes 4, 5, 5b, 7, 8, 9, 10, 11.
2. **NRB Green Finance Taxonomy 2024** (`02-nrb-taxonomy/`) — the classification wedge. This is the second binding NRB regulation the demo implements. It sits *on top of* ESRM: §3.2.2 requires banks to run ESRM Steps 1 and 2 *first*, then apply the taxonomy. Read Chapter 2 (four Environmental Principles + DNSH), Chapter 3 (Green/Amber/Red decision tree), and Annex 2 for the 17-sector activity catalogue.
3. **NFRS S1 & S2 Exposure Drafts** (`03-nfrs-icann/`) — the disclosure wedge. Nepal's IFRS-baseline sustainability reporting standards (ASB Nepal, April 2026, comment period closed June 2026, mandatory date TBD). Read S1 §§25–53 (governance / strategy / risk / metrics) and S2 §29(a)(vi) + §§B58–B63 (financed emissions for commercial banks).
4. **PCAF Global GHG Standard — Part A 3rd Edition** (`04-pcaf/`) — the scoring methodology. The industry-standard way to satisfy NFRS S2 §B62(d) attribution and §§B55–B56 data quality. Read §§3–4 (universal principles + attribution formula), then §5.2 (Business Loans) and §5.3 (Project Finance) — those are the two asset classes that drive the demo's cement and hydropower PCAF scores.
5. **IFC Performance Standards + EHS Guidelines** (`05-ifc-performance-standards/`, `06-ifc-ehs-guidelines/`) — the deep reference for project finance loans. NRB §6 explicitly names IFC PS as "good practice"; the demo's Annex 5b PF screening (148 items across 8 areas) maps 1:1 to PS1–PS8. When a project-finance question in the wizard cites "IFC PS3 §12", these are the PDFs to open.
6. **Nepal legislation** (`07-nepal-legislation/`) — statutory backstop. EPR 2020 defines EIA/IEE thresholds; the MoFE Hydropower EIA Manual is the practitioner reference the NRB Annex 2 hydropower supplement points to.
7. **Sector context** (`08-sector-context/`, `09-nba-industry/`, `10-secondary-references/`) — read on demand when a specific sector question comes up.

---

## How the demo cross-references these documents

- The **ESDD wizard** at `/esdd/[loanId]` walks the officer through Annex 5 verbatim. Every question in `lib/regulatory/esdd/annex5-questions.ts` is a direct transcription of a numbered question in the NRB 2022 Annex 5 (source: `01-nrb-esrm/nrb-esrm-guideline-2022.pdf`).
- The **PF screening wizard** at `/pf-screening/[loanId]` implements Annex 5b (`lib/regulatory/esdd/annex5b-pf-questions.ts`). Each question carries an `ifcPS: "PS1".."PS8"` tag pointing at the IFC Performance Standard whose paragraph the question comes from.
- The **CAP panel** (`components/bfi/cap/cap-panel.tsx`, backed by `scripts/supabase-cap.sql`) implements NRB §7.3.5 corrective action plans + Annex 8 template.
- The **Green Finance Statement export** (`lib/reports/nrbsis-green-statement.ts`) generates the Annex 11 annual report to NRB.
- The **NRB Taxonomy export** (`lib/reports/nrb-taxonomy-export.ts`) reports Green/Amber/Red loan flows using the Annex 4b SIS reporting format.
- The **PCAF scoring engine** (`lib/regulatory/pcaf/scoring.ts`) implements the 1–5 option ladder from PCAF Part A §4 + §5.2 + §5.3.
- The **NFRS tab** (`components/bfi/tabs/nfrs-tab.tsx`) previews the financed-emissions matrix required by NFRS S2 §B62(a).
- The **Climate risk panel** (`components/bfi/esrm/climate-risk-panel.tsx`) implements Q2.5 added by the 2022 ESRM update.

See `HOW_THE_DEMO_USES_THESE.md` for the exhaustive source-to-code mapping.

---

## Retrieval

Run:

```bash
cd docs/regulatory-sources
./download.sh          # fetches every PDF into the right subfolder
./download.sh --dry-run # prints what would be fetched without doing it
```

Some documents cannot be auto-fetched:

- **NBA ESRM Implementation Handbook (Feb 2026)** — no direct PDF URL. Request from the Laxmi Sunrise ESRM team, or email `nba@nepalbankers.com.np`. See `09-nba-industry/` notes below.
- **NFRS S1 / S2 exposure drafts (ASB Nepal, April 2026)** — the research pack cites content verbatim but does not include stable ASB Nepal PDF URLs. The ASB Nepal notices page (`https://asbnepal.gov.np/`) is the entry point; the downloader will attempt a best-guess but will likely fail. Fall back to requesting the PDFs directly from ASB Nepal or ICAN.
- **IFC Performance Standards 1–8 (2012 English)** — the research references PS1–PS8 by paragraph but does not provide a stable direct download URL. The downloader includes a placeholder pointing at the IFC handbook landing page; if it fails, the definitive copies are available via `www.ifc.org` search for "Performance Standards Handbook".
- **IFC EHS Textiles / Chemicals sub-sectors** — some sector guidelines are behind IFC's "Connect" content system and require login before the direct PDF URL resolves. If the downloader fails on those, use the general hub link and browse manually.

Any file that fails to download is listed at the end of the `download.sh` run so you know what needs manual retrieval.

---

## Manifest

The entries below describe every source cited by the demo. Each shows publisher, date, page count (where known), the canonical URL used by `download.sh`, the local filename the downloader writes to, and a short note on how the demo uses the document.

---

### Category 01 — NRB ESRM

The single most important folder in this pack. Everything the demo calls "ESRM" — the wizards, the CAP panel, the monitoring report, the annual NRB submission — comes from here.

#### NRB Guideline on Environmental & Social Risk Management for Banks and Financial Institutions (2022 edition)

- **Publisher / issuer:** Nepal Rastra Bank, Banks and Financial Institutions Regulation Department
- **Tier:** LOAD-BEARING — every ESDD wizard question and the entire CAP/monitoring/annual-report stack cites this guideline directly. Non-negotiable.
- **Date:** February 2022 (supersedes May 2018 edition)
- **Pages:** 70 (A4)
- **URL:** https://www.nrb.org.np/contents/uploads/2022/02/Final-ESRM-with-cover.pdf
- **Local filename:** `01-nrb-esrm/nrb-esrm-guideline-2022.pdf`
- **How the demo uses it:** Foundational. §5 drives the ESDD-category derivation in `lib/regulatory/esdd/loan-category-derive.ts`; §7.3 drives the 8-step officer workflow; Annex 4 drives the exclusion-list check; Annex 5 is transcribed verbatim into `lib/regulatory/esdd/annex5-questions.ts`; Annex 5b drives `lib/regulatory/esdd/annex5b-pf-questions.ts`; Annex 8/9 back the CAP panel; Annex 11 drives the annual NRB report export.
- **Naming note:** The load-bearing on-disk copy is `NRB_ESRM_Guideline_2022_Feb.pdf` (~2.2 MB). A second copy exists at `nrb-esrm-guideline-2022.pdf` (~2.8 MB — same document, different scan). See the redundant-copy entry immediately below.

#### NRB ESRM Guideline 2022 — redundant with-cover copy

- **Publisher / issuer:** Nepal Rastra Bank
- **Tier:** REFERENCE — identical content to the load-bearing entry above; kept only because two copies were downloaded into the folder. Do not cite this filename in new code — cite the load-bearing filename instead.
- **Local filename:** `01-nrb-esrm/nrb-esrm-guideline-2022.pdf`
- **How the demo uses it:** Not used. Retained until we prune duplicates.

#### NRB Guideline on ESRM (2018 edition, predecessor)

- **Publisher / issuer:** Nepal Rastra Bank
- **Tier:** CONTEXT — superseded by the 2022 Second Edition. Retain for historical diff only; do not cite as the source of any current demo rule. On disk as `NRB_ESRM_Guideline_2018_ORIGINAL_Circular22_Attachment.pdf`.
- **Date:** May 2018 (superseded by 2022 edition)
- **Pages:** 66
- **URL:** https://www.nrb.org.np/contents/uploads/2018/05/Environment-Social-Risk-Management-Guidelines-2018.pdf
- **Local filename:** `01-nrb-esrm/nrb-esrm-guideline-2018.pdf`
- **How the demo uses it:** Reference only. Cited from `components/bfi/tabs/esrm-tab.tsx` (legacy link) and used in `research/01-esrm-2022-breakdown.md` for the 2018→2022 diff. Retain it so analysts can see what changed (climate chapter, Annex 5b PF questionnaire, Q2.5, EPR 2020 references).

#### NRB Circular 22 (Directive 22, FY 2074/75) — attachment page (HTML)

- **Publisher / issuer:** Nepal Rastra Bank
- **Tier:** CONTEXT — provenance HTML capture confirming the circular's binding authority; no rule text extracted from it.
- **Date:** 2017–2018 issuance; still operative
- **URL:** https://www.nrb.org.np/bfr/circular_22-attachment_to_guideline_on_environmental__social_risk_management_for_banks_and_financial_institutions_related/
- **Local filename:** `01-nrb-esrm/circular-22-attachment-page.html`
- **How the demo uses it:** Anchor URL for provenance. This is the NRB circular that binds the ESRM Guideline on all Class A/B/C BFIs. It attaches the guideline PDF plus the interactive Excel ESDD checklist.

#### NRB Circular 22 — checklist page (HTML)

- **Publisher / issuer:** Nepal Rastra Bank
- **Tier:** CONTEXT — provenance HTML for the Excel checklist download page. The Excel itself is the load-bearing artifact (see next entry).
- **URL:** https://www.nrb.org.np/bfr/circular-22-checklist-to-guideline-on-environmental-social-risk-management-for-banks-and-financial-institutions-related/
- **Local filename:** `01-nrb-esrm/circular-22-checklist-page.html`
- **How the demo uses it:** Provenance for the interactive Excel ESDD tool that supplements the printed Annex 5. Notes in `research/02-circular-22-authoritative.md` reconcile the Excel vs. PDF wording (e.g. "eco-sensitive" vs "sensitive"; ESRR aggregation rule).

#### NRB Circular 22 ESDD Checklist (interactive Excel)

- **Publisher / issuer:** Nepal Rastra Bank
- **Tier:** LOAD-BEARING — the Excel is the interactive tool NRB distributes and is the canonical wording source. `lib/regulatory/esdd/annex5-questions.ts` cites its cells verbatim (`Tempor!A1:A4` for loan categories; `C20`, `C21`, `C22`, etc. for Annex 5 questions). Where the Excel and PDF diverge, the Excel wins.
- **Date:** Distributed with Circular 22 (FY 2074/75); still operative
- **URL:** Linked from the checklist HTML page above
- **Local filename:** `01-nrb-esrm/NRB_Circular_22_ESDD_Checklist.xls`
- **How the demo uses it:** Primary source for `lib/regulatory/esdd/annex5-questions.ts` and `lib/regulatory/esdd/scoring.ts` (ESRR_criteria sheet). Cross-checked verbatim in `research/02-circular-22-authoritative.md`.

---

### Category 02 — NRB Green Finance Taxonomy

Second binding NRB regulation the demo implements. Runs after ESRM steps 1–2, classifies activities as Green / Amber / Red.

#### Nepal Green Finance Taxonomy 2024 (V1)

- **Publisher / issuer:** Nepal Rastra Bank, BFIR Department (with AFI and OPM technical assistance; peer review by BSP and BNM)
- **Tier:** LOAD-BEARING — Annex 2 activity catalogue is transcribed verbatim into `lib/regulatory/taxonomy/activities.ts`; Chapter 2 Table 1 drives `lib/regulatory/taxonomy/dnsh.ts`. On disk as `NRB_Green_Finance_Taxonomy_Oct2024_V1.pdf`.
- **Date:** October 2024 (finalized Dec 2023; released for consultation Jan 2024)
- **Pages:** 152
- **URL:** https://www.nrb.org.np/contents/uploads/2024/10/Nepal-Green-Finance-Taxonomy-2024-V1.pdf
- **Local filename:** `02-nrb-taxonomy/nepal-green-finance-taxonomy-2024-v1.pdf`
- **How the demo uses it:** Drives the Taxonomy wizard at `/taxonomy/[loanId]`. Annex 2 activity catalogue is transcribed into `lib/regulatory/taxonomy/activities.ts` (94 sub-sectors under 17 SIS-aligned sectors). Chapter 2 Table 1 DNSH conditions and Table 3 colour system drive `lib/regulatory/taxonomy/dnsh.ts` and `components/bfi/taxonomy/wizard.tsx`. Annex 4b reporting format drives `lib/reports/nrb-taxonomy-export.ts` (Supervisory Information System green-loan submission).

#### Nepal Green Finance Taxonomy 2024 — alt URL

- **Publisher / issuer:** Nepal Rastra Bank
- **Tier:** REFERENCE — same document as the V1 above, kept as a backup copy in case the primary NRB CDN path 404s.
- **URL:** https://www.nrb.org.np/contents/uploads/2024/10/Nepal-Green-Finance-Taxonomy-2024.pdf
- **Local filename:** `02-nrb-taxonomy/nepal-green-finance-taxonomy-2024-alt.pdf`
- **How the demo uses it:** Same document, different NRB CDN path. Kept as backup in case the V1 URL 404s.

---

### Category 03 — NFRS S1 & S2 (ICAN / ASB Nepal)

Sustainability disclosure standards. Alignment layer between NRB ESRM output and international IFRS S1/S2.

#### NFRS S1 Exposure Draft — General Requirements for Disclosure of Sustainability-related Financial Information

- **Publisher / issuer:** Accounting Standards Board Nepal (ASB Nepal / ICAN)
- **Tier:** LOAD-BEARING — the demo's disclosure narrative (governance / strategy / risk / metrics) is built on S1 §§25–53. `components/bfi/tabs/nfrs-tab.tsx` cites S1 statement-of-compliance and comparatives rules directly. On disk as `NFRS_S1_ExposureDraft_April2026.pdf`.
- **Date:** April 2026 (exposure draft; public comment closed 6 June 2026; mandatory effective date TBD as of research date)
- **Pages:** 44 (paragraphs 1–86 + Appendices A–E)
- **URL:** TBD — no stable PDF URL captured in research. Start at ASB Nepal notices page: https://asbnepal.gov.np/
- **Local filename:** `03-nfrs-icann/nfrs-s1-exposure-draft-2026.pdf`
- **How the demo uses it:** Frames the demo's disclosure narrative — governance, strategy, risk, metrics-and-targets structure. The demo cites S1 §72 statement-of-compliance and §70 comparatives rules.
- **Retrieval:** Downloader will attempt best-guess URLs on `asbnepal.gov.np`; if they fail, request from ASB Nepal secretariat (`secretariat@asbnepal.gov.np`) or ICAN library.

#### NFRS S2 Exposure Draft — Climate-related Disclosures

- **Publisher / issuer:** Accounting Standards Board Nepal (ASB Nepal / ICAN)
- **Tier:** LOAD-BEARING — §29(a)(vi) + §§B58–B63 drive the NFRS tab's industry × asset-class × scope financed-emissions matrix. Cited in `components/bfi/tabs/nfrs-tab.tsx` and in `lib/regulatory/pcaf/*`. On disk as `NFRS_S2_ExposureDraft_April2026.pdf`.
- **Date:** April 2026 (exposure draft; same comment window as S1)
- **Pages:** 43 (paragraphs 1–37 + Appendices A–C)
- **URL:** TBD — same situation as S1. Start at https://asbnepal.gov.np/
- **Local filename:** `03-nfrs-icann/nfrs-s2-exposure-draft-2026.pdf`
- **How the demo uses it:** The load-bearing disclosure standard for the PCAF wedge. §29(a)(vi) + §§B58–B63 (commercial banking financed emissions) drive the NFRS tab's industry × asset-class × scope matrix. §29(a)(ii) mandates GHG Protocol Corporate Standard (2004) as the measurement method. §22 scenario analysis and §14 transition plan inform the "climate resilience" narrative.
- **Retrieval:** Same as S1 — try ASB Nepal notices page first; if unavailable, request from `secretariat@asbnepal.gov.np`.

---

### Category 04 — PCAF (Global GHG Accounting for the Financial Industry)

The methodology stack underneath the Jana PCAF scoring engine and the NFRS S2 financed-emissions matrix.

#### PCAF Global GHG Standard — Part A: Financed Emissions (3rd Edition)

- **Publisher / issuer:** Partnership for Carbon Accounting Financials (PCAF), secretariat operated by Guidehouse
- **Tier:** LOAD-BEARING — `lib/regulatory/pcaf/scoring.ts` cites "PCAF Part A 3rd Edition §5.2 · Option 2b" (and similar) verbatim for every scored option. §5.2 (Business Loans) and §5.3 (Project Finance) drive cement and hydropower scoring.
- **Date:** December 2025 (PDF stamped 15 January 2026)
- **URL:** https://carbonaccountingfinancials.com/files/standard-launch-2025/PCAF-PartA-2025-V3-15012026.pdf
- **Local filename:** `04-pcaf/pcaf-part-a-3rd-edition-2025.pdf`
- **How the demo uses it:** Primary methodology reference for `lib/regulatory/pcaf/scoring.ts` and `components/bfi/pcaf/pcaf-wizard.tsx`. §5.2 (Business Loans) drives cement/manufacturing scoring; §5.3 (Project Finance) drives hydropower scoring; §4 (attribution) drives the outstanding-over-EVIC and outstanding-over-project-capital formulas.

#### PCAF Part A — Executive Summary (3rd Edition)

- **Publisher / issuer:** PCAF
- **Tier:** REFERENCE — short-form companion to the full 3rd Edition. Not cited in code; useful for customer briefings and 2nd→3rd edition diff.
- **Date:** December 2025
- **URL:** https://carbonaccountingfinancials.com/files/standard-launch-2025/PCAF-PartA-2025-Executive-Summary-Clean.pdf
- **Local filename:** `04-pcaf/pcaf-part-a-3rd-edition-executive-summary.pdf`
- **How the demo uses it:** Short-form reference for what changed from 2nd → 3rd edition (four new asset classes; optional undrawn-commitment reporting per IFRS S1/S2; fluctuation-analysis recommendation). Use this when briefing a customer who does not want to read 400 pages.

#### PCAF Global GHG Standard — Part A: Financed Emissions (2nd Edition)

- **Publisher / issuer:** PCAF
- **Tier:** REFERENCE — historical edition still referenced by many bank disclosures (including NMB's 2022 report). Cross-check for legacy option numbering per `research/04-pcaf-scoring.md` (source S4).
- **Date:** December 2022 (with methodology amendments December 2023)
- **URL:** https://carbonaccountingfinancials.com/files/downloads/PCAF-Global-GHG-Standard.pdf
- **Local filename:** `04-pcaf/pcaf-part-a-2nd-edition-2022.pdf`
- **How the demo uses it:** Historical reference. Many bank disclosures (including NMB's 2022 report) reference 2nd edition option numbering; keep this available for cross-referencing legacy Nepal disclosures.

#### CDP × PCAF — The Importance of Data Quality

- **Publisher / issuer:** CDP and PCAF (joint paper)
- **Tier:** REFERENCE — cited in `research/04-pcaf-scoring.md` (source S5) for the CDP 1–7 to PCAF 1–5 score alignment table. Not cited in code.
- **Date:** June 2023
- **URL:** https://carbonaccountingfinancials.com/files/Importance-of-data-quality-CDP-PCAF.pdf
- **Local filename:** `04-pcaf/cdp-pcaf-data-quality-importance-2023.pdf`
- **How the demo uses it:** Reference for how CDP's 1–7 data quality score maps to PCAF's 1–5. Useful when a customer already reports to CDP and wants to reuse the score.

#### CDFI Portfolio GHG Accounting — Process Documentation

- **Publisher / issuer:** Coastal Enterprises Inc. (CEI), PCAP, Self-Help
- **Tier:** REFERENCE — cited in `research/04-pcaf-scoring.md` (source S6) as a verbatim reproduction of the 2nd-edition PCAF Annex score-option tables. Cross-check when the 3rd-edition PDF's tabular content is hard to extract. Not cited in code.
- **Date:** April 2022
- **URL:** https://www.self-help.org/docs/default-source/PDFs/pcaf-working-guide-for-cdfis_20220418.pdf
- **Local filename:** `04-pcaf/pcaf-cdfi-process-documentation-2022.pdf`
- **How the demo uses it:** Verbatim reproduction of the 2nd-edition PCAF Annex score-option table (S6 in the research notes). Cross-check for `lib/regulatory/pcaf/scoring.ts` when the 3rd-edition PDF's tabular content proves hard to extract.

#### PCAF Disclosure Checklist — Part A

- **Publisher / issuer:** PCAF
- **Tier:** REFERENCE — column-set reference for what a PCAF-conformant disclosure must contain (source S8 in `research/04-pcaf-scoring.md`). Informs the "PCAF disclosure preview" narrative but not cited in code.
- **Date:** May 2025
- **URL:** https://carbonaccountingfinancials.com/files/disclosure_checklist/PCAF-Disclosure-Checklist-Part-A-Financed-Emissions-May-2025.pdf
- **Local filename:** `04-pcaf/pcaf-disclosure-checklist-part-a-may-2025.pdf`
- **How the demo uses it:** Column-set reference for what a PCAF-conformant disclosure must contain. Backs the "PCAF disclosure preview" section of the NFRS tab.

#### NMB Bank — Carbon Footprint Accounting 2022 (Nepal signatory disclosure)

- **Publisher / issuer:** NMB Bank Ltd (Nepal); published through PCAF signatory portal
- **Tier:** REFERENCE — the Nepal reference implementation (source S7 in `research/04-pcaf-scoring.md`). Concrete example for Laxmi Sunrise conversations; not cited in code.
- **Date:** 2023 disclosure covering FY 2022 baseline
- **URL:** https://carbonaccountingfinancials.com/files/institutions_downloads/nmb-carbon-disclosure-report-2022-akm.pdf
- **Local filename:** `04-pcaf/nmb-bank-carbon-disclosure-2022.pdf`
- **How the demo uses it:** The Nepal reference implementation. NMB is the only Nepali PCAF signatory (Dinesh Dulal sits on the PCAF Board). This report is the concrete example we point Laxmi Sunrise at when they ask "what does a real Nepali bank disclosure look like?"

---

### Category 05 — IFC Performance Standards

Referenced by NRB §6 as "good practice" and mapped 1:1 to the demo's Annex 5b PF screening (`lib/regulatory/esdd/annex5b-pf-questions.ts`).

#### IFC Performance Standards on Environmental and Social Sustainability (2012, English edition)

- **Publisher / issuer:** International Finance Corporation (World Bank Group)
- **Tier:** LOAD-BEARING (**not yet downloaded** — folder `05-ifc-performance-standards/` is empty). Every question in `lib/regulatory/esdd/annex5b-pf-questions.ts` carries an `ifcPS: "PS1".."PS8"` tag that resolves against this handbook. Priority acquisition — until it is on disk, PF-screening question citations cannot be verified.
- **Date:** 1 January 2012 (currently operative edition)
- **Pages:** 72 (handbook covering PS1–PS8)
- **URL:** TBD — no stable direct PDF URL captured in research. Search `www.ifc.org` for "Performance Standards Handbook 2012 English" or start at the general Sustainability Framework page: https://www.ifc.org/en/insights-reports/sustainability-framework
- **Local filename:** `05-ifc-performance-standards/ifc-performance-standards-handbook-2012-en.pdf`
- **How the demo uses it:** Every question in `lib/regulatory/esdd/annex5b-pf-questions.ts` carries an `ifcPS: "PS1".."PS8"` tag pointing at a specific paragraph of these standards. When the PF screening wizard says "IFC PS3 §12", this is the reference document.
- **Retrieval:** Downloader will attempt best-guess URLs; if they fail, retrieve from `www.ifc.org` manually.

---

### Category 06 — IFC EHS Guidelines

Sector-specific technical guidelines the demo's supplementary sector questions rely on (per `research/05-nepal-sector-esrm-hunt.md` fallback plan).

#### IFC General EHS Guidelines (hub)

- **Publisher / issuer:** IFC / World Bank Group
- **Tier:** CONTEXT — HTML capture of the hub landing page for orientation only.
- **URL:** https://www.ifc.org/en/insights-reports/general-environmental-health-and-safety-guidelines
- **Local filename:** `06-ifc-ehs-guidelines/00-general-ehs-guidelines-hub.html`
- **How the demo uses it:** Entry point for any sector that lacks a dedicated EHS Guideline (notably brick). Cited generically for cross-cutting air/water/waste/OHS content.

#### IFC EHS Guidelines hub (long URL)

- **Tier:** CONTEXT — alternate HTML capture of the hub; backup permalink.
- **URL:** https://www.ifc.org/wps/wcm/connect/topics_ext_content/ifc_external_corporate_site/sustainability-at-ifc/policies-standards/ehs-guidelines
- **Local filename:** `06-ifc-ehs-guidelines/00-ehs-guidelines-hub-alt.html`
- **How the demo uses it:** Alternative entry point (older permalink). Kept in case the new hub URL changes.

#### Good Practice Note: EHS Approaches for Hydropower Projects

- **Publisher / issuer:** IFC
- **Tier:** REFERENCE — sector supplement research per `research/05-nepal-sector-esrm-hunt.md`. Sector supplements were removed from `annex5-questions.ts` per Circular 22 verbatim conformance, so this document informs research and hydropower doc-matrix framing rather than the wizard itself.
- **Date:** March 2018
- **Pages:** ~200
- **URL:** https://www.ifc.org/en/insights-reports/2018/publications-gpn-ehshydropwer
- **Local filename:** `06-ifc-ehs-guidelines/hydropower-gpn-2018.pdf`
- **How the demo uses it:** Anchor for hydropower sector supplement questions (H.1–H.4) and for the hydro doc matrix panel (`components/bfi/hydro/doc-matrix-panel.tsx`). Covers RoR diversion, RoR reservoir, storage reservoir, pumped storage.

#### EHS Guidelines for Cement and Lime Manufacturing

- **Publisher / issuer:** IFC / WBG
- **Tier:** REFERENCE — cement sector supplement research (see `research/05-nepal-sector-esrm-hunt.md`). Not implemented in the wizard per Circular 22 verbatim conformance.
- **Date:** 2022 (updated)
- **URL:** https://www.ifc.org/content/dam/ifc/doc/2022/2022-cement-lime-manufacturing-ehs-guidelines-en.pdf
- **Local filename:** `06-ifc-ehs-guidelines/cement-and-lime-manufacturing-2022.pdf`
- **How the demo uses it:** Anchor for cement sector supplement questions (C.1–C.3). Covers energy, GHG, air (PM, NOx, SOx), wastewater, solid waste.

#### EHS Guidelines for Textile Manufacturing (hub link)

- **Publisher / issuer:** IFC / WBG
- **Tier:** CONTEXT — HTML hub capture only (direct PDF not stably linked). Textile sector supplement was not implemented; use for orientation.
- **Date:** 2007
- **URL:** https://www.ifc.org/en/insights-reports/general-environmental-health-and-safety-guidelines/ehs-guidelines-general-manufacturing
- **Local filename:** `06-ifc-ehs-guidelines/textile-manufacturing-hub.html`
- **How the demo uses it:** Anchor for textile sector supplement questions (T.1–T.3). Natural, synthetic, regenerated fibers; dyeing / finishing water and chemical impacts.
- **Retrieval note:** The direct PDF is not linked from the hub in a stable way; the downloader captures the hub HTML. Analyst may need to navigate manually from the hub.

#### EHS Guidelines for Integrated Steel Mills

- **Publisher / issuer:** IFC / WBG
- **Tier:** REFERENCE — steel sector supplement research. Not cited in code (sector supplements were removed per Circular 22 verbatim conformance).
- **Date:** 2007
- **URL:** https://www.ifc.org/content/dam/ifc/doc/2000/2007-integrated-steel-mills-ehs-guidelines-en.pdf
- **Local filename:** `06-ifc-ehs-guidelines/integrated-steel-mills-2007.pdf`
- **How the demo uses it:** Reference for large-scale steel supplement questions (S.1–S.3). For Nepal's typical small re-rolling mills, prefer Foundries (next entry).

#### EHS Guidelines for Foundries

- **Publisher / issuer:** IFC / WBG
- **Tier:** REFERENCE — small-mill steel sector supplement research (better fit than Integrated Steel Mills for Nepali borrowers). Not cited in code.
- **Date:** 2007
- **URL:** https://www.ifc.org/content/dam/ifc/doc/2000/2007-foundries-ehs-guidelines-en.pdf
- **Local filename:** `06-ifc-ehs-guidelines/foundries-2007.pdf`
- **How the demo uses it:** Anchor for Nepal small steel re-rolling mill supplement questions. Better fit than Integrated Steel Mills for the typical Nepali borrower.

#### EHS Guidelines for Chemicals (hub link)

- **Publisher / issuer:** IFC / WBG
- **Tier:** CONTEXT — HTML hub capture only; sub-sector PDFs are behind the hub. Chemicals sector supplement not implemented in the wizard.
- **URL:** https://www.ifc.org/en/insights-reports/general-environmental-health-and-safety-guidelines/ehs-guidelines-chemicals
- **Local filename:** `06-ifc-ehs-guidelines/chemicals-hub.html`
- **How the demo uses it:** Entry point for chemicals sector supplement questions (Ch.1–Ch.3). Coverage is fragmented across sub-sectors (agrochemical, formulator, terminal, bulk); the analyst must pick the correct sub-sector guideline per borrower.
- **Retrieval note:** The sub-sector PDFs (pesticides manufacturing, bulk chemical terminals, coal processing) are behind the hub. Download the hub HTML and navigate from there.

#### EHS Guidelines for Annual Crop Production

- **Publisher / issuer:** IFC / WBG
- **Tier:** REFERENCE — agriculture sector supplement research per `research/05-nepal-sector-esrm-hunt.md`. Not cited in code.
- **Date:** 2016
- **URL:** https://www.ifc.org/content/dam/ifc/doc/2010/2016-annual-crop-production-ehs-guidelines-en.pdf
- **Local filename:** `06-ifc-ehs-guidelines/annual-crop-production-2016.pdf`
- **How the demo uses it:** Anchor for agriculture sector supplement questions (A.1–A.4). Covers pesticide, fertilizer, water use, worker safety, land tenure, biodiversity.

#### EHS Guidelines for Perennial Crop Production

- **Publisher / issuer:** IFC / WBG
- **Tier:** REFERENCE — agriculture sector supplement research (tea, coffee, cardamom, orchards). Complements the Annual Crop guideline. Not cited in code.
- **Date:** 2016
- **URL:** https://www.ifc.org/content/dam/ifc/doc/2010/2016-perennial-crop-production-ehs-guidelines-en.pdf
- **Local filename:** `06-ifc-ehs-guidelines/perennial-crop-production-2016.pdf`
- **How the demo uses it:** Anchor for agriculture sector supplement questions where the borrower is tea, coffee, cardamom, or orchard. Complements the Annual Crop guideline.

#### Brick sector — GAP (no dedicated IFC EHS Guideline)

- **Tier:** n/a (gap note only — not a source file).
- **Note:** There is no IFC EHS Guideline for brick manufacturing. Composite anchor is (a) General EHS Guidelines above, (b) MinErgy/ICIMOD Nepal Brick Sector Policy Framework (see category 08), and optionally (c) EHS Guidelines for Ceramic Tile & Sanitary Ware Manufacturing / Construction Materials Extraction — for which no stable direct URLs were captured in the research pack.
- **Retrieval:** Manual — search `www.ifc.org` for "Ceramic Tile Sanitary Ware EHS" and "Construction Materials Extraction EHS". Flag this gap when a brick-sector borrower comes up in the demo.

---

### Category 07 — Nepal legislation

Statutory backstop for the ESRM permit checks (§Annex 6 of the NRB guideline) and the hydropower EIA process.

#### MoFE Hydropower Environmental Impact Assessment Manual (2018)

- **Publisher / issuer:** Ministry of Forests and Environment, Nepal, with IFC support
- **Tier:** REFERENCE (**not yet downloaded**) — practitioner reference informing the hydropower doc-matrix. Not directly cited in code, but pointed at by NRB Annex 2.
- **Date:** 2018
- **URL:** https://mofe.gov.np/downloadfile/Hydropower%20Environmental%20Impact%20Assessment%20Manual_1537854204.pdf
- **Local filename:** `07-nepal-legislation/mofe-hydropower-eia-manual-2018.pdf`
- **How the demo uses it:** Practitioner reference the NRB Annex 2 hydropower supplement points to. Backs the hydropower documentation matrix in `components/bfi/hydro/doc-matrix-panel.tsx`.

#### Environment Protection Rules 2020 (EPR 2020)

- **Publisher / issuer:** Government of Nepal, Ministry of Forests and Environment
- **Tier:** REFERENCE (**Gazette PDF not yet downloaded**) — statutory backstop for EIA / IEE / BES thresholds. Informs `assessment_type` derivation and permit-check narrative in the ESDD wizard; the code cites NRB Annex 6 (which is derived from EPR 2020) rather than EPR itself.
- **Date:** 2020 (following Environment Protection Act 2019)
- **URL:** TBD — no direct government PDF URL captured in research. Secondary explainers:
  - Sada Law overview: https://sadalaw.com.np/news-publication/nepal-environment-protection-act-2019-extended-rules-2020
  - Lawsagar overview: https://lawsagar.com/2025/10/01/environmental-clearance-for-industries-nepal-eia-iee/
- **Local filename:** `07-nepal-legislation/nepal-epr-2020.pdf`
- **How the demo uses it:** Defines EIA / IEE / BES thresholds by industry (Schedules 1–3). Backs the derivation of `assessment_type` in the hydropower doc matrix and the general permit-check logic in the ESDD wizard.
- **Retrieval:** Downloader will fetch the two secondary explainers as HTML. The authoritative Nepali Gazette PDF must be sourced manually from `moljpa.gov.np` (Ministry of Law) or `mofe.gov.np`.

#### Lawsagar — Environmental clearance for industries (EIA / IEE) HTML capture

- **Publisher / issuer:** Lawsagar (Nepal legal-explainer site)
- **Tier:** CONTEXT — secondary explainer of EPR 2020 EIA/IEE process. Used only to orient a reader while the authoritative Gazette PDF is still missing.
- **URL:** https://lawsagar.com/2025/10/01/environmental-clearance-for-industries-nepal-eia-iee/
- **Local filename:** `07-nepal-legislation/lawsagar-environmental-clearance.html`
- **How the demo uses it:** Not cited by code. Background reading for the EPR 2020 threshold discussion.

---

### Category 08 — Sector context

Non-authoritative but useful when a specific sector question comes up. Cite as "context", not as the source of a demo rule.

#### Nepal Brick Sector National Policy Framework

- **Publisher / issuer:** MinErgy Pvt. Ltd. and ICIMOD
- **Tier:** REFERENCE — Nepal-specific brick sector context cited in `research/05-nepal-sector-esrm-hunt.md`. Not cited in code (no dedicated brick sector supplement was implemented).
- **Date:** 2017
- **URL:** https://www.ccacoalition.org/sites/default/files/resources/2017_bricks-sector-nepal_minergy-icimod.pdf
- **Local filename:** `08-sector-context/nepal-brick-sector-policy-framework-2017.pdf`
- **How the demo uses it:** Nepal-specific context for brick supplement questions (B.1–B.4) — kiln type, seasonal migrant labour, child labour risk, Kathmandu Valley air-quality obligations. Composite anchor with IFC General EHS Guidelines because there is no dedicated IFC EHS Guideline for brick.

---

### Category 09 — NBA industry publications

Advisory / industry-consensus material sitting between NRB regulation and day-to-day banking.

#### NBA ESRM Implementation Handbook — press release

- **Publisher / issuer:** Nepal Bankers' Association
- **Tier:** CONTEXT — HTML capture of the release announcement; provenance only.
- **Date:** 20 February 2026 (press release)
- **URL:** https://nepalbankers.com.np/nba-released-esrm-implementation-handbook/
- **Local filename:** `09-nba-industry/nba-esrm-handbook-press-release.html`
- **How the demo uses it:** The public description confirms the handbook exists and is positioned as operational guidance for ESRM. The demo does not currently ingest content from the handbook (we do not have the PDF).

#### NBA ESRM Implementation Handbook — the PDF itself

- **Publisher / issuer:** Nepal Bankers' Association
- **Tier:** CONTEXT (**not yet obtained** — manual request required). Once we have it, may be promoted to REFERENCE if it contains sector Q&A worth cross-checking.
- **Date:** February 2026
- **URL:** No direct URL — not linked from the NBA Publications page as of research date (2026-07-30).
- **Local filename:** `09-nba-industry/nba-esrm-implementation-handbook-2026.pdf`
- **How the demo uses it:** Not yet — see retrieval note.
- **Retrieval:** **Manual only.** Ask the Laxmi Sunrise ESRM team to share their member-bank copy, or email `nba@nepalbankers.com.np`. If it turns out to contain sector-specific Q&A, we should re-open the sector-supplement design (`lib/regulatory/esdd/annex5-questions.ts` sector supplements) against it. If it is process guidance only, the current IFC EHS fallback stands.

#### NBA Publications index

- **Tier:** CONTEXT — HTML capture for provenance; confirms the NBA catalogue's current state.
- **URL:** https://nepalbankers.com.np/publications/
- **Local filename:** `09-nba-industry/nba-publications-index.html`
- **How the demo uses it:** Provenance — confirms the NBA publications catalogue does not currently list the ESRM handbook (only newsletters and Code of Conduct).

#### NBA — Climate Transition Maturity of Nepali Commercial Banks 2025 (release announcement)

- **Publisher / issuer:** Nepal Bankers' Association (report by Cadmus / Invest for Impact Nepal)
- **Tier:** CONTEXT — release announcement HTML; industry framing for narratives in the NFRS tab, not a source of code rules.
- **Date:** February 2026 announcement
- **URL:** https://nepalbankers.com.np/release-of-the-assessing-climate-transition-maturity-of-nepali-commercial-banks-2025-report/
- **Local filename:** `09-nba-industry/nba-climate-transition-maturity-2025.html`
- **How the demo uses it:** Reference for the maturity-tier framing in `components/bfi/tabs/nfrs-tab.tsx` narratives.

---

### Category 10 — Secondary references

Useful background, primarily HTML. Not load-bearing for the demo but cited by the research pack.

#### SBFN Nepal country page

- **Publisher / issuer:** Sustainable Banking and Finance Network
- **Tier:** CONTEXT — external membership confirmation and framing.
- **URL:** https://data.sbfnetwork.org/country/nepal
- **Local filename:** `10-secondary-references/sbfn-nepal-country-page.html`
- **How the demo uses it:** External confirmation that Nepal is an SBFN member (NRB joined 2014). Cited in the ESRM guideline's foundational chapters.

#### Green Finance Platform entry on Nepal ESRM

- **Tier:** CONTEXT — external policy-database entry (**not yet downloaded**); stakeholder framing.
- **URL:** https://www.greenfinanceplatform.org/policies-and-regulations/guideline-environmental-social-risk-management-esrm-banks-and-financial
- **Local filename:** `10-secondary-references/greenfinanceplatform-nepal-esrm.html`
- **How the demo uses it:** External policy-database entry pointing at the NRB ESRM Guideline. Useful for stakeholder framing.

#### AFI — NRB Green Finance Taxonomy announcement

- **Publisher / issuer:** Alliance for Financial Inclusion
- **Tier:** CONTEXT — third-party endorsement HTML; provenance for the taxonomy's international peer review.
- **URL:** https://afi-global.org/news/nepal-rastra-bank-issues-a-comprehensive-green-finance-taxonomy/
- **Local filename:** `10-secondary-references/afi-nrb-taxonomy-announcement.html`
- **How the demo uses it:** Third-party endorsement of the 2024 taxonomy publication. Provenance for the taxonomy's international peer review (BSP, BNM).

#### Invest for Impact Nepal — ESG Landscape Analysis Report

- **Publisher / issuer:** Invest for Impact Nepal (BII / FMO / SDC, delivered by Cadmus)
- **Tier:** CONTEXT — Nepal ESG market survey for orientation only. Does not provide sector-specific ESDD questions.
- **Date:** May 2024
- **URL:** https://www.investforimpactnepal.com/wp-content/uploads/2024/05/ESG-Landscape-Analysis-Report.pdf
- **Local filename:** `10-secondary-references/iin-esg-landscape-analysis-2024.pdf`
- **How the demo uses it:** Survey of the Nepal ESG environment — banks, insurers, capital markets. Useful for orientation. Does not itself provide sector-specific ESDD questions.

#### Cadmus — Are Nepal's banks ready for climate transition? (article)

- **Tier:** CONTEXT — companion narrative HTML to the NBA Climate Transition Maturity report.
- **URL:** https://cadmusgroup.com/are-nepals-banks-ready-for-climate-transition/
- **Local filename:** `10-secondary-references/cadmus-nepal-banks-climate-transition.html`
- **How the demo uses it:** Companion narrative to the NBA Climate Transition Maturity report; frames why banks are moving on climate.

#### Cadmus — Accelerating DFI investments in Nepal's financial service industry

- **Tier:** CONTEXT — programmatic backdrop HTML.
- **URL:** https://cadmusgroup.com/accelerating-dfi-investments-in-nepals-financial-service-industry/
- **Local filename:** `10-secondary-references/cadmus-dfi-nepal.html`
- **How the demo uses it:** Programmatic backdrop for the Invest for Impact Nepal work.

#### MyRepublica — ESRM in Nepali banking (opinion piece)

- **Tier:** CONTEXT (**not yet downloaded**) — industry-press colour, not a source of demo rules.
- **URL:** https://myrepublica.nagariknetwork.com/news/environmental-and-social-risk-management-in-nepali-banking-policy-implementation-and-status/
- **Local filename:** `10-secondary-references/myrepublica-esrm-nepal-opinion.html`
- **How the demo uses it:** Industry-press summary of ESRM implementation status. Useful colour, not a source of demo rules.

#### ESRM Origins and Adoption (research brief)

- **Publisher / issuer:** Jana research pack
- **Tier:** CONTEXT — internal narrative on where the NRB ESRM framework came from and how it maps to international precedent (IFC PS, Equator Principles, SBFN).
- **Local filename:** `10-secondary-references/ESRM_Origins_and_Adoption.pdf`
- **How the demo uses it:** Onboarding background; not cited by code.

#### Green Finance Taxonomy Origins and Adoption (research brief)

- **Publisher / issuer:** Jana research pack
- **Tier:** CONTEXT — internal narrative on the Nepal Green Finance Taxonomy 2024 lineage (EU Taxonomy, Bangko Sentral ng Pilipinas, Bank Negara Malaysia peer reviews).
- **Local filename:** `10-secondary-references/Green_Finance_Taxonomy_Origins_and_Adoption.pdf`
- **How the demo uses it:** Onboarding background; not cited by code.

#### Global Climate Disclosure Cheat Sheet (research brief)

- **Publisher / issuer:** Jana research pack
- **Tier:** CONTEXT — one-page comparator of ISSB / TCFD / EU CSRD / NFRS S2 disclosure regimes.
- **Local filename:** `10-secondary-references/Global_Climate_Disclosure_Cheat_Sheet.pdf`
- **How the demo uses it:** Customer conversation aid; not cited by code.

#### ISSB / IFRS Adoption Map (research brief)

- **Publisher / issuer:** Jana research pack
- **Tier:** CONTEXT — country-by-country map of IFRS S1/S2 adoption status, situating Nepal's NFRS S1/S2 in global context.
- **Local filename:** `10-secondary-references/ISSB_IFRS_Adoption_Map.pdf`
- **How the demo uses it:** Onboarding background; not cited by code.

---

## Change log

- **2026-08-03** — Initial version. Manifest reconciled from `research/01`..`research/06`. NBA ESRM Implementation Handbook flagged for manual retrieval; NFRS S1/S2 exposure drafts flagged pending stable ASB Nepal URLs; IFC PS Handbook and EPR 2020 flagged pending stable direct URLs.
