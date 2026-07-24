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
// Sector-specific supplements (TODO — Annex 2 hydropower + Annex 3 sector)
// ---------------------------------------------------------------------------
// Per plan decision Q3, all sectors are in scope from day one. Extract:
//   - Hydropower supplement (Annex 2 of the guideline)
//   - Sector-specific SME risks (Annex 3)
//   - Sector-specific industrial risks
// Group by sector slug matching Borrower.nrbSector values in the demo.
export const ANNEX5_SECTOR_SUPPLEMENTS: Record<string, EsddQuestion[]> = {
  // TODO: e.g. "hydropower": [...], "cement": [...], "textiles": [...]
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
