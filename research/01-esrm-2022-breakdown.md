# NRB ESRM Guideline 2022 — Structured Breakdown

> Source: Nepal Rastra Bank, Banks and Financial Institutions Regulation Department, *Guideline on Environmental & Social Risk Management (ESRM) for Banks and Financial Institutions*, February 2022. 70 pages, A4. (`uploads/Final-ESRM-without-cover-1.pdf`)
> Compared against: same guideline, May 2018 edition, 66 pages (`uploads/Guidelines-Guideline_on_Environmental__Social_Risk_Management_for_Banks_and_Financial_Institutions_2018-new.pdf`).
>
> This breakdown is the source of truth for updating `lib/regulatory/esdd/annex5-questions.ts`. Section numbering cited below refers to the 2022 PDF unless otherwise stated. Note that the printed section numbering in the 2022 PDF is inconsistent — the ESRM procedures subsections are printed as "1.1"–"1.3.8" in-body but appear as "7.1"–"7.3.8" in the Table of Contents. This document uses the ToC numbering because that is the one every downstream reference uses.

---

## 1. Document metadata

| Field | Value |
|---|---|
| Full title | Guideline on Environmental & Social Risk Management (ESRM) for Banks and Financial Institutions |
| Issuing authority | Nepal Rastra Bank (NRB), Central Office, Banks and Financial Institutions Regulation Department |
| Issue date | February 2022 |
| Supersedes | May 2018 edition (same title). Note: 2018 file metadata says "Guidelines on ESRM-February 2017.doc" — the document has been in circulation since 2017 in draft form. |
| Applicability | All BFIs regulated by NRB engaged in SME finance, commercial leasing, Term Finance, or project finance. Not scoped by class (A / B / C / D / IDB) in the guideline text — applicability is by transaction type, not by license class. §5. |
| International anchors | IFC Performance Standards; Equator Principles; ISO 14001; ISO 45001:2018 (was OHSAS 18001); SA8000; Sustainable Banking and Finance Network (SBFN). §6. |
| Companion tool | Excel-based ESDD Checklist (Annex 5) that auto-computes the Low/Medium/High risk rating. |
| Not addressed in this doc | Circular 22 attachment / checklist supplement — those live in separate files (Circular 22 attachment + Circular 22 checklist XLS, both in `uploads/`) and are the source of the per-sector supplements task R2 is capturing. |

---

## 2. Chapter-by-chapter breakdown

### §1. Introduction (p.5)

Sets context — Nepal's environmental quality has deteriorated over 15 years, pollution above WHO safe limit, Nepal is highly vulnerable to climate change (ADB projects 2.2% GDP loss/year by 2050). BFIs positioned to shape climate/social outcomes through lending. NRB joined SBFN in 2014.

- **Data fields:** none (narrative preamble).
- **Decision rules:** none.

### §2. Overview of the ESRM Guideline (p.6)

Objective: integrate E&S risk management into overall credit risk process so credit authority is informed before financing. **2022 explicitly adds "climatic" risks alongside environmental and social.**

- **Data fields:** none.
- **Decision rules:** none.

### §3. Typical E&S Risks for BFI Clients (p.6-7)

Defines environmental risk (function of sector), social risk (function of client behaviour), and — new in 2022 — climate risk as a sub-category of environmental risk covering physical (extreme weather, water scarcity, power shortage) and transition (policy, technology, market shifts to low-carbon).

- **Data fields (per client):**
  - `sector` (industry classification, drives environmental risk)
  - `client_behaviour_flags` (labour standards, safety, resettlement, IP impact — drives social risk)
  - `physical_climate_exposure` (flood, landslide, drought, epidemic, fire — Nepal-specific list)
  - `transition_climate_exposure` (carbon-intensive?)
- **Decision rules:** none directly; feeds §7.

### §4. Risks to BFIs Associated with Client E&S Risks (p.7-8)

Enumerates four BFI-level risk categories that flow from client E&S issues:
- Credit risk
- Legal risk
- Operational risk
- Reputational risk

- **Data fields:** each transaction should carry an attribute set for later reporting: `bfi_risk_categories[]` — {credit, legal, operational, reputational}.
- **Decision rules:** none; conceptual framing.

### §5. Applicability of the Guideline (p.8-10) — THE CORE ROUTING RULES

Defines four transaction buckets and what applies to each.

- **Data fields (per loan application):**
  - `application_type` — enum: `New | Renewal | Rescheduling | Restructuring`
  - `loan_amount_npr` (numeric, drives threshold)
  - `is_business_purpose` (boolean)
  - `transaction_type` — enum: `SME_finance | commercial_leasing | term_finance | project_finance | short_term | working_capital | trade | retail`
  - `tenor_months` (numeric; short-term = <12 months)
  - `sector_code` (against the critical-sector list below)
  - `on_exclusion_list` (boolean — Annex 4)
  - `exclusion_reason` (nullable text)
- **Decision rules (algorithmic — encode verbatim):**
  1. **Exclusion screen FIRST for all business-purpose loans:** if `on_exclusion_list == true` → **reject transaction**.
  2. **Bucket selection:**
     - `loan_amount_npr < 10,000,000` AND `sector NOT IN critical_sectors` AND `tenor >= 12mo` → **Small loan / non-critical** → exclusion list + national laws only, no ESDD.
     - `loan_amount_npr < 10,000,000` AND `sector IN critical_sectors` → **Small loan / critical** → full ESDD via Annex 5 required regardless of size.
     - `loan_amount_npr >= 10,000,000` AND transaction is term financing (>1yr) → **Term Finance** → ESDD via Annex 5 required.
     - transaction is project finance (non-recourse / limited recourse, large infra) → **Project Finance** → ESDD + Annex 5b Screening Questionnaire + EIA if required by Nepal law (typically >50 MW hydro etc.).
     - `tenor_months < 12` OR working-capital / trade / retail → exclusion list + national laws only.
  3. **Critical sectors list (2022 unchanged from 2018):**
     - Washing/dyeing/finishing of RMG
     - Small steel re-rolling mills
     - Brick kilns
     - Tanning/dressing/dyeing of leather and fur
     - Pesticides / agrochemicals / nitrogen manufacturing
     - Chemicals and chemical products manufacturing
     - Rubber and plastic products manufacturing
     - Batteries and accumulators manufacturing
     - Paper manufacturing and paper pulp processing
     - Small foundries
- **Threshold in code:** `NPR 10,000,000` (≈ USD 100,000). Cited in text as small-loan cutoff.

### §6. Applicable Standards (p.10)

Minimum requirement: exclusion-list screen (Annex 4) + all national E&S laws + relevant ILO conventions Nepal has signed (list in Annex 6). International frameworks (ISO 14001, ISO 45001, SA8000, IFC PS, Equator, buyer supply-chain standards e.g. Apple/H&M/Ikea/Nike/Starbucks/Walmart) treated as best practice.

- **Data fields:**
  - `national_permits_valid` (boolean per permit)
  - `permits_list[]` — {permit_name, issued_date, expiry_date, issuing_authority, status}
  - `iso_14001_certified`, `iso_45001_certified`, `sa8000_certified` (booleans, best-practice flags)
  - `buyer_supply_chain_audit` (text — e.g. "H&M vendor audit 2024-06 passed")
  - `ifc_ps_adherence` (boolean — for project finance)
- **Decision rules:** if any required permit is missing/expired → the transaction is not necessarily rejected, but ESDD Q1.1 answer will be "b" or "c" (see §7.3.4 rating scheme).

### §7. Environmental and Social Management System (ESMS) for BFIs (p.10-18)

Defines the ESMS = policy + procedures + tools + capacity. This is the operating manual chapter.

#### §7.1 E&S Policy (p.12)
BFI must have a board-approved E&S policy. Content prescribed:
- **Data fields:**
  - `esrm_policy_approved` (boolean)
  - `esrm_policy_approval_date` (date)
  - `esrm_policy_document_id` (link/blob)

#### §7.2 Roles and Responsibilities (p.12-13)
Assigns process ownership. See §6 of this deliverable for the full role catalogue.
- **Data fields (per bank, one-time):**
  - `rm_department` (string)
  - `credit_risk_manager_id` (user ID)
  - `legal_dept_head_id` (user ID)
  - `credit_authority_definitions[]` (org chart — who approves what tier)
  - `es_focal_point_id` (user ID; often Head of Credit)
- **Data fields (per transaction):**
  - `rm_officer_id`, `cro_reviewer_id`, `legal_reviewer_id`, `approving_authority_id`

#### §7.3 E&S Risk Management Procedures (p.13-18) — 8-STEP PROCESS

Eight steps: (1) Exclusion List → (2) Initial Categorization → (3) ESDD → (4) Generate Risk Rating → (5) Risk Management & Control → (6) Escalation → (7) Monitoring → (8) Reporting.

##### §7.3.1 Screening Transactions (p.15)
Data field: `exclusion_screen_pass` (boolean), `exclusion_screen_date`, `exclusion_screen_officer`.

##### §7.3.2 Categorizing Transactions (p.15)
Data field: `esdd_category` — enum: `small_non_critical | small_critical | term_finance | project_finance | short_term`. Derived from §5 rules above.

##### §7.3.3 Conducting E&S Due Diligence (p.15-17)
Three activity sets depending on category:

**For Small loans in critical sectors:**
- Documents check (Pollution Control Certificate valid; Sewage/Sanitary/Drinking-water completion certificate where applicable; Fire Safety Certificate)
- Compliance history review (fines, penalties, incidents last 3 yrs)
- Annex 5 ESDD Checklist + Annex 7 E&S Risk Summary

**For Term Finance:**
- Documents check + BES/IEE/EIA approval if required
- Compliance history review
- **Mandatory site visit** — process areas, workforce size, labour practices, land use, effluent, air emissions, hazmat storage
- Annex 5 + Annex 7

**For Project Finance:**
- Documents check (all of the above)
- Compliance history review; for hydropower add Annex 2 review
- **Mandatory site visit**, focus areas listed in text (PPE use, storage tanks, discoloration of streams, noise, odour, proximity to communities, resident complaints)
- Review of BES/IEE/EIA report and conditions
- Annex 5 **plus Annex 5b Project Finance Screening Questionnaire** (or external consultant)
- Annex 7

**Data fields per transaction (ESDD workflow):**
- `esdd_started_at`, `esdd_completed_at`
- `documents_reviewed[]` — {document_type, doc_id, valid_from, valid_to, verified_by}
- `site_visit_required` (boolean, derived from category)
- `site_visit_conducted` (boolean), `site_visit_date`, `site_visit_officer_id`, `site_visit_notes` (text)
- `bes_iee_eia_type` — enum: `none | BES | IEE | EIA | supplementary_EIA | strategic_EIA`
- `bes_iee_eia_approval_id`, `bes_iee_eia_approval_date`
- `annex5_completed` (boolean), `annex5b_completed` (boolean, project finance only)
- `external_consultant_used` (boolean), `external_consultant_report_id`

##### §7.3.4 E&S Performance Risk Rating (p.17-18) — CRITICAL SCORING RULE
The Annex 5 Excel tool "automatically generates" an ESRR of **Low / Medium / High**. The rating is transaction-specific, not sector-specific — a high-risk sector with excellent management can be "Low".

Definitions given verbatim (encode these as tooltip text):
- **HIGH:** "significant adverse E&S impacts that are diverse, irreversible or unprecedented"; also indicates serious non-compliance. Named examples: loss of major natural habitat, converting agri land to industrial, resettlement, UNESCO site impact.
- **MEDIUM:** "specific E&S impacts that are few in number, generally site-specific, largely reversible and readily addressed"; also less serious non-compliance / unresolved non-material issues.
- **LOW:** minimal/no impacts; no compliance issues.

The doc does NOT publish the exact aggregation formula that turns question answers (a/b/c/d) into Low/Medium/High. Implementation must reconstruct it from the checklist (see §5 of this breakdown). Working assumption used by existing `annex5-questions.ts`: any "c" answer → High; any "b" answer with no "c" → Medium; all "a" or "d" → Low. This is a defensible default but should be flagged as an assumption for a compliance-team review.

**Data fields:**
- `esdd_rating` — enum: `Low | Medium | High`
- `esdd_rating_computed_at` (timestamp)
- `esdd_rating_override` (nullable enum — for CRO manual override with reason)
- `esdd_rating_override_reason` (text)

##### §7.3.5 Decision Making — Corrective Action Plan and Covenants (p.18)
- **Low:** no further action.
- **Medium / High:** time-bound corrective action plan (Annex 8) + E&S covenants (Annex 9) attached to loan documentation.
- Annex 7 E&S Risk Summary prepared for credit authority.

**Data fields:**
- `cap_required` (boolean, derived: rating in {Medium, High})
- `cap_items[]` — {risk_area, corrective_action, deadline_date, responsible_party (enum: client_staff | management | board), cost_npr, indicator, status}
- `covenants[]` — {type (enum: positive | negative | condition_precedent | event_of_default), text, deadline}

##### §7.3.6 Escalation (p.18)
**Rule:** all Medium and High ESRR transactions escalate to **one level higher** credit authority than would normally approve that loan size.

**Data fields:**
- `escalation_required` (boolean, derived)
- `escalated_to_authority_id` (user/role ID)
- `escalation_date`
- `escalation_decision` (enum: approved | conditionally_approved | rejected)

##### §7.3.7 Risk Monitoring (p.18)
Periodic monitoring throughout project life cycle using Annex 10 template. Frequency tailored per transaction — driven by ESRR + CAP status. If non-compliance found → require new CAP and/or third-party monitoring.

**Data fields (per monitoring cycle):**
- `monitoring_report_id`, `reporting_period_start`, `reporting_period_end`
- `covenant_compliance_status` (enum: fully | partial | not | delayed)
- `new_incidents` (boolean), `incident_descriptions[]`
- `new_fines_penalties[]` — {issuing_body, amount_npr, reason, resolution_status}
- `permits_still_valid` (boolean)
- `grievances_received[]` — {source, description, resolution}

##### §7.3.8 Internal Reporting and BFI Reporting to NRB (p.18)
- Internal: reports to senior management + shareholders.
- External: annual report to NRB using Annex 11 template.

**Data fields:** see §7 (Reporting) of this deliverable.

### §8. Implementing ESMS (p.18-19)
BFI must produce an implementation plan, integrate ESMS into Credit Manual, run a testing phase, and review periodically.
- **Data fields:** `esms_implementation_plan_id`, `esms_last_reviewed_date`.

### §9. NRB Monitoring and Control (p.19)
NRB requires annual reporting on: (a) progress integrating E&S into credit risk process; (b) capacity-building activities; (c) internal monitoring/evaluation procedures; (d) E&S risk profile of relevant portion of portfolio (by NSIC sector).
- See §7 Reporting for the exact fields.

---

## 3. Sector-specific annexes / supplements

**Important scoping note:** The 2022 ESRM Guideline PDF itself contains **only one sector-specific supplement in the body**, which is Annex 2 (Hydropower). It also lists sector-specific *permitting* requirements in Annex 6 A5. The per-sector question supplements the demo currently ships (task #23) originated from the **Circular 22 attachment** — that document is being ingested separately under task R2 (`Nepal_Banking_Compliance_Data_Requirements.pdf` / Circular 22 attachment / checklist XLS). This section only reports what is *in the 2022 Guideline itself*.

### Annex 2: E&S Risk Management Considerations in Hydropower Projects (p.27-28)

#### Documentation matrix (by capacity)

| Capacity | Assessment required | Suggested docs for financing |
|---|---|---|
| >50 MW | EIA | Company registration (VAT, PAN, cert, AoA, MoA); Survey license (gen/trans/dist or combined); EIA approved by Federal or Provincial Ministry; Development licence; Power Purchase Agreement (PPA) |
| 1–50 MW | IEE | Company registration; Survey licence; Letter of approval or IEE from MoEWRI via Dept of Electricity Development (or provincial ministry responsible for Energy if single-province); Development licence; PPA |
| <1 MW | None (except forest-land projects need IEE) | For 100 kW–1 MW: licence issued by local government (may seek DoED consent) |

**Data fields (hydropower loan):**
- `installed_capacity_mw` (numeric — drives assessment tier)
- `crosses_provinces` (boolean)
- `on_forest_land` (boolean)
- `company_reg_docs_verified` (boolean set)
- `survey_licence_id`, `survey_licence_type` (gen / trans / dist / combined)
- `assessment_type` — enum: `EIA | IEE | none`
- `assessment_approval_authority` — enum: `federal | provincial | local | not_required`
- `assessment_approval_date`
- `development_licence_id`
- `ppa_id`, `ppa_counterparty` (typically NEA)

#### Environmental & social aspects checklist (all hydropower projects)

Grouped by aspect. Each entry becomes a checklist item that the RM confirms during site visit / document review.

- **Construction-related issues:**
  - `wastewater_discharges` — worker camp sanitary effluents
  - `stormwater_runoff` — TSS
  - `rock_extraction_tunnelling_discharges`
  - `solid_waste_rock_topsoil_storage`
  - `biodiversity_aquatic_terrestrial_surveys` (upstream/downstream of effluent discharge)
  - `air_quality_pm_at_boundary`, `black_smoke_visible`, `dust_visible`
  - `noise_vibration_at_receptor` (include pre-blasting community-infrastructure surveys)
- **Hydrology / Morphology:**
  - `streamflow_upstream`, `streamflow_downstream`
  - `water_consumption_downstream`
  - `stored_water_volume` (reservoirs)
  - `flow_velocity_depth`
- **Water quality:**
  - `temperature_upstream`, `temperature_downstream`
  - `dissolved_oxygen`, `tss`, `water_clarity`, `phosphates_nitrates` (in reservoir + downstream)
- **Sediment transport:**
  - `tss_upstream_downstream`, `sediment_deposition`, `stream_morphology`, `structural_risk_to_in_stream_structures`
- **Emissions (storage reservoirs):**
  - `co2_reservoir`, `h2s_reservoir`, `methane_reservoir`
- **Resettlement:**
  - `land_acquisition_extent`, `compensation_amount_npr`, `affected_land_ha`, `affected_properties_count`
- **Indigenous Peoples / vulnerable community:**
  - `ip_land_impact`, `religious_sites_impact`, `culture_tradition_impact`, `local_economy_impact`, `employment_impact`
- **Aquatic ecology:**
  - `fish_invertebrate_species_upstream_downstream_reservoir`, `habitat_preference_indicator_species`
- **Terrestrial ecology:**
  - `forestation_upstream_reservoir_riparian`, `forest_types`, `major_plant_species`, `ntfp_present`, `wildlife_species_distribution_numbers`
- **Land use:**
  - `vegetation_cover_change`, `land_use_change_in_watershed`
- **Community health:**
  - `water_based_vectors`
- **Community safety:**
  - `dam_structural_safety_construction_survey`, `dam_structural_safety_post_construction_survey`
  - `downstream_population_riparian_resource_use`

#### Guidance notes
- The Nepal Hydropower EIA Guideline (MoFE 2018 with IFC support) is cited as the reference for practitioners — banks should require sponsor compliance with it.
- IFC Hydro Advisory tools referenced for diagnostic support.

### Annex 3: E&S Risks for Various Types of Credits (p.29-30)

Not a sector supplement per se — it explains how E&S risk manifests differently across:
- SME lending
- Commercial leasing (finance lease vs operating lease — different liability)
- Term Finance
- Project Finance

**Data field (per transaction):** `lease_type` — enum: `finance | operating | n/a` (drives liability allocation in leasing).

### Annex 6 A5: Permitting requirements by sector (p.54-56)

Table of licences by sector. For each sector, the mandatory permit set is:

| Sector | Required permits (2022) |
|---|---|
| Agricultural & Forest Related | BES/IEE/EIA (as applicable); Pollution Control Certificate; ministry approvals |
| Fishery Related | IEE/EIA; Pollution Control Certificate; ministry approvals |
| Mining Related | BES/IEE/EIA; Pollution Control Certificate; Fire Safety Certificate; ministry approvals |
| Agriculture, Forestry & Beverage Production | BES/IEE/EIA; Pollution Control Certificate; Fire Safety; ministry approvals |
| Non-food Production | BES/IEE/EIA; Pollution Control Certificate; Fire Safety; Nepal Standards (NS) certification for cement (OPC/PPC/PSC), LPG cylinders, composite gas cylinders, LPG bottling; ministry approvals |
| Construction | BES/IEE/EIA; Pollution Control Certificate; building design approval (Building Act 1998); Building Code Standard 2014 approval; Fire Safety; ministry approvals |
| Power, Gas and Water | BES/IEE/EIA; Pollution Control Certificate; ministry approvals |
| Metal Products, Machinery & Electronic Equipment | BES/IEE/EIA; provisional/permanent Pollution Control Certificate; Fire Safety; NS certification for dry cell/battery, iron bar, GI wire, PVC cable, LPG regulator/valves |
| Transport, Communication & Public Utilities | BES/IEE/EIA; Pollution Control Certificate; Green Stickers (Nepal Vehicle Mass Emission Std 2012); ministry approvals |
| Wholesaler & Retailer | BES/IEE/EIA (rare); Pollution Control Certificate; foreign quality/health/phytosanitary/fumigation certs for food imports; product analysis certificate |
| Finance, Insurance & Real Estate | BES/IEE/EIA; Pollution Control Certificate; building design approval; Fire Safety |
| Hotel or Restaurant | BES/IEE/EIA; Pollution Control Certificate; building design approval; Fire Safety |
| Other Services | BES/IEE/EIA; Pollution Control Certificate; Sewage/Sanitary/Drinking Water completion certificate (Health Institutions Standard 2014); Fire Safety |
| Consumption Loans | None specified |
| Local Government | None specified |

**Data fields (per client sector):**
- `sector_nsic_code` (map to the table)
- `required_permit_types[]` (derived from sector via lookup)
- `permits_on_file[]` (checked against required)
- `missing_permits[]` (derived — feeds ESDD Q1.1)

**Sectors called out in the R1 brief but NOT given per-sector questions in the 2022 PDF:** cement, textiles, steel, chemicals, brick, tourism, healthcare, transportation, real estate. These appear only as items in the critical-sector list (§5) or in Annex 6's permit table. Any sector-specific questionnaire the demo uses beyond Annex 2 (hydropower) comes from Circular 22 or from the demo team's own extensions — not from this Guideline.

---

## 4. Climate risk provisions (NEW in 2022 vs 2018)

The flagship 2022 addition. Located in a dedicated section between Annex 1 and Annex 2 (p.24-26, unnumbered heading: **"Climate-related risks and Financial Institutions"**) plus a new ESDD question 2.5 and an NGFS-based taxonomy table.

### 4.1 What climate risks banks must consider

**Physical risks** (encode as enum values):
- Extreme weather events: tropical cyclones/typhoons, floods, winter storms, heat waves, droughts, wildfires, hailstorms
- Ecosystems pollutions: soil degradation and pollution, water pollution, marine pollution, environmental accidents
- Sea-level rise
- Water scarcity
- Deforestation
- Desertification

**Transition risks** (encode as enum values):
- Public policy change: energy transition policies, pollution control regulation, resource conservation policies
- Technology changes: clean energy technologies, energy saving technologies, clean transportation, other green technologies
- Shifting sentiment
- Disruptive business model

Source cited: NGFS (Network for Greening the Financial System) — "Overview of Environmental Risk Analysis by Financial Institutions".

### 4.2 Named sectors/activities in the climate discussion

The text calls out these transmission channels rather than a fixed sector list:
- Market supply/demand price shifts (any sector)
- Asset efficiency/output/performance degradation
- OPEX increases (input prices, maintenance)
- Insurance cost increases / insurer withdrawal
- CAPEX for facility upgrades to meet new pollution rules
- Staff health/safety/productivity impacts
- Loss contingency reserve increases
- Asset depreciation acceleration
- Country risk (GDP tied to scarce water, small vulnerable economies)

### 4.3 Scoring / threshold rules — ESDD Q2.5 (NEW)

The single hard rule added to the checklist:

> **Q2.5:** *Are there any Climate Change related risks (flood, drought, cyclone etc.) and opportunities (GHG emission reduction) associated with the client's operation?*
> - **a)** Client has a robust disaster management plan AND has procedures to measure, disclose, set targets, and mitigate GHG emissions.
> - **b)** Client has a disaster management plan but it is not robust AND there is evidence of intention to measure, disclose, set targets, mitigate GHG in near future.
> - **c)** No disaster management plan AND no definite plan to measure, disclose, set targets, mitigate GHG.
> - **d)** Not applicable.

**GHG reporting threshold (guidance note 2.5):** Clients with more than **25,000 metric tons of annual CO₂ emissions** need to report and should have an emission reduction plan. This is the only hard numeric climate threshold in the Guideline.

### 4.4 Reporting requirements (climate-specific)

The 2022 update does **not** add a discrete climate report; climate risk feeds into the existing annual Annex 11 report to NRB. However, the guideline strongly implies (and 2022 industry direction confirms) that BFIs should track:
- `client_ghg_emissions_tco2e_annual` (numeric)
- `client_has_disaster_management_plan` (boolean)
- `client_disaster_plan_robust` (boolean — RM judgement, backed by evidence)
- `client_ghg_measurement_procedures` (boolean)
- `client_ghg_reduction_targets_set` (boolean)
- `client_renewable_energy_use` (boolean)

Q2.4 (energy efficiency / renewable — carried over from 2018) plus Q2.5 (climate) are the two questions that feed the "green/inclusive lending" narrative NRB wants to promote via SBFN.

---

## 5. 2018 → 2022 diff highlights

### New in 2022
1. **Climate risk chapter** (pre-Annex 2, ~p.24-26) — did not exist in 2018.
2. **ESDD Q2.5 (Climate Change risks and opportunities)** — new question, using the same a/b/c/d answer schema as the rest of the checklist.
3. **NGFS climate risk taxonomy table** — physical and transition sub-categories added as reference.
4. **Annex 5b: Project Finance E&S Screening Questionnaire** — new, ~85 questions aligned to the 8 IFC Performance Standards. Not present in 2018.
5. **Annex 6 rewritten** — expanded overview of Nepal E&S regulation. 2018 pointed to `Environment Protection Rules 2054 (1997)` and its Annex 12 replicated Schedules 1–2. 2022 replaces this with **EPA 2019 + EPR 2020**, and the "Annex 12" (Schedules 1–2 of the 1997 rules) is **removed** — schedules are now referenced by number in the body text of Annex 6.
6. **Sustainable Banking Network → Sustainable Banking and Finance Network (SBFN)** — name change reflected; 32 countries → 43 countries with national frameworks.
7. **Exclusion list Annex 4 item 8** — rewritten around the **Industrial Enterprises Act 2020** ("Schedule 1, Section 8"). Adds:
   - **Electronic cigarettes** (new)
   - **All industries producing drone products or providing services through drones** (new)
   - **LPG refilling industries** (new — split out)
   - Removes explicit ban references to marijuana / lotteries / nuclear power / coal-fired power / gold-silver-diamond mining / hunted animals that appeared in the 2018 list item 8. (These are not necessarily allowed — they now flow through general licensing under IEA 2020 instead of a hard ban list.)
8. **Section 3 (Typical E&S Risks)** now explicitly introduces **climate as a sub-type of environmental risk**, with the physical/transition distinction. 2018 language was silent on this.
9. **Bibliographic anchors updated** — 2022 cites ADB Ahmed & Suphachalasai (2014) climate cost study; Nepal Climate Change Policy 2019; EPA 2019; EPR 2020; Labor Act 2017 (was "Labor Act 2074" phrasing in 2018); Solid Waste Management Act 2011 + Rules 2013; Local Government Operation Act 2017; Building Act 1998; Building Code Standard 2014.
10. **NEW in monitoring narrative:** severe weather / long-term climate patterns explicitly named as drivers of collateral value loss (§4).

### Unchanged from 2018
- The 8-step ESDD workflow.
- The Small/Term/Project categorisation thresholds (NPR 10 million / USD 100k).
- The critical sector list (10 sectors identical).
- The Low/Medium/High risk rating scheme and the a/b/c/d answer alphabet.
- Escalation rule (Medium or High → one level up).
- Annex 5 questions 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4 — wording largely unchanged; only Q2.5 is new. Guidance notes updated to reference EPA 2019/EPR 2020 instead of the older 1997 rules.
- Annex 9 (covenants), Annex 10 (monitoring), Annex 11 (annual report to NRB) — template structure identical; wording tweaked.
- Roles and responsibilities (§7.2) — unchanged.

### Removed in 2022
- Annex 12 (Schedules 1 and 2 of EPR 2054 (1997)) — dropped because EPR 2020 supersedes.
- 2018 Message from Governor (was on the cover page; 2022 version I have is cover-stripped, so this may just be an artefact of the file rather than an actual removal).

### Wording changes that alter meaning
- "B/FI" → "BFI" throughout (cosmetic).
- "SBN" → "SBFN" (organisation renamed).
- "environmental, social and climatic risks" in §2 (2022) — the addition of "climatic" is a substantive scoping change, not cosmetic.
- 2018 §3 hydropower text mentioned "habitat conversion"; 2022 revised to "habitat management" — slightly softer / more manageable framing.

---

## 6. Roles and responsibilities

Per §7.2 (p.12-13). Encode as fixed enum for `role_id` and permission mapping:

| Role | Scope | Owns (data ownership) |
|---|---|---|
| **Relationship Manager / Loan Officer (RM/LO)** | Per transaction | Screening; Annex 5 ESDD Checklist completion; site visits; document collection; client communication; pre-disbursement action follow-up; monitoring reports |
| **Credit Risk Manager / Credit Officer (CRM/CO)** | Per transaction | First reviewer of ESDD after RM; compliance check; validates E&S risk rating; queries RM |
| **Legal Department** | Per transaction | Ensures E&S covenants (Annex 9) and CAP (Annex 8) are written into the loan agreement |
| **Credit Authority** | Per transaction (tiered by size) | Final financing decision; ensures they have enough information; ensures agreement provisions are sufficient |
| **E&S Focal Point** (often Head of Credit) | Bank-wide | Operational responsibility for ESMS; develops/integrates/implements ESMS; briefs Senior Management on portfolio ESRM status; facilitates unresolved-issue decisions; annual NRB reporting; media/regulatory scanning; supports transaction teams |
| **Senior Management** | Bank-wide | Approves E&S Policy; kept informed of implementation challenges and successes |
| **Board** | Bank-wide | Approves ESRM Policy and Procedure (per Annex 11 reporting fields 1.1 and 1.2) |

Escalation rule (§7.3.6): Medium or High rating → escalates to **one level higher** credit authority than would normally approve the transaction. This is the only automated escalation route defined.

---

## 7. Reporting requirements

Per §7.3.8 and §9, and Annex 11 (template).

### 7.1 Cadence
- **Annual** report to NRB.
- **Annual** report to shareholders/stakeholders.
- Ongoing internal reporting to senior management (frequency not specified — BFI discretion).

### 7.2 Recipient
NRB (Banks and Financial Institutions Regulation Department).

### 7.3 Format
Annex 11 template — an Excel-style tabular form filled out per calendar year, with a per-quarter breakdown for the operational metrics.

### 7.4 Fields to report (verbatim from Annex 11)

**Section 1 — Policy Formulation and Governance** (Yes/No + date + remarks):
- 1.1 Formulation and Board approval of ESRM Policy
- 1.2 Formulation and Board approval of ESRM Procedure (Manual)
- 1.3 Nomination of E&S Officer

**Section 2 — Employee trainings and capacity building** (per quarter Q1/Q2/Q3/Q4 + total):
- 2.1 Fund allocated for ESRM trainings (NPR)
- 2.2 Number of ESRM training programs / seminars / workshops conducted
- 2.3 Number of attendees

**Section 3 — Incorporation of E&S Risk in Core Risk Management** (per quarter + total):
- 3.1 Number of loan requests rejected due to Exclusion List
- 3.2 Number of transactions subject to ESDD
- 3.3 Share (% of total loan value) of ESDD transactions in disbursed commercial (business purpose) loan portfolio
- 3.4 Total number of disbursed transactions by ESRR (Low / Medium / High)
- 3.5 Total amount in disbursed transactions by ESRR (Low / Medium / High)
- 3.6 Number of transactions with specific E&S Action Plan
- 3.7 Number of transactions rejected on E&S risk management grounds
- 3.8 Number of transactions beneficial to E&S improvements, sub-broken into:
  - Renewable energy projects (hydro, solar, biogas, wind)
  - Energy efficiency projects (lighting, heating/cooling, ventilation, boiler retrofit, facility upgrade)
  - Effluent treatment plants
  - Waste recycling and reuse
  - Water consumption reduction

Additional §9 requirements (annual):
- Progress and performance integrating E&S risk management into credit process
- ESRM institutional capacity-building activities during the year
- Procedures for monitoring, evaluation and reporting compliance with this Guideline
- E&S risk profile of relevant portfolio, aggregated by NSIC standard industry sector, showing ESRR categorisation of both new credits and the total loan book

**Data model implication:** every loan record must carry `nsic_sector_code`, `esrr_at_disbursement`, `esrr_current`, `is_green_lending` (boolean with sub-type enum), `is_rejected_for_exclusion` (boolean), `is_rejected_for_esrm` (boolean). Portfolio aggregation is per-quarter for Section 3, but published annually.

---

## 8. Annexes catalog

| Annex | Purpose (verbatim / paraphrased) | Digital form equivalent |
|---|---|---|
| Annex 1 (p.20-26) | Typical E&S risks for BFI clients — reference primer covering air, water, waste, labour, community, biodiversity, land, IP, cultural heritage, and (2022 new) climate | Reference article / educational content (help-panel); not itself a form |
| Annex 2 (p.27-28) | E&S Risk Management Considerations in Hydropower Projects — docs matrix by capacity + aspects checklist | Sector supplement form (hydropower-specific), triggered when `sector = hydropower` |
| Annex 3 (p.29-30) | E&S Risks for Various Types of Credits — SME/leasing/term/project narrative | Reference / help-panel |
| Annex 4 (p.31) | Exclusion List — 8 categories | Boolean checkbox screen (multi-select); if any checked → reject transaction |
| Annex 5 (p.32-42) | ESDD Checklist — 13 questions (1.1-1.4 General; 2.1-2.5 EHS; 3.1-3.4 Social) with a/b/c/d answer schema + guidance notes | Multi-page form / wizard; scoring engine that auto-computes Low/Medium/High |
| Annex 5b (p.43-49) | Project Finance E&S Screening Questionnaire — IFC PS-aligned Yes/No questions across 8 areas (Assessment & Management; Labor; Resource Efficiency; Community H&S; Land Acquisition; Biodiversity; Indigenous Peoples; Cultural Heritage) | Long-form conditional questionnaire (~85 items); only shown when `esdd_category = project_finance` |
| Annex 6 (p.50-59) | Overview of E&S / OHS regulation in Nepal — permit matrix, EIA process, noise/air/water/waste/labour regulation, environmental authorities, social issues (labour, minimum wage, child labour, forced labour) | Reference document; the permit-matrix (A5) becomes a lookup table driving `required_permits` per sector |
| Annex 7 (p.63) | E&S Risk Summary Template — 8 fields (nature of loan; info reviewed; key issues; regulatory compliance; social compliance; performance rating; covenants/monitoring; further actions) — signed by Credit Officer | Auto-populated 1-page PDF (generated from ESDD state), signed via e-signature or attached to credit memo |
| Annex 8 (p.64-65) | Sample Corrective Action Plan — rows of {Area of concern, Corrective action, Deadline, Completion indicator, Responsibility, Cost} | Editable table attached to loan; must be attached to legal agreement when rating ∈ {Medium, High} |
| Annex 9 (p.66) | Examples of E&S Risk Covenants — guidance on Positive / Negative / Condition Precedent / Event of Default / CAP covenants | Covenant-library UI with insertable clauses into loan legal template; 3-day notification rule for spills/serious accidents is a hard clause |
| Annex 10 (p.67-68) | E&S Monitoring Checklist — 13 items across Project Summary, General Info, EHS Management, Permits, Grievance Redressal, Other | Periodic monitoring form per loan; frequency configurable per transaction |
| Annex 11 (p.69-70) | Templates for reporting BFIs to NRB — Annual Statement (see §7 above for full field list) | Excel export + PDF cover sheet; the demo already builds this via task #32 (Agent A — NRB reporting export) |

### Annexes present in 2018 but not in 2022
- **Annex 12 (2018 only, p.58-66):** Schedule 1 and 2 of Environment Protection Rules 2054 (1997), Fifth amendment. Removed because EPR 2020 supersedes.

---

## Open questions / ambiguities the compliance team must resolve

1. **ESRR aggregation formula.** The Excel tool "automatically generates" Low/Medium/High but the formula isn't published in the PDF text. The demo's current assumption (any `c` → High; any `b` and no `c` → Medium; else Low) is defensible but must be validated against the Excel tool itself (which is a separate file — Circular 22 attachment XLS in `uploads/`, being ingested under R2).
2. **Applicability by BFI class.** The R1 brief asked for applicability by Class A/B/C/IDB. The Guideline itself does not scope by class — applicability is by transaction type. If NRB's Class-A vs Class-B rules diverge, that scoping likely comes from Circular 22, not this document.
3. **Sector supplements beyond hydropower.** The 2022 Guideline only supplies a supplement for hydropower (Annex 2). Every other named sector (cement, textiles, steel, chemicals, brick, tourism, healthcare, transportation, real estate) gets treatment only via (a) the critical-sector list in §5, (b) the permit-matrix in Annex 6, and (c) sector-specific pollution-limit tables mentioned in the narrative of Annex 1. If the demo needs per-sector questions for these, they must come from Circular 22 (R2) or be built from the sector-specific tolerance/emission tables the Guideline references but does not reproduce inline.
4. **Section-numbering inconsistency.** The 2022 PDF prints the ESMS sub-sections as "1.1", "1.2", "1.3", "1.3.1", etc. in the body, but the Table of Contents lists them as "7.1", "7.2", "7.3", "7.3.1", etc. This looks like a Word template hiccup carried over from the 2017 draft. Use the ToC numbering (7.x) for all downstream references — that's what compliance officers will look up.
5. **Escalation ceiling.** "One level higher" credit authority is defined per BFI's own credit hierarchy — the Guideline does not enforce a specific escalation target. The demo's Manager view for escalation is therefore an intentional abstraction, not a Guideline requirement.
