/**
 * NRB ESRM Guideline 2022 — Annex 5b Project Finance E&S Screening
 * Questionnaire.
 *
 * Verbatim transcription of the ~85-item IFC-Performance-Standards-aligned
 * screening questionnaire that Annex 5b of the 2022 NRB ESRM Guideline
 * requires for every loan categorised as Project Finance under Circular 22 §5.
 *
 * Source of truth: `uploads/Final-ESRM-without-cover-1.pdf`, pp. 43-49.
 *
 * The source PDF does not number its individual questions. It groups them
 * under 8 top-level areas (one per IFC Performance Standard) with a
 * sub-area heading (e.g. "Policy", "Retrenchment", "Waste management") and
 * then bulleted questions. We assign stable ids of the form
 * `annex5b.PS<n>.<i>` where `<i>` is the item's index within its Performance
 * Standard, and cite each item as `NRB ESRM 2022 Annex 5b · PS<n> §<i>`.
 *
 * Every item captures:
 *   - `id`             : stable identifier used on captured rows
 *   - `ifcPS`          : the IFC Performance Standard (PS1..PS8)
 *   - `area`           : verbatim sub-area heading from the PDF
 *   - `prompt`         : verbatim question text
 *   - `options`        : `['yes', 'no', 'n/a']`
 *   - `guidanceNote`   : verbatim NRB context or, where absent from the
 *                        source, brief Jana editorial guidance flagged with
 *                        `[Jana editorial]` so a reviewer can spot the
 *                        non-verbatim additions
 *   - `flagOnAnswer`   : which answer triggers a review flag (see below)
 *   - `ifcPsTerminationTrigger` : (optional) marks items that, when flagged,
 *                        hit a non-negotiable red line in the IFC PS text
 *                        NRB Annex 5b is built on. NRB itself does NOT
 *                        publish an escalation grid for Annex 5b — this
 *                        field is Jana synthesis of IFC PS termination-grade
 *                        language. Each marked item carries a
 *                        `terminationCitation` string pointing to the
 *                        specific IFC PS § that supports its inclusion.
 *                        Reviewers should treat the mechanic as operational
 *                        triage, not regulatory rule. See
 *                        `pfCriticalItems()`.
 *   - `terminationCitation` : the IFC PS § string that anchors the
 *                        termination-trigger flag on the item.
 *   - `citation`       : `NRB ESRM 2022 Annex 5b · PS<n> §<i>`
 *
 * Flag-on-answer conventions:
 *   - Most items are compliance affirmations ("Does the company have a
 *     policy...?"). A `no` means the policy is missing → flag.
 *   - A handful of items are risk exposures ("Does the company use
 *     pesticides?", "Have there been allegations of unlawful acts by
 *     security personnel?"). A `yes` means the risk is present → flag.
 *   - `n/a` never flags. The wizard collects `n/a` as a first-class answer
 *     so the officer records that they considered the item and it is not
 *     applicable to this project (as opposed to unanswered).
 *
 * This file is regulatory data. It changes only when NRB revises Annex 5b.
 * Do not edit to adjust demo behavior; edit scoring below or in
 * `annex5b-pf-types.ts`.
 */

import type { Annex5bItem, IfcPS } from "./annex5b-pf-types";
export type { Annex5bItem, IfcPS } from "./annex5b-pf-types";

// ---------------------------------------------------------------------------
// PS1 — Assessment and Management of E&S Risks and Impacts
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF pp. 43-44.
// ---------------------------------------------------------------------------
const PS1_ITEMS: Annex5bItem[] = [
  // Policy
  {
    id: "annex5b.PS1.1",
    ifcPS: "PS1",
    area: "Policy",
    prompt:
      "Does the company have an overarching Policy (statement) defining the environmental and social objectives and principles guiding the company's E&S performance?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "The Policy should articulate the company's commitment to E&S performance and set out the environmental and social objectives and principles that guide day-to-day operations. IFC PS1 §5.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §1",
  },
  {
    id: "annex5b.PS1.2",
    ifcPS: "PS1",
    area: "Policy",
    prompt: "Is this Policy backed by the top management of the company?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Look for evidence that senior management (Board or CEO) has formally endorsed the Policy and communicates it to staff and stakeholders.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §2",
  },
  {
    id: "annex5b.PS1.3",
    ifcPS: "PS1",
    area: "Policy",
    prompt:
      "Does this Policy specify who within the company is responsible for Policy implementation?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "The Policy should name the roles or departments accountable for implementation, not just publish an intent.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §3",
  },
  {
    id: "annex5b.PS1.4",
    ifcPS: "PS1",
    area: "Policy",
    prompt: "Was this Policy communicated to all employees of the company?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Verify that the Policy is displayed and understood at each site, not only held at head office.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §4",
  },
  // Identification of Risks and Impacts
  {
    id: "annex5b.PS1.5",
    ifcPS: "PS1",
    area: "Identification of Risks and Impacts",
    prompt:
      "Does the company have a system/procedure to screen, identify, analyze, and access the potential risks and impacts related to its business activities/projects?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS1 §7-8: the risk identification process should be commensurate with the risks and impacts of the project.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §5",
  },
  {
    id: "annex5b.PS1.6",
    ifcPS: "PS1",
    area: "Identification of Risks and Impacts",
    prompt:
      "Is an emergency preparedness and response system an integrated part of the company's risk management system?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Emergency preparedness must be documented, tested (drills), and integrated into the ESMS — not a stand-alone plan.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §6",
  },
  {
    id: "annex5b.PS1.7",
    ifcPS: "PS1",
    area: "Identification of Risks and Impacts",
    prompt:
      "Has the company conducted Environmental and Social Impact Assessment (green field projects) or any other type of E&S assessments (limited or focused E&S assessments, E&S audits) for the project financed?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "For hydropower, industrial, or other projects listed in Nepal EPR 2020 Schedules, verify the BES / IEE / EIA record and approval date.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §7",
  },
  // Organizational Capacity and Competency
  {
    id: "annex5b.PS1.8",
    ifcPS: "PS1",
    area: "Organizational Capacity and Competency",
    prompt:
      "Has the company designated specific in-house personnel, including management representative, with clear lines of responsibility and authority for E&S issues?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS1 §17: named roles with formal delegation of authority for E&S.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §8",
  },
  {
    id: "annex5b.PS1.9",
    ifcPS: "PS1",
    area: "Organizational Capacity and Competency",
    prompt:
      "Do the delegated personnel possess the knowledge, skills, and experience to implement the E&S policy and to follow established procedures?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Look at CVs, training records, and prior E&S experience for the named personnel.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §9",
  },
  {
    id: "annex5b.PS1.10",
    ifcPS: "PS1",
    area: "Organizational Capacity and Competency",
    prompt: "Has the company allocated resources to support its E&S functions?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Budget line, headcount, and equipment allocated to E&S team — not shared with production.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §10",
  },
  {
    id: "annex5b.PS1.11",
    ifcPS: "PS1",
    area: "Organizational Capacity and Competency",
    prompt:
      "Has the company allocated resources to support capacity building of relevant staff on E&S issues?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Training budget and hours per staff, external courses, internal knowledge-sharing sessions.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §11",
  },
  {
    id: "annex5b.PS1.12",
    ifcPS: "PS1",
    area: "Organizational Capacity and Competency",
    prompt:
      "Does the company have relevant training programs in place for the E&S personnel?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Documented training calendar, attendance registers, refresher schedule.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §12",
  },
  {
    id: "annex5b.PS1.13",
    ifcPS: "PS1",
    area: "Organizational Capacity and Competency",
    prompt:
      "Does the company outsource E&S functions to a qualified third party(ies)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Outsourcing is not a failure — but verify the third party is qualified and that oversight remains with the company.",
    ],
    // Purely informational — do NOT flag either direction.
    // Encode as flag-on-answer 'no' so the officer captures intent; the
    // scoring engine treats this item as informational unless marked
    // otherwise. TODO: verify with compliance whether this should score.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §13",
  },
  // Monitoring and Review
  {
    id: "annex5b.PS1.14",
    ifcPS: "PS1",
    area: "Monitoring and Review",
    prompt:
      "Does the company have procedures in place to track and evaluate E&S performance of its operations?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "KPIs, monitoring schedule, and a documented review cadence.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §14",
  },
  {
    id: "annex5b.PS1.15",
    ifcPS: "PS1",
    area: "Monitoring and Review",
    prompt:
      "Is appropriate environmental and social performance information periodically reported internally to senior management, investors and stakeholders (as relevant)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Look for periodic (at least annual) E&S performance reports going to Board / senior management.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §15",
  },
  {
    id: "annex5b.PS1.16",
    ifcPS: "PS1",
    area: "Monitoring and Review",
    prompt:
      "Does the company have a procedure to evaluate and record results of its monitoring activities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Monitoring must feed corrective action — records should show closed-loop response, not just measurement.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §16",
  },
  // Stakeholder Engagement
  {
    id: "annex5b.PS1.17",
    ifcPS: "PS1",
    area: "Stakeholder Engagement",
    prompt:
      "Does the company have a mechanism to identify its stakeholders (affected communities and other interested stakeholders in the company's activities)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS1 §25-26: stakeholder identification must include vulnerable groups and those disproportionately affected.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §17",
  },
  {
    id: "annex5b.PS1.18",
    ifcPS: "PS1",
    area: "Stakeholder Engagement",
    prompt:
      "Has the company developed and implemented a Stakeholder Engagement Plan that is scaled to the project risks and impacts and development stage?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS1 §27: SEP must be commensurate with project risk and updated as the project evolves.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §18",
  },
  {
    id: "annex5b.PS1.19",
    ifcPS: "PS1",
    area: "Stakeholder Engagement",
    prompt:
      "In case company's activities have negative impacts on local communities does the company established a community engagement process for affected communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "If yes-impact and no-engagement, flag as high risk — communities must be consulted on impacts before they are felt.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §19",
  },
  {
    id: "annex5b.PS1.20",
    ifcPS: "PS1",
    area: "Stakeholder Engagement",
    prompt:
      "Does the process of informed consultation and participation took place (when applicable)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "ICP is required by IFC PS1 §31 for projects with adverse impacts on communities.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §20",
  },
  // External Communications and Grievance Mechanism
  {
    id: "annex5b.PS1.21",
    ifcPS: "PS1",
    area: "External Communications and Grievance Mechanism",
    prompt:
      "Does the company have a procedure to receive and process communications from external stakeholders?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Look for a documented inbound-communications intake process (mail, phone, walk-in).",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §21",
  },
  {
    id: "annex5b.PS1.22",
    ifcPS: "PS1",
    area: "External Communications and Grievance Mechanism",
    prompt:
      "Does the company have a grievance mechanism – a procedure for receiving, addressing, and recording/documenting complaints and communication from affected communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS1 §35: grievance mechanism must be culturally appropriate, at no cost to the complainant, and without retribution.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §22",
  },
  {
    id: "annex5b.PS1.23",
    ifcPS: "PS1",
    area: "External Communications and Grievance Mechanism",
    prompt:
      "Does the grievance mechanism ensure that the confidentiality of a person raising the complain is protected?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Anonymous or confidential channels must be available; failure exposes complainants to retribution.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §23",
  },
  {
    id: "annex5b.PS1.24",
    ifcPS: "PS1",
    area: "External Communications and Grievance Mechanism",
    prompt:
      "Does the company ensure that the grievance mechanism is easily accessible, understandable and its availability was communicated to affected communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Accessibility means language, literacy level, and physical presence appropriate to the affected community.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS1 §24",
  },
];

// ---------------------------------------------------------------------------
// PS2 — Labor and Working Conditions
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF pp. 44-45.
// ---------------------------------------------------------------------------
const PS2_ITEMS: Annex5bItem[] = [
  // Human Resources Policy and Management
  {
    id: "annex5b.PS2.1",
    ifcPS: "PS2",
    area: "Human Resources Policy and Management",
    prompt:
      "Does the company have an HR policy that is consistent with requirements of the national law and related international commitments?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Nepal Labour Act 2074 (2017) and ratified ILO conventions (see Annex 6 of the 2022 ESRM Guideline) are the baseline.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §1",
  },
  {
    id: "annex5b.PS2.2",
    ifcPS: "PS2",
    area: "Human Resources Policy and Management",
    prompt: "Is this Policy clearly understandable and easily accessible to all employees?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Language, literacy, and physical accessibility appropriate to the workforce.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §2",
  },
  {
    id: "annex5b.PS2.3",
    ifcPS: "PS2",
    area: "Human Resources Policy and Management",
    prompt:
      "Does the company have policies and procedures for managing and monitoring the performance of third party employers in terms of labor and working conditions?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Contractors and labor agencies must be held to the same standards; verify audit and monitoring practice.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §3",
  },
  {
    id: "annex5b.PS2.4",
    ifcPS: "PS2",
    area: "Human Resources Policy and Management",
    prompt:
      "Has the company established a grievance mechanism for workers to review and address employee complaints?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §20: worker grievance mechanism must be separate and independent from the community grievance mechanism.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §4",
  },
  {
    id: "annex5b.PS2.5",
    ifcPS: "PS2",
    area: "Human Resources Policy and Management",
    prompt:
      "Has the company ensured that contracted workers by third parties, if any, also have access to the grievance mechanism?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Contractor workers face the same OHS and labor risks; excluding them is a systemic gap.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §5",
  },
  {
    id: "annex5b.PS2.6",
    ifcPS: "PS2",
    area: "Human Resources Policy and Management",
    prompt:
      "Is there a person responsible to review complaints and follow up on them in a timely and transparent manner?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Named accountability, with a documented turnaround SLA and a periodic escalation to management.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §6",
  },
  // Working Conditions and Terms of Engagement
  {
    id: "annex5b.PS2.7",
    ifcPS: "PS2",
    area: "Working Conditions and Terms of Engagement",
    prompt:
      "Has the company documented and communicated in understandable way working conditions and terms of employment to all workers directly contracted (including information on working hours, rest days, overtime procedures, wages, frequency of payments and sick and maternity leave, vacations)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §8: written contracts covering all terms listed, in a language the worker understands.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §7",
  },
  {
    id: "annex5b.PS2.8",
    ifcPS: "PS2",
    area: "Working Conditions and Terms of Engagement",
    prompt: "Are the terms and working conditions in accordance with any collective agreement (if applicable)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Where a CBA exists, cross-check its terms against the current employment contracts.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §8",
  },
  {
    id: "annex5b.PS2.9",
    ifcPS: "PS2",
    area: "Working Conditions and Terms of Engagement",
    prompt:
      "Does the company identify migrant workers and ensure that the migrant workers are engaged on substantially equivalent terms and conditions to non-migrant workers?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §14-15: migrant workers must not be paid less or subject to worse conditions than local workers doing the same job.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §9",
  },
  {
    id: "annex5b.PS2.10",
    ifcPS: "PS2",
    area: "Working Conditions and Terms of Engagement",
    prompt: "Does the company provide accommodation to its workers?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Not a flag either direction on its own — but if yes, verify item 2.11 below.",
    ],
    // Informational — 'yes' triggers follow-up; 'no' is not a gap.
    // TODO: verify with compliance if this should be scored.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §10",
  },
  {
    id: "annex5b.PS2.11",
    ifcPS: "PS2",
    area: "Working Conditions and Terms of Engagement",
    prompt:
      "If so, does the company put in place and implement policies on the quality and management of the accommodation and provision of basic services?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC Workers' Accommodation: Processes and Standards guidance note applies.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §11",
  },
  // Worker's Organization
  {
    id: "annex5b.PS2.12",
    ifcPS: "PS2",
    area: "Worker's Organization",
    prompt: "Does the company allow workers to form and join workers' organizations and bargain collectively?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §16: freedom of association and collective bargaining are non-negotiable.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §12",
  },
  // Non-Discrimination and Equal Opportunity
  {
    id: "annex5b.PS2.13",
    ifcPS: "PS2",
    area: "Non-Discrimination and Equal Opportunity",
    prompt:
      "Does the company have documented transparent procedures to ensure that employment decisions are not made on the basis of personal characteristics unrelated to job requirements?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §15: employment decisions must be based on the principle of equal opportunity and fair treatment.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §13",
  },
  {
    id: "annex5b.PS2.14",
    ifcPS: "PS2",
    area: "Non-Discrimination and Equal Opportunity",
    prompt: "Does the company have any preferential employment policies in place?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Preferential employment for local/vulnerable groups is permitted where consistent with national law (IFC PS2 footnote to §15).",
    ],
    // Informational — either answer OK. TODO: verify scoring.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §14",
  },
  // Retrenchment
  {
    id: "annex5b.PS2.15",
    ifcPS: "PS2",
    area: "Retrenchment",
    prompt: "Does the company anticipate retrenchment of a significant number of employees?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers the retrenchment plan requirements (items 2.16-2.18).",
    ],
    // Risk exposure — 'yes' flags follow-up work.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §15",
  },
  {
    id: "annex5b.PS2.16",
    ifcPS: "PS2",
    area: "Retrenchment",
    prompt: "If yes, has the company assessed any alternatives to retrenchment?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §17: alternatives such as reassignment, retraining, or reduced hours must be considered.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §16",
  },
  {
    id: "annex5b.PS2.17",
    ifcPS: "PS2",
    area: "Retrenchment",
    prompt: "If there are no viable alternatives, is there a retrenchment plan in place?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §17: retrenchment plan must be based on non-discriminatory principles and comply with all legal and contractual requirements.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §17",
  },
  {
    id: "annex5b.PS2.18",
    ifcPS: "PS2",
    area: "Retrenchment",
    prompt:
      "If retrenchment has taken place, have workers received notice of dismissal and relevant severance payments mandated by law and collective agreements in a timely manner?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Verify severance payment records against Labour Act and CBA thresholds.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §18",
  },
  // Protecting the Work Force
  {
    id: "annex5b.PS2.19",
    ifcPS: "PS2",
    area: "Protecting the Work Force",
    prompt:
      "Does the company ensure child or forced labor, including trafficked persons, is not used in its operations, including through contractors or in the primary supply chain?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §21-22: child labor and forced labor are non-negotiable. NRB Annex 5 §3.2 guidance: 'Transactions should be terminated if instances of child labor or forced labor are found in client's activities, unless immediate remedial actions are taken.'",
      "Minimum working age in Nepal is 14 (Child Labour Act 2000; Labour Act 2074/2017); minimum age for hazardous work is 16.",
    ],
    flagOnAnswer: "no",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS2 §21-22 (termination triggers — child labor and forced labor findings)",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §19",
  },
  {
    id: "annex5b.PS2.20",
    ifcPS: "PS2",
    area: "Protecting the Work Force",
    prompt: "Does the company check the age of all employees?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Age verification is the operational control that backs the child-labor commitment in 2.19.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §20",
  },
  {
    id: "annex5b.PS2.21",
    ifcPS: "PS2",
    area: "Protecting the Work Force",
    prompt:
      "Does the company ensure that young workers (under the age of 18) are not employed in dangerous work and regularly monitor their health, working conditions, and hours of work?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Nepal law: hazardous work minimum age is 16, but IFC PS2 references 18. Take the stricter of the two.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §21",
  },
  // Occupational Health and Safety
  {
    id: "annex5b.PS2.22",
    ifcPS: "PS2",
    area: "Occupational Health and Safety",
    prompt: "Does the company provide its workers with a safe and healthy work environment?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Overarching OHS obligation from IFC PS2 §23; supported by items 2.23-2.27.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §22",
  },
  {
    id: "annex5b.PS2.23",
    ifcPS: "PS2",
    area: "Occupational Health and Safety",
    prompt:
      "Where applicable does the company provide workers with and mandating that workers use personal protective equipment (PPE)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Verify PPE provision, training on use, and enforcement — not just PPE presence on site.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §23",
  },
  {
    id: "annex5b.PS2.24",
    ifcPS: "PS2",
    area: "Occupational Health and Safety",
    prompt:
      "Has the company established and implemented occupational health and safety procedures in line with good international industry practices to prevent accidents, injury, and disease?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "ISO 45001:2018 (formerly OHSAS 18001) is the reference standard cited by NRB.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §24",
  },
  {
    id: "annex5b.PS2.25",
    ifcPS: "PS2",
    area: "Occupational Health and Safety",
    prompt:
      "Does the company track and report on rates of injury, occupational diseases, lost days, and absenteeism and number of work-related fatalities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Look for a recordable-incident log and periodic OHS performance reports to management.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §25",
  },
  {
    id: "annex5b.PS2.26",
    ifcPS: "PS2",
    area: "Occupational Health and Safety",
    prompt: "Does the company have training programs in place for workers on occupational health and safety?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Verify induction and refresher OHS training records for a sample of workers.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §26",
  },
  {
    id: "annex5b.PS2.27",
    ifcPS: "PS2",
    area: "Occupational Health and Safety",
    prompt: "Does the company have a fire, life and safety plan?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "See Annex 5 §3.1 guidance for the operational checks (extinguishers, exits, alarms, drills).",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §27",
  },
  // Supply Chain
  {
    id: "annex5b.PS2.28",
    ifcPS: "PS2",
    area: "Supply Chain",
    prompt:
      "Where there is a high risk of significant safety issues related to supply chain workers, has the company requested its primary supply chain to introduce corrective measures to address life-threatening situations?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §27: primary supply chain worker safety is the client's responsibility to escalate.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §28",
  },
  {
    id: "annex5b.PS2.29",
    ifcPS: "PS2",
    area: "Supply Chain",
    prompt: "Where remedy is not possible, does the company have a plan to shift the primary supply chain?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS2 §27: if suppliers cannot remediate, the client must have a documented exit plan.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS2 §29",
  },
];

// ---------------------------------------------------------------------------
// PS3 — Resource Efficiency and Pollution Prevention
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF pp. 45-46.
// ---------------------------------------------------------------------------
const PS3_ITEMS: Annex5bItem[] = [
  // Resource Efficiency
  {
    id: "annex5b.PS3.1",
    ifcPS: "PS3",
    area: "Resource Efficiency",
    prompt:
      "Has the company tracked use of resources and material inputs (including daily use for energy and water)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Baseline metering is the precondition for any efficiency improvement plan.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §1",
  },
  {
    id: "annex5b.PS3.2",
    ifcPS: "PS3",
    area: "Resource Efficiency",
    prompt:
      "Does the company implement measures for improving efficiency in its consumption of energy, water, and other resources and material inputs that are in line with good international industry practice?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Cross-reference to Annex 5 §2.4 guidance (energy audit, VSDs, insulation, LED lighting, HVAC retrofits).",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §2",
  },
  {
    id: "annex5b.PS3.3",
    ifcPS: "PS3",
    area: "Resource Efficiency",
    prompt: "Is the company a potentially significant consumer of water?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers scrutiny of water abstraction impacts on community (Annex 5 §3.3) and on ecosystem services (PS6).",
    ],
    // Risk exposure — 'yes' warrants follow-up.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §3",
  },
  // Green House Gas Emissions
  {
    id: "annex5b.PS3.4",
    ifcPS: "PS3",
    area: "Green House Gas Emissions",
    prompt: "What is company's GHG emission (direct and indirect from purchased electricity)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "The source PDF poses this as an open question, not Yes/No. Answer 'yes' = client has quantified Scope 1+2; 'no' = not quantified; 'n/a' where clearly negligible (e.g. commercial office).",
      "Capture the tCO2e/year figure in the Remarks field.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §4",
  },
  {
    id: "annex5b.PS3.5",
    ifcPS: "PS3",
    area: "Green House Gas Emissions",
    prompt: "Has the company considered options for reducing its GHG emissions?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS3 §7: consider technically and financially feasible options for reducing project-related GHG emissions.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §5",
  },
  {
    id: "annex5b.PS3.6",
    ifcPS: "PS3",
    area: "Green House Gas Emissions",
    prompt:
      "In case company's emissions of GHG gases exceed equivalent of 25,000 tons of CO2 annually, does the company quantify those emissions on annual basis?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "25,000 tCO2e is the NRB / IFC PS3 §7 reporting threshold; clients above the threshold must quantify annually and should have a reduction plan.",
      "'n/a' is a legitimate answer where emissions are demonstrably below 25,000 tCO2e.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §6",
  },
  // Pollution Prevention
  {
    id: "annex5b.PS3.7",
    ifcPS: "PS3",
    area: "Pollution Prevention",
    prompt: "Does the company monitor air, land and water release of pollutants?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "See Annex 5 §2.1-2.3 for the physical evidence checks (thick dust, coloured effluent, staining around storage).",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §7",
  },
  {
    id: "annex5b.PS3.8",
    ifcPS: "PS3",
    area: "Pollution Prevention",
    prompt:
      "Did the company introduce procedures/practices/techniques to avoid, or where avoidance is not feasible to minimize and/or control the intensity and mass flow of their release?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS3 §10-11: mitigation hierarchy — avoid, minimize, control.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §8",
  },
  {
    id: "annex5b.PS3.9",
    ifcPS: "PS3",
    area: "Pollution Prevention",
    prompt:
      "Where historical pollution such as land or ground water contamination exists, has the company sought to determine whether it is responsible for mitigation measures?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Historical contamination is a common legacy issue when a client acquires a brownfield site.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §9",
  },
  {
    id: "annex5b.PS3.10",
    ifcPS: "PS3",
    area: "Pollution Prevention",
    prompt:
      "If it is determined that the company is legally responsible, then has the company resolved these liabilities in accordance with national law, or where national law silent, with good international industry practice?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Nepal EPA 2019 + EPR 2020 are the primary references; IFC PS3 §12 is the fallback.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §10",
  },
  // Waste management
  {
    id: "annex5b.PS3.11",
    ifcPS: "PS3",
    area: "Waste management",
    prompt: "Does the company generate significant amount of wastes?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers items 3.12-3.15.",
    ],
    // Risk exposure — 'yes' warrants scrutiny.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §11",
  },
  {
    id: "annex5b.PS3.12",
    ifcPS: "PS3",
    area: "Waste management",
    prompt: "Does the company have procedures for storage, handling, and disposal of solid wastes?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Nepal Solid Waste Management Act 2011 and Rules 2013 apply.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §12",
  },
  {
    id: "annex5b.PS3.13",
    ifcPS: "PS3",
    area: "Waste management",
    prompt: "In case for hazardous wastes are those procedures in line with good industry international practices?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Segregated storage, marked and bunded; chain of custody records for off-site consignment.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §13",
  },
  {
    id: "annex5b.PS3.14",
    ifcPS: "PS3",
    area: "Waste management",
    prompt: "Is hazardous wastes disposal conducted by third parties?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers 3.15 (contractor verification).",
    ],
    // Informational — 'yes' triggers follow-up, but a 'no' (in-house) can also be OK.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §14",
  },
  {
    id: "annex5b.PS3.15",
    ifcPS: "PS3",
    area: "Waste management",
    prompt:
      "If so, has the company ensured that the contractors are reputable and legitimate enterprises licensed by the relevant government regulatory agencies and obtain chain of custody documentation to the final destination?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Chain-of-custody documentation to final destination is critical for hazardous waste.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §15",
  },
  // Hazardous Materials
  {
    id: "annex5b.PS3.16",
    ifcPS: "PS3",
    area: "Hazardous Materials",
    prompt:
      "Does the company have procedures for storage, handling, transportation, use and disposal of hazardous materials?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "See Annex 5 §2.3 guidance on hazmat storage (bunded, marked, controlled inventory).",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §16",
  },
  {
    id: "annex5b.PS3.17",
    ifcPS: "PS3",
    area: "Hazardous Materials",
    prompt: "Has the client assessed alternatives to use of hazardous materials?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS3 §13-14: substitution to less-hazardous alternatives is the preferred mitigation.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §17",
  },
  // Pesticide Use and Management
  {
    id: "annex5b.PS3.18",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt: "Does the company use pesticides?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers items 3.19-3.24. 'n/a' is appropriate for non-agri clients.",
    ],
    // Risk exposure — 'yes' warrants scrutiny.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §18",
  },
  {
    id: "annex5b.PS3.19",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt:
      "Does the company purchase, store, use, manufacture, or trade in products that falls in the World Health Organization Recommended Classification of Pesticides by Hazard Classes I a (extremely hazardous) and I b (highly hazardous)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "WHO Class Ia / Ib pesticides are on the IFC PS3 §16 elimination list — 'yes' is a critical escalation.",
    ],
    // Any 'yes' is a critical finding.
    flagOnAnswer: "yes",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS3 §29 (prohibited pesticides — elevated review)",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §19",
  },
  {
    id: "annex5b.PS3.20",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt:
      "If so, has the company established and implemented integrated pest management and/or integrated vector management approaches?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IPM / IVM is the IFC PS3 §16 required response where hazardous pesticides are used.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §20",
  },
  {
    id: "annex5b.PS3.21",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt:
      "Does the company select pesticides with the following considerations in mind: low in human toxicity, effective against the target species, known to have minimal effects on non-target species and the environment?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Selection criteria from IFC PS3 §16.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §21",
  },
  {
    id: "annex5b.PS3.22",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt: "Are the pesticides properly packaged and labeled (including directions for safe and appropriate use)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "FAO Code compliance — packaging must include local-language safety directions.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §22",
  },
  {
    id: "annex5b.PS3.23",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt: "Have the pesticides been manufactured by an entity licensed by the relevant regulatory agencies?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Verify manufacturer licence and Nepal import registration.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §23",
  },
  {
    id: "annex5b.PS3.24",
    ifcPS: "PS3",
    area: "Pesticide Use and Management",
    prompt:
      "Are the pesticides handled, stored, applied, and disposed in accordance with the Food and Agriculture Organization's International Code of Conduct on the Distribution and Use of Pesticides or other good international industry practice?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "FAO Code of Conduct on the Distribution and Use of Pesticides is the reference standard.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS3 §24",
  },
];

// ---------------------------------------------------------------------------
// PS4 — Community Health, Safety and Security
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF p. 46.
// ---------------------------------------------------------------------------
const PS4_ITEMS: Annex5bItem[] = [
  // Community Health and Safety
  {
    id: "annex5b.PS4.1",
    ifcPS: "PS4",
    area: "Community Health and Safety",
    prompt: "Are there communities in close proximity to the company's facilities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers scrutiny of items 4.2-4.4 (procedures, infrastructure safety, hazmat controls).",
    ],
    // Informational; does not itself flag.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §1",
  },
  {
    id: "annex5b.PS4.2",
    ifcPS: "PS4",
    area: "Community Health and Safety",
    prompt: "Does the company have procedures to address community, health and safety issues in the context of its operations?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Cross-reference to Annex 5 §3.3 guidance on community nuisance, structural safety, water quality.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §2",
  },
  {
    id: "annex5b.PS4.3",
    ifcPS: "PS4",
    area: "Community Health and Safety",
    prompt:
      "Do those procedures/practices take into account safety of company's infrastructure (including buildings and structures) and equipment for local communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Nepal Building Code, Building Act 1998, Building Code Standard 2014.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §3",
  },
  {
    id: "annex5b.PS4.4",
    ifcPS: "PS4",
    area: "Community Health and Safety",
    prompt:
      "Does the company have safety procedures in place to deal with hazardous material release, transport and disposal in order to avoid or to minimize exposure of local communities to those materials?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Community exposure to hazmat releases requires an emergency response plan with community notification.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §4",
  },
  // Ecosystem Services
  {
    id: "annex5b.PS4.5",
    ifcPS: "PS4",
    area: "Ecosystem Services",
    prompt: "Do company operations have potential negative impacts on ecosystem services?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Ecosystem services = provisioning (products from ecosystems) and regulating (benefits from ecosystem processes).",
    ],
    // Risk exposure — 'yes' warrants follow-up.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §5",
  },
  {
    id: "annex5b.PS4.6",
    ifcPS: "PS4",
    area: "Ecosystem Services",
    prompt:
      "If so (i.e. provisioning services, which are the products people obtain from ecosystems, and regulating services, which are the benefits people obtain from the regulation of ecosystem processes), and such impacts may result in adverse health and safety impacts, has the company identified mitigation measures to avoid those impacts?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Mitigation hierarchy from IFC PS4 §8.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §6",
  },
  // Community Exposure to Disease
  {
    id: "annex5b.PS4.7",
    ifcPS: "PS4",
    area: "Community Exposure to Disease",
    prompt:
      "Does the company have a procedure to deal with avoiding/minimizing exposure of the communities to water-borne, water based, water-related, vector-borne, and communicable (including related to the influx of project labor) diseases that could result from company's operations?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Labor influx epidemiology plan is a specific IFC PS4 concern for construction-phase projects.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §7",
  },
  // Emergency Preparedness and Response
  {
    id: "annex5b.PS4.8",
    ifcPS: "PS4",
    area: "Emergency Preparedness and Response",
    prompt:
      "Does the company's emergency preparedness and response plan take into account risks and impacts from company's activities to local communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "The company's ERP must extend beyond the facility fence to affected communities.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §8",
  },
  {
    id: "annex5b.PS4.9",
    ifcPS: "PS4",
    area: "Emergency Preparedness and Response",
    prompt: "Did the company inform affected communities of significant potential hazards and emergency procedures in an appropriate manner?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Communities must know what to do in an emergency — flyers, drills, community meetings.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §9",
  },
  // Security Personnel Requirements
  {
    id: "annex5b.PS4.10",
    ifcPS: "PS4",
    area: "Security Personnel Requirements",
    prompt: "Does the company engage security personnel to provide security services at their facilities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers items 4.11-4.14.",
    ],
    // Informational.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §10",
  },
  {
    id: "annex5b.PS4.11",
    ifcPS: "PS4",
    area: "Security Personnel Requirements",
    prompt:
      "If so, do the contract provisions include guidelines on how security personnel shall interact with communities in close proximity to the facility?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS4 §12: contracts with security providers must include Voluntary Principles / UN Code of Conduct clauses.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §11",
  },
  {
    id: "annex5b.PS4.12",
    ifcPS: "PS4",
    area: "Security Personnel Requirements",
    prompt: "Is security personnel armed?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers item 4.13 (training on appropriate conduct).",
    ],
    // Risk exposure — 'yes' triggers follow-up.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §12",
  },
  {
    id: "annex5b.PS4.13",
    ifcPS: "PS4",
    area: "Security Personnel Requirements",
    prompt:
      "If so, has the company provided training on the appropriate conduct towards workers and the nearby communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Use-of-force training and human-rights briefing required by IFC PS4 §12.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §13",
  },
  {
    id: "annex5b.PS4.14",
    ifcPS: "PS4",
    area: "Security Personnel Requirements",
    prompt: "Have there been any allegations of unlawful and/or abusive acts by security personnel towards workers or nearby communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Any allegation is a critical finding — investigation and remediation required before financing.",
    ],
    // Risk exposure — 'yes' is critical.
    flagOnAnswer: "yes",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS4 §12-14 (immediate review of security-personnel incidents)",
    citation: "NRB ESRM 2022 Annex 5b · PS4 §14",
  },
];

// ---------------------------------------------------------------------------
// PS5 — Land Acquisition and Involuntary Resettlement
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF pp. 46-47.
// ---------------------------------------------------------------------------
const PS5_ITEMS: Annex5bItem[] = [
  // Project design
  {
    id: "annex5b.PS5.1",
    ifcPS: "PS5",
    area: "Project design",
    prompt: "Is there any land acquisition planned/happened for/in the proposed investment?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers the full PS5 workflow (5.2-5.13).",
    ],
    // Risk exposure — 'yes' warrants follow-up.
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §1",
  },
  // Compensation and Benefits for Displaced Persons
  {
    id: "annex5b.PS5.2",
    ifcPS: "PS5",
    area: "Compensation and Benefits for Displaced Persons",
    prompt: "Has there been any physical and/or economic displacement as a result of land acquisition for this project?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' + 5.3 = no compensation is a critical finding.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §2",
  },
  {
    id: "annex5b.PS5.3",
    ifcPS: "PS5",
    area: "Compensation and Benefits for Displaced Persons",
    prompt: "Has the company or other third party responsible for resettlement provided the compensation for loss of assets at full replacement cost?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §9: compensation at full replacement cost is a non-negotiable minimum.",
    ],
    flagOnAnswer: "no",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS5 §9 (replacement-cost requirement — non-negotiable)",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §3",
  },
  // Consultation and Grievance Mechanism
  {
    id: "annex5b.PS5.4",
    ifcPS: "PS5",
    area: "Consultation and Grievance Mechanism",
    prompt:
      "Has the company disclosed all relevant information, consulted with affected persons and communities and facilitated their informed participation in the decision making process relating to resettlement?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §10-11: disclosure and informed participation are prerequisites for resettlement.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §4",
  },
  {
    id: "annex5b.PS5.5",
    ifcPS: "PS5",
    area: "Consultation and Grievance Mechanism",
    prompt: "Has the company established an effective grievance mechanism?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Resettlement-specific grievance mechanism, in addition to the community-wide mechanism from PS1.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §5",
  },
  // Resettlement Planning and Implementation
  {
    id: "annex5b.PS5.6",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt: "Has the company considered alternative designs to avoid or minimize economic and physical displacement?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §8: avoidance / minimisation is the first step in the mitigation hierarchy.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §6",
  },
  {
    id: "annex5b.PS5.7",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt: "Has the company identified persons to be displaced by the project, regardless of the land ownership and rights, and those eligible for compensation and assistance?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §17: displaced persons must be identified regardless of legal land tenure status.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §7",
  },
  {
    id: "annex5b.PS5.8",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt: "Has the company identified the status of displaced persons according to their legal rights or claim to land?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Legal status determines the specific compensation entitlement per IFC PS5 §17.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §8",
  },
  {
    id: "annex5b.PS5.9",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt: "Has the cut-off date for eligibility been established and disseminated?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "A cut-off date prevents opportunistic in-migration to claim compensation and must be publicly disclosed.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §9",
  },
  {
    id: "annex5b.PS5.10",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt:
      "Has the company prepared a Resettlement Action Plan (RAP) or resettlement framework (if physical displacement is involved) that mitigates the negative impacts of displacement, identifies development opportunities and establishes entitlement for all affected persons?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §19: RAP is mandatory for physical displacement.",
    ],
    flagOnAnswer: "no",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS5 §12-19 (elevated review — RAP required)",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §10",
  },
  {
    id: "annex5b.PS5.11",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt:
      "Has the company prepared a Livelihood Restoration Plan (if economic but not physical displacement is involved) to offer compensation or other assistance that will establish entitlement for affected persons or communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §25: LRP is the analogous requirement for economic-only displacement.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §11",
  },
  {
    id: "annex5b.PS5.12",
    ifcPS: "PS5",
    area: "Resettlement Planning and Implementation",
    prompt: "Were forced evictions carried out as part of this investment?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §5: forced eviction (eviction without due process) is prohibited. Any 'yes' is a critical stop-the-line finding.",
    ],
    flagOnAnswer: "yes",
    ifcPsTerminationTrigger: true,
    terminationCitation: "IFC PS5 §29 (forced evictions not permitted)",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §12",
  },
  // Private Sector Responsibilities under Government-Managed Resettlement
  {
    id: "annex5b.PS5.13",
    ifcPS: "PS5",
    area: "Private Sector Responsibilities under Government-Managed Resettlement",
    prompt: "Was resettlement managed by the government?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers 5.14 (client must supplement government actions where they fall short of IFC PS5).",
    ],
    // Informational.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §13",
  },
  {
    id: "annex5b.PS5.14",
    ifcPS: "PS5",
    area: "Private Sector Responsibilities under Government-Managed Resettlement",
    prompt:
      "If so, has the company supplemented government actions and bridged the gaps (if applicable) between the government-assigned entitlements and the international commitments/requirements?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS5 §30: private sector cannot shelter behind government-led resettlement if it falls short of PS5.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS5 §14",
  },
];

// ---------------------------------------------------------------------------
// PS6 — Biodiversity Conservation and Sustainable Natural Resource Management
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF pp. 47-48.
// ---------------------------------------------------------------------------
const PS6_ITEMS: Annex5bItem[] = [
  // Protection and Conservation of Biodiversity
  {
    id: "annex5b.PS6.1",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt: "Has the company identified and assessed the impacts on biodiversity as part of its operations?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Cross-reference to Annex 5 §1.3 (eco-sensitive areas) and the sector-specific biodiversity surveys in Annex 2 for hydropower.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §1",
  },
  {
    id: "annex5b.PS6.2",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt: "Will modified, natural or critical habitat be impacted by the company's activities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' opens follow-ups 6.3-6.5 depending on habitat type. Critical habitat impacts are non-negotiable.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §2",
  },
  {
    id: "annex5b.PS6.3",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt:
      "In the case of areas of modified habitat that include significant biodiversity value, has the company minimized impacts and implemented mitigation measures?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS6 §11: modified habitat with significant biodiversity value still requires mitigation.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §3",
  },
  {
    id: "annex5b.PS6.4",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt:
      "In the case of natural habitat, has the company considered alternatives, established consultation with stakeholders and adequately mitigated any potential degradation to achieve no net loss of biodiversity?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS6 §13-15: 'no net loss' is the target for natural habitat.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §4",
  },
  {
    id: "annex5b.PS6.5",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt:
      "In the case of critical habitat, has the company demonstrated that no viable alternatives exist, that there will be no measurable adverse impact on species, habitat, and ecological processes, and that the mitigation strategy is designed to achieve net gains of the biodiversity values for which the critical habitat was designated?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS6 §16-19: critical habitat impacts require the highest bar — net gains, not just no net loss. A 'no' here is a critical finding.",
    ],
    flagOnAnswer: "no",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS6 §16-17 (critical habitat — no net loss non-negotiable)",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §5",
  },
  {
    id: "annex5b.PS6.6",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt: "Does the company conduct any operations in legally protected areas?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS6 §20-21: operations in legally protected areas require government approval + management-plan alignment. A 'yes' without 6.7 is a critical finding.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §6",
  },
  {
    id: "annex5b.PS6.7",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt:
      "If so, has the company demonstrated that proposed operations are permitted, acted consistently with government recognized management plans, and consulted protected area sponsors and managers, affected communities, Indigenous Peoples and other stakeholders (as applicable)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "The follow-up to 6.6. Combined 'yes' to 6.6 and 'no' to 6.7 is a critical finding.",
    ],
    flagOnAnswer: "no",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS6 §20 (host-country + IFC review required)",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §7",
  },
  {
    id: "annex5b.PS6.8",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt: "Has the company identified any alien species which may be intentionally or unintentionally introduced through its activities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Alien species introduction is a common secondary impact from aquaculture, forestry, and construction imports.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §8",
  },
  {
    id: "annex5b.PS6.9",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt: "If intentional introduction of alien species is planned, has this received appropriate government regulatory approval?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS6 §22: intentional introduction requires government approval + risk assessment.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §9",
  },
  {
    id: "annex5b.PS6.10",
    ifcPS: "PS6",
    area: "Protection and Conservation of Biodiversity",
    prompt: "If alien species are already established in the country or region of proposed operations, has the company exercise diligence in not spreading alien species?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Even for already-established aliens, spread-prevention controls apply.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §10",
  },
  // Management of Ecosystem Services
  {
    id: "annex5b.PS6.11",
    ifcPS: "PS6",
    area: "Management of Ecosystem Services",
    prompt: "Do company's operations have potential negative impacts on ecosystem services?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Same concept as PS4 §5 but scored under PS6 for the ecosystem-services angle.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §11",
  },
  {
    id: "annex5b.PS6.12",
    ifcPS: "PS6",
    area: "Management of Ecosystem Services",
    prompt: "If so, has the company conducted a systematic review to identify priority ecosystem services?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS6 §24: priority ecosystem services must be identified via a structured review.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §12",
  },
  {
    id: "annex5b.PS6.13",
    ifcPS: "PS6",
    area: "Management of Ecosystem Services",
    prompt: "Has Affected Communities participated in determination of priority ecosystem services (where applicable)?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Priority determination must be inclusive of the users of those services.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §13",
  },
  {
    id: "annex5b.PS6.14",
    ifcPS: "PS6",
    area: "Management of Ecosystem Services",
    prompt: "Does the company have direct management control or significant influence over primary ecosystem services?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers 6.15 and 6.16 (avoidance + mitigation).",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §14",
  },
  {
    id: "annex5b.PS6.15",
    ifcPS: "PS6",
    area: "Management of Ecosystem Services",
    prompt: "If so, has the company managed to avoided adverse impacts on Affected Communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Avoidance is the first step in the mitigation hierarchy per IFC PS6 §25.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §15",
  },
  {
    id: "annex5b.PS6.16",
    ifcPS: "PS6",
    area: "Management of Ecosystem Services",
    prompt:
      "Has the company implemented mitigation measure to minimize the impacts and maintain priority services in cases where impacts are unavoidable?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Where avoidance fails, mitigation and offset are required.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §16",
  },
  // Sustainable Management of Living Natural Resources
  {
    id: "annex5b.PS6.17",
    ifcPS: "PS6",
    area: "Sustainable Management of Living Natural Resources",
    prompt:
      "Is the company engaged in the primary production of living natural resources, including natural and plantation forestry, agriculture, animal husbandry, aquaculture, and fisheries?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers items 6.18-6.21.",
    ],
    // Informational.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §17",
  },
  {
    id: "annex5b.PS6.18",
    ifcPS: "PS6",
    area: "Sustainable Management of Living Natural Resources",
    prompt: "If so, is this production (land-based) located on unforested land or land already converted?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'No' (i.e. land-conversion from natural forest) requires PS6 §14-19 review.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §18",
  },
  {
    id: "annex5b.PS6.19",
    ifcPS: "PS6",
    area: "Sustainable Management of Living Natural Resources",
    prompt:
      "Where primary production practices are codified by globally, regionally, or nationally recognized standards, has the company implemented sustainable management practices in line with one or more of those standards?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "FSC (forestry), RSPO (palm oil), RTRS (soy), MSC/ASC (fish), etc.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §19",
  },
  {
    id: "annex5b.PS6.20",
    ifcPS: "PS6",
    area: "Sustainable Management of Living Natural Resources",
    prompt: "Have company's practices been independently verified or certified?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Third-party certification is the credible evidence of standard compliance.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §20",
  },
  {
    id: "annex5b.PS6.21",
    ifcPS: "PS6",
    area: "Sustainable Management of Living Natural Resources",
    prompt:
      "In the absence of relevant standards for the particular living natural resource in the country of concern, has the company applied good international industry operating principles, management practices, and technologies?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Fallback when no formal certification standard exists.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §21",
  },
  // Supply Chain
  {
    id: "annex5b.PS6.22",
    ifcPS: "PS6",
    area: "Supply Chain",
    prompt:
      "Has the company been purchasing primary production that is known to be produced in regions where there is a risk of significant conversion of natural and/or critical habitats?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Deforestation-linked commodity risk (palm oil, soy, cattle, timber).",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §22",
  },
  {
    id: "annex5b.PS6.23",
    ifcPS: "PS6",
    area: "Supply Chain",
    prompt: "If so, has the company established procedures and verification practices to evaluate its primary suppliers and avoid those who adversely impact such areas?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Supplier due diligence and traceability programme.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS6 §23",
  },
];

// ---------------------------------------------------------------------------
// PS7 — Indigenous Peoples
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF p. 48.
// ---------------------------------------------------------------------------
const PS7_ITEMS: Annex5bItem[] = [
  // Avoidance of Adverse Impacts
  {
    id: "annex5b.PS7.1",
    ifcPS: "PS7",
    area: "Avoidance of Adverse Impacts",
    prompt: "Is it likely that Indigenous Peoples (IPs) will be adversely impacted as a result of the company's operations?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' opens the full PS7 workflow (7.2-7.9).",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §1",
  },
  {
    id: "annex5b.PS7.2",
    ifcPS: "PS7",
    area: "Avoidance of Adverse Impacts",
    prompt: "Does the ESIA (where applicable) conducted by the company identify the adverse impacts to IPs?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IP impact assessment is a required component of the ESIA under IFC PS7 §9.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §2",
  },
  {
    id: "annex5b.PS7.3",
    ifcPS: "PS7",
    area: "Avoidance of Adverse Impacts",
    prompt:
      "Has the company identified appropriate measures to avoid or minimize impacts on IPs as well as opportunities for culturally appropriate and sustainable development benefits for IPs?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS7 §8: mitigation must be culturally appropriate.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §3",
  },
  // Consultation and Informed Participation
  {
    id: "annex5b.PS7.4",
    ifcPS: "PS7",
    area: "Consultation and Informed Participation",
    prompt: "Has the company conducted a process of Informed Consultation and Participation with affected IP communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "ICP is the baseline PS7 requirement; FPIC is required for specific triggers below.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §4",
  },
  {
    id: "annex5b.PS7.5",
    ifcPS: "PS7",
    area: "Consultation and Informed Participation",
    prompt: "Will company's operations impact lands and natural resources subject to traditional ownership or under customary use of IPs?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers the FPIC requirement in 7.8.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §5",
  },
  {
    id: "annex5b.PS7.6",
    ifcPS: "PS7",
    area: "Consultation and Informed Participation",
    prompt: "Will company's operation lead to relocation of IPs from lands and natural resources subject to traditional ownership or under customary use?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS7 §14-15: relocation of IPs from traditional/customary lands requires FPIC — a 'yes' without 7.8 is a critical finding.",
    ],
    flagOnAnswer: "yes",
    ifcPsTerminationTrigger: true,
    terminationCitation: "IFC PS7 §14 (FPIC non-negotiable)",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §6",
  },
  {
    id: "annex5b.PS7.7",
    ifcPS: "PS7",
    area: "Consultation and Informed Participation",
    prompt: "Will cultural heritage of IPs be impacted by the company's operations or used for commercial purposes by the company?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Trigger for FPIC + PS8 (cultural heritage).",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §7",
  },
  {
    id: "annex5b.PS7.8",
    ifcPS: "PS7",
    area: "Consultation and Informed Participation",
    prompt:
      "Has the company obtained IPs' Free, Prior and Informed Consent on design, implementation and expected outcomes related to impacts (on lands and natural resources, leading to relocation of IPs, on cultural heritage) affecting communities of IPs?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS7 §12-17: FPIC is required for the three specific triggers (traditional lands, relocation, cultural heritage). A 'no' where any of 7.5/7.6/7.7 is 'yes' is a critical finding.",
    ],
    flagOnAnswer: "no",
    ifcPsTerminationTrigger: true,
    terminationCitation: "IFC PS7 §12-17 (FPIC non-negotiable)",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §8",
  },
  // Private Sector Responsibility where Government is Responsible for Managing Indigenous Peoples Issues
  {
    id: "annex5b.PS7.9",
    ifcPS: "PS7",
    area: "Private Sector Responsibility where Government is Responsible",
    prompt: "Does the government have a defined role in the management of Indigenous Peoples issues in relation to the company's operation?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers 7.10 (collaboration expectation).",
    ],
    // Informational.
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §9",
  },
  {
    id: "annex5b.PS7.10",
    ifcPS: "PS7",
    area: "Private Sector Responsibility where Government is Responsible",
    prompt: "If so, has the company collaborated with the responsible government agency, to the extent feasible and permitted by the agency, to achieve outcomes?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS7 §18: private sector obligation to collaborate with government, not replace it.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS7 §10",
  },
];

// ---------------------------------------------------------------------------
// PS8 — Cultural Heritage
// Source: 2022 NRB ESRM Guideline Annex 5b, PDF p. 49.
// ---------------------------------------------------------------------------
const PS8_ITEMS: Annex5bItem[] = [
  // Protection of Cultural heritage in Project Design and Execution
  {
    id: "annex5b.PS8.1",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt: "Is the project located in an area where cultural heritage is expected to be found?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "'Yes' triggers Chance Find Procedure (8.2) and downstream items.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §1",
  },
  {
    id: "annex5b.PS8.2",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt: "If so, has a Chance Find Procedure been established by the company?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS8 §7: Chance Find Procedure is mandatory where cultural heritage may be encountered during excavation or construction.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §2",
  },
  {
    id: "annex5b.PS8.3",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt:
      "Will the company's project site contain cultural heritage or prevent access to previously accessible cultural heritage sites being used by, or that have been used by, Affected Communities?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Access preservation and continued use are IFC PS8 §8 obligations.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §3",
  },
  {
    id: "annex5b.PS8.4",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt: "If so, has the company allowed continued access to the cultural site or provided an alternative access route?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Where 8.3 is 'yes', 8.4 'no' is a compliance gap.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §4",
  },
  {
    id: "annex5b.PS8.5",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt: "Is it possible that the project may affect cultural heritage?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Broad screen — any 'yes' triggers 8.6-8.7.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §5",
  },
  {
    id: "annex5b.PS8.6",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt: "Will the project cause significant damage to critical cultural heritage?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS8 §11-12: significant damage to critical cultural heritage is generally not permitted — 'yes' is a critical finding.",
    ],
    flagOnAnswer: "yes",
    ifcPsTerminationTrigger: true,
    terminationCitation:
      "IFC PS8 §11 (critical cultural heritage non-negotiable)",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §6",
  },
  {
    id: "annex5b.PS8.7",
    ifcPS: "PS8",
    area: "Protection of Cultural Heritage in Project Design and Execution",
    prompt: "Is the project located in a legally protected area or a legally defined buffer zone?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS8 §12: cross-check with Nepal Department of Archaeology / DNPWC lists.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §7",
  },
  // Project use of Cultural Heritage
  {
    id: "annex5b.PS8.8",
    ifcPS: "PS8",
    area: "Project Use of Cultural Heritage",
    prompt: "Will the company use cultural resources, knowledge, innovations, or practices of local communities embodying traditional lifestyles for commercial purposes?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "Trigger for the benefit-sharing regime in 8.9-8.10.",
    ],
    flagOnAnswer: "yes",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §8",
  },
  {
    id: "annex5b.PS8.9",
    ifcPS: "PS8",
    area: "Project Use of Cultural Heritage",
    prompt:
      "If so, has the company informed these communities of their rights under national law, the scope and nature of the proposed commercial development, and the potential consequences of such development?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS8 §16: informed disclosure of rights, scope, and consequences before commercial use.",
      "Source PDF renders the three sub-items (rights / scope and nature / potential consequences) as bullets under one question; we treat them as a single composite item and expect the officer to note in Remarks which sub-items are covered.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §9",
  },
  {
    id: "annex5b.PS8.10",
    ifcPS: "PS8",
    area: "Project Use of Cultural Heritage",
    prompt:
      "If commercialization has proceeded, has the company entered into good faith negotiation with the affected community embodying traditional lifestyle, documented their informed participation and successful outcome of the negotiation, and provided fair and equitable sharing of benefits from commercialization?",
    options: ["yes", "no", "n/a"],
    guidanceNote: [
      "IFC PS8 §16: benefit-sharing is mandatory once commercial use is under way.",
      "Source PDF renders the three sub-items (good-faith negotiation / documented participation / benefit sharing) as bullets under one question; we treat them as a single composite item and expect the officer to note in Remarks which sub-items are covered.",
    ],
    flagOnAnswer: "no",
    citation: "NRB ESRM 2022 Annex 5b · PS8 §10",
  },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Full ordered catalog — PS1 through PS8, area order preserved from the
 * source PDF.
 */
export const ANNEX5B_ALL: Annex5bItem[] = [
  ...PS1_ITEMS,
  ...PS2_ITEMS,
  ...PS3_ITEMS,
  ...PS4_ITEMS,
  ...PS5_ITEMS,
  ...PS6_ITEMS,
  ...PS7_ITEMS,
  ...PS8_ITEMS,
];

/**
 * Catalog grouped by IFC Performance Standard.
 * Order within each PS matches ANNEX5B_ALL.
 */
export const ANNEX5B_BY_PS: Record<IfcPS, Annex5bItem[]> = {
  PS1: PS1_ITEMS,
  PS2: PS2_ITEMS,
  PS3: PS3_ITEMS,
  PS4: PS4_ITEMS,
  PS5: PS5_ITEMS,
  PS6: PS6_ITEMS,
  PS7: PS7_ITEMS,
  PS8: PS8_ITEMS,
};

/**
 * The full ordered PF screening checklist. Wrapper for API symmetry with
 * `fullChecklist()` in annex5-questions.ts.
 */
export function pfScreeningChecklist(): Annex5bItem[] {
  return ANNEX5B_ALL;
}

/**
 * Items where a flag on the answer escalates the whole screening to
 * CRITICAL. Derived from the `ifcPsTerminationTrigger: true` markers on the
 * catalog items above.
 *
 * NRB ESRM 2022 Annex 5b does not itself publish an escalation grid for
 * this questionnaire; the items marked here are Jana synthesis of the
 * IFC Performance Standards termination-grade language that the Annex is
 * aligned to (e.g. child/forced labor, forced eviction, critical habitat,
 * WHO Ia/Ib pesticides, IP relocation without FPIC, significant damage to
 * critical cultural heritage, security-abuse allegations). Each marked
 * item carries a `terminationCitation` string pointing to the specific
 * IFC PS § that supports its inclusion. Treat the mechanic as operational
 * triage — surfacing show-stoppers to the credit committee — not as a
 * verbatim regulatory rule.
 */
export function pfCriticalItems(): Annex5bItem[] {
  return ANNEX5B_ALL.filter((i) => i.ifcPsTerminationTrigger === true);
}
