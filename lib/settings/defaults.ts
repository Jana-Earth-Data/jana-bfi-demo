/**
 * DEFAULT_SETTINGS — the fully-hydrated baseline TenantSettings object.
 *
 * Every default here is annotated with its NRB / Circular 22 source so
 * future maintainers can trace the "why". resolveSettings() deep-merges
 * the saved JSONB blob over this object, so a partial saved payload never
 * leaves callers with `undefined` fields.
 *
 * If you add a field to TenantSettings you MUST add a default here (the
 * TypeScript type check will surface the omission).
 */

import type { TenantSettings } from "./types";

export const DEFAULT_SETTINGS: TenantSettings = {
  esrm: {
    // Circular 22 does not mandate remarks on the ESDD checklist — the
    // Annex 5 template has a Remarks column but leaves it optional. Off
    // by default; individual banks can turn it on per section.
    remarksRequired: {
      section1: false,
      section2: false,
      section3: false,
    },
    // NRB ESRM Guideline 2022 §7.3.6 (p. 18): "All transactions rated as
    // MEDIUM or HIGH (ESRR) will be escalated to the one-level higher
    // related credit approval authority." That is the demo default. The
    // 'c'-based modes are stricter-than-NRB narrowings some banks apply
    // on top of the rule; they are not readings of the Guideline.
    escalationTrigger: "esrr-medium-high",
    // Q2.5 (climate risks + opportunities) was added by the 2022 ESRM
    // update. Banks are still phasing it in — leave false so the
    // wizard doesn't hard-block officers on a question their operating
    // manual has not yet ratified.
    q25Required: false,
    // "Unassigned in all queues" matches the current demo behaviour —
    // any officer can pick up any unassigned loan from anywhere.
    autoAssignment: "unassigned-in-all-queues",
  },
  loanBook: {
    // Plain NPR (raw digits) is what NRB filings expect. Banks that
    // want dashboards to display in NPR millions / NPR crores can
    // toggle this.
    nprDisplayFormat: "plain",
    // Calendar year matches the demo synthesizer's year-grouped
    // aggregates. Nepal fiscal year (Shrawan–Ashad, mid-Jul to
    // mid-Jul) is available for banks that report on that cycle.
    fiscalYear: "calendar-jan-dec",
  },
  taxonomy: {
    // NRB GFT §3.2.2 — the taxonomy gate on ESRM progression is
    // described as a hard requirement, so default to hard-enforce.
    // warn-and-allow exists for banks that prefer to log the miss
    // and route to a manager instead of blocking the officer.
    esrmGateMode: "hard-enforce",
    // Empty list = every activity in the NRB Green Finance Taxonomy
    // is offered in the classification picker. Banks that do not
    // lend into a sector (e.g. no upstream oil & gas) can hide the
    // relevant activity ids here.
    hiddenActivityIds: [],
    // When a loan lacks a taxonomy classification the demo default
    // leaves it in the officer's queue with a nudge. Banks can flip
    // this on to escalate directly to the manager review lane.
    missingClassificationEscalatesToManager: false,
  },
  nfrs: {
    // PCAF sign-off is treated as an ESG-officer sole responsibility
    // by default (matches the current wizard flow). Turning this on
    // requires a compliance officer countersign before the score is
    // final.
    pcafDualSignoff: false,
    // NFRS S1 / S2 exposure drafts assume annual disclosure. Banks
    // that voluntarily disclose more frequently can bump this.
    reportingFrequency: "annual",
    // NFRS aggregate includes every exposure by default so the
    // headline financed-emissions figure reflects the whole book.
    // Excluding unclassified exposures is a stricter convention some
    // banks use pre-taxonomy-rollout.
    includeUnclassifiedInAggregate: true,
  },
  cap: {
    // NRB ESRM Guideline 2022 §7.3.7 sets the monitoring cadence by risk
    // class. Values below match the demo's frequencyForRiskClass
    // helper (lib/regulatory/cap/*).
    monitoringCadenceMonthsByRiskClass: {
      low: 12,
      medium: 6,
      high: 3,
      extreme: 1,
    },
    // Strict — an item one day past its deadline_date is treated as
    // overdue. Non-zero values give the officer breathing room for
    // routine slippage.
    overdueGraceDays: 0,
  },
  notifications: {
    // All notification channels default off so a fresh tenant does
    // not spam anyone until the bank explicitly opts in.
    emailEnabled: false,
    smsEnabled: false,
    pushEnabled: false,
    emailDigestCadence: "off",
  },
  bank: {
    // Null = fall through to the tenant registry's displayName. The
    // override is available for banks that prefer a different rendering
    // of their name in dashboard headers / email templates.
    displayNameOverride: null,
  },
};
