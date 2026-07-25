/**
 * NRB ESRM Guidelines (2018) — Annex 5 E&S Due Diligence Checklist.
 *
 * Verbatim transcription of the questions and answer options from the NRB
 * source document (Circular 22, FY 2074/75). Every question captures:
 *   - id             : stable identifier used on captured rows
 *   - section        : "general" | "ehs" | "social" | "sector-<slug>"
 *   - number         : NRB's own numbering (e.g. "1.1", "2.3")
 *   - prompt         : the question text as NRB writes it
 *   - options        : the four answer options a/b/c/d, verbatim
 *   - guidanceNotes  : the "what to look for" text NRB provides at the end
 *                       of the checklist (extracted per question)
 *
 * This file is regulatory data. It changes only when NRB revises the
 * guideline. Do not edit to adjust demo behavior; edit lib/regulatory/esdd/
 * scoring.ts and risk-aggregation.ts instead.
 *
 * Source: NRB_ESRM_Guidelines_2018_Circular22.pdf, Annex 5 (pages 30-38).
 *
 * ---------------------------------------------------------------------------
 * STATUS: Phase 2 in-progress. This file contains the General Risk (Section 1)
 * and Environmental Health & Safety (Section 2) blocks fully transcribed.
 * Section 3 (Social Risk) and the sector supplements (Annex 2 hydropower,
 * Annex 3 sector-specific) are marked TODO and will be filled in as the
 * compliance extract task progresses. See the extension plan §6.2.
 * ---------------------------------------------------------------------------
 */

export type EsddAnswer = "a" | "b" | "c" | "d";

export type EsddQuestion = {
  id: string;
  section: "general" | "ehs" | "social" | `sector-${string}`;
  number: string;
  prompt: string;
  options: Record<EsddAnswer, string>;
  guidanceNotes?: string[];
};

/**
 * Basic Information block — captured before any question is answered.
 * Fields match NRB's opening table on the Annex 5 checklist.
 */
export type EsddBasicInfo = {
  date: string;                    // ISO
  clientName: string;
  transactionId: string;
  location: string;
  industrySector: string;
  productManufactured: string;
  relationshipOfficerName: string;
  businessLine: string;
};

// ---------------------------------------------------------------------------
// Section 1 — General Risk
// ---------------------------------------------------------------------------
export const ANNEX5_GENERAL_RISK: EsddQuestion[] = [
  {
    id: "annex5.1.1",
    section: "general",
    number: "1.1",
    prompt:
      "Are there any legal issues associated with the client's E&S performance?",
    options: {
      a:
        "Client has all valid permits AND has not faced any legal claims or " +
        "any serious environmental/social incident in last three years",
      b:
        "Client does not have all valid permits but has taken definite steps " +
        "to acquire them in next six months AND/OR client has faced legal " +
        "claims but has addressed or has definite plan to address all of them",
      c:
        "Client does not have all valid permits and has not taken any " +
        "definite step to acquire them AND/OR client has faced legal claims " +
        "and has no definite plan to address them",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Check for all relevant environmental, health and safety licenses and permits and their validity. If permits and certificates are not up to date and it does not impact immediate operations, up to six months' time can be given for renewal. If even after six months the required permits are not renewed, escalate the transaction.",
      "Check if there are any notices, fines, or penalties received for breaching environmental, labour safety, or community health and safety regulations and pollution limits in past three years.",
    ],
  },
  {
    id: "annex5.1.2",
    section: "general",
    number: "1.2",
    prompt:
      "Have operations ever been affected by local stakeholder grievances, " +
      "media or non-governmental organization (NGO) campaigns over E&S issues?",
    options: {
      a: "There is no evidence of stakeholder grievances, negative media or NGO protest",
      b:
        "There is evidence of stakeholder grievances, negative media or NGO " +
        "protest for a particular operation AND client has taken adequate " +
        "steps to address the issue",
      c:
        "There is evidence of stakeholder grievances, negative media or NGO " +
        "protest AND client has taken no adequate steps to address the issue",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Examples of triggering incidents: worker unrest / riots, discharge of untreated toxic effluent, dust or noise affecting local community, involuntary resettlement without proper compensation, encroachment on forest land, use of buildings without permit, adverse impact on UNESCO World Heritage sites or critical natural habitat.",
    ],
  },
  {
    id: "annex5.1.3",
    section: "general",
    number: "1.3",
    prompt:
      "Is project site and/or its routing likely to have negative impacts on " +
      "sensitive areas (residential or protected sites) near the project site?",
    options: {
      a: "No sensitive areas observed",
      b:
        "There are a few sensitive areas and the client has taken adequate " +
        "measures to mitigate the impact of their operation on the sensitive " +
        "areas as per regulations",
      c:
        "There are sensitive areas observed and mitigation measures are not " +
        "adequate as per regulations and the client may face legal challenge in future",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Sensitive areas include national parks, wildlife sanctuaries, reserve forests, water bodies, wetlands, and areas designated for biodiversity protection. Information available from Department of National Parks and Wildlife Conservation, Ministry of Forests and Environment, and Department of Archaeology.",
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
    prompt:
      "Is there any evidence of air and noise pollution from the client's " +
      "operation violating the Environment Protection Rules (Official Gazette, " +
      "June 26/1997) or the conditions specified in the client's Pollution " +
      "Control Certificate?",
    options: {
      a:
        "There is no evidence of air/noise pollution and non-compliance " +
        "and/or all mitigation measures and monitoring systems are in place",
      b:
        "There is evidence of air/noise emission and non-compliance AND " +
        "partial mitigation measure, monitoring system is in place AND client " +
        "is addressing or has a definite plan to address the remaining issues",
      c:
        "There is evidence of air emission/noise and non-compliance AND " +
        "there is no mitigation measure/monitoring system in place AND client " +
        "has no definite plan to address the issues",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Sources of air pollution: boilers, chimneys, open-air burning of waste, diesel generator sets, vehicular emissions.",
      "Physical evidence: thick dust on plant machinery and walkways, visible smoke, chemical odors.",
    ],
  },
  {
    id: "annex5.2.2",
    section: "ehs",
    number: "2.2",
    prompt:
      "Is there any evidence of water pollution due to client's operation, " +
      "violating the Environment Protection Rules (Official Gazette, " +
      "June 26/1997) or the conditions specified in the client's Pollution " +
      "Control Certificate?",
    options: {
      a:
        "There is no evidence of water pollution and non-compliance and/or " +
        "all mitigation measures and monitoring systems are in place",
      b:
        "There is evidence of water pollution and non-compliance AND partial " +
        "mitigation measure monitoring system is in place AND client is " +
        "addressing or has a definite plan to address the remaining issues",
      c:
        "There is evidence of water pollution and non-compliance AND there " +
        "is no mitigation measure/monitoring system in place AND client has " +
        "no definite plan to address the issues",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Check if the permission requires an Effluent Treatment Plant (ETP) and verify its monitoring records: quantity treated, quality before/after, running hours.",
      "Look for evidence of untreated discharge: coloured or turbid water, chemical odours, discharge into agricultural fields, residential areas, or drinking water sources.",
    ],
  },
  {
    id: "annex5.2.3",
    section: "ehs",
    number: "2.3",
    prompt:
      "Is there any evidence of land pollution and lack of waste handling " +
      "mechanism in the project operation, violating the Environment Protection " +
      "Rules or the conditions specified in the client's Pollution Control Certificate?",
    options: {
      a:
        "There is no evidence of land contamination or waste handling issues " +
        "and/or all mitigation measures and monitoring systems are in place",
      b:
        "There is evidence of land contamination or lack of waste handling " +
        "mechanism AND partial mitigation is in place AND client has a " +
        "definite plan to address the remaining issues",
      c:
        "There is evidence of land contamination or lack of waste handling " +
        "mechanism or non-compliance AND there is no mitigation measure/monitoring " +
        "system in place AND client has no definite plan to address the issues",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Common contamination sources: chemical storage/transfer areas, diesel generator sets and transformers (diesel and waste oil), toxic waste storage, process equipment using chemicals, dumped raw materials.",
      "Hazardous waste (batteries, solvents, cutting oil, waste oil, pesticides, paint sludge) must be stored separately from non-hazardous waste with dedicated marked storage.",
    ],
  },
  {
    id: "annex5.2.4",
    section: "ehs",
    number: "2.4",
    prompt:
      "Has the client made any investments in technologies or measures in " +
      "its operation leading to cost savings by reducing energy consumption " +
      "(increasing energy efficiency) or using renewable energy?",
    options: {
      a:
        "The client made investment in energy efficiency technologies/measures " +
        "OR in renewable energy generation OR analyzed its operation from the " +
        "energy efficiency standpoint (e.g. energy audit) and is actively " +
        "pursuing opportunities for energy-related cost savings",
      b:
        "The client is considering identifying opportunities for cost savings " +
        "from improved energy efficiency or renewable energy use but has not " +
        "made any particular steps in this direction yet",
      c:
        "The client has never made any investment in technologies or measures " +
        "for energy-related cost savings and appears to be unaware of the " +
        "opportunities in these areas",
      d: "Not applicable",
    },
    guidanceNotes: [
      "This question is scored differently from the pollution-focused questions above. Answer 'a' here is a positive signal (efficient / renewable-invested client), not merely 'no risk found'.",
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
    prompt:
      "Is there any evidence of increased fire risk or occupational health " +
      "& safety (OHS) risk, i.e. risk of injuries at work?",
    options: {
      a: "The client does not have any OHS concern or have mitigated them adequately",
      b: "The client has some OHS concern but has taken definite steps to correct them",
      c:
        "The client has OHS concern in its operation and have no plans of " +
        "correcting them",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Check for adequate personal protective equipment (PPE) use, worker safety training, emergency response procedures, and OHS incident records.",
      "Fire risk indicators include lack of extinguishers, blocked exits, flammable materials stored unsafely, and absence of fire-safety certificates.",
    ],
  },
  {
    id: "annex5.3.2",
    section: "social",
    number: "3.2",
    prompt:
      "Are the labor and working conditions poor and breaching local " +
      "regulations / standards?",
    options: {
      a:
        "There is proper working condition and labor practice AND there is no " +
        "evidence of poor working condition or labor practice for which client " +
        "may face legal challenge or labor unrest or negative media coverage " +
        "or protest from activist",
      b:
        "There are a few evidences of poor working conditions BUT no " +
        "significantly poor labor practice such as child/forced labor is " +
        "present AND the client has a definite plan to improve the working " +
        "condition to ensure there is no legal challenge or labor unrest or " +
        "negative media coverage or protest from activist in future",
      c:
        "Working condition is very poor AND/OR there is presence of " +
        "significantly poor labor practice such as child labor/forced labor " +
        "AND client is not addressing/has no definite plan to address the issues",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Verify compliance with Nepal Labour Act and Occupational Health and Safety regulations: working hours, wages, overtime pay, contracts, social security enrolment.",
      "Any evidence of child labor (under 16) or forced labor is an automatic escalation regardless of other mitigation. Neither is negotiable.",
      "Check factory records against union representation and grievance mechanism documentation.",
    ],
  },
  {
    id: "annex5.3.3",
    section: "social",
    number: "3.3",
    prompt:
      "Does the project pose a threat to Community Health, Safety and Security?",
    options: {
      a:
        "There is no evidence of issues that may create nuisance/accidents/" +
        "injuries to local community in future or the company has a robust " +
        "plan for community health & safety which was developed in " +
        "consultation with the local community",
      b:
        "There are a few evidences of issues that may create nuisance/" +
        "accidents/injuries to local community AND the client intends to " +
        "address the gaps AND/OR the client has a plan for community health " +
        "& safety but it is not robust or it is not developed in consultation " +
        "with the community",
      c:
        "There is evidence of significant issues that can create nuisance/" +
        "accidents/injuries to local community AND client has no definite " +
        "plan to address the gaps AND/OR does not intend to manage its impact " +
        "on community health & safety",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Check for a community grievance mechanism accessible to affected residents. Look at incident logs for past complaints and resolution records.",
      "Site visits: verify perimeter security, traffic-safety measures for community areas near heavy vehicle routes, and warning signage for hazardous zones.",
    ],
  },
  {
    id: "annex5.3.4",
    section: "social",
    number: "3.4",
    prompt:
      "Is there any evidence of community consultation with key stakeholders " +
      "including indigenous people?",
    options: {
      a:
        "There is evidence that the client consults/engages with the " +
        "stakeholders including local community, indigenous people on (such " +
        "as rehabilitation, compensation, their expectations as the case may be)",
      b: "There is limited/inadequate consultations with the stakeholders",
      c: "No consultations with the stakeholders",
      d: "Not applicable",
    },
    guidanceNotes: [
      "Nepal ratified ILO Convention 169 on Indigenous and Tribal Peoples in 2007. Free, Prior and Informed Consent (FPIC) documentation is expected for projects on or near indigenous land.",
      "Verify consultation minutes, stakeholder-mapping records, and any Memoranda of Understanding (MoU) with affected communities.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Sector-specific supplements
// ---------------------------------------------------------------------------
// Per plan decision Q3, all sectors are in scope from day one. Each
// supplement below covers the NRB Annex 2 (hydropower) / Annex 3
// (sector-specific) risk areas the guideline calls out for that sector.
//
// STATUS: first-pass content. Wording is aligned to NRB's a/b/c/d
// convention (a = best case, b = partial mitigation with plan, c =
// unmitigated concern that triggers escalation, d = not applicable) but
// has NOT yet been word-for-word verified against the source doc for
// every question. A follow-up compliance pass with the bank's ESRM lead
// should refine the wording against the source PDF — same pattern we're
// using for the taxonomy criteria.
//
// Keys are sector slugs matched by lib/regulatory/esdd/sector-slug.ts and
// by the sectorSlugFor() helpers in the API routes.
export const ANNEX5_SECTOR_SUPPLEMENTS: Record<string, EsddQuestion[]> = {
  // -------------------------------------------------------------------------
  // Hydropower (Annex 2 of NRB ESRM Guidelines)
  // -------------------------------------------------------------------------
  hydropower: [
    {
      id: "annex5.hydro.1",
      section: "sector-hydropower",
      number: "H.1",
      prompt:
        "Does the project maintain the environmental release / minimum " +
        "downstream flow required by the generation licence?",
      options: {
        a:
          "Environmental release is metered, complies with the licence " +
          "condition, and records are available to the bank on request",
        b:
          "Environmental release is not consistently metered but the " +
          "operator has committed to install monitoring and share records " +
          "within a defined timeline",
        c:
          "No environmental release maintained OR licence condition is " +
          "regularly breached with no corrective plan",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Nepal Electricity Regulatory Commission and Department of Electricity Development licence conditions specify a minimum environmental flow (typically expressed as a percentage of the mean monthly discharge).",
        "For run-of-river schemes without dedicated environmental-flow bypass, downstream ecology and irrigation users can be materially harmed. Verify by field observation of bypass reach during operation.",
      ],
    },
    {
      id: "annex5.hydro.2",
      section: "sector-hydropower",
      number: "H.2",
      prompt:
        "Has the project completed all resettlement, land compensation " +
        "and community-benefit obligations agreed at the time of licence?",
      options: {
        a:
          "All resettlement, compensation and benefit-sharing obligations " +
          "have been discharged and there are no outstanding disputes",
        b:
          "Some obligations remain but a written completion plan with " +
          "committed dates is in place AND affected households have been " +
          "informed",
        c:
          "Material obligations remain outstanding AND there is no credible " +
          "plan OR there are unresolved community disputes",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Check DoED / Investment Board Nepal file for signed MoUs with affected VDCs / rural municipalities.",
        "The 10% local shareholding and 1% royalty-sharing arrangements are common commitments — verify against project agreement.",
      ],
    },
    {
      id: "annex5.hydro.3",
      section: "sector-hydropower",
      number: "H.3",
      prompt:
        "Has the project addressed geological, seismic and landslide risks " +
        "identified in the site studies?",
      options: {
        a:
          "Detailed engineering incorporates the recommendations of the " +
          "seismic / geotechnical study AND a monitoring programme is in place",
        b:
          "Recommendations partially implemented; residual risks known and " +
          "a mitigation plan is committed with clear timelines",
        c:
          "Known geological or seismic risks are unmitigated AND there is no " +
          "clear plan to address them",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Nepal is a high-seismic-hazard country. Verify design against Nepal Building Code and IS 1893 seismic zones; check for landslide-hazard mapping and headworks stability.",
        "Post-2015 earthquake and post-2021 Melamchi flood, updated hazard assessments are expected for projects in the Central and Western Development Regions.",
      ],
    },
    {
      id: "annex5.hydro.4",
      section: "sector-hydropower",
      number: "H.4",
      prompt:
        "Has fish passage / riverine ecology been addressed where the " +
        "environmental study identified migratory species?",
      options: {
        a:
          "Fish ladder or comparable passage is installed and functional, " +
          "OR the study found no migratory species impact",
        b:
          "Passage is planned but not yet built, with a committed installation " +
          "date, AND interim mitigation is in place",
        c:
          "Migratory-species impact identified in the study is unmitigated " +
          "AND no plan is in place",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Common migratory species affected by mid-hill hydropower include Asla (snowtrout) and Sahar (mahseer). Presence should have been flagged in the IEE / EIA.",
        "Absence of a fish ladder is not disqualifying if the EIA established no migratory species use the reach.",
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Cement (Annex 3 industrial supplement)
  // -------------------------------------------------------------------------
  cement: [
    {
      id: "annex5.cement.1",
      section: "sector-cement",
      number: "C.1",
      prompt:
        "Are kiln stack particulate emissions within the Environment " +
        "Protection Rules limit and continuously monitored?",
      options: {
        a:
          "Stack CEMS or periodic monitoring shows compliance; records are " +
          "shared with the Department of Environment on schedule",
        b:
          "Some exceedances noted; corrective actions (bag-filter upgrade, " +
          "electrostatic precipitator maintenance) are committed with dates",
        c:
          "Persistent exceedances OR no monitoring programme in place OR " +
          "monitoring records are not shared with the regulator",
        d: "Not applicable",
      },
      guidanceNotes: [
        "EPR limits for cement kilns: 150 mg/Nm³ particulate; 800 mg/Nm³ SO₂; 800 mg/Nm³ NOx.",
        "Bag-filter cement plants can meet the PM limit if maintained; ESP-only plants often struggle without upgrades.",
      ],
    },
    {
      id: "annex5.cement.2",
      section: "sector-cement",
      number: "C.2",
      prompt:
        "Does the limestone quarry have an approved rehabilitation plan " +
        "that is being executed?",
      options: {
        a:
          "Approved plan in place with staged rehabilitation; visible progress " +
          "on rehabilitated benches",
        b:
          "Plan approved but rehabilitation lags mining; operator has " +
          "committed to a catch-up schedule",
        c:
          "No approved plan OR quarry is being extended without rehabilitation " +
          "of exhausted areas",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Verify Department of Mines and Geology royalty payments and quarry-lease documents. Rehabilitation is a condition of most limestone leases.",
        "Common issues: acid rock drainage from spoil dumps, dust from haul roads, community complaints about blasting.",
      ],
    },
    {
      id: "annex5.cement.3",
      section: "sector-cement",
      number: "C.3",
      prompt:
        "Are fugitive dust sources (clinker handling, packing, haul roads) " +
        "controlled?",
      options: {
        a:
          "Enclosed conveyors, packing dust-collectors, and haul-road " +
          "water spraying are all in operation",
        b:
          "Partial controls in place; operator has committed to close the " +
          "remaining gaps",
        c:
          "Visible dust plumes at clinker silos, packing lines or haul " +
          "roads with no mitigation programme",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Community grievances about cement plants in Nepal (Bhairahawa, Birgunj corridor) are dominated by fugitive dust rather than stack emissions. Photograph packing areas during a site visit.",
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Textiles (Annex 3 industrial supplement)
  // -------------------------------------------------------------------------
  textiles: [
    {
      id: "annex5.textile.1",
      section: "sector-textiles",
      number: "T.1",
      prompt:
        "Is dyeing / wet-processing effluent treated to meet the " +
        "generic textile industry discharge standards before discharge?",
      options: {
        a:
          "ETP is operating; monitoring records show compliance with pH, " +
          "COD, BOD and colour limits",
        b:
          "ETP present but under-performing on one or two parameters; " +
          "operator has committed to a defined upgrade schedule",
        c:
          "No ETP OR effluent discharged to drain / land with no treatment",
        d:
          "Not applicable (dry weaving / knitting only, no wet processing)",
      },
      guidanceNotes: [
        "Nepal Generic Standards for Textile Industries: pH 5.5-9.0, COD 250 mg/l, BOD 30 mg/l, TSS 100 mg/l.",
        "Physical evidence of untreated dyeing effluent: coloured drains, dyed algae in receiving water, complaints from downstream farmers.",
      ],
    },
    {
      id: "annex5.textile.2",
      section: "sector-textiles",
      number: "T.2",
      prompt:
        "Are chemicals used in dyeing / finishing (azo dyes, formaldehyde, " +
        "heavy-metal mordants) restricted or eliminated where required?",
      options: {
        a:
          "Chemical inventory shows compliance with restricted-substances " +
          "lists (e.g. buyer RSL); SDSs available for every chemical",
        b:
          "Some restricted substances still in use; operator has committed " +
          "to phase-out on a defined schedule",
        c:
          "Restricted or banned substances in active use with no phase-out " +
          "plan OR no chemical inventory maintained",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Export-oriented mills commonly follow buyer RSLs (e.g. H&M, Zara) — request the internal chemical-approval file.",
        "Look for AZO dyes, pentachlorophenol, and formaldehyde-based resins in finishing.",
      ],
    },
    {
      id: "annex5.textile.3",
      section: "sector-textiles",
      number: "T.3",
      prompt:
        "Are worker exposures to fibres, noise and chemical fumes controlled " +
        "with PPE and ventilation?",
      options: {
        a:
          "Task-specific PPE issued and used; local exhaust ventilation " +
          "on dyeing / printing lines; OHS training records maintained",
        b:
          "PPE issued but inconsistent use observed; ventilation covers " +
          "some but not all hot spots — corrective plan committed",
        c:
          "No PPE programme OR no ventilation OR OHS incident records " +
          "show recurring exposure incidents",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Byssinosis (cotton dust) is a known risk in spinning; hearing loss in weaving; skin sensitisation in dyeing.",
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Steel (Annex 3 industrial supplement)
  // -------------------------------------------------------------------------
  steel: [
    {
      id: "annex5.steel.1",
      section: "sector-steel",
      number: "S.1",
      prompt:
        "Are induction / EAF furnace emissions captured and treated?",
      options: {
        a:
          "Fume-extraction hoods, bag filters and stack monitoring meet EPR " +
          "limits; records available",
        b:
          "Extraction is in place but coverage is partial; operator has " +
          "committed to close the remaining gaps",
        c:
          "Furnaces vent uncaptured to roof / atmosphere OR bag filters " +
          "are not maintained OR no monitoring",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Induction furnaces without hood-and-filter systems are a persistent air-quality issue in Nepal's steel corridor (Simara / Birgunj).",
      ],
    },
    {
      id: "annex5.steel.2",
      section: "sector-steel",
      number: "S.2",
      prompt:
        "Is furnace slag disposed of or reused in a controlled manner?",
      options: {
        a:
          "Slag is sold to cement / aggregate producers OR disposed at a " +
          "permitted site with runoff controls",
        b:
          "Some uncontrolled dumping historically; operator has an approved " +
          "disposal plan going forward",
        c:
          "Slag is dumped in open areas or waterways with no controls",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Steel slag can leach heavy metals if exposed to weathering. Check the disposal site against drainage patterns.",
      ],
    },
    {
      id: "annex5.steel.3",
      section: "sector-steel",
      number: "S.3",
      prompt:
        "Is scrap-metal sourcing traceable and free of hazardous " +
        "contamination (medical, munitions, radioactive)?",
      options: {
        a:
          "Formal scrap-purchase agreements; radiation portals at intake; " +
          "documented rejection procedure",
        b:
          "Some traceability; operator has committed to install radiation " +
          "monitoring at the intake gate",
        c:
          "No radiation monitoring AND scrap sourced primarily from " +
          "informal collectors with no documentation",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Radioactive contamination incidents at Indian and Bangladeshi mills are documented; imported scrap into Nepal carries the same risk.",
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Chemicals (Annex 3 industrial supplement)
  // -------------------------------------------------------------------------
  chemicals: [
    {
      id: "annex5.chem.1",
      section: "sector-chemicals",
      number: "Ch.1",
      prompt:
        "Are hazardous chemicals stored in dedicated, bunded, ventilated " +
        "areas with segregation of incompatibles?",
      options: {
        a:
          "Storage complies with SDS requirements; secondary containment " +
          "sized for largest vessel; incompatible chemicals segregated",
        b:
          "Storage is broadly adequate but has known gaps; operator has " +
          "committed to a defined remediation schedule",
        c:
          "Chemicals stored open, unbunded, or with incompatibles adjacent " +
          "AND no remediation plan",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Verify the operator's Emergency Response Plan and confirm the local fire brigade has been briefed on stored chemicals.",
      ],
    },
    {
      id: "annex5.chem.2",
      section: "sector-chemicals",
      number: "Ch.2",
      prompt:
        "Is process effluent characterised and treated before discharge " +
        "or off-site consignment?",
      options: {
        a:
          "Effluent is characterised, treated on site to permit limits OR " +
          "consigned to a licensed treatment facility with manifests",
        b:
          "Treatment is present but some parameters exceed limits; operator " +
          "has an upgrade plan with dates",
        c:
          "Untreated discharge OR unmanifested off-site consignment",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Small-scale specialty chemicals plants in Nepal often lack full ETPs; check monitoring records against permit conditions.",
      ],
    },
    {
      id: "annex5.chem.3",
      section: "sector-chemicals",
      number: "Ch.3",
      prompt:
        "Has the operator notified surrounding communities about spill / " +
        "release risks and provided a grievance mechanism?",
      options: {
        a:
          "Community-notification programme in place with periodic drills; " +
          "grievance log maintained and reviewed",
        b:
          "Some notification has occurred; operator has committed to a " +
          "regular programme",
        c:
          "No community notification OR no grievance mechanism",
        d: "Not applicable",
      },
      guidanceNotes: [
        "For any operation storing more than the threshold quantities in the Hazardous Substances Rules, community notification is a legal requirement.",
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Brick kilns (major Nepal source of PM, child-labour concerns)
  // -------------------------------------------------------------------------
  brick: [
    {
      id: "annex5.brick.1",
      section: "sector-brick",
      number: "B.1",
      prompt:
        "What kiln technology is in use, and is it compliant with the 2017 " +
        "Kathmandu Valley brick-kiln directive?",
      options: {
        a:
          "Zigzag, VSBK, or tunnel kiln in operation — compliant technology " +
          "with acceptable PM performance",
        b:
          "Fixed Chimney Bull's Trench Kiln (FCBTK) in operation with a " +
          "committed conversion timeline to zigzag or VSBK",
        c:
          "Clamp kiln OR non-converted FCBTK with no conversion plan",
        d: "Not applicable",
      },
      guidanceNotes: [
        "The 2017 directive banned clamp kilns and mandated FCBTK-to-zigzag conversion in Kathmandu Valley. Compliance is enforced by MoFAGA and municipal authorities.",
        "Zigzag conversion reduces PM by ~60% and coal use by ~20%.",
      ],
    },
    {
      id: "annex5.brick.2",
      section: "sector-brick",
      number: "B.2",
      prompt:
        "What is the fuel mix, and is coal quality controlled?",
      options: {
        a:
          "Fuel mix is documented; coal is sampled for sulphur; biomass / " +
          "agricultural waste co-firing where feasible",
        b:
          "Fuel mix is known but coal quality is not tested; operator has " +
          "committed to sampling programme",
        c:
          "Uncontrolled mix of coal, tyres, plastic or waste-derived fuel",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Tyre / plastic combustion is a persistent grey-market fuel practice; produces dioxin and heavy-metal emissions.",
      ],
    },
    {
      id: "annex5.brick.3",
      section: "sector-brick",
      number: "B.3",
      prompt:
        "Are worker recruitment and living conditions free of child labour, " +
        "bonded labour, and unsafe migrant housing?",
      options: {
        a:
          "Direct employment; age verification on file; on-site housing " +
          "meets basic sanitation standards; no advance-payment / bonded-" +
          "labour arrangements",
        b:
          "Some concerns but a defined remediation plan is in place with " +
          "third-party verification",
        c:
          "Any evidence of child labour, bonded labour, or unfit migrant " +
          "housing — AUTOMATIC ESCALATION",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Nepal brick kilns are one of the highest-risk sectors for child labour and debt bondage globally. GEFONT, ILO, and Better Brick Nepal have documented recurring cases.",
        "This question is not negotiable — any 'c' answer here should stop the credit decision until independently verified.",
      ],
    },
    {
      id: "annex5.brick.4",
      section: "sector-brick",
      number: "B.4",
      prompt:
        "Is topsoil sourcing controlled, with restoration of borrow pits?",
      options: {
        a:
          "Soil sourced under agreement with landowners; borrow pits are " +
          "restored to productive use",
        b:
          "Sourcing is documented but restoration lags; operator has a " +
          "committed restoration schedule",
        c:
          "Unauthorised topsoil extraction OR pits left unrestored",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Prime agricultural topsoil is the main input to brick production in the Terai. Uncontrolled extraction has been flagged by MoFAGA as a food-security concern.",
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Agriculture (Annex 3 SME + industrial)
  // -------------------------------------------------------------------------
  agriculture: [
    {
      id: "annex5.agri.1",
      section: "sector-agriculture",
      number: "A.1",
      prompt:
        "Are pesticides and agrochemicals managed per the Pesticide Act " +
        "and Highly Hazardous Pesticide restrictions?",
      options: {
        a:
          "Only approved products in use; application records maintained; " +
          "no WHO Ia / Ib class chemicals",
        b:
          "Mostly compliant; some minor deviations with a corrective plan",
        c:
          "Use of banned pesticides OR no application records OR untrained " +
          "spray operators",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Nepal has banned specific pesticides (methyl parathion, endosulfan, monocrotophos, phorate, methomyl, chlorpyrifos in specific uses). Verify against the current Pesticide Registration Board list.",
      ],
    },
    {
      id: "annex5.agri.2",
      section: "sector-agriculture",
      number: "A.2",
      prompt:
        "Are water abstraction and irrigation practices sustainable relative " +
        "to the source (surface / groundwater)?",
      options: {
        a:
          "Water use is metered; groundwater licence in place where required; " +
          "drip / micro-sprinkler where suited",
        b:
          "Water use is not fully metered but the operator has committed to " +
          "install monitoring and improve efficiency",
        c:
          "Uncontrolled groundwater abstraction OR flood irrigation on " +
          "over-stressed aquifers with no efficiency plan",
        d: "Not applicable",
      },
      guidanceNotes: [
        "The Terai groundwater is already showing seasonal depletion in some districts. Check Ground Water Resources Development Board maps.",
      ],
    },
    {
      id: "annex5.agri.3",
      section: "sector-agriculture",
      number: "A.3",
      prompt:
        "Are contract-farming arrangements with smallholders fair, " +
        "documented, and free of exploitative pricing / debt spirals?",
      options: {
        a:
          "Written contracts in local language; price mechanism transparent; " +
          "grievance channel available to farmers",
        b:
          "Contracts are documented but some pricing / dispute concerns " +
          "exist; operator committed to a defined remediation",
        c:
          "Verbal-only arrangements OR reports of debt-bound farmers OR " +
          "opaque pricing with no grievance channel",
        d: "Not applicable (own-farm operation, no contract growers)",
      },
      guidanceNotes: [
        "Agribusinesses working with poultry, dairy, and vegetable smallholders should be able to produce a sample contract and a grievance register.",
      ],
    },
    {
      id: "annex5.agri.4",
      section: "sector-agriculture",
      number: "A.4",
      prompt:
        "Is land use / land tenure for the operation properly documented " +
        "and free of encroachment on public / community forest or protected land?",
      options: {
        a:
          "All operating land is on registered private title OR properly " +
          "leased public land with valid documentation",
        b:
          "Some tenure ambiguity but the operator has an active title / " +
          "lease clarification underway",
        c:
          "Operation on encroached forest, disputed land, or without any " +
          "valid tenure document",
        d: "Not applicable",
      },
      guidanceNotes: [
        "Cross-check against Department of Forest and Soil Conservation maps for any operation adjoining protected or community forests.",
      ],
    },
  ],
};

/**
 * The full ordered checklist that the wizard walks through, once all
 * sections and sector supplements are transcribed.
 */
export function fullChecklist(sectorSlug?: string): EsddQuestion[] {
  const base = [
    ...ANNEX5_GENERAL_RISK,
    ...ANNEX5_EHS_RISK,
    ...ANNEX5_SOCIAL_RISK,
  ];
  if (sectorSlug && ANNEX5_SECTOR_SUPPLEMENTS[sectorSlug]) {
    return [...base, ...ANNEX5_SECTOR_SUPPLEMENTS[sectorSlug]];
  }
  return base;
}
