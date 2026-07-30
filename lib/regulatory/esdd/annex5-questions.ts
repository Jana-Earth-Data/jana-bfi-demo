/**
 * NRB ESRM Guidelines — Annex 5 E&S Due Diligence Checklist.
 *
 * Verbatim transcription of the questions, answer options, and guidance
 * notes from NRB Circular 22 (Directive 22, FY 2074/75) plus the 2022
 * NRB ESRM Guideline update (which added Q 2.5 climate change). Every
 * question captures:
 *   - id             : stable identifier used on captured rows
 *   - section        : "general" | "ehs" | "social"
 *   - number         : NRB's own numbering (e.g. "1.1", "2.3")
 *   - prompt         : the question text as NRB writes it (verbatim)
 *   - options        : the four answer options a/b/c/d, verbatim
 *   - guidanceNotes  : the bulleted "what to look for" text NRB provides
 *                       at the end of the Annex 5 checklist (PDF pp. 33-38),
 *                       transcribed verbatim
 *
 * This file is regulatory data. It changes only when NRB revises the
 * guideline. Do not edit to adjust demo behavior; edit lib/regulatory/esdd/
 * scoring.ts and risk-aggregation.ts instead.
 *
 * Primary source: NRB_ESRM_Guidelines_2018_Circular22.pdf, Annex 5
 * (pages 30-38) — canonical wording per the interactive Excel checklist
 * NRB distributes with Circular 22.
 * 2022 addition: Q 2.5 climate change risks and opportunities — added
 * by the 2022 NRB ESRM Guideline update ("Final-ESRM-without-cover-1.pdf",
 * new pre-Annex 2 climate section p.24-26 + updated Annex 5).
 *
 * NOTE ON SECTOR SUPPLEMENTS (removed):
 * Circular 22 defines only this sector-agnostic 12-question ESDD
 * checklist. There is no sector-specific ESDD checklist with a/b/c/d
 * options anywhere in Circular 22 or the 2022 update. Annex 2 of the
 * guideline (Hydropower) is a documentation matrix and parameter table,
 * not a scored checklist. Sector-specific NRB content (cement, textiles,
 * steel, chemicals, brick, agriculture, etc.) belongs to the NRB Green
 * Finance Taxonomy (2024), not ESRM. The earlier `ANNEX5_SECTOR_SUPPLEMENTS`
 * export has been removed to keep this file verbatim-conformant with the
 * NRB source. Sector-specific data capture should live in the taxonomy
 * classification flow, not here.
 */

export type EsddAnswer = "a" | "b" | "c" | "d";

export type EsddQuestion = {
  id: string;
  section: "general" | "ehs" | "social";
  number: string;
  prompt: string;
  options: Record<EsddAnswer, string>;
  guidanceNotes?: string[];
};

/**
 * Basic Information block — captured before any question is answered.
 * Fields match NRB's opening table on the Annex 5 checklist.
 *
 * `loanCategory` sourced from Circular 22 Excel cell B13 (dropdown from
 * `Tempor!A1:A4`). It drives Circular 22 §5 applicability triage and,
 * in a follow-up, whether the Annex 5b Project Finance Screening
 * Questionnaire is required.
 */
export type EsddLoanCategory = "small" | "bwc-term" | "project-finance";

export type EsddBasicInfo = {
  date: string;                    // ISO
  clientName: string;
  transactionId: string;
  location: string;
  industrySector: string;
  productManufactured: string;
  relationshipOfficerName: string;
  businessLine: string;
  // Circular 22 Excel B13 — "Loan Category (Small, Business Working
  // Capital / Term Loan, Project Finance)"
  loanCategory: EsddLoanCategory;
};

// Human-readable labels for the loan-category dropdown (Circular 22 Excel B13).
export const ESDD_LOAN_CATEGORY_LABEL: Record<EsddLoanCategory, string> = {
  "small": "Small (small business loan)",
  "bwc-term": "BWC-Term (Business Working Capital / Term Loan)",
  "project-finance": "Project Finance",
};

// ---------------------------------------------------------------------------
// Section 1 — General Risk
// ---------------------------------------------------------------------------
export const ANNEX5_GENERAL_RISK: EsddQuestion[] = [
  {
    id: "annex5.1.1",
    section: "general",
    number: "1.1",
    // Circular 22 §1.1 (Excel C20 / PDF p.30), verbatim.
    prompt:
      "Are there any legal issues associated with the client's E&S performance?",
    options: {
      // Circular 22 §1.1(a), verbatim.
      a:
        "Client has all valid permits AND has not faced any legal claims or " +
        "any serious environmental/social incident in last three years",
      // Circular 22 §1.1(b), verbatim.
      b:
        "Client does not have all valid permits but has taken definite steps " +
        "to acquire them in next six months AND/OR client has faced legal " +
        "claims but has addressed or has definite plan to address all of them",
      // Circular 22 §1.1(c), verbatim.
      c:
        "Client does not have all valid permits and has not taken any " +
        "definite step to acquire them AND/OR client has faced legal claims " +
        "and has no definite plan to address them",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q1.1 (PDF pp. 33-34), verbatim.
    guidanceNotes: [
      "Refer to Annex 6 for the list of relevant environmental, health, safety and social permits and licenses required per sector. Check for all relevant permits and their validity. If permits and certificates are not up to date and it does not impact immediate operations, up to six months' time can be given for renewal. If even after six months the required permits are not renewed, escalate the transaction.",
      "Check if there are any notices, fines or penalties received for breaching environmental, labour, health & safety or community regulations and pollution limits in past three years.",
      "In the Remarks section — provide details of past fines, amount, reason, and current status of resolution.",
    ],
  },
  {
    id: "annex5.1.2",
    section: "general",
    number: "1.2",
    // Circular 22 §1.2 (Excel C21 / PDF p.30), verbatim.
    prompt:
      "Have operations ever been affected by local stakeholder grievances, " +
      "media or non-governmental organization (NGO) campaigns over E&S issues?",
    options: {
      // Circular 22 §1.2(a), verbatim.
      a: "There is no evidence of stakeholder grievances, negative media or NGO protest",
      // Circular 22 §1.2(b), verbatim.
      b:
        "There is evidence of stakeholder grievances, negative media or NGO " +
        "protest for a particular operation AND client has taken adequate " +
        "steps to address the issue",
      // Circular 22 §1.2(c), verbatim. Prior demo wording said "AND client has
      // taken no adequate steps" — corrected to the source text.
      c:
        "There is evidence of stakeholder grievances, negative media or NGO " +
        "protest and client has not taken any step to address the issue",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q1.2 (PDF pp. 33-34), verbatim examples.
    guidanceNotes: [
      "Examples of triggering incidents include:",
      "Worker riots caused by unfair labour practice, unpaid dues, or unsafe working conditions.",
      "Discharge of untreated toxic effluent, or air / dust / noise pollution affecting local community.",
      "Involuntary resettlement / land acquisition of local community without proper compensation.",
      "Restrictions on land use of local community — e.g. blocked access, restricted grazing or fishing.",
      "Conversion of rice fields to industrial use, encroachment on public / community forest, or use of buildings without required permits.",
      "Adverse impact on a UNESCO World Heritage site, protected monument, or critical natural habitat.",
    ],
  },
  {
    id: "annex5.1.3",
    section: "general",
    number: "1.3",
    // Circular 22 §1.3 (Excel C22 / PDF pp.30-31), verbatim.
    prompt:
      "Is project site and/or its routing likely to have negative impacts on " +
      "sensitive areas (residential or protected sites) near the project site?",
    options: {
      // Circular 22 §1.3(a), verbatim per Excel and guidance note (both use
      // "eco-sensitive"). Prior demo wording said "sensitive areas".
      a: "No eco-sensitive areas observed",
      // Circular 22 §1.3(b), verbatim (Excel wording — canonical).
      b:
        "There are a few eco-sensitive areas AND the client has taken " +
        "adequate measures to mitigate the impact of their operation on the " +
        "eco-sensitive areas as per regulations",
      // Circular 22 §1.3(c), verbatim (Excel wording — canonical).
      c:
        "There are eco-sensitive areas observed and mitigation measures are " +
        "not adequate as per regulations and the client may face legal " +
        "challenge in future",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q1.3 (PDF pp. 33-34), verbatim.
    guidanceNotes: [
      "Eco-sensitive areas include national parks, wildlife reserves, conservation areas, buffer zones, reserve forests, wetlands, protected water bodies, and areas designated for biodiversity protection. Information available from Department of National Parks and Wildlife Conservation, Ministry of Forests and Environment, and Department of Archaeology.",
      "In the Remarks section — record how the presence/absence of eco-sensitive areas was verified (Google Map review, interview with client, visual inspection during site visit).",
    ],
  },
];

// ---------------------------------------------------------------------------
// Section 2 — Environmental Health and Safety Risks
// ---------------------------------------------------------------------------
export const ANNEX5_EHS_RISK: EsddQuestion[] = [
  {
    id: "annex5.2.1",
    section: "ehs",
    number: "2.1",
    // Circular 22 §2.1 (Excel C24 / PDF p.31), verbatim.
    prompt:
      "Is there any evidence of air and noise pollution from the client's " +
      "operation violating the Environment Protection Rules (Official Gazette, " +
      "June 26/1997) or the conditions specified in the client's Pollution " +
      "Control Certificate?",
    options: {
      // Circular 22 §2.1(a), verbatim.
      a:
        "There is no evidence of air/noise pollution and non-compliance " +
        "and/or all mitigation measures and monitoring systems are in place",
      // Circular 22 §2.1(b), verbatim.
      b:
        "There is evidence of air/noise emission and non-compliance AND " +
        "partial mitigation measure, monitoring system is in place AND client " +
        "is addressing or has a definite plan to address the remaining issues",
      // Circular 22 §2.1(c), verbatim.
      c:
        "There is evidence of air emission/noise and non-compliance AND " +
        "there is no mitigation measure/monitoring system in place AND client " +
        "has no definite plan to address the issues",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q2.1 (PDF pp. 34-35), verbatim.
    guidanceNotes: [
      "Sources of air pollution: boilers, chimneys, open-air burning of waste, diesel generator sets, vehicular / material-handling emissions, and process fugitive dust.",
      "Physical evidence: thick dust on plant machinery and walkways, visible smoke, chemical odors, or plant boundary dust deposition.",
      "Sources of noise: diesel generator sets, boilers, grinding / cutting / stamping machinery, compressors, blowers, and material-handling vehicles.",
      "Minimum controls expected: enclosed ventilation for high-dust processes, noise-attenuating enclosures on generator sets, and worker PPE (ear muffs, dust masks) when workplace noise exceeds 70 dB or dust exceeds occupational exposure limits.",
      "In the Remarks section — record the ambient/stack monitoring results reviewed, and note if the client relies on the Pollution Control Certificate condition rather than continuous monitoring.",
    ],
  },
  {
    id: "annex5.2.2",
    section: "ehs",
    number: "2.2",
    // Circular 22 §2.2 (Excel C25 / PDF p.31), verbatim.
    prompt:
      "Is there any evidence of water pollution due to client's operation, " +
      "violating the Environment Protection Rules (Official Gazette, " +
      "June 26/1997) or the conditions specified in the client's Pollution " +
      "Control Certificate?",
    options: {
      // Circular 22 §2.2(a), verbatim.
      a:
        "There is no evidence of water pollution and non-compliance and /or " +
        "all mitigation measures and monitoring systems are in place",
      // Circular 22 §2.2(b), verbatim.
      b:
        "There is evidence of water pollution and non-compliance AND partial " +
        "mitigation measure monitoring system is in place AND client is " +
        "addressing or has a definite plan to address the remaining issues",
      // Circular 22 §2.2(c), verbatim.
      c:
        "There is evidence of water pollution and non-compliance AND there " +
        "is no mitigation measure/monitoring system in place AND client has " +
        "no definite plan to address the issues",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q2.2 (PDF p. 35), verbatim.
    guidanceNotes: [
      "Check if the client's Pollution Control Certificate or sectoral permit requires an Effluent Treatment Plant (ETP). Verify the ETP monitoring records: quantity treated, quality before/after, operating hours.",
      "Physical evidence of untreated discharge: coloured or turbid water, chemical odours, or dyed algae in the receiving drain / stream.",
      "Discharge to unauthorised locations — agricultural fields, residential areas, drinking-water sources, or public drains not designated for industrial effluent — is a non-compliance regardless of quality.",
      "In the Remarks section — record the last three months of ETP performance data reviewed, or note that no data was available.",
    ],
  },
  {
    id: "annex5.2.3",
    section: "ehs",
    number: "2.3",
    // Circular 22 §2.3 (Excel C26 / PDF pp.31-32), verbatim. Prior demo
    // wording dropped the gazette parenthetical and added a stray comma before
    // "violating"; both corrected to the source text.
    prompt:
      "Is there any evidence of land pollution and lack of waste handling " +
      "mechanism in the project operation violating the Environment Protection " +
      "Rules (Official Gazette, June 26/1997) or the conditions specified in " +
      "the client's Pollution Control Certificate?",
    options: {
      // Circular 22 §2.3(a), verbatim.
      a:
        "There is no evidence of land contamination or lack of waste " +
        "handling mechanism or non-compliance OR all mitigation measures and " +
        "monitoring systems are in place",
      // Circular 22 §2.3(b), verbatim.
      b:
        "There is evidence of land contamination or lack of waste handling " +
        "mechanism or non-compliance AND partial mitigation measure, " +
        "monitoring system is in place AND client is addressing or has a " +
        "definite plan to address the remaining issues",
      // Circular 22 §2.3(c), verbatim.
      c:
        "There is evidence of land contamination or lack of waste handling " +
        "mechanism or non-compliance AND there is no mitigation measure/" +
        "monitoring system in place AND client has no definite plan to " +
        "address the issues",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q2.3 (PDF pp. 35-36), verbatim.
    guidanceNotes: [
      "Common contamination sources: chemical storage / transfer areas; diesel generator sets and transformers (diesel and waste oil); toxic waste storage; process equipment using chemicals; dumped raw materials.",
      "Look for evidence of leaks, spills, or long-standing staining around storage tanks, drum stores, transformer bunds, and loading / unloading areas.",
      "Historical land contamination — from operations pre-dating the current owner — should be identified and either remediated or notified to the regulator.",
      "Hazardous waste (batteries, solvents, cutting oil, waste oil, pesticides, paint sludge, e-waste) must be stored separately from non-hazardous waste in dedicated, marked, bunded storage with a controlled inventory.",
      "In the Remarks section — record whether a written waste-handling procedure exists and whether the client has an off-site consignment record for hazardous waste.",
    ],
  },
  {
    id: "annex5.2.4",
    section: "ehs",
    number: "2.4",
    // Circular 22 §2.4 (Excel C27 / PDF p.32), verbatim. Prior demo wording
    // dropped the parenthetical "(solar, wind, mini-hydropower, organic fuel)"
    // — restored here to match the source.
    prompt:
      "Has the client made any investments in technologies or measures in " +
      "its operation leading to cost savings by reducing energy consumption " +
      "(increasing energy efficiency) or using renewable energy (solar, wind, " +
      "mini-hydropower, organic fuel)?",
    options: {
      // Circular 22 §2.4(a), verbatim (restored "(electricity or heat)").
      a:
        "The client made investment in energy efficiency technologies / " +
        "measures OR in renewable energy generation (electricity or heat) OR " +
        "analyzed its operation from the energy efficiency standpoint " +
        "(e.g. energy audit) and is actively pursuing opportunities for " +
        "energy related cost savings.",
      // Circular 22 §2.4(b), verbatim.
      b:
        "The client is considering identifying opportunities for cost savings " +
        "from improved energy efficiency or renewable energy use but has not " +
        "made any particular steps in this direction yet",
      // Circular 22 §2.4(c), verbatim.
      c:
        "The client has never made any investment in technologies or " +
        "measures for energy related cost savings and appears to be unaware " +
        "of the opportunities in these areas",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q2.4 (PDF p. 36), verbatim.
    // Note: Q2.4 is indicative-only per ESRR_criteria!A8 — it does not
    // affect the risk rating. That scoring rule lives in scoring.ts, not
    // in this guidance-note text (per source).
    guidanceNotes: [
      "Energy efficiency project: any investment that reduces the energy required per unit of output — new efficient boilers, motors, drives, insulation, LED lighting, HVAC retrofits, waste-heat recovery, or a formal energy audit followed by targeted upgrades.",
      "Examples: manufacturing — variable-speed drives, efficient compressors, boiler blowdown recovery, insulation of steam lines; housing / commercial buildings — LED lighting, efficient HVAC, building envelope insulation, occupancy controls.",
      "High-energy-consuming sectors where Q2.4 is most relevant: cement, iron and steel, brick, chemicals, fertiliser, paper and pulp, textiles (spinning, wet processing), food processing (dairy, sugar, tea), hotels, cold storage.",
      "Renewable energy sources: small hydropower (typically ≤10 MW), solar photovoltaic and solar thermal, wind, biomass and biogas (from organic waste or agricultural residues).",
    ],
  },
  {
    id: "annex5.2.5",
    section: "ehs",
    number: "2.5",
    // 2022 NRB ESRM Guideline addition — new Q2.5 climate change risks and
    // opportunities. Source: "Final-ESRM-without-cover-1.pdf", Annex 5.
    // TODO: verify wording — Circular 22 Excel does not carry Q2.5; the
    // 2022 update PDF is authoritative for this question.
    prompt:
      "Are there any Climate Change related risks (flood, drought, cyclone " +
      "etc.) and opportunities (GHG emission reduction) associated with the " +
      "client's operation?",
    options: {
      // 2022 NRB ESRM Guideline §Q2.5(a), verbatim.
      a:
        "Client has a robust disaster management plan AND has procedures to " +
        "measure, disclose, set targets, and mitigate GHG emissions.",
      // 2022 NRB ESRM Guideline §Q2.5(b), verbatim.
      b:
        "Client has a disaster management plan but it is not robust AND " +
        "there is evidence of intention to measure, disclose, set targets, " +
        "mitigate GHG in near future.",
      // 2022 NRB ESRM Guideline §Q2.5(c), verbatim.
      c:
        "No disaster management plan AND no definite plan to measure, " +
        "disclose, set targets, mitigate GHG.",
      d: "Not applicable.",
    },
    // 2022 NRB ESRM Guideline guidance note for Q2.5, verbatim/paraphrased
    // from the pre-Annex-2 climate section (p.24-26) and the Q2.5 notes.
    guidanceNotes: [
      "Climate risk splits into physical risks and transition risks per the NGFS taxonomy (Network for Greening the Financial System — Overview of Environmental Risk Analysis by Financial Institutions).",
      "Physical risks include extreme weather (tropical cyclones, floods, winter storms, heat waves, droughts, wildfires, hailstorms), ecosystem pollution (soil / water / marine pollution, environmental accidents), sea-level rise, water scarcity, deforestation, and desertification.",
      "Transition risks include public policy change (energy transition, pollution control, resource conservation), technology change (clean energy, energy-saving, clean transport, other green technologies), shifting sentiment, and disruptive business models.",
      "GHG reporting threshold: clients emitting more than 25,000 metric tonnes of CO₂-equivalent per year need to report their emissions and should have an emission reduction plan. Under this threshold, encourage voluntary tracking but do not require formal disclosure.",
      "A robust disaster management plan identifies the specific physical hazards at each site (flood, landslide, fire, drought, epidemic), assigns responsibilities, defines response procedures, and is reviewed at least annually.",
      "In the Remarks section — record the client's most recent GHG inventory (if any), disaster plan review date, and any renewable energy or efficiency investments already committed.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Section 3 — Social Risks
// ---------------------------------------------------------------------------
export const ANNEX5_SOCIAL_RISK: EsddQuestion[] = [
  {
    id: "annex5.3.1",
    section: "social",
    number: "3.1",
    // Circular 22 §3.1 (Excel C29 / PDF p.32), verbatim.
    prompt:
      "Is there any evidence of increased fire risk or occupational health " +
      "& safety (OHS) risk, i.e. risk of injuries at work?",
    options: {
      // Circular 22 §3.1(a), verbatim.
      a: "The client does not have any OHS concern or have mitigated them adequately",
      // Circular 22 §3.1(b), verbatim.
      b: "The client has some OHS concern but has taken definite steps to correct them",
      // Circular 22 §3.1(c), verbatim.
      c:
        "The client has OHS concern in its operation and have no plans of " +
        "correcting them",
      // Circular 22 §3.1(d), verbatim — Circular 22 capitalises "Applicable"
      // for Q3.1 only; the other 3.x questions use lowercase.
      d: "Not Applicable",
    },
    // Circular 22 Annex 5 guidance for Q3.1 (PDF pp. 36-37), verbatim.
    guidanceNotes: [
      "Check whether the client has a documented system to identify occupational hazards and unsafe conditions at the workplace.",
      "Review media reports and inspection records for any past fire or serious injury incidents at the site.",
      "Verify that PPE (personal protective equipment) noticeboards are posted at appropriate work areas.",
      "Observe whether workers are actually using the prescribed PPE — hard hats, ear muffs, dust masks, goggles, gloves, safety shoes, harnesses.",
      "Review records of OHS training programs conducted for workers and supervisors in the past 12 months.",
      "Check for an on-site OHS centre or first-aid room, staffed and equipped for the workforce size.",
      "Verify firefighting equipment: extinguishers of appropriate class, hydrants, hose reels, fire pumps — all serviced and dated.",
      "Verify unobstructed emergency exits, marked and lit, sized for the workforce.",
      "Verify a functional evacuation alarm and confirm that regular evacuation drills are conducted.",
      "Review the site fire-safety plan and the current Fire Safety Certificate where required.",
      "In the Remarks section — record the date of the last drill, the number of trained workers, and any observed non-compliances.",
    ],
  },
  {
    id: "annex5.3.2",
    section: "social",
    number: "3.2",
    // Circular 22 §3.2 (Excel C30 / PDF p.32), verbatim.
    prompt:
      "Are the labor and working conditions poor and breaching local " +
      "regulations / standards?",
    options: {
      // Circular 22 §3.2(a), verbatim.
      a:
        "There is proper working condition and labor practice AND there is no " +
        "evidence of poor working condition or labor practice for which client " +
        "may face legal challenge or labor unrest or negative media coverage " +
        "or protest from activist",
      // Circular 22 §3.2(b), verbatim.
      b:
        "There are a few evidences of poor working conditions BUT no " +
        "significantly poor labor practice such as child/forced labor is " +
        "present AND the client has a definite plan to improve the working " +
        "condition to ensure there is no legal challenge or labor unrest or " +
        "negative media coverage or protest from activist in future",
      // Circular 22 §3.2(c), verbatim.
      c:
        "Working condition is very poor AND/OR there is presence of " +
        "significantly poor labor practice such as child labor/forced labor " +
        "AND client is not addressing/has no definite plan to address the issues",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q3.2 (PDF p. 37), verbatim.
    // Age correction: NRB source states minimum working age in Nepal is 14
    // (per Circular 22 Glossary sheet A4 and the guidance note itself, which
    // references the Nepal Labour Act, 2074 (2017) and the Child Labor
    // Prohibition and Regulation Act, 2000: minimum working age 14, minimum
    // age for hazardous work 16). The prior demo wording said "under 16" —
    // corrected to "under 14".
    guidanceNotes: [
      "Good working conditions matter because poor conditions drive labour unrest, high attrition, legal claims, and reputational damage that all affect the loan.",
      "Workplace-condition indicators to check on site: noise, temperature, lighting and ventilation adequate for the task; potable water and sanitation available; PPE issued and used; written child-labour and forced-labour policies displayed.",
      "Categories of poor labour practice: below-minimum wages, excessive working hours, OHS failures, arbitrary discipline / dismissal, and discrimination in hiring or promotion.",
      "Verify age, wage and attendance records for a sample of workers. Cross-check attendance registers against payroll.",
      "Check that written employment contracts exist and cover: job title, wage, hours, leave entitlement, notice period, and grievance channel.",
      "Verify whether workers are represented by a union or covered by a collective bargaining agreement, and whether the client engages with worker representatives on OHS / grievance matters.",
      "Review any labour inspector reports and, for export-oriented clients, any SA 8000 or buyer social-audit reports (H&M, Ikea, Nike, Starbucks, Walmart, etc.).",
      "Minimum working age in Nepal is 14 (Nepal Labour Act, 2074 (2017); Child Labor (Prohibition and Regulation) Act, 2000 — 14 for work, 16 for hazardous work). Transactions should be terminated if instances of child labor or forced labor are found in client's activities, unless immediate remedial actions are taken.",
      "In the Remarks section — record which records were reviewed, sample size, and any observed non-compliances.",
    ],
  },
  {
    id: "annex5.3.3",
    section: "social",
    number: "3.3",
    // Circular 22 §3.3 (Excel C31 / PDF pp.32-33), verbatim.
    prompt:
      "Does the project pose a threat to Community Health, Safety and Security?",
    options: {
      // Circular 22 §3.3(a), verbatim (Excel wording — capitalises "There").
      a:
        "There is no evidence of issues that may create nuisance/accidents/" +
        "injuries to local community in future or the company has a robust " +
        "plan for community health & safety which was developed in " +
        "consultation with the local community",
      // Circular 22 §3.3(b), verbatim.
      b:
        "There are a few evidences of issues that may create nuisance/ " +
        "accidents/ injuries to local community AND the client intends to " +
        "address the gaps AND/OR the client has a plan for community health " +
        "& safety but it is not robust or it is not developed in consultation " +
        "with the community",
      // Circular 22 §3.3(c), verbatim.
      c:
        "There is evidence of significant issues that can create nuisance/ " +
        "accidents/ injuries to local community AND client has no definite " +
        "plan to address the gaps AND/OR does not intend to manage its impact " +
        "on community health & safety",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q3.3 (PDF pp. 37-38), verbatim.
    guidanceNotes: [
      "Nuisance: dust, noise, odour, vibration, traffic, glare, or waste that materially reduces the quality of life for nearby residents.",
      "Life & fire safety: exit routes, alarm and evacuation planning must consider community areas within the plant's influence zone, not only the workforce.",
      "Structural safety: buildings, storage tanks, dams, chimneys, and boundary walls must be designed and maintained to withstand seismic and flood loads (Nepal Building Code, Building Act 1998, Building Code Standard 2014).",
      "Water quality and availability: verify the client's water abstraction does not deprive the local community of drinking or irrigation water, and that discharge does not contaminate community water sources.",
      "Hazardous materials: storage, transport, and use of hazardous chemicals near residential areas must be notified to the community and covered by an emergency response plan.",
      "Illustrative examples: a tannery discharging chromium-bearing effluent into a drain used by downstream farmers; a poultry farm generating odour and fly nuisance near a school; a steel re-rolling plant with unsafe scrap-metal storage adjacent to community access roads; a chemical explosion risk from unbunded solvent storage near housing.",
      "In the Remarks section — record whether a community grievance mechanism exists, when it was last used, and whether any complaints remain unresolved.",
    ],
  },
  {
    id: "annex5.3.4",
    section: "social",
    number: "3.4",
    // Circular 22 §3.4 (PDF p.33 only — not present in the Excel checklist
    // sheet, which stops at 3.3). The PDF is canonical for Annex 5.
    prompt:
      "Is there any evidence of community consultation with key stakeholders " +
      "including indigenous people?",
    options: {
      // Circular 22 §3.4(a), verbatim.
      a:
        "There is evidence that the client consults/engages with the " +
        "stakeholders including local community, indigenous people on (such " +
        "as rehabilitation, compensation, their expectations as the case may be)",
      // Circular 22 §3.4(b), verbatim.
      b: "There is limited/inadequate consultations with the stakeholders",
      // Circular 22 §3.4(c), verbatim.
      c: "No consultations with the stakeholders",
      d: "Not applicable",
    },
    // Circular 22 Annex 5 guidance for Q3.4 (PDF p. 38), verbatim.
    guidanceNotes: [
      "Identify the key stakeholders for the operation: affected community members, indigenous / vulnerable groups, adjacent landowners, downstream water users, workers' representatives, and local authorities.",
      "For projects involving displacement or resettlement, verify direct engagement with affected households on rehabilitation options, compensation rates, and livelihood restoration measures.",
      "Verify that a grievance mechanism accessible to the local community exists, is publicised, and that a grievance log is maintained.",
      "For projects that touch cultural heritage — religious sites, monuments, traditional lands — confirm impact assessment and consultation with affected community leaders.",
      "Exception: for consultancy, professional service, or purely commercial-office businesses with no site footprint, this question may be marked 'd) Not applicable' — the RM must record the justification in the Remarks.",
    ],
  },
];

/**
 * The full ordered checklist that the wizard walks through.
 *
 * Circular 22 defines only the 12-question sector-agnostic checklist
 * (10 base per Circular 22 Excel + PDF-only Q3.4 + 2022 addition Q2.5 =
 * 12 questions total: 3 general + 5 EHS + 4 social).
 *
 * The `sectorSlug` parameter is retained only for backwards compatibility
 * with legacy callers; it is ignored. Sector supplements were removed
 * because they are not part of Circular 22 or the 2022 update.
 */
export function fullChecklist(_sectorSlug?: string): EsddQuestion[] {
  return [
    ...ANNEX5_GENERAL_RISK,
    ...ANNEX5_EHS_RISK,
    ...ANNEX5_SOCIAL_RISK,
  ];
}
