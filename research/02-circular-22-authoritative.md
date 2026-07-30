# NRB Circular 22 — Authoritative ESRM / Annex 5 Checklist Extract

Research pass for R2: extracts the authoritative NRB ESDD checklist as issued
under Circular 22 (Directive 22, FY 2074/75) and compares it against our current
in-code transcription at `lib/regulatory/esdd/annex5-questions.ts`.

**Sources reviewed (both attached to Circular 22 upload):**

- `2074_75_..._Circular_22-Checklist_...xls` — the actual interactive Excel tool
  NRB distributed. Converted to xlsx via LibreOffice and read with openpyxl.
  Six sheets: `Glossary of terms`, `ESDD Checklist`, `User Guide`,
  `ESRR_criteria`, `Example1`, `Tempor` (dropdown source list).
- `2074_75_..._Circular_22-Attachment_...pdf` — the full 66-page ESRM guideline
  attached to the circular, containing Annexes 1-12. Annex 5 (pp. 30-38) is the
  same checklist rendered in printable form with per-question guidance notes.

**Current in-code file compared:**
`lib/regulatory/esdd/annex5-questions.ts` (985 lines, 10 base + 25 sector
questions).

---

## 1. Source document metadata

| Field | Value |
|---|---|
| Regulator | Nepal Rastra Bank (NRB), Central Office, Banks and Financial Institutions Regulation Department |
| Instrument | Circular 22 (Directive 22), FY 2074/75 (2017/18) |
| Applicability | All A, B and C class licensed institutions |
| Governor sign-off | May 2018 (title page of the attached ESRM Guideline) |
| Superseded by | Not yet — remains the operative ESRM guideline (2018-present) referenced by NRB's later Green Finance Taxonomy (2024) |
| Scope of applicability (§5) | SME finance, commercial leasing, Business Working Capital / Term Finance, project finance |

The Excel file is explicitly called out in Annex 5's opening footnote:
"(¹This ESDD checklist is also available as a separate interactive MS-Excel
Tool)" — so the two source files are two renderings of the same content and are
authoritative jointly.

---

## 2. Every checklist item, verbatim

The "Basic Information" header captured before questions (Excel `ESDD
Checklist!B4:B13`, PDF p. 30):

- Date
- Name of Client/Account
- Transaction ID
- Location
- Industry / Sector
- Product Manufactured / Traded
- Name of Relationship Official
- Business line (Sub-sector)
- Loan Category (Small, Business Working Capital / Term Loan, Project Finance) — Excel-only (`B13`), not in the PDF Annex 5 header

The E&S Risk Rating (ESRR) rule from `ESRR_criteria!A3:B6`:

- All answers (a) or (d), or a combination — except for Q 2.4 → **LOW**
- One or more answers is (b) and no (c) — except for Q 2.4 → **MEDIUM**
- One or more answers is (c) — except for Q 2.4 → **HIGH**
- Q 2.4 (energy efficiency) is indicative-only and does not affect the rating.

### Section 1 — General Risk

#### 1.1 (Excel `C20`, PDF p. 30)

**Prompt (verbatim):** *"Are there any legal issues associated with the client's E&S performance?"*

- **a)** Client has all valid permits AND has not faced any legal claims or any serious environmental/social incident in last three years
- **b)** Client does not have all valid permits but has taken definite steps to acquire them in next six months AND/OR client has faced legal claims but has addressed or has definite plan to address all of them
- **c)** Client does not have all valid permits and has not taken any definite step to acquire them AND/OR client has faced legal claims and has no definite plan to address them
- **d)** Not applicable

#### 1.2 (Excel `C21`, PDF p. 30)

**Prompt:** *"Have operations ever been affected by local stakeholder grievances, media or non-governmental organization (NGO) campaigns over E&S issues?"*

- **a)** There is no evidence of stakeholder grievances, negative media or NGO protest
- **b)** There is evidence of stakeholder grievances, negative media or NGO protest for a particular operation AND client has taken adequate steps to address the issue
- **c)** There is evidence of stakeholder grievances, negative media or NGO protest and client has not taken any step to address the issue
- **d)** Not applicable

#### 1.3 (Excel `C22`, PDF pp. 30-31)

**Prompt:** *"Is project site and/or its routing likely to have negative impacts on sensitive areas (residential or protected sites) near the project site?"*

- **a)** No eco-sensitive areas observed *(Excel wording)* / No sensitive areas observed *(PDF wording)*
- **b)** There are a few eco-sensitive areas AND the client has taken adequate measures to mitigate the impact of their operation on the eco-sensitive areas as per regulations *(Excel)* / There are a few sensitive areas and the client has taken adequate measures to mitigate the impact of their operation on the sensitive areas as per regulations *(PDF)*
- **c)** There are eco-sensitive areas observed and mitigation measures are not adequate as per regulations and the client may face legal challenge in future *(Excel)* / There are sensitive areas observed and mitigation measures are not adequate as per regulations and the client may face legal challenge in future *(PDF)*
- **d)** Not applicable

**Divergence between Excel and PDF:** Excel uses "eco-sensitive"; PDF uses "sensitive". The guidance note on p. 34 uses "eco-sensitive". Because the Excel is the interactive tool NRB distributes AND the guidance note reinforces "eco-sensitive", I recommend using **"eco-sensitive"** as the canonical wording.

### Section 2 — Environmental Health and Safety Risks

#### 2.1 (Excel `C24`, PDF p. 31)

**Prompt:** *"Is there any evidence of air and noise pollution from the client's operation violating the Environment Protection Rules (Official Gazette, June 26/1997) or the conditions specified in the client's Pollution Control Certificate?"*

- **a)** There is no evidence of air/noise pollution and non-compliance and/or all mitigation measures and monitoring systems are in place
- **b)** There is evidence of air/noise emission and non-compliance AND partial mitigation measure, monitoring system is in place AND client is addressing or has a definite plan to address the remaining issues
- **c)** There is evidence of air emission/noise and non-compliance AND there is no mitigation measure/monitoring system in place AND client has no definite plan to address the issues
- **d)** Not applicable

#### 2.2 (Excel `C25`, PDF p. 31)

**Prompt:** *"Is there any evidence of water pollution due to client's operation, violating the Environment Protection Rules (Official Gazette, June 26/1997) or the conditions specified in the client's Pollution Control Certificate?"*

- **a)** There is no evidence of water pollution and non-compliance and /or all mitigation measures and monitoring systems are in place
- **b)** There is evidence of water pollution and non-compliance AND partial mitigation measure monitoring system is in place AND client is addressing or has a definite plan to address the remaining issues
- **c)** There is evidence of water pollution and non-compliance AND there is no mitigation measure/monitoring system in place AND client has no definite plan to address the issues
- **d)** Not applicable

#### 2.3 (Excel `C26`, PDF pp. 31-32)

**Prompt:** *"Is there any evidence of land pollution and lack of waste handling mechanism in the project operation violating the Environment Protection Rules (Official Gazette, June 26/1997) or the conditions specified in the client's Pollution Control Certificate?"*

- **a)** There is no evidence of land contamination or lack of waste handling mechanism or non-compliance OR all mitigation measures and monitoring systems are in place
- **b)** There is evidence of land contamination or lack of waste handling mechanism or non-compliance AND partial mitigation measure, monitoring system is in place AND client is addressing or has a definite plan to address the remaining issues
- **c)** There is evidence of land contamination or lack of waste handling mechanism or non-compliance AND there is no mitigation measure/monitoring system in place AND client has no definite plan to address the issues
- **d)** Not applicable

#### 2.4 (Excel `C27`, PDF p. 32)

**Prompt:** *"Has the client made any investments in technologies or measures in its operation leading to cost savings by reducing energy consumption (increasing energy efficiency) or using renewable energy (solar, wind, mini-hydropower, organic fuel)?"*

- **a)** The client made investment in energy efficiency technologies / measures OR in renewable energy generation (electricity or heat) OR analyzed its operation from the energy efficiency standpoint (e.g. energy audit) and is actively pursuing opportunities for energy related cost savings.
- **b)** The client is considering identifying opportunities for cost savings from improved energy efficiency or renewable energy use but has not made any particular steps in this direction yet
- **c)** The client has never made any investment in technologies or measures for energy related cost savings and appears to be unaware of the opportunities in these areas
- **d)** Not applicable

*(Q 2.4 is indicative-only and does not affect the ESRR — see `ESRR_criteria!A8`.)*

### Section 3 — Social Risks

#### 3.1 (Excel `C29`, PDF p. 32)

**Prompt:** *"Is there any evidence of increased fire risk or occupational health & safety (OHS) risk, i.e. risk of injuries at work?"*

- **a)** The client does not have any OHS concern or have mitigated them adequately
- **b)** The client has some OHS concern but has taken definite steps to correct them
- **c)** The client has OHS concern in its operation and have no plans of correcting them
- **d)** Not Applicable *(note: Excel and PDF both capitalise "Applicable" here; the other d) options are lowercase)*

#### 3.2 (Excel `C30`, PDF p. 32)

**Prompt:** *"Are the labor and working conditions poor and breaching local regulations / standards?"*

- **a)** There is proper working condition and labor practice AND there is no evidence of poor working condition or labor practice for which client may face legal challenge or labor unrest or negative media coverage or protest from activist
- **b)** There are a few evidences of poor working conditions BUT no significantly poor labor practice such as child/forced labor is present AND the client has a definite plan to improve the working condition to ensure there is no legal challenge or labor unrest or negative media coverage or protest from activist in future
- **c)** Working condition is very poor AND/OR there is presence of significantly poor labor practice such as child labor/forced labor AND client is not addressing/has no definite plan to address the issues
- **d)** Not applicable

#### 3.3 (Excel `C31`, PDF pp. 32-33)

**Prompt:** *"Does the project pose a threat to Community Health, Safety and Security?"*

- **a)** There is no evidence of issues that may create nuisance/accidents/injuries to local community in future or the company has a robust plan for community health & safety which was developed in consultation with the local community *(Excel; PDF opens with lower-case "there")*
- **b)** There are a few evidences of issues that may create nuisance/ accidents/ injuries to local community AND the client intends to address the gaps AND/OR the client has a plan for community health & safety but it is not robust or it is not developed in consultation with the community
- **c)** There is evidence of significant issues that can create nuisance/ accidents/ injuries to local community AND client has no definite plan to address the gaps AND/OR does not intend to manage its impact on community health & safety
- **d)** Not applicable

#### 3.4 — **PDF-only** (PDF p. 33, not present in Excel `ESDD Checklist` sheet)

**Prompt:** *"Is there any evidence of community consultation with key stakeholders including indigenous people?"*

- **a)** There is evidence that the client consults/engages with the stakeholders including local community, indigenous people on (such as rehabilitation, compensation, their expectations as the case may be)
- **b)** There is limited/inadequate consultations with the stakeholders
- **c)** No consultations with the stakeholders
- **d)** Not applicable

**Important divergence:** The interactive Excel tool stops at 3.3 (last populated row `B31`). The PDF Annex 5 adds 3.4. Because the PDF is the printed guideline and the Excel is described in Annex 5 as "also available as a separate interactive MS-Excel Tool" — i.e. a supplementary rendering — I treat the PDF as canonical and keep 3.4. The ESRR rule (`ESRR_criteria`) counts all questions "except 2.4", so 3.4 is included in scoring.

### Guidance notes (PDF pp. 33-38)

Each question has a bulleted guidance block on pp. 33-38 of the PDF. These are the "help text" NRB intends to be shown to credit staff. The wording used in the current file's `guidanceNotes` arrays is close to but often paraphrased from these notes. Full verbatim extraction of guidance would double the size of this file; the change list in §5 flags where guidance was materially reshaped versus lightly paraphrased.

---

## 3. Sector supplements from Circular 22

**Finding — critical.** Circular 22 contains **no sector-specific ESDD
checklists** with a/b/c/d options. The 25 sector questions currently in
`ANNEX5_SECTOR_SUPPLEMENTS` (hydropower H.1-H.4, cement C.1-C.3, textiles T.1-T.3,
steel S.1-S.3, chemicals Ch.1-Ch.3, brick B.1-B.4, agriculture A.1-A.4) are
**not verbatim from Circular 22**. They were authored to look like NRB's a/b/c/d
convention, but the source guideline does not contain them. The file's header
comment honestly acknowledges this: *"STATUS: first-pass content. Wording is
aligned to NRB's a/b/c/d convention … but has NOT yet been word-for-word
verified against the source doc for every question."*

What Circular 22 actually contains at Annex 2 and Annex 3:

- **Annex 2 (PDF pp. 25-26) — Hydropower.** Two tables:
  1. A documentation-requirements matrix by capacity (>50 MW → EIA + list of documents; 1-50 MW → IEE + list; <1 MW → none).
  2. A matrix of "typical environmental and social aspects for hydropower projects" grouped by aspect (construction-related issues, hydrology/morphology, water quality, sediment transport, emissions, aquatic ecology, terrestrial ecology, land use, community health, community safety). This is descriptive text; there are no a/b/c/d questions.
- **Annex 3 (PDF pp. 27-28) — "E&S Risks for Various Types of Credits".** Narrative sections on SME, Commercial Leasing, Term Finance, Project Finance — describing typical risks per **credit product type**, not per **industrial sector**. Again, no a/b/c/d questions.

There is **nothing** in Circular 22 that resembles the cement, textiles, steel,
chemicals, brick, or agriculture supplements our code carries.

### Implications for the code

Two viable paths:

1. **Honest position (recommended):** Rename `ANNEX5_SECTOR_SUPPLEMENTS` to
   something that reflects its actual authorship (e.g.
   `JANA_SECTOR_SUPPLEMENTS`, `SUPPLEMENTARY_SECTOR_QUESTIONS`), add a header
   note explicitly stating the questions are Jana-authored guidance derived
   from Annex 1 and Annex 2 of Circular 22 plus general NRB / IFC good
   practice, and continue to score them separately from the ESRR. Do not claim
   verbatim NRB source for content that is not.
2. **Verbatim-only position:** Delete the sector supplements entirely for now,
   and add hydropower-specific data-capture fields sourced strictly from
   Annex 2's document / parameter tables. This is more truthful but drops
   sector-specific ESDD signal we're using in scoring.

Option (1) preserves demo value and stays honest about provenance. Option (2)
maximises regulatory fidelity but leaves the officer flow thinner. I recommend
option (1) for the code update.

---

## 4. Diff table — current transcription vs. Circular 22

Legend for the Match column:
- ✅ verbatim match
- ~ close, minor drift (punctuation, connector words, dropped parenthetical)
- ⚠ material drift (wording that changes emphasis)
- ❌ not present in Circular 22
- ➕ present in Circular 22 but omitted from current file

| Question ID | Current status | Match | Notes |
|---|---|---|---|
| annex5.1.1 prompt | present | ✅ | Verbatim. |
| annex5.1.1 a/b/c/d | present | ✅ | Verbatim (only whitespace/line-break normalisation). |
| annex5.1.1 guidance | present (2 bullets) | ~ | Paraphrased; source has 3 bullets (Annex 6 pointer, notices/fines, Remarks reminder). Add missing "Remarks section — details of past fines, amount, reason, current status." |
| annex5.1.2 prompt | present | ✅ | Verbatim. |
| annex5.1.2 a/b | present | ✅ | Verbatim. |
| annex5.1.2 c | present | ⚠ | Current says *"AND client has taken no adequate steps"*; source says *"and client has not taken any step to address the issue"*. |
| annex5.1.2 guidance | present (1 bullet) | ~ | Circular 22 provides 6 bullet examples (worker riots; untreated discharge; land acquisition without compensation; land-use restrictions; conversion of rice fields / encroachment / unpermitted buildings; UNESCO impact). Current condenses to one bullet. Expand or replace. |
| annex5.1.3 prompt | present | ✅ | Verbatim. |
| annex5.1.3 a | present | ⚠ | Current: *"No sensitive areas observed"*. Excel and guidance say *"eco-sensitive"*. |
| annex5.1.3 b | present | ⚠ | Same "sensitive" vs "eco-sensitive" drift. |
| annex5.1.3 c | present | ⚠ | Same "sensitive" vs "eco-sensitive" drift. |
| annex5.1.3 guidance | present (1 bullet) | ~ | Source has 2 bullets (sources of eco-sensitive area info + Remarks reminder mentioning google map / interview / visual). |
| annex5.2.1 prompt | present | ✅ | Verbatim. |
| annex5.2.1 a | present | ✅ | Verbatim (spacing normalised). |
| annex5.2.1 b | present | ✅ | Verbatim. |
| annex5.2.1 c | present | ✅ | Verbatim. |
| annex5.2.1 guidance | present (2 bullets) | ~ | Source has 5 bullets: sources of air pollution; dust evidence; sources of noise; ventilation/noise mitigation minimums; Remarks reminder. Current covers 2 of 5. |
| annex5.2.2 prompt | present | ✅ | Verbatim. |
| annex5.2.2 a/b/c | present | ✅ | Verbatim. |
| annex5.2.2 guidance | present (2 bullets) | ~ | Source has 4 bullets; current covers 2. Missing: ETP requirement check; discharge to unauthorised locations; Remarks reminder. |
| annex5.2.3 prompt | present | ⚠ | Current drops the parenthetical *"(Official Gazette, June 26/1997)"* and puts a comma before *"violating"*. Source has no comma and includes the gazette reference. |
| annex5.2.3 a | present | ⚠ | Current: *"There is no evidence of land contamination or waste handling issues and/or all mitigation measures and monitoring systems are in place"*. Source: *"There is no evidence of land contamination or lack of waste handling mechanism or non-compliance OR all mitigation measures and monitoring systems are in place"*. Missing "lack of waste handling mechanism", "non-compliance", and "OR" vs "and/or". |
| annex5.2.3 b | present | ⚠ | Current drops "or non-compliance" and "monitoring system"; simplifies "partial mitigation measure, monitoring system is in place" to "partial mitigation is in place"; drops "is addressing or". |
| annex5.2.3 c | present | ~ | Close but merges phrases. Source: *"…AND there is no mitigation measure/monitoring system in place AND client has no definite plan to address the issues"*. Current keeps essentially the same but the split is slightly reworded. |
| annex5.2.3 guidance | present (2 bullets) | ~ | Source has 5 bullets; missing leak/spill areas, historical contamination references, Remarks reminder. |
| annex5.2.4 prompt | present | ⚠ | Current drops the parenthetical *"(solar, wind, mini-hydropower, organic fuel)"*. |
| annex5.2.4 a | present | ⚠ | Current drops *"(electricity or heat)"* after "renewable energy generation". |
| annex5.2.4 b/c/d | present | ✅ | Verbatim. |
| annex5.2.4 guidance | present (1 bullet with editorial commentary) | ⚠ | Source has 4 bullets (definition of energy-efficiency project; manufacturing/housing examples; high-energy-consuming sectors list; definition/breakdown of renewable energy sources). The current file adds a scoring caveat that is not in the source ("Answer 'a' here is a positive signal") — this is our own scoring intent, not NRB guidance. Move that caveat out to `scoring.ts`. |
| annex5.3.1 prompt | present | ✅ | Verbatim. |
| annex5.3.1 a/b/c/d | present | ✅ | Verbatim (note Circular 22 capitalises `d) Not Applicable` here). |
| annex5.3.1 guidance | present (2 bullets) | ~ | Source has ~11 sub-bullets (system to identify hazards; media reports; PPE noticeboards; PPE use; trainings; on-site OHS centre; firefighting equipment; emergency exits; evacuation alarm; fire-safety plan; Remarks reminder). Current is a decent condensation. Consider expanding. |
| annex5.3.2 prompt | present | ✅ | Verbatim. |
| annex5.3.2 a/b/c/d | present | ✅ | Verbatim. |
| annex5.3.2 guidance | present (3 bullets) | ~ | Source has ~7 bullets: reasons good conditions matter; workplace-condition indicators (noise/temperature/light/ventilation, water, PPE, child/forced labor policies); poor-practice categories (wages/hours/OHS/discipline/discrimination); age/wage/attendance records; employment contract requirements; unions/collective bargaining; inspector reports & SA 8000; Remarks; and — critically — *"Transactions should be terminated if instances of child labor or forced labor are found in client's activities, unless immediate remedial actions are taken. Minimum working age in Nepal is 14."* The current file references age 16, which contradicts the source. **Correct age is 14** (the Glossary sheet also says 14; the Child Labor Prohibition Act sets 14 as minimum for work and 16 for hazardous work — our note conflated the two). |
| annex5.3.3 prompt | present | ✅ | Verbatim. |
| annex5.3.3 a | present | ~ | PDF opens with lower-case *"there"*; Excel with capital *"There"*. Current follows Excel. Fine. |
| annex5.3.3 b/c/d | present | ✅ | Verbatim. |
| annex5.3.3 guidance | present (2 bullets) | ~ | Source has 5+ bullets: nuisance; life & fire safety; structural safety; water quality & availability; hazardous materials; several illustrative examples (tannery, poultry, steel rerolling); Remarks. Current is thin. |
| annex5.3.4 prompt | present | ✅ | Verbatim. |
| annex5.3.4 a/b/c/d | present | ✅ | Verbatim. |
| annex5.3.4 guidance | present (2 bullets) | ~ | Source has 5 bullets covering stakeholder identification; displacement/resettlement engagement; grievance mechanism; cultural heritage impact; the important exception for consultancy/service businesses (RM must justify N/A). Current covers indigenous FPIC + consultation minutes — different emphasis than source. |
| annex5.hydro.1..H.4 | present (4 questions) | ❌ | **Not in Circular 22.** Annex 2 is a document matrix and parameter table, not a/b/c/d questions. |
| annex5.cement.C.1..C.3 | present (3 questions) | ❌ | Not in Circular 22. |
| annex5.textile.T.1..T.3 | present (3 questions) | ❌ | Not in Circular 22. |
| annex5.steel.S.1..S.3 | present (3 questions) | ❌ | Not in Circular 22. |
| annex5.chem.Ch.1..Ch.3 | present (3 questions) | ❌ | Not in Circular 22. |
| annex5.brick.B.1..B.4 | present (4 questions) | ❌ | Not in Circular 22. |
| annex5.agri.A.1..A.4 | present (4 questions) | ❌ | Not in Circular 22. |
| Loan Category basic-info field | missing | ➕ | Excel `B13` has "Loan Category (Small, Business Working Capital / Term Loan, Project Finance)" — not currently in `EsddBasicInfo`. |
| ESRR rule set | scoring lives in `scoring.ts` | ➕ | `ESRR_criteria` sheet defines: all a/d → LOW; ≥1 b and no c → MEDIUM; ≥1 c → HIGH; Q 2.4 excluded. Ensure `scoring.ts` matches exactly (verify separately in R2 follow-up). |

---

## 5. Change list — edits to make `lib/regulatory/esdd/annex5-questions.ts` verbatim-conformant

Prioritised. Items marked **[REG]** are regulatory-content corrections;
**[HYG]** are provenance / naming hygiene; **[SCORE]** touches scoring inputs.

### 5.1 [REG] Fix wording drift in the 10 base questions

1. **1.2 option (c)** — replace *"AND client has taken no adequate steps to address the issue"* → *"and client has not taken any step to address the issue"*.
2. **1.3 option (a)** — replace *"No sensitive areas observed"* → *"No eco-sensitive areas observed"*.
3. **1.3 option (b)** — replace both instances of *"sensitive areas"* → *"eco-sensitive areas"* (Excel canonical).
4. **1.3 option (c)** — replace *"sensitive areas"* → *"eco-sensitive areas"*.
5. **2.3 prompt** — restore *"(Official Gazette, June 26/1997)"* and drop the comma before "violating": *"…in the project operation violating the Environment Protection Rules (Official Gazette, June 26/1997) or the conditions specified in the client's Pollution Control Certificate?"*.
6. **2.3 option (a)** — replace with verbatim: *"There is no evidence of land contamination or lack of waste handling mechanism or non-compliance OR all mitigation measures and monitoring systems are in place"*.
7. **2.3 option (b)** — replace with verbatim: *"There is evidence of land contamination or lack of waste handling mechanism or non-compliance AND partial mitigation measure, monitoring system is in place AND client is addressing or has a definite plan to address the remaining issues"*.
8. **2.3 option (c)** — replace with verbatim: *"There is evidence of land contamination or lack of waste handling mechanism or non-compliance AND there is no mitigation measure/monitoring system in place AND client has no definite plan to address the issues"*.
9. **2.4 prompt** — restore *"(solar, wind, mini-hydropower, organic fuel)"*: *"…or using renewable energy (solar, wind, mini-hydropower, organic fuel)?"*.
10. **2.4 option (a)** — restore *"(electricity or heat)"* after "renewable energy generation".
11. **3.1 option (d)** — change *"Not applicable"* → *"Not Applicable"* (the source capitalises Applicable only for 3.1; keep the other three questions lowercase). Optional pedantic fix.

### 5.2 [REG] Fix the age-16 error in 3.2 guidance

The current guidance for 3.2 states *"Any evidence of child labor (under 16) or forced labor is an automatic escalation"*. Circular 22 explicitly states minimum working age in Nepal is **14** (guidance note for 3.2 on p. 37; Glossary sheet A4). Update to *"Minimum working age in Nepal is 14"* and quote NRB's own language: *"Transactions should be terminated if instances of child labor or forced labor are found in client's activities, unless immediate remedial actions are taken."* (Reference the Child Labor (Prohibition and Regulation) Act 2000: 14 for work, 16 for hazardous work.)

### 5.3 [REG] Rebuild guidance-note arrays from PDF pp. 33-38

For each of 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, replace the
current `guidanceNotes` with the verbatim bullet list from the source PDF. The
current arrays are close paraphrases; NRB guidance is short enough to store
verbatim and treating it as canonical helps demo credibility. Specific
additions per §4 diff table:

- **1.1:** add the "notices/fines/penalties" bullet and the "Remarks section — provide details of the past fines" reminder.
- **1.2:** replace with the 6 example-list bullets from p. 33-34.
- **1.3:** add the "Department of National Parks and Wildlife Conservation, Ministry of Forests and Environment, Department of Archaeology" source list and the Remarks reminder about how presence/absence was verified (Google Map / interview / site visit).
- **2.1:** add sources of noise pollution, ventilation/noise-mitigation minimums, and 70 dB threshold guidance.
- **2.2:** add the ETP requirement check, the "colour/turbidity/chemical odor" evidence bullet, and the unauthorised-discharge-location examples.
- **2.3:** add the historical land contamination bullet, and add the hazardous-vs-non-hazardous storage rule.
- **2.4:** replace our scoring commentary with the source's definition of energy-efficiency projects, examples, high-energy-consuming sector list, and the renewable-energy sub-bullets (small hydropower ≤10 MW; solar; wind; biomass & biogas). Move the "answer (a) is a positive signal" note to `scoring.ts`.
- **3.1:** expand to the 11 indicator sub-bullets from p. 36.
- **3.2:** expand to include the poor-practice categories (wages/hours/OHS/discipline/discrimination), employment-contract content requirements, and the SA 8000 reference. Include the child-labor / forced-labor termination clause verbatim.
- **3.3:** expand to include life & fire safety, structural safety, water quality & availability, hazardous materials, and the illustrative-examples paragraph (tannery, poultry, steel rerolling, chemical explosion).
- **3.4:** replace with the source's 5 bullets, including the important exception that consultancy/service businesses can mark N/A if the RM justifies in comments.

### 5.4 [SCORE] Add loan-category basic-info field

Add `loanCategory: "small" | "working-capital-term" | "project-finance"` to
`EsddBasicInfo` and surface a dropdown in the wizard, matching Excel `B13`.
This mirrors Circular 22's applicability triage and is used by the "small loan
in non-critical sector" fast-path (Excel `Tempor!A1`).

### 5.5 [HYG] Rename and reframe `ANNEX5_SECTOR_SUPPLEMENTS`

The 25 sector questions are not from Circular 22. Two mandatory hygiene changes:

- **Rename** the export to `JANA_SECTOR_SUPPLEMENTS` (or
  `SUPPLEMENTARY_SECTOR_QUESTIONS`) so the identifier does not imply Annex 5
  provenance.
- **Rewrite the block-level comment** to explicitly state: *"These questions
  are Jana-authored operational aides drawn from Circular 22 Annex 1
  (typical E&S risks) and Annex 2 (hydropower), IFC EHS Guidelines, and Nepal
  sector regulations. They are not verbatim NRB checklist items and do not
  form part of the ESRR calculation defined in Circular 22
  `ESRR_criteria`."*.
- **Update `fullChecklist()`** to reflect the split — base questions feed
  ESRR; supplementary sector questions feed a separate "sector deep-dive"
  panel and don't influence the a/d/b/c risk rating.
- Optionally, mark each supplement question with a `source: "jana-supplement"`
  discriminator so downstream scoring and the API cannot accidentally treat
  them as Annex 5 items.

### 5.6 [SCORE] Verify `scoring.ts` matches the ESRR rule

Confirm scoring in `lib/regulatory/esdd/scoring.ts` implements exactly:

- If any question (except 2.4) is **c** → HIGH
- Else if any question (except 2.4) is **b** → MEDIUM
- Else (all a/d) → LOW
- Q 2.4 is indicative-only, excluded from the rating

If the current code includes 3.4 in the rating (it should — Excel omits 3.4
but PDF includes it and the ESRR rule says "except 2.4"), that's correct.
Just confirm.

### 5.7 [HYG] Update file header comment

The top-of-file comment says *"Source: NRB_ESRM_Guidelines_2018_Circular22.pdf,
Annex 5 (pages 30-38)"* — accurate. But it also says *"STATUS: Phase 2
in-progress. This file contains the General Risk (Section 1) and
Environmental Health & Safety (Section 2) blocks fully transcribed. Section 3
(Social Risk) and the sector supplements … are marked TODO"* — no longer
accurate now that Section 3 (including 3.4) is in the file. Remove the stale
STATUS block or restate it to reflect Circular 22 verbatim conformance after
this change list is applied.

---

## Appendix A — Cell / page references for verification

| Item | Excel cell | PDF page |
|---|---|---|
| 1.1 prompt | `ESDD Checklist!C20` | 30 |
| 1.1 options | `ESDD Checklist!E20` | 30 |
| 1.2 prompt | `C21` | 30 |
| 1.3 prompt | `C22` | 30-31 |
| 2.1 prompt | `C24` | 31 |
| 2.2 prompt | `C25` | 31 |
| 2.3 prompt | `C26` | 31-32 |
| 2.4 prompt | `C27` | 32 |
| 3.1 prompt | `C29` | 32 |
| 3.2 prompt | `C30` | 32 |
| 3.3 prompt | `C31` | 32-33 |
| 3.4 prompt | (not in Excel) | 33 |
| ESRR rule | `ESRR_criteria!A3:B6` | Guideline §7.3.4 (indirectly) |
| Loan Category field | `ESDD Checklist!B13` (with dropdown from `Tempor!A1:A4`) | — |
| Guidance notes | (not in Excel) | 33-38 |
| Annex 2 (Hydropower) doc matrix | — | 25 |
| Annex 2 (Hydropower) parameter table | — | 25-26 |
| Annex 3 (Types of Credits) | — | 27-28 |
| Annex 4 (Exclusion List) | — | 29 |
| Basic Information header (rendered) | `ESDD Checklist!B4:B13` | 30 |
