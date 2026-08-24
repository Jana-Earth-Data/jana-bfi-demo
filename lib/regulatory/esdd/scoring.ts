/**
 * NRB ESRM Annex 5 answer scoring and risk aggregation.
 *
 * NRB does not publish a formal numeric score for each answer option, but
 * the guidance is unambiguous: 'a' means the risk is not present or has
 * been adequately mitigated; 'b' means partial mitigation with a definite
 * plan; 'c' means the risk is present with no plan; 'd' means the question
 * does not apply.
 *
 * We encode that hierarchy as an integer weight so we can aggregate a
 * completed checklist into a single risk class and a defensible
 * recommendation. Every derivation carries the question ids that drove
 * the outcome, which is what the wizard's review screen shows and what
 * a credit committee auditor could later verify.
 *
 * The weights are calibratable in one place. If NRB updates the guidance
 * or an internal review changes the escalation posture, it changes here.
 */

import type { EsddAnswer } from "./annex5-questions";

export const ANSWER_WEIGHTS: Record<EsddAnswer, number | null> = {
  a: 0,
  b: 1,
  c: 3,
  // "Not applicable" drops out of both the numerator and denominator so
  // it does not depress a section's mean score.
  d: null,
};

export type EsddResponseRecord = {
  questionId: string;
  answer: EsddAnswer;
  remarks?: string;
};

export type SectionScore = {
  section: "general" | "ehs" | "social" | string;
  answered: number;
  applicable: number;
  totalWeight: number;
  cCount: number;
  /**
   * Sum of weights divided by number of applicable answers, or null if no
   * applicable answers have been recorded yet.
   */
  mean: number | null;
};

export type EsrmDerivation = {
  /**
   * NRB's ESRR, and only NRB's ESRR. Three levels, because the Guideline
   * has three. Deliberately narrower than the "extreme"-inclusive unions
   * elsewhere in the codebase: those describe other things (emissions
   * magnitude in lib/data/screening.ts, monitoring cadence in settings) and
   * are free to have their own scales. This field is the regulator's, so a
   * fourth level here is a type error rather than a judgement call.
   */
  riskClass: "low" | "medium" | "high";
  recommendation: "approve" | "approve-with-conditions" | "decline";
  escalationFlag: boolean;
  rationale: string;
  drivingQuestionIds: string[];
  /**
   * Number of 'c' answers. Severity within HIGH, for queue triage. This is
   * what the old "extreme" class was really trying to express; expressing
   * it as a count keeps it out of the rating field.
   */
  criticalFindingCount: number;
};

/**
 * Questions NRB excludes from the ESRR calculation.
 *
 * Q2.4 asks whether the client HAS INVESTED in energy efficiency or
 * renewables. It is the one question on the sheet where a less-positive
 * answer describes an absent benefit rather than a present risk, so scoring
 * it would let a borrower be marked riskier for having done less of a good
 * thing. NRB marks it indicative-only in ESRR_criteria!A8 and leaves it out
 * of the rating; annex5-questions.ts documents this and defers the rule
 * here, which had not actually been implemented.
 */
export const RATING_EXEMPT_QUESTIONS: ReadonlySet<string> = new Set([
  "annex5.2.4",
]);

/**
 * Aggregate a set of responses into a per-section summary.
 * Groups by the `section` field on each question definition; the caller
 * passes a lookup so this file stays free of imports from annex5-questions.ts.
 */
export function scoreBySection(
  responses: EsddResponseRecord[],
  lookupSection: (questionId: string) => string,
): Record<string, SectionScore> {
  const buckets: Record<string, SectionScore> = {};
  for (const r of responses) {
    const section = lookupSection(r.questionId);
    if (!section) continue;
    if (!buckets[section]) {
      buckets[section] = {
        section,
        answered: 0,
        applicable: 0,
        totalWeight: 0,
        cCount: 0,
        mean: null,
      };
    }
    const bucket = buckets[section];
    // Counted as answered for progress purposes even when exempt from the
    // rating — the officer did answer it, and 13/13 must still read 13/13.
    bucket.answered += 1;
    if (RATING_EXEMPT_QUESTIONS.has(r.questionId)) continue;
    const weight = ANSWER_WEIGHTS[r.answer];
    if (weight === null) continue; // 'd' — not applicable, no scoring impact
    bucket.applicable += 1;
    bucket.totalWeight += weight;
    if (r.answer === "c") bucket.cCount += 1;
  }
  for (const key of Object.keys(buckets)) {
    const b = buckets[key];
    b.mean = b.applicable > 0 ? b.totalWeight / b.applicable : null;
  }
  return buckets;
}

/**
 * Derive the overall ESRM decision from per-section scores.
 *
 * NRB's own rule, for reference — NRB ESRM Guideline 2022 §7.3.6
 * "Escalation" (p. 18), verbatim: "All transactions rated as MEDIUM or
 * HIGH (ESRR) will be escalated to the one-level higher related credit
 * approval authority." Under the ESRR_criteria sheet of NRB's ESDD Excel
 * tool: all (a)/(d) → LOW; any (b) with no (c) → MEDIUM; any (c) → HIGH;
 * Q2.4 excluded from the rating. So a 'b' answer escalates under NRB.
 *
 * Escalation reproduces NRB's rule directly: ESRR of MEDIUM or HIGH
 * escalates one level, LOW does not. A loan reaching MEDIUM on 'b'
 * answers alone therefore escalates, which is the NRB outcome.
 *
 * Rating rules as implemented — these now reproduce NRB's ESRR criteria
 * rather than approximating them:
 *   - Any 'c' answer            → HIGH   (NRB: "any (c) → HIGH")
 *   - Any 'b', no 'c'           → MEDIUM (NRB: "any (b) with no (c)")
 *   - All 'a'/'d'               → LOW    (NRB: "all (a)/(d) → LOW")
 *   - Risk class above LOW      → escalationFlag = true (§7.3.6)
 *
 * There is no fourth level. This function previously returned 'extreme'
 * for three or more 'c' answers. NRB's ESRR has three levels and stops at
 * HIGH, and this value is stored in computed_risk_class and shown to the
 * bank as the NRB rating, so a fourth level put a rating in that field
 * that appears nowhere in the Guideline. Severity above a single 'c' is
 * now reported as criticalFindingCount, which a queue can use for triage
 * without overwriting the regulator's scale.
 *
 * This also previously required two or more 'c' answers for HIGH and let a
 * loan with 'b' answers stay LOW on a section mean ≤ 0.5. Both were
 * stricter than NRB and under-rated real loans: a single 'c' is HIGH under
 * the ESRR_criteria sheet, and a single 'b' is MEDIUM.
 *
 * Recommendation follows risk class:
 *   - high    → approve-with-conditions
 *   - medium  → approve-with-conditions
 *   - low     → approve
 *
 * The rationale is a plain-English sentence citing the c-answered question
 * ids so the reviewer can trace the decision back to a specific evidence
 * failure.
 */
export function deriveEsrm(
  bucketed: Record<string, SectionScore>,
  responses: EsddResponseRecord[],
): EsrmDerivation {
  const totalC = Object.values(bucketed).reduce((s, b) => s + b.cCount, 0);
  const maxMean = Object.values(bucketed).reduce(
    (m, b) => (b.mean !== null && b.mean > m ? b.mean : m),
    0,
  );
  // Questions that drive the rating. Under NRB's ESRR criteria a 'b'
  // answer alone produces MEDIUM, which escalates. So when there are no
  // 'c' answers we surface the 'b' answers instead, otherwise an escalated
  // MEDIUM loan would appear in the manager banner with no reason listed.
  // Exempt questions are filtered out here too: Q2.4 cannot drive a rating
  // it is excluded from, and listing it in the escalation banner would point
  // the credit authority at a reason that did not actually contribute.
  const cQuestionIds = responses
    .filter((r) => r.answer === "c" && !RATING_EXEMPT_QUESTIONS.has(r.questionId))
    .map((r) => r.questionId);
  const bQuestionIds = responses
    .filter((r) => r.answer === "b" && !RATING_EXEMPT_QUESTIONS.has(r.questionId))
    .map((r) => r.questionId);
  const drivingQuestionIds =
    cQuestionIds.length > 0 ? cQuestionIds : bQuestionIds;

  // NRB ESRR criteria, applied in order. `totalWeight === 0` across every
  // section means no 'b' and no 'c' was recorded — all answers were 'a' or
  // 'd' — which is NRB's LOW.
  const anyB = Object.values(bucketed).some((b) => b.totalWeight > 0);

  // NRB's ESRR has exactly three levels and stops at HIGH. This function
  // must never return a fourth: the value it produces is stored in
  // computed_risk_class and presented to the bank, and to a regulator, AS
  // the NRB rating. Inventing a level above HIGH would put a rating in that
  // field that does not exist anywhere in the Guideline.
  let riskClass: EsrmDerivation["riskClass"];
  if (totalC >= 1) {
    riskClass = "high";
  } else if (anyB) {
    riskClass = "medium";
  } else {
    riskClass = "low";
  }

  // Severity WITHIN high, for triage only. Three or more 'c' answers is a
  // materially worse screening than one, and a queue should be able to show
  // that -- but as a separate signal, not by overwriting the NRB rating.
  // Consumers may surface this however they like; nothing about it is NRB's.
  const criticalFindingCount = totalC;

  const recommendation: EsrmDerivation["recommendation"] =
    riskClass === "low" ? "approve" : "approve-with-conditions";

  // NRB ESRM Guideline 2022 §7.3.6: an ESRR of MEDIUM or HIGH must be
  // escalated to the next-higher credit approval authority. LOW does not
  // escalate. This is the rule the UI cites, so the flag reproduces it.
  const escalationFlag = riskClass !== "low";

  const rationale = buildRationale({
    riskClass,
    totalC,
    maxMean,
    drivingQuestionIds,
  });

  return {
    riskClass,
    recommendation,
    escalationFlag,
    rationale,
    drivingQuestionIds,
    criticalFindingCount,
  };
}

function buildRationale({
  riskClass,
  totalC,
  maxMean,
  drivingQuestionIds,
}: {
  riskClass: EsrmDerivation["riskClass"];
  totalC: number;
  maxMean: number;
  drivingQuestionIds: string[];
}): string {
  const cList =
    drivingQuestionIds.length > 0
      ? drivingQuestionIds.map((id) => id.replace("annex5.", "")).join(", ")
      : "none";
  // When nothing was answered 'c', the listed questions are the 'b'
  // answers that produced the rating. Label them accurately.
  const driverLabel = totalC > 0 ? "'c'" : "'b'";

  if (riskClass === "high") {
    return (
      `Risk class: high. ${totalC} 'c' answer(s) at ${cList}. Highest section ` +
      `mean weight ${maxMean.toFixed(2)}. Recommend approve-with-conditions ` +
      `including mitigation commitments on the flagged questions. Escalation ` +
      `flag set per NRB ESRM guidance.`
    );
  }
  if (riskClass === "low") {
    return (
      `Risk class: low. No 'c' answers recorded and every section mean weight ` +
      `≤ 0.5. Recommend approve under standard commercial terms; no ESRM ` +
      `escalation triggered.`
    );
  }
  return (
    `Risk class: medium. Highest section mean weight ${maxMean.toFixed(2)}. ` +
    `Driven by ${driverLabel} answer(s) at ${cList}. Escalates to the ` +
    `next-higher credit approval authority per NRB ESRM Guideline 2022 ` +
    `§7.3.6. Recommend approve-with-conditions; monitor mitigation ` +
    `commitments during covenant review.`
  );
}
