/**
 * Corrective Action Plan + E&S Covenant + Monitoring library.
 *
 * Verbatim source: NRB Circular 22 attachment — the "Guidelines on
 * Environmental & Social Risk Management (ESRM)" PDF, Annexes 8, 9 and 10
 * (pp. 64-68 of the guideline PDF). Clause wording is taken directly from
 * Annex 9's five-way covenant taxonomy where the guideline itself gives
 * example language; where it only gives topics we synthesise a short
 * plain-English clause and cite the topic.
 *
 * This file is the code-side source of truth for:
 *   - COVENANT_LIBRARY — insertable clause templates
 *   - ANNEX10_CHECKLIST_ITEMS — the 13 items of Annex 10
 *   - frequencyForRiskClass — monitoring cadence from §7.3.7 guidance
 *   - deriveCapFromEscalation — seed CAP rows from ESDD "c" answers
 *
 * Keeping the catalogue in code (as with hydro doc-matrix and PCAF flag
 * library) means we can re-cite Annex 8/9/10 without a schema change.
 */

import type {
  CapItem,
  CapRiskClass,
  CovenantTemplate,
  MonitoringChecklistItem,
} from "./types";

// ---------------------------------------------------------------------------
// Covenant library — 7 entries covering every Annex 9 type at least once.
// ---------------------------------------------------------------------------

const ANNEX_9_CITATION = "NRB Circular 22 Annex 9 (ESRM Guideline PDF p. 66)";

export const COVENANT_LIBRARY: CovenantTemplate[] = [
  // -------- Positive covenants --------
  {
    id: "positive.quarterly-es-report",
    type: "positive",
    category: "Reporting",
    title: "Quarterly E&S performance report",
    clauseText:
      "The Borrower shall submit to the Bank a quarterly Environmental and " +
      "Social (E&S) performance report covering compliance with the E&S " +
      "requirements attached to this facility, including progress against " +
      "the Corrective Action Plan and any material E&S incidents during " +
      "the reporting period.",
    typicallyHasDeadline: false,
    citation: ANNEX_9_CITATION,
  },
  {
    id: "positive.spill-notification-3day",
    type: "positive",
    category: "Incidents",
    title: "3-day notification of significant accidents / spills",
    // Verbatim topic + timeframe from Annex 9: "In the event of significant
    // accidents and incidents, with potentially adverse E&S effects such
    // as spills or workplace accidents resulting in death, serious or
    // multiple injuries or major pollution, the client is required to
    // notify the Bank in a timely manner, such as within 3 days."
    clauseText:
      "In the event of any significant accident or incident with potentially " +
      "adverse Environmental and Social effects — including spills, workplace " +
      "accidents resulting in death, serious or multiple injuries, or major " +
      "pollution — the Borrower shall notify the Bank in writing within " +
      "three (3) days of the event, and shall provide a full written incident " +
      "report within thirty (30) days.",
    typicallyHasDeadline: false,
    citation: ANNEX_9_CITATION,
  },
  {
    id: "positive.regulatory-compliance",
    type: "positive",
    category: "Compliance",
    title: "Compliance with national E&S regulations and standards",
    clauseText:
      "The Borrower shall comply at all times with all applicable national " +
      "environmental, social, occupational health and safety and labour " +
      "regulations, standards and licence conditions, and shall maintain in " +
      "good standing every permit, licence or clearance required for its " +
      "operations.",
    typicallyHasDeadline: false,
    citation: ANNEX_9_CITATION,
  },

  // -------- Negative covenants --------
  {
    id: "negative.no-operations-protected-area",
    type: "negative",
    category: "Land use",
    title: "No operations in protected areas / critical habitat",
    clauseText:
      "The Borrower shall not commence, expand or continue any operations " +
      "within any protected forest area, national park, wildlife reserve, " +
      "conservation area, buffer zone or other legally designated critical " +
      "habitat, without the prior written consent of the Bank and the " +
      "relevant Government authority.",
    typicallyHasDeadline: false,
    citation: ANNEX_9_CITATION,
  },

  // -------- Condition precedent --------
  {
    id: "condition_precedent.permits-on-file",
    type: "condition_precedent",
    category: "Pre-disbursement",
    title: "Valid permits and licences on file before disbursement",
    clauseText:
      "As a condition precedent to each disbursement, the Borrower shall " +
      "provide the Bank with certified copies of every environmental " +
      "assessment approval (IEE / EIA), pollution control certificate, " +
      "sector permit and operational licence required for the financed " +
      "activities, each valid on the date of disbursement.",
    typicallyHasDeadline: true,
    citation: ANNEX_9_CITATION,
  },

  // -------- Event of default --------
  {
    id: "event_of_default.child-forced-labor",
    type: "event_of_default",
    category: "Labour",
    title: "Confirmed child or forced labour at any borrower facility",
    clauseText:
      "Any confirmed instance of child labour or forced labour at any " +
      "facility owned or operated by the Borrower, or any subcontractor " +
      "engaged in the financed activities, shall constitute an Event of " +
      "Default. The Borrower shall have thirty (30) days from written " +
      "notification by the Bank to fully remediate the finding, failing " +
      "which the Bank may cancel the facility and declare all amounts " +
      "owed immediately due and payable.",
    typicallyHasDeadline: false,
    citation: ANNEX_9_CITATION,
  },

  // -------- CAP covenant (Annex 9's own catch-all) --------
  {
    id: "cap_covenant.attach-cap-annex",
    type: "cap_covenant",
    category: "CAP",
    title: "Corrective Action Plan attached as annex to loan agreement",
    clauseText:
      "The Corrective Action Plan set out in Schedule [•] to this agreement " +
      "is incorporated by reference. The Borrower shall implement each item " +
      "of the Corrective Action Plan by the agreed completion date, and " +
      "shall report on the status of each item in the quarterly E&S " +
      "performance report required under this agreement.",
    typicallyHasDeadline: false,
    citation: ANNEX_9_CITATION,
  },
];

/** Lookup helper — returns undefined for an unknown template id. */
export function findCovenantTemplate(
  id: string,
): CovenantTemplate | undefined {
  return COVENANT_LIBRARY.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Annex 10 — 13-item monitoring checklist (verbatim)
// ---------------------------------------------------------------------------

const ANNEX_10_CITATION = "NRB Circular 22 Annex 10 (ESRM Guideline PDF pp. 67-68)";

export const ANNEX10_CHECKLIST_ITEMS: MonitoringChecklistItem[] = [
  // Project Summary Information (Sl. 1-3)
  {
    id: "annex10.1",
    serial: 1,
    section: "Project Summary Information",
    prompt: "Reporting period covered by this supervision report.",
  },
  {
    id: "annex10.2",
    serial: 2,
    section: "Project Summary Information",
    prompt:
      "Specification of project stage (design, construction, operation or closure stage).",
  },
  {
    id: "annex10.3",
    serial: 3,
    section: "Project Summary Information",
    prompt:
      "Key developments and any major changes in project location and design, if any, from the time of loan disbursement or from the last supervision period.",
  },

  // General Information (Sl. 4)
  {
    id: "annex10.4",
    serial: 4,
    section: "General Information",
    prompt:
      "Status of implementation of covenants / corrective action plan. Is it in line with the agreed timeframe (fully implemented, partially implemented, not implemented, or delayed)? If partially implemented / not implemented / delayed, RM to mention the reason along with a committed timeline for completion.",
  },

  // EHS Management (Sl. 5-8)
  {
    id: "annex10.5",
    serial: 5,
    section: "EHS Management",
    prompt:
      "Any incidence of accidents, spills, leakages, explosion etc. during the reporting period. If yes, what was the scale of damage (any fatality, monetary loss etc.) and what action was taken in response to the incident?",
  },
  {
    id: "annex10.6",
    serial: 6,
    section: "EHS Management",
    prompt:
      "Any recent fines or penalties issued by the regulatory body. If yes, RM to mention the nature of violation, amount of fine / penalty paid, and action taken by the client to address the issue and avoid recurrence.",
  },
  {
    id: "annex10.7",
    serial: 7,
    section: "EHS Management",
    prompt:
      "Any health & safety incident. If yes, extent of injury (minor, major or fatal) and action taken in response.",
  },
  {
    id: "annex10.8",
    serial: 8,
    section: "EHS Management",
    prompt:
      "Any new E&S risks or adverse impacts observed due to client's operation. RM to mention types of new E&S risks, reasons and mitigation measures undertaken.",
  },

  // Permits and Compliance Certificates (Sl. 9-10)
  {
    id: "annex10.9",
    serial: 9,
    section: "Permits and Compliance Certificates",
    prompt:
      "All required permits, licences and clearances in place. RM to mention issuance dates and duration of validity of all such permits, licences and clearances.",
  },
  {
    id: "annex10.10",
    serial: 10,
    section: "Permits and Compliance Certificates",
    prompt:
      "Other international management systems (e.g. ISO 14000, OHSAS 18001, SA8000) followed by the client and whether they hold valid certifications for those systems.",
  },

  // Grievance Redressal (Sl. 11-12)
  {
    id: "annex10.11",
    serial: 11,
    section: "Grievance Redressal",
    prompt:
      "Any recent complaints, grievances or protests received from local communities. If yes, RM to specify the nature of grievances, actions taken by the client to resolve them and any outstanding issues.",
  },
  {
    id: "annex10.12",
    serial: 12,
    section: "Grievance Redressal",
    prompt:
      "Any concerns raised during stakeholder consultations carried out by the client during the reporting period. If yes, what approach did the client take to address those concerns?",
  },

  // Other Information (Sl. 13)
  {
    id: "annex10.13",
    serial: 13,
    section: "Other Information",
    prompt:
      "Any other information pertaining to environmental matters, management approach, community, media or NGO coverage; and any environment-friendly initiatives or energy-saving equipment relevant for the BFI.",
  },
];

export const ANNEX10_CITATION = ANNEX_10_CITATION;

// ---------------------------------------------------------------------------
// Monitoring frequency — §7.3.7 guidance
// ---------------------------------------------------------------------------

/**
 * Default monitoring frequency (in months) by ESRR risk class. Circular 22
 * §7.3.7 says frequency is "tailored per transaction — driven by ESRR +
 * CAP status" but does not print an explicit table; the mapping below is
 * the demo default (also what most Nepal BFIs use in practice):
 *   extreme → monthly
 *   high    → quarterly
 *   medium  → semi-annual
 *   low     → annual (still required per §7.3.7, just infrequent)
 *
 * Individual monitoring reports may override this on save — the frequency
 * lives on the report row, not on a per-loan setting, so cadence can
 * tighten mid-life if non-compliance is found.
 */
export function frequencyForRiskClass(
  riskClass: CapRiskClass | null,
): 1 | 3 | 6 | 12 {
  switch (riskClass) {
    case "extreme":
      return 1;
    case "high":
      return 3;
    case "medium":
      return 6;
    case "low":
    default:
      return 12;
  }
}

// ---------------------------------------------------------------------------
// CAP seeding from ESDD escalation
// ---------------------------------------------------------------------------

/**
 * Minimal shape needed from an ESRM screening to seed CAP rows. Kept
 * loose (no import cycle) so both the API route and the wizard can call
 * this without pulling in the whole screening module.
 */
type EscalationSource = {
  drivingQuestionIds?: string[];
  esdd_snapshot?: Record<
    string,
    { answer?: string; remarks?: string | null }
  > | null;
};

/**
 * Human-readable prompt for the ESDD questions the screening driver
 * knows about. Kept as a local map so this helper doesn't have to import
 * the annex5 questions module (avoids a cross-cutting circular dep).
 * If a driving question isn't in the map we fall back to the raw id.
 */
const ESDD_QUESTION_AREA: Record<string, string> = {
  "annex5.1.1": "Legal / regulatory issues (Circular 22 Q 1.1)",
  "annex5.1.2": "Stakeholder grievances (Circular 22 Q 1.2)",
  "annex5.1.3": "Sensitive-area siting (Circular 22 Q 1.3)",
  "annex5.2.1": "Air and noise pollution (Circular 22 Q 2.1)",
  "annex5.2.2": "Water pollution (Circular 22 Q 2.2)",
  "annex5.2.3": "Waste handling (Circular 22 Q 2.3)",
  "annex5.2.4": "Energy efficiency (Circular 22 Q 2.4)",
  "annex5.2.5": "Climate risks and GHG mitigation (Circular 22 Q 2.5)",
  "annex5.3.1": "Fire / occupational health & safety (Circular 22 Q 3.1)",
  "annex5.3.2": "Labour practices (Circular 22 Q 3.2)",
  "annex5.3.3": "Community health & safety (Circular 22 Q 3.3)",
  "annex5.3.4": "Stakeholder consultation (Circular 22 Q 3.4)",
};

/**
 * Seed a starter CAP list from an escalated ESRM screening. One row per
 * driving ESDD "c" answer, area_of_concern derived from the question,
 * corrective_action left blank for the officer to fill in.
 *
 * The returned rows are camelCase CapItem drafts (no id, no bank / loan
 * / borrower ids — the API route fills those in). Deadlines are left
 * null; officers pick a date when filling in the corrective action.
 */
export function deriveCapFromEscalation(
  screening: EscalationSource,
): Array<
  Pick<
    CapItem,
    | "areaOfConcern"
    | "correctiveAction"
    | "deadlineDate"
    | "completionIndicator"
    | "responsibleParty"
    | "costNpr"
    | "status"
    | "linkedEsddQuestionId"
  >
> {
  const drivers = new Set<string>();

  // Prefer explicit drivingQuestionIds if the screening carries them.
  for (const id of screening.drivingQuestionIds ?? []) drivers.add(id);

  // Fall back to snapshot scan for any legacy screening rows.
  if (drivers.size === 0 && screening.esdd_snapshot) {
    for (const [qid, entry] of Object.entries(screening.esdd_snapshot)) {
      if (entry?.answer === "c") drivers.add(qid);
    }
  }

  const ordered = Array.from(drivers).sort();
  return ordered.map((qid) => {
    const remark =
      screening.esdd_snapshot?.[qid]?.remarks?.trim() ?? null;
    const area = ESDD_QUESTION_AREA[qid] ?? qid;
    return {
      areaOfConcern: remark ? `${area} — ${remark}` : area,
      correctiveAction: "",
      deadlineDate: null,
      completionIndicator: null,
      responsibleParty: null,
      costNpr: null,
      status: "not_started" as const,
      linkedEsddQuestionId: qid,
    };
  });
}
