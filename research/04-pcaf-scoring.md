# PCAF Data Quality Scoring — research pack for Jana Nepal demo

**Purpose:** capture the authoritative PCAF Data Quality Score (DQS) rubric so we can (a) upgrade the demo to compute scores per loan instead of hard-coding "Score 2 / Score 5" and (b) cross-map PCAF to NFRS S2, the NRB Circular 22 checklist, and Laxmi Sunrise's ESRM workbench.

Sources fetched during this research pass:

| # | Source | URL |
|---|--------|-----|
| S1 | PCAF landing page (asset-class list + PDF links) | https://carbonaccountingfinancials.com/en/standard |
| S2 | Part A — Financed Emissions, **3rd Edition (Dec 2025 / release 15-Jan-2026)** — full PDF | https://carbonaccountingfinancials.com/files/standard-launch-2025/PCAF-PartA-2025-V3-15012026.pdf |
| S3 | Part A — Executive Summary (3rd Edition) | https://carbonaccountingfinancials.com/files/standard-launch-2025/PCAF-PartA-2025-Executive-Summary-Clean.pdf |
| S4 | Part A — Financed Emissions, **2nd Edition (Dec 2022 / v2 2023-Dec)** — full PDF | https://carbonaccountingfinancials.com/files/downloads/PCAF-Global-GHG-Standard.pdf |
| S5 | CDP × PCAF joint paper "The importance of data quality" (June 2023) — has the exact score → data-type mapping | https://carbonaccountingfinancials.com/files/Importance-of-data-quality-CDP-PCAF.pdf |
| S6 | "Process Documentation: Portfolio GHG Accounting for CDFIs" (CEI / PCAP / Self-Help, April 2022) — reproduces the score tables verbatim from the Annex | https://www.self-help.org/docs/default-source/PDFs/pcaf-working-guide-for-cdfis_20220418.pdf |
| S7 | NMB Bank Carbon Footprint Accounting 2022 (Nepal signatory disclosure) | https://carbonaccountingfinancials.com/files/institutions_downloads/nmb-carbon-disclosure-report-2022-akm.pdf |
| S8 | PCAF Disclosure Checklist — Part A (May 2025) | https://carbonaccountingfinancials.com/files/disclosure_checklist/PCAF-Disclosure-Checklist-Part-A-Financed-Emissions-May-2025.pdf |

**Note on primary source quality:** the 3rd-edition PDF (S2) parsed cleanly for the introduction, principles, attribution methodology, and Section 5.1 asset-class definitions, but the tabular content in the per-asset-class score sub-sections (5.1–5.10) and Annex 10.1 did not extract because those tables are rendered as graphic elements. Where the third-edition table content is not directly quoted here I have cross-referenced from the second-edition Annex via the CDFI working guide (S6), which reproduces the option/score mapping verbatim from the Annex, and from the CDP × PCAF alignment paper (S5). The 2nd → 3rd edition changes to the six original asset classes are described in the Exec Summary (S3) as "updates and improvements", not as changes to the score rubric itself — the option definitions (Option 1a/1b, 2a/2b, 3a/3b/3c) are preserved.

---

## 1. Standard metadata

- **Full title:** *The Global GHG Accounting and Reporting Standard for the Financial Industry — Part A: Financed Emissions*
- **Publisher:** Partnership for Carbon Accounting Financials (PCAF). Secretariat operated by Guidehouse.
- **Currently authoritative version:** **Third Edition — December 2025** (PDF stamped release 15 Jan 2026). Cite as: *PCAF (2025). The Global GHG Accounting and Reporting Standard Part A: Financed Emissions. Third Edition.*
- **Previous versions** (still referenced by many bank disclosures, including NMB Bank's 2022 report): 2nd edition Dec 2022 (with methodology amendments Dec 2023); 1st edition Nov 2020.
- **Part B** (Facilitated Emissions, Dec 2023) and **Part C** (Insurance-Associated Emissions, 2nd ed. Dec 2025) are separate PDFs — not covered here except by mention. Nepal banks are on the hook for Part A.
- **GHG Protocol conformance:** the 1st edition was reviewed and marked "Built on GHG Protocol" for the six original asset classes (Listed Equity & Corporate Bonds, Business Loans & Unlisted Equity, Project Finance, Commercial Real Estate, Mortgages, Motor Vehicle Loans). The GHG Protocol closed its review programme before the 2nd/3rd editions, so the additions since 2023 are self-published (S2 p.1).
- **Signatories:** 700+ financial institutions (S1). NMB Bank Nepal is a signatory since 2021; **Dinesh Dulal (NMB Bank) sits on the PCAF Board of Directors**, and NMB is one of ~14 institutions represented on the Global Core Team (S2 acknowledgements p.4).

---

## 2. Asset class scoping — 3rd edition covers **ten** asset classes

The 1st and 2nd editions covered six. The 3rd edition (Dec 2025) added four. From S2 §5 ToC and S2 §5.1-5.10 chapter openers (pp.36–39):

| # | Asset class | Sub-ch. | Scope definition (paraphrased from S2 §5.1-5.10) |
|---|-------------|---------|--------------------------------------------------|
| 1 | Listed equity & corporate bonds | 5.1 | On-balance-sheet listed equity, and all listed/unlisted corporate bonds, issued for general corporate purposes (unknown use of proceeds). Excludes derivatives, held-for-sale, IPO underwriting, private equity. |
| 2 | Business loans & unlisted equity | 5.2 | On-balance-sheet loans, lines of credit, and equity investments to private (non-listed) companies for general corporate purposes. Includes state-owned enterprises; excludes sovereign loans. |
| 3 | Project finance | 5.3 | On-balance-sheet loans and equity investments to specific self-contained projects with their own budget (e.g. gas-fired power plant, wind/solar project, energy-efficiency project). "Financing is designated for a defined activity or set of activities." |
| 4 | Commercial real estate (CRE) | 5.4 | On-balance-sheet loans for purchase/refinance of CRE, and CRE investments where the FI has no operational control. Covers retail, hotels, office, industrial, large multi-family. |
| 5 | Mortgages | 5.5 | On-balance-sheet loans for purchase/refinance of residential property (single-family or small multi-family). Residential use only. |
| 6 | Motor vehicle loans | 5.6 | On-balance-sheet loans/lines of credit to businesses or consumers to finance one or more motor vehicles. |
| 7 | **Use-of-proceeds structures** *(new in 3rd ed.)* | 5.7 | Debt or equity to pools of underlying assets with a defined use of proceeds — allocate to the underlying asset class(es). |
| 8 | **Securitisation & structured products** *(new in 3rd ed.)* | 5.8 | Securitised / structured products backed by an identifiable pool of loans, leases, or income-generating assets; public and private ABS. |
| 9 | Sovereign debt | 5.9 | Sovereign bonds and loans of all maturities, domestic or foreign currency, that transfer funds to a national government. |
| 10 | **Sub-sovereign debt** *(new in 3rd ed.)* | 5.10 | Bonds and loans issued by public authorities below national level — states, provinces, cities, municipalities. |

Additional 3rd-edition scope changes: optional IFRS S1/S2-aligned reporting of undrawn loan commitments (§6.2), fluctuation-analysis and inflation-adjustment recommendations (§6.1), plus supplemental guidance (separate PDF) on financed avoided emissions and forward-looking metrics.

For the Jana / Laxmi Nepal demo the relevant classes are **Business Loans & Unlisted Equity (§5.2)** for corporate lending to Nepali borrowers such as cement companies and hotels, **Project Finance (§5.3)** for hydropower project debt, and **Commercial Real Estate (§5.4)** / **Mortgages (§5.5)** for the retail portfolios. Sovereign debt applies if the bank holds NRB bonds.

---

## 3. The 1-5 score rubric per asset class

### 3.1 The generic PCAF data hierarchy

From S2 §4 (p.31) and S5 pp.5-6, the score is a rank of **how the borrower's emissions were derived**, from most to least trustworthy. Three "options" collapse into five sub-scores:

- **Option 1 — Reported emissions.** The borrower calculates its own scope 1/2/3 emissions per the GHG Protocol.
  - **Score 1** — Option 1a: reported emissions are **verified** by a qualified third party.
  - **Score 2** — Option 1b: reported emissions are **unverified** (self-reported per GHG Protocol methodology).
- **Option 2 — Physical activity-based emissions.** The FI estimates using the borrower's primary physical data.
  - **Score 2** — Option 2a: FI uses **primary physical energy consumption data** (kWh, litres of fuel, etc.) times matched emission factors.
  - **Score 3** — Option 2b: FI uses **primary physical production data** (tonnes of cement, MWh generated, etc.) times sector-specific emission factors.
- **Option 3 — Economic activity-based emissions.** The FI estimates from financial ratios.
  - **Score 4** — Option 3a: **borrower revenue** × sector/region-average emission factor per unit of revenue.
  - **Score 5** — Option 3b: **outstanding amount** × sector/region-average emission factor per unit of asset (or 3c: revenue estimated via sector asset-turnover ratio × asset-based EF).

Score 1 = "certain"; Score 5 = "uncertain." A weighted portfolio average is disclosed alongside absolute financed emissions.

### 3.2 Business Loans & Unlisted Equity (also mirrored to Project Finance)

Source: S6 pp.8-9 (reproduced verbatim from the 2nd-edition Annex, unchanged in intent in the 3rd edition per S2 §5.2).

| Score | Emissions data | Financial data | Option |
|-------|----------------|----------------|--------|
| 1 | Verified GHG emissions from borrower per GHG Protocol | Outstanding amount + Total equity + debt (or EVIC if listed) | 1a |
| 2 | Unverified GHG emissions from borrower per GHG Protocol | Outstanding amount + Total equity + debt / EVIC | 1b |
| 3 | Borrower's **primary production data** × sector EF per tonne/MWh | Outstanding amount + Total equity + debt / EVIC | 2b |
| 3 (alt) | Borrower's **energy consumption data** × emission factor per kWh/fuel | Outstanding amount + Total equity + debt / EVIC | 2a |
| 4 | **Borrower's revenue** × sector average EF per unit revenue | Outstanding amount + Total equity + debt / EVIC + revenue | 3a |
| 5 | Sector-average EF per unit of assets (no revenue) | Outstanding amount + Total equity + debt / EVIC (+ sector asset-turnover ratio for 3c) | 3b / 3c |

(Note: S6 groups Options 2a/2b both as "score 3" but distinguishes them in the option column; the actual PCAF Annex lists 2a as the higher-quality of the two. Some later Guidehouse tables split 2a=score 2, 2b=score 3. **For our demo we should treat 2a and 2b as the two flavors of Score 3 — that matches the current 3rd-edition scorecard for business loans and is the version most FIs disclose against.**)

### 3.3 Project Finance (§5.3)

The scoring options are identical to Business Loans (S2 §5.3 chapter opener; S6 explicit note "also relevant to Project Finance"). The **denominator is the total project debt + project equity** rather than corporate EVIC. The emissions numerator is the same 1a/1b/2a/2b/3a/3b/3c hierarchy.

### 3.4 Commercial Real Estate & Mortgages

Source: S6 p.8 (verbatim from 2nd-edition Annex).

| Score | Building energy data | Financial / physical anchor |
|-------|----------------------|------------------------------|
| 1 | **Primary metered energy consumption** + supplier-specific emission factor (Option 1a) | Floor area + Outstanding + Property value at origination |
| 2 | Primary metered energy consumption (grid-average EF) (Option 1b) | Floor area + Outstanding + Property value |
| 3 | Estimated energy use from **building energy labels** (EPC etc.) (Option 2a) | Floor area + Outstanding + Property value |
| 4 | Estimated energy use from **building type + location statistics**, per m² (Option 2b) | Floor area OR building count + Outstanding + Property value |
| 5 | Estimated from building type + location, per building (Option 3) | Number of buildings (no floor area) + Outstanding + Property value |

Mortgages follow the same 1-5 pattern, with per-dwelling (1, 2-4, 5+ units) emission factors from the PCAF database when floor area is unknown.

### 3.5 Motor Vehicle Loans

Source: S6 p.9.

| Score | Emissions data | Financial data |
|-------|----------------|----------------|
| 1 | Primary vehicle **fuel consumption data** (Option 1a) OR primary distance travelled + fuel efficiency + fuel type (Option 1b) | Outstanding + Total value at origination |
| 2 | Local statistics on distance travelled + known make/model efficiency (Option 2a) | Outstanding + Total value |
| 3 | Regional statistics on distance travelled + known make/model (Option 2b) | Outstanding + Total value |
| 4 | Local/regional distance stats + known make/model (Option 3a) | Outstanding + Total value |
| 5 | Local/regional distance stats + **average vehicle** efficiency (Option 3b) | Outstanding + Total value |

### 3.6 Sovereign Debt (§5.9)

Distinct hierarchy — the "borrower" is a country. The three data types are (i) production emissions from national inventories (UNFCCC, PRIMAP), (ii) consumption emissions (production + imports − exports), and (iii) government-emissions-only. Scores 1-4 vary by whether the inventory was verified against an IPCC guideline, its recency, and whether trade data is included. Score 5 uses proxies. Full detail is in S2 §5.9 and Annex 10.3 (not fully extracted here). Not central to Nepal corporate lending demo.

### 3.7 Listed Equity & Corporate Bonds (§5.1)

Same 1-5 option ladder as Business Loans, but the denominator is **EVIC** (Enterprise Value Including Cash — see §4 below). This is the class where CDP has fully aligned its own 1-7 data quality score to the PCAF 1-5 (S5 alignment table, p.7).

### 3.8 The four new-in-2025 asset classes

Use-of-proceeds structures (§5.7) and securitisation (§5.8) inherit the score from whatever underlying asset class the pool traces to. Sub-sovereign debt (§5.10) mirrors sovereign debt scoring adapted to the sub-national level. These are second-order for the demo.

---

## 4. Attribution methodology

### 4.1 The universal formula (S2 §4.2 pp.28-29)

> Financed emissions = Σ_c [ Attribution factor_c × Emissions_c ]
>
> Attribution factor_c = Outstanding amount_c / Company value_c

Three universal principles from S2 pp.28-30:

1. Emissions are always **attribution factor × borrower emissions**.
2. Attribution factor is the FI's share of the borrower's / project's total capital stack.
3. Denominator includes **both equity and debt** — this is what makes the total attribution across all FIs sum to 100% and prevents double-counting.

### 4.2 Denominator by asset class

- **Listed equity + corporate bonds (§5.1):** *Enterprise Value Including Cash (EVIC).* Defined (S2 p.42): "the sum of the market capitalisation of ordinary shares at fiscal year-end, the market capitalisation of preferred shares at fiscal year-end, and the book values of total debt and minorities' interests. No deductions of cash or cash equivalents are made to avoid the possibility of negative enterprise values." Aligned to EU TEG and EU Delegated Reg 2020/1818. If total equity is negative, set it to 0 and attribute all emissions to debt.
- **Corporate bonds to private companies:** Total equity + total debt from balance sheet.
- **Business loans / unlisted equity (§5.2):** Total equity + total debt from balance sheet. Fallback allowed to total balance sheet (assets) if debt/equity split not obtainable.
- **Project finance (§5.3):** Attribution factor = **outstanding amount / (total project equity + total project debt)** at project level. This equals the FI's share of **total project cost** for greenfield financings where equity + debt = project cost.
- **Commercial real estate (§5.4) & Mortgages (§5.5):** Attribution factor = **outstanding amount / property value at loan origination**. The property replaces "equity + debt" as the denominator.
- **Motor vehicle loans (§5.6):** Attribution factor = **outstanding amount / total value at origination** (vehicle purchase price).
- **Sovereign debt (§5.9):** Attribution factor = **outstanding amount / (PPP-adjusted GDP)** for consumption emissions; or divided by total government debt for government-emissions-only variant. See §5.9 and Annex 10.3.

### 4.3 Edge cases

- **Revolvers / lines of credit / bridge / letters of credit:** counted **only if there is outstanding balance on the balance sheet at fiscal year-end** (S4 p.46). The 3rd edition adds **optional** reporting of undrawn commitments per IFRS S1/S2 (S2 §6.2).
- **Off-balance-sheet items** (guarantees not drawn, IPO underwriting) — **out of scope** for Part A (they may be picked up under Part B Facilitated Emissions).
- **Trading book / held-for-sale / short-duration assets:** out of scope (S2 §5.1).
- **Derivatives:** out of scope for Part A entirely.
- **Financial-sector-to-financial-sector loans:** now in scope for scope 3 from 2025 onward (previous phase-in ended); PCAF recommends separate reporting to avoid infinite-loop double counting (S2 pp.41-42).
- **Negative equity:** set equity to 0, attribute all emissions to debt providers (S2 footnote 42, p.42).

### 4.4 What must be measured and reported (§4.1 pp.24-26)

- FIs **shall** measure absolute scope 1 + 2 + 3 emissions of borrowers, **for all sectors**, from reports published in 2025 onward. The old phase-in (energy/mining only from 2021; transport/construction/materials from 2023) has ended.
- FIs **shall separately disclose** scope 1+2 from scope 3.
- FIs **shall** disclose the weighted data quality score.
- FIs **should** disclose a fluctuation analysis and (optional) an inflation-adjustment for reference-year comparisons (new in 3rd edition, §6.1).

---

## 5. Emission scope expectations

From S2 §5.1-5.6 opening subsections:

| Asset class | Scope 1 | Scope 2 | Scope 3 |
|-------------|---------|---------|---------|
| Listed equity + corporate bonds | Required | Required | Required (all sectors, from 2025) |
| Business loans + unlisted equity | Required | Required | Required (all sectors, from 2025) |
| Project finance | Required | Required | Required (project scope 3 — e.g. upstream fuel supply for a power plant) |
| Commercial real estate | Required (on-site combustion, refrigerants) | Required (purchased electricity) | Not required (out-of-scope for CRE at FI level) |
| Mortgages | Required (household heating fuels) | Required (household purchased electricity) | Not required |
| Motor vehicle loans | Required (fuel burn — tank-to-wheel) | Required (electric charging) | Not required for the vehicle itself |
| Sovereign debt | Required (national inventory scope 1) | Required (scope 2 imports) | Optional (consumption-based emissions) |

FIs must explain if scope 3 cannot be reported because of data availability (S2 p.41). Practical effect: **for the Nepal demo, cement borrowers must have scope 1 + 2 + 3 reported or estimated**; hydropower project finance must have scope 1 + 2 + 3 for the project.

---

## 6. Sector-specific guidance relevant to the demo

PCAF Part A does **not** publish a separate sector-guidance document per sector; sector-specific detail is embedded in the asset-class chapters. But the emission-factor database and the "options" hierarchy imply the following defaults for the demo's four sectors:

### 6.1 Cement / manufacturing (business loans, unlisted equity)

- **Emissions basis:** scope 1 dominated by clinker calcination (process emissions from CaCO₃) plus fuel combustion in the kiln; scope 2 from grid electricity; scope 3 from purchased clinker if imported, plus downstream distribution.
- **Best-attainable score with typical Nepal cement borrower:**
  - Score 1 requires verified GHG report per GHG Protocol — most Nepali cement companies do **not** have this.
  - Score 3 (Option 2b) is realistic if the bank captures the borrower's **annual clinker production in tonnes** and the demo applies a Nepal / South Asia grid-and-fuel-mix EF (e.g. 0.85-0.95 tCO₂e per tonne cement).
  - Score 4 (Option 3a) is the fallback where the bank knows revenue but not physical output.
  - Score 5 (Option 3b) uses outstanding amount × sector average EF per unit of asset.
- **Emission factors:** PCAF Emission Factor Database has cement-sector NAICS 327310 EFs by country. For countries without country-specific factors, PCAF permits regional (South Asia) fallback.

### 6.2 Hydropower / electricity generation (project finance)

- **Emissions basis:** hydropower project scope 1 emissions include reservoir methane (for large storage projects — meaningful for tropical reservoirs), plus construction-phase emissions if capitalised; scope 2 electricity used at the site is trivial; scope 3 includes upstream cement / steel embodied emissions.
- **Best-attainable score with typical Nepal hydro borrower:**
  - Score 3 (Option 2b) is achievable if the bank captures **installed capacity (MW), annual generation (GWh), and reservoir surface area (km²)**. Emissions can then be computed via IPCC 2019 refinement (Vol.4 Ch.7) for reservoir CH₄, and applied to the generation figure.
  - Score 4 (Option 3a) if only project revenue is known.
- **Special note:** run-of-river projects (dominant in Nepal) have near-zero scope 1 emissions; reservoir projects (Kulekhani-type) do have measurable CH₄. Getting to Score 2 for either requires the developer to publish verified emissions — most Nepal SPVs will not.

### 6.3 Commercial real estate / commercial buildings

- **Best-attainable score:**
  - Score 1 requires a full smart-meter energy log with supplier-specific EFs — vanishingly rare.
  - Score 2 (Option 1b): actual metered kWh consumption from utility bills — feasible for larger commercial borrowers.
  - Score 3 (Option 2a): energy-label / EPC-based estimate — Nepal has **no** national EPC scheme, so this is largely N/A.
  - Score 4 (Option 2b): floor area × building-type-and-location statistical intensity — realistic default.
  - Score 5 (Option 3): number of buildings × per-building intensity — worst case.

### 6.4 Motor vehicles / transport

- **Best-attainable score:** Score 4-5 typical for a Nepali auto-loan portfolio unless the bank captures make/model/year at origination (which many now do for insurance purposes). If make/model captured → Score 3 achievable. Score 1/2 requires odometer / fuel-card data.

Note that PCAF publishes **separate** sector-guidance documents only for the Insurance-Associated Emissions Standard (Part C, personal motor attribution paper). For financed emissions there is no standalone sector-guidance doc.

---

## 7. Applicability to Nepal

### 7.1 Nepal signatories and governance seats

- **NMB Bank Ltd** — signatory since 2021; disclosed 2022 baseline (S7). Dinesh Dulal (Head of Sustainable Banking, NMB) is a **PCAF Board Director** and on the Global Core Team that governs the standard (S2 pp.3-4). This is the single largest source of PCAF familiarity inside the Nepal BFI market.
- To our best knowledge (as of the search date) **no other Nepali commercial bank has publicly signed on**; NMB remains the pioneer. This includes Laxmi Sunrise, which has not published a PCAF-aligned disclosure.

### 7.2 NRB position

Nepal Rastra Bank has **not** formally required PCAF-conformant reporting. NRB's climate posture flows through:

1. The 2018 (revised 2022) ESRM Guideline — screening + due-diligence framework, not an emissions-accounting framework.
2. Circular 22 (Nepal Green Finance Taxonomy activity list, Oct 2024) — activity classification.
3. NFRS S1 / S2 exposure drafts (aligned to IFRS S1 / S2).

NFRS S2 (Nepal's adoption of IFRS S2) explicitly cross-references PCAF as the **default methodology for financed emissions**, echoing IFRS S2 Appendix B58-B63 which points to the "GHG Protocol Corporate Value Chain (Scope 3) Accounting and Reporting Standard, applying the methodology described in the Global GHG Accounting and Reporting Standard for the Financial Industry published by PCAF" as the required approach for scope 3 category 15 financial-sector emissions. Alternatives are permitted but require justification.

### 7.3 What this means for the demo narrative

- Saying "**Jana computes PCAF-aligned scope 3 category 15 financed emissions per NFRS S2 §B58**" is defensible.
- Saying "NRB requires PCAF" is **not** defensible — NRB has not issued a mandate; the pathway is via NFRS S2 conformance.
- Saying "NMB Bank sits on the PCAF Board and is the Nepal reference implementation" is defensible and useful for social proof.

---

## 8. Assessment of the demo's current "Score 2 vs Score 5" claim

### 8.1 What the demo currently claims

The tour narration currently states: *"With Jana, this hydropower project loan achieves a PCAF Score 2. Without Jana — with the manual spreadsheet baseline — it lands at Score 5."*

### 8.2 What is actually achievable

For a **hydropower project finance loan** with a mid-sized Nepal developer:

- **Score 2 requires** either (a) the developer publishing GHG-Protocol-conformant emissions with third-party verification (rare; almost no Nepal IPPs do this) or (b) the developer publishing unverified GHG-Protocol-conformant emissions (Score 2 = Option 1b). Neither is likely today.
- **Score 3** is the realistic best case with Jana's help — the bank captures MW installed capacity + GWh generated + reservoir surface area, and applies IPCC-2019 reservoir CH₄ EFs. That's Option 2b (physical production data × sector EF) which is **Score 3, not Score 2**.
- **Score 5** is the correct baseline without Jana — outstanding × sector asset-based EF.

For a **cement borrower** (business loan §5.2):

- **Score 2 requires** an unverified GHG-Protocol-conformant scope 1+2+3 report from the borrower. Nepal cement companies typically do not publish this.
- **Score 3** achievable if Jana captures annual cement production tonnage — Option 2b.
- **Score 4** achievable if only revenue is captured — Option 3a.
- **Score 5** is the baseline without any borrower-specific data.

### 8.3 Recommendation

**Walk the "Score 2" claim back to "Score 3"** for the demo default. Say:

> *With Jana we lift these loans from Score 5 (outstanding-amount × sector average EF, no borrower data) to Score 3 (borrower's physical production or energy data × sector EF). Score 2 is achievable only where the borrower publishes GHG-Protocol-conformant emissions — Jana is ready to consume that when it exists, but for the Nepal market today Score 3 is the honest ceiling.*

This is technically precise, defensible under S2 §5.2 and §5.3, and still tells the same story (two-notch improvement, materially better auditability).

Alternate framing: keep "Score 2" but only for the specific case of an NMB-Bank-style borrower that publishes GHG data — and be explicit about the pre-condition.

### 8.4 What a PCAF-conformant integration requires our platform to capture

Per loan:
- Asset class (mandatory decision — see §5 decision tree in S2).
- Outstanding amount at fiscal-year-end + fiscal-year-end date.
- For each of Option 1a/1b/2a/2b/3a/3b/3c chosen, the specific data field(s) enumerated in §9 below.
- The chosen option + resulting DQS (1-5).
- Emission factor source + version (PCAF DB row, IPCC guideline, national inventory year).
- Vintage / lag (year of financial data vs year of emissions data).
- Free-text justification if scope 3 not reported.

Per portfolio:
- Weighted absolute financed emissions (tCO₂e) by asset class × scope × sector.
- Weighted average DQS per asset class.
- Fluctuation analysis year-over-year (new 3rd-ed recommendation).
- Inflation-adjustment note if used (new 3rd-ed recommendation).

---

## 9. Data-model requirements (per loan, by asset class)

### 9.1 Common (all asset classes)

- `loan_id`, `borrower_id`, `asset_class` (enum of the 10), `outstanding_amount_ccy`, `outstanding_amount_ccy_iso`, `outstanding_amount_reporting_date`, `pcaf_option_chosen` (1a/1b/2a/2b/3a/3b/3c), `pcaf_data_quality_score` (1-5), `emission_factor_source`, `emission_factor_version`, `emissions_reporting_year`, `financial_reporting_year`, `sector_naics_or_nsic`, `country`.

### 9.2 Business Loans & Unlisted Equity (§5.2)

- If Option 1a/1b: `borrower_scope1_tCO2e`, `borrower_scope2_tCO2e`, `borrower_scope3_tCO2e`, `verifier_name` (1a only), `verification_standard` (1a only), `ghg_protocol_conformance_evidence`.
- If Option 2a: `borrower_energy_consumption_kwh_by_source`, `energy_source_specific_ef`.
- If Option 2b: `borrower_physical_production_units`, `borrower_physical_production_uom`, `sector_ef_per_uom`.
- If Option 3a: `borrower_revenue_ccy`, `revenue_period`, `sector_ef_per_revenue`.
- If Option 3b: `sector_ef_per_asset_value`.
- If Option 3c: `sector_asset_turnover_ratio`, `sector_ef_per_revenue`.
- Denominator: `borrower_total_equity`, `borrower_total_debt`, `borrower_balance_sheet_date`, or `evic` if listed.

### 9.3 Project Finance (§5.3)

Same numerator options as §9.2 above, plus:

- `project_id`, `project_name`, `project_total_cost_ccy`, `project_total_equity_ccy`, `project_total_debt_ccy`, `project_capacity_uom` (MW / tCement / etc.), `project_annual_output`, `project_commercial_operation_date`.
- Hydro-specific: `installed_capacity_mw`, `annual_generation_gwh`, `reservoir_surface_area_km2`, `project_type` ∈ {run-of-river, reservoir, pumped-storage}.

### 9.4 Commercial Real Estate (§5.4)

- `property_id`, `property_type` (retail/office/hotel/industrial/multifamily), `floor_area_m2`, `property_value_at_origination`, `country`, `state_or_province`.
- If Option 1a: `metered_kwh_by_energy_source`, `supplier_ef_by_source`.
- If Option 1b: `metered_kwh_by_energy_source`, `grid_ef_by_source`.
- If Option 2a: `energy_label_grade`, `label_scheme`.
- If Option 2b: floor_area × building-type-location EF.
- If Option 3: `building_count`.

### 9.5 Mortgages (§5.5)

- Same as CRE but the property-type enum is dwelling categories (single-family / 2-4 units / 5+ units / mobile).

### 9.6 Motor Vehicle Loans (§5.6)

- `vehicle_make`, `vehicle_model`, `vehicle_year`, `fuel_type`, `vehicle_value_at_origination`.
- Option 1a: `annual_fuel_litres`.
- Option 1b: `annual_km_driven`, `fuel_efficiency_l_per_100km`, `fuel_type`.
- Option 2a/2b: `distance_stat_source`.
- Option 3a/3b: fallback to national/regional average distance × known-model or average-vehicle EF.

### 9.7 Sovereign / Sub-sovereign (§5.9-5.10)

- `sovereign_id` (ISO alpha-3 for sovereigns; NUTS/state code for sub-sovereigns).
- `national_inventory_source` (UNFCCC / PRIMAP / national submission).
- `inventory_year`.
- `ppp_adjusted_gdp` and `total_government_debt` for denominator options.
- `consumption_emissions_included` (bool).

### 9.8 Cross-cutting derived fields

- `financed_emissions_scope1_tCO2e = attribution_factor × borrower_scope1`.
- `financed_emissions_scope2_tCO2e = attribution_factor × borrower_scope2`.
- `financed_emissions_scope3_tCO2e = attribution_factor × borrower_scope3`.
- `attribution_factor` (dimensionless, computed).
- Portfolio-level weighted DQS = Σ(financed_emissions_i × DQS_i) / Σ(financed_emissions_i).

---

## 10. What this feeds

1. **Platform upgrade — score computation:** Jana currently hard-codes `pcaf_score = 2 | 3` in demo data. Replace with a real computation function `pcaf.score(loan) → { option, score, missing_fields }` that inspects the fields captured in §9 and returns the highest-quality option the data supports. This makes "Score 2 with Jana" earned rather than declared.
2. **Cross-framework mapping:** map PCAF §5.2/§5.3 data fields to (a) NFRS S2 §B58-63 disclosures, (b) the NRB Circular 22 activity list (so a taxonomy-classified hydro project auto-suggests Project Finance §5.3), and (c) the ESDD Annex-5 due-diligence questions where they overlap (e.g. "installed capacity in MW" is asked in ESDD and needed for PCAF Option 2b).
3. **Demo narrative fix:** revise the tour audio to say "Score 3 with Jana / Score 5 without" for the default cement + hydropower cases, and reserve "Score 2" for the specific NMB-style borrower demo variant.

---

*End of research pack. All quoted section numbers refer to S2 (PCAF Part A, 3rd Edition, Dec 2025) unless noted. Score tables §3.2-§3.5 are cross-checked against S6 (which reproduces the 2nd-edition Annex verbatim) and the S5 CDP-PCAF alignment paper; the 3rd edition preserves the option lettering and score meaning.*
