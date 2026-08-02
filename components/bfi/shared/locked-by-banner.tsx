"use client";

/**
 * Read-only lock banner (P36).
 *
 * Rendered at the top of any loan-scoped wizard / workbench when the
 * current officer is not the loan's owner. Communicates why every input
 * on the surface is disabled and points the officer at the manager as
 * the path to reassignment.
 *
 * Rose tone — matches the palette the demo already uses for
 * cannot-edit / escalation states. Inline SVG icon so we don't pull in
 * lucide-react on a surface that only needs one glyph.
 */

export function LockedByBanner({
  ownerName,
  className,
}: {
  ownerName: string | null;
  className?: string;
}) {
  const displayName = ownerName?.trim() || "another officer";
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 " +
        (className ?? "")
      }
    >
      <LockIcon />
      <span>
        Locked — owned by{" "}
        <span className="font-semibold text-white">{displayName}</span>. Ask
        the manager to reassign this loan before editing.
      </span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
