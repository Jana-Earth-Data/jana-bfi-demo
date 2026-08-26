/**
 * Loan lock resolution — first-toucher-owns model (P34/P36).
 *
 * When an officer opens a loan-scoped surface (ESDD wizard, Taxonomy wizard,
 * PF-screening wizard, or the Manager workbench with a selected loan), we
 * either:
 *
 *   1. Auto-claim the loan for the current officer (upsert an assignment row)
 *      when the loan is currently unassigned, OR
 *   2. Return the existing owner's identity so the surface can render
 *      read-only for non-owners with a lock banner, OR
 *   3. Report `isOwner: true` for the current officer when they already
 *      own the loan.
 *
 * The helper is intentionally non-blocking on infrastructure failures —
 * if the assignment upsert or lookup errors, we LOG and fall back to
 * `isOwner: true` so the demo does not become unusable when Supabase is
 * flaky. Enforcement in mutation endpoints is defence-in-depth.
 *
 * Used by:
 *   - Server components in app/{esdd,taxonomy,pf-screening}/[loanId]/page.tsx
 *     (via `resolveLoanLock`).
 *   - POST /api/loans/[loanId]/claim (client-triggered when the Manager
 *     workbench selects a loan; see esrm-tab.tsx).
 *   - Every mutation route that needs to enforce ownership
 *     (via `assertOwnerOrRespond`).
 */

import { NextResponse } from "next/server";

import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import type { Officer, TenantConfig } from "@/lib/tenants";
import { getCaptureClient } from "@/lib/data/capture-client";
import { currentOfficerRoster } from "@/lib/officers/resolve";

export type LoanLockState = {
  loanId: string;
  /** True when either the current officer is the owner, or no officer is
   *  signed in (in which case downstream code handles auth). */
  isOwner: boolean;
  ownerOfficerId: string | null;
  ownerOfficerName: string | null;
  /** True when this call performed the auto-claim upsert (loan was
   *  previously unassigned). Callers may surface a tiny confirmation
   *  toast if they want to. */
  autoClaimed: boolean;
};

/**
 * Core resolver. Given a loan id, the current tenant, and the current
 * officer, either auto-claim on first touch or return the existing
 * owner's identity so the caller can render read-only.
 *
 * Semantics:
 *   - No officer signed in → returns `isOwner: false, autoClaimed: false`
 *     with the existing owner (if any). Callers should treat this the
 *     same way they treat a non-owner.
 *   - No assignment row exists → upsert and return `isOwner: true,
 *     autoClaimed: true`.
 *   - Assignment row belongs to currentOfficer → returns `isOwner: true`.
 *   - Assignment row belongs to a different officer → returns
 *     `isOwner: false` with that officer's name.
 *
 * Non-blocking on infra errors — logs and falls back to
 * `isOwner: true` so the officer can keep working.
 */
export async function resolveLoanLock(loanId: string): Promise<LoanLockState> {
  const tenant = await resolveCurrentTenant();
  const officer = await resolveCurrentOfficer();
  return resolveLoanLockFor(loanId, tenant, officer);
}

/**
 * Variant that accepts the resolved tenant + officer directly. Useful
 * when the caller has already resolved them and wants to avoid double
 * cookie reads.
 */
export async function resolveLoanLockFor(
  loanId: string,
  tenant: TenantConfig,
  officer: Officer | null,
): Promise<LoanLockState> {
  const supabase = await getCaptureClient();
  if (!supabase) {
    // No DB — degrade gracefully. Assume the current officer owns
    // whatever they're touching so the demo still works locally
    // without Supabase configured.
    return {
      loanId,
      isOwner: true,
      ownerOfficerId: officer?.id ?? null,
      ownerOfficerName: officer?.name ?? null,
      autoClaimed: false,
    };
  }

  // Look up any existing assignment.
  let ownerId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("bfi_loan_assignments")
      .select("officer_id")
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .maybeSingle();
    if (error) {
      console.warn(
        "[loan-lock] assignment lookup failed (fail-open):",
        error.message,
      );
      return {
        loanId,
        isOwner: true,
        ownerOfficerId: officer?.id ?? null,
        ownerOfficerName: officer?.name ?? null,
        autoClaimed: false,
      };
    }
    ownerId = data?.officer_id ?? null;
  } catch (err) {
    console.warn("[loan-lock] assignment lookup threw (fail-open):", err);
    return {
      loanId,
      isOwner: true,
      ownerOfficerId: officer?.id ?? null,
      ownerOfficerName: officer?.name ?? null,
      autoClaimed: false,
    };
  }

  // Case 1 — no assignment yet. Auto-claim for the current officer if
  // one is signed in. If nobody is signed in, return an "unassigned"
  // state so upstream can prompt for officer selection.
  if (!ownerId) {
    if (!officer) {
      return {
        loanId,
        isOwner: false,
        ownerOfficerId: null,
        ownerOfficerName: null,
        autoClaimed: false,
      };
    }
    try {
      const { error: insErr } = await supabase
        .from("bfi_loan_assignments")
        .insert({
          bank_id: tenant.id,
          loan_id: loanId,
          officer_id: officer.id,
          assigned_by: officer.id,
          assigned_at: new Date().toISOString(),
        });
      if (insErr) {
        console.warn(
          "[loan-lock] auto-claim insert failed (fail-open):",
          insErr.message,
        );
      }
    } catch (err) {
      console.warn("[loan-lock] auto-claim insert threw (fail-open):", err);
    }
    return {
      loanId,
      isOwner: true,
      ownerOfficerId: officer.id,
      ownerOfficerName: officer.name,
      autoClaimed: true,
    };
  }

  // Case 2 — already owned by the current officer.
  if (officer && ownerId === officer.id) {
    return {
      loanId,
      isOwner: true,
      ownerOfficerId: officer.id,
      ownerOfficerName: officer.name,
      autoClaimed: false,
    };
  }

  // Case 3 — owned by a different officer. Resolve the owner's display
  // name from the tenant roster (cheap in-memory lookup, avoids a
  // round-trip to bfi_officers on the hot path).
  const owner = (await currentOfficerRoster()).find((o) => o.id === ownerId);
  return {
    loanId,
    isOwner: false,
    ownerOfficerId: ownerId,
    ownerOfficerName: owner?.name ?? ownerId,
    autoClaimed: false,
  };
}

/**
 * Look up a loan's current owner without side-effects (no auto-claim).
 * Used by mutation-endpoint guards where we must NOT create an
 * assignment as a side-effect of a write.
 */
export async function lookupLoanOwner(
  loanId: string,
  tenant: TenantConfig,
): Promise<string | null> {
  const supabase = await getCaptureClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("bfi_loan_assignments")
      .select("officer_id")
      .eq("bank_id", tenant.id)
      .eq("loan_id", loanId)
      .maybeSingle();
    if (error) {
      console.warn(
        "[loan-lock] owner lookup failed (fail-open):",
        error.message,
      );
      return null;
    }
    return data?.officer_id ?? null;
  } catch (err) {
    console.warn("[loan-lock] owner lookup threw (fail-open):", err);
    return null;
  }
}

/**
 * Guard helper for mutation endpoints. Returns `null` when the current
 * officer is allowed to mutate this loan; returns a `NextResponse` with
 * status 403 when they are not.
 *
 * Rules:
 *   - No officer signed in → caller should have already 401'd; we just
 *     return null (no lock enforcement).
 *   - No assignment on the loan → allow (the officer's next server-side
 *     page load will auto-claim it).
 *   - Assignment matches officer → allow.
 *   - Assignment mismatched → 403 with a human message.
 *
 * Non-blocking on infra errors — logs and allows the mutation. The rule
 * from spec: "Non-blocking rule violation: if the assignment lookup
 * itself errors, LOG and allow (don't fail-closed for a demo)."
 */
export async function assertOwnerOrRespond(
  loanId: string,
  officer: Officer,
  tenant: TenantConfig,
): Promise<NextResponse | null> {
  const ownerId = await lookupLoanOwner(loanId, tenant);
  if (ownerId == null) return null; // unassigned OR lookup failed — allow
  if (ownerId === officer.id) return null; // owner — allow
  const owner = (await currentOfficerRoster()).find((o) => o.id === ownerId);
  return NextResponse.json(
    {
      error: "Loan is assigned to a different officer",
      ownerOfficerId: ownerId,
      ownerOfficerName: owner?.name ?? null,
    },
    { status: 403 },
  );
}
