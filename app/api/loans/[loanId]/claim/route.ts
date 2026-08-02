/**
 * POST /api/loans/[loanId]/claim
 *
 * Auto-claim (or resolve ownership of) a loan for the currently signed-in
 * officer. Idempotent — hitting the endpoint on a loan you already own
 * is a no-op and returns { alreadyOwned: true }.
 *
 * Called from the Manager tab workbench (components/bfi/tabs/esrm-tab.tsx)
 * whenever `selectedLoanId` changes, so an officer clicking through the
 * queue is treated the same as an officer opening the ESDD wizard —
 * first touch claims it, non-owners see the read-only view.
 *
 * Response:
 *   {
 *     ok: true,
 *     ownerOfficerId: string | null,     // may be null on infra failure
 *     ownerOfficerName: string | null,
 *     alreadyOwned: boolean,             // true when caller was the owner
 *     autoClaimed: boolean,              // true when this call performed the claim
 *   }
 *
 * Requires a signed-in officer (401 otherwise). No 403 possible here —
 * the endpoint reports state, it does not mutate other officers'
 * assignments.
 */

import { NextResponse } from "next/server";
import { resolveCurrentOfficer } from "@/lib/officers/resolve";
import { resolveCurrentTenant } from "@/lib/tenants";
import { resolveLoanLockFor } from "@/lib/officers/loan-lock";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ loanId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { loanId } = await params;
  if (!loanId) {
    return NextResponse.json(
      { error: "loanId is required" },
      { status: 400 },
    );
  }

  const officer = await resolveCurrentOfficer();
  if (!officer) {
    return NextResponse.json(
      { error: "Officer must be selected before claiming a loan." },
      { status: 401 },
    );
  }
  const tenant = await resolveCurrentTenant();

  const lock = await resolveLoanLockFor(loanId, tenant, officer);

  return NextResponse.json({
    ok: true,
    loanId,
    ownerOfficerId: lock.ownerOfficerId,
    ownerOfficerName: lock.ownerOfficerName,
    alreadyOwned: lock.isOwner && !lock.autoClaimed,
    autoClaimed: lock.autoClaimed,
    isOwner: lock.isOwner,
  });
}
