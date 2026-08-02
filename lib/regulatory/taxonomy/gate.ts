/**
 * ESRM-before-Taxonomy gate.
 *
 * NRB Green Finance Taxonomy 2024 §3.2.2 (p. 26) is explicit:
 *
 *   "In the case of BFIs, Steps 1 and 2 of the Environment and Social
 *    Risk Management (ESRM) guidelines shall be applied first and then
 *    the taxonomy in terms of classifying activities."
 *
 * The same rule is repeated in the Executive Summary "Treatment of
 * risk" section (p. 11) and in Annex 3 Note (p. 141).
 *
 * Our UX enforces this by refusing to open the Taxonomy wizard for a
 * loan until an ESRM screening has been saved for it.
 *
 * The check queries `bfi_esrm_screenings` for the tenant + loan and
 * returns a small verdict object the page component uses to render
 * either the wizard or a gate screen with a jump-to-ESRM button.
 */

import { getSupabaseAdmin } from "@/lib/data/supabase";

export type TaxonomyGateVerdict =
  | { allowed: true; capturedAt: string; riskClass: string | null }
  | { allowed: false; reason: "no-supabase" | "no-screening" };

/**
 * Check whether a loan has a saved ESRM screening. Called from the
 * taxonomy wizard route before rendering. Returns `allowed: true` when
 * a screening exists, otherwise `allowed: false` with the reason.
 *
 * When Supabase is not configured (local dev without the DB) we
 * currently allow the wizard through so the in-memory demo still works
 * end-to-end. Change to `allowed: false` if we want the gate to be
 * hard-enforced even in the mock path.
 */
export async function checkEsrmBeforeTaxonomyGate(
  tenantId: string,
  loanId: string,
): Promise<TaxonomyGateVerdict> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Fallback for local dev without Supabase — don't block the demo.
    return { allowed: false, reason: "no-supabase" };
  }
  const { data, error } = await supabase
    .from("bfi_esrm_screenings")
    .select("computed_risk_class, captured_at")
    .eq("bank_id", tenantId)
    .eq("loan_id", loanId)
    .order("captured_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) {
    return { allowed: false, reason: "no-screening" };
  }
  return {
    allowed: true,
    capturedAt: data[0].captured_at,
    riskClass: (data[0].computed_risk_class as string | null) ?? null,
  };
}
