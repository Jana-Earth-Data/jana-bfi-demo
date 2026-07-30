/**
 * NRB ESRM 2022 Annex 5b Project Finance Screening — scoring engine.
 *
 * Takes a set of Yes/No/N/A responses against `ANNEX5B_ALL` and computes
 * a `PfScreeningResult`. The scoring rules are:
 *
 *   - Each item has a `flagOnAnswer` (either 'no' or 'yes'). A response
 *     matching that value counts as a flag.
 *   - 'n/a' never flags.
 *   - Items marked `criticalOnFlag = true` push the overall risk to
 *     CRITICAL when they are flagged.
 *   - Otherwise, overall risk is:
 *       LOW      : < 5 flags
 *       MEDIUM   : 5..15 flags
 *       HIGH     : > 15 flags
 *
 * The rationale sentence names the driving PS(s) and the critical items
 * (if any) so the wizard's Review step can render a defensible summary.
 *
 * NRB ESRM 2022 Annex 5b does not itself publish a formal aggregation
 * formula for the questionnaire; the thresholds above are Jana editorial
 * defaults chosen to align with the "few / several / many" cadence NRB
 * uses in the Annex 5 checklist and IFC PS supervision practice. Review
 * with compliance before treating as regulatory canon.
 */

import {
  ANNEX5B_ALL,
  ANNEX5B_BY_PS,
  pfCriticalItems,
} from "./annex5b-pf-questions";
import {
  IFC_PS_TITLE,
  type Annex5bItem,
  type IfcPS,
  type PfPsBreakdown,
  type PfRiskClass,
  type PfScreeningResponse,
  type PfScreeningResult,
} from "./annex5b-pf-types";

const ALL_PS: IfcPS[] = ["PS1", "PS2", "PS3", "PS4", "PS5", "PS6", "PS7", "PS8"];

const LOW_MAX = 4; // < 5
const MEDIUM_MAX = 15; // 5..15

function itemIsFlagged(item: Annex5bItem, answer: string | null | undefined): boolean {
  if (answer === "yes" || answer === "no") {
    return answer === item.flagOnAnswer;
  }
  return false;
}

/**
 * Compute the Annex 5b screening result from a response map.
 *
 * Missing entries in `responses` count as unanswered (not applicable is
 * captured explicitly as 'n/a').
 */
export function scorePfScreening(
  responses: PfScreeningResponse,
): PfScreeningResult {
  const criticalFlaggedItems: string[] = [];
  let itemsFlagged = 0;
  let itemsAnswered = 0;
  let itemsApplicable = 0;
  const psBreakdown: PfPsBreakdown[] = [];

  for (const ps of ALL_PS) {
    const items = ANNEX5B_BY_PS[ps];
    let answered = 0;
    let applicable = 0;
    let flagged = 0;
    let criticalFlagged = 0;
    for (const item of items) {
      const ans = responses[item.id] ?? null;
      if (ans !== null && ans !== undefined) answered += 1;
      if (ans === "yes" || ans === "no") applicable += 1;
      if (itemIsFlagged(item, ans)) {
        flagged += 1;
        if (item.criticalOnFlag) {
          criticalFlagged += 1;
          criticalFlaggedItems.push(item.id);
        }
      }
    }
    itemsAnswered += answered;
    itemsApplicable += applicable;
    itemsFlagged += flagged;
    psBreakdown.push({
      ifcPS: ps,
      title: IFC_PS_TITLE[ps],
      answered,
      applicable,
      flagged,
      criticalFlagged,
      total: items.length,
    });
  }

  let riskClass: PfRiskClass = "low";
  if (criticalFlaggedItems.length > 0) {
    riskClass = "critical";
  } else if (itemsFlagged > MEDIUM_MAX) {
    riskClass = "high";
  } else if (itemsFlagged > LOW_MAX) {
    riskClass = "medium";
  }

  const rationale = buildRationale({
    riskClass,
    itemsFlagged,
    criticalFlaggedItems,
    psBreakdown,
  });

  return {
    totalItems: ANNEX5B_ALL.length,
    itemsAnswered,
    itemsApplicable,
    itemsFlagged,
    criticalFlaggedItems,
    psBreakdown,
    riskClass,
    rationale,
  };
}

function buildRationale({
  riskClass,
  itemsFlagged,
  criticalFlaggedItems,
  psBreakdown,
}: {
  riskClass: PfRiskClass;
  itemsFlagged: number;
  criticalFlaggedItems: string[];
  psBreakdown: PfPsBreakdown[];
}): string {
  const drivingPs = psBreakdown
    .filter((b) => b.flagged > 0)
    .sort((a, b) => b.flagged - a.flagged)
    .slice(0, 3)
    .map((b) => `${b.ifcPS} (${b.flagged})`);
  const drivingList = drivingPs.length > 0 ? drivingPs.join(", ") : "none";

  if (riskClass === "critical") {
    const criticalList = criticalFlaggedItems.length > 0
      ? criticalFlaggedItems.map((id) => id.replace("annex5b.", "")).join(", ")
      : "none";
    return (
      `PF risk: CRITICAL. ${criticalFlaggedItems.length} auto-critical item(s) ` +
      `flagged (${criticalList}). Total flags: ${itemsFlagged}. Top-flagged PS: ${drivingList}. ` +
      `Screening must be reviewed by credit committee before any approval; ` +
      `escalation is mandatory per NRB ESRM 2022 Annex 5b + IFC PS.`
    );
  }
  if (riskClass === "high") {
    return (
      `PF risk: HIGH. ${itemsFlagged} flagged item(s) across the questionnaire. ` +
      `Top-flagged PS: ${drivingList}. Recommend approve-with-conditions after ` +
      `each flag has a documented mitigation commitment and CAP; escalation ` +
      `to credit committee per NRB ESRM Annex 5b.`
    );
  }
  if (riskClass === "medium") {
    return (
      `PF risk: MEDIUM. ${itemsFlagged} flagged item(s). Top-flagged PS: ${drivingList}. ` +
      `Recommend approve-with-conditions; each flag should be covered by a CAP ` +
      `item (Annex 8) or an E&S covenant (Annex 9) in the loan agreement.`
    );
  }
  return (
    `PF risk: LOW. ${itemsFlagged} flagged item(s). No auto-critical findings. ` +
    `Recommend approve under standard commercial terms with routine E&S monitoring ` +
    `per NRB ESRM Annex 10.`
  );
}

export { pfCriticalItems };
