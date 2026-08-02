"use client";

/**
 * Client-side loan-lock context (P36).
 *
 * Every loan-scoped wizard / workbench surface wraps its tree in
 * <LoanLockProvider value={...}> at the top (usually seeded server-side
 * via `resolveLoanLock` on the page component). Children consume the
 * context via `useLoanLock()` to know whether the current officer owns
 * the loan or is browsing read-only.
 *
 * Semantics:
 *   - isOwner === true  → interactive editing is allowed
 *   - isOwner === false → render read-only; hide save/delete buttons;
 *                          the top-level surface should render a
 *                          <LockedByBanner /> so the officer knows why.
 *
 * The context itself does NOT enforce anything — enforcement lives in
 * the API routes (assertOwnerOrRespond). This context is a UI-friendly
 * mirror of that server-side truth so the surface doesn't feel broken.
 */

import { createContext, useContext } from "react";

export type LoanLockValue = {
  loanId: string;
  isOwner: boolean;
  ownerOfficerId: string | null;
  ownerOfficerName: string | null;
};

const LoanLockContext = createContext<LoanLockValue | null>(null);

export function LoanLockProvider({
  value,
  children,
}: {
  value: LoanLockValue;
  children: React.ReactNode;
}) {
  return (
    <LoanLockContext.Provider value={value}>
      {children}
    </LoanLockContext.Provider>
  );
}

/**
 * Consume the loan-lock state. Returns a permissive default (isOwner:
 * true) when no provider is mounted — that way components can render
 * outside a wizard (unit tests, storybook, ad-hoc pages) without
 * exploding, and non-loan-scoped surfaces just get standard edit
 * behavior.
 */
export function useLoanLock(): LoanLockValue {
  const ctx = useContext(LoanLockContext);
  if (ctx) return ctx;
  return {
    loanId: "",
    isOwner: true,
    ownerOfficerId: null,
    ownerOfficerName: null,
  };
}
