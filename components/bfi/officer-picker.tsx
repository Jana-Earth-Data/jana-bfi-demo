"use client";

/**
 * Officer picker.
 *
 * A small header affordance: shows the currently-signed-in officer, or a
 * "Choose officer" prompt if none is set. Clicking either opens a modal
 * with the current tenant's roster, and a click on a roster entry POSTs
 * to /api/officer/set and refreshes the SSR tree.
 *
 * The demo does not enforce officer selection to browse the dashboard.
 * Wizards that capture officer-attributed data (Phase 2 ESDD wizard,
 * Phase 4 Taxonomy wizard) will require it to be set and prompt the
 * picker when it's not.
 *
 * The modal is rendered into document.body via a React portal because the
 * <DashboardHeader> uses backdrop-blur, and any CSS filter / backdrop-filter
 * on an ancestor creates a new containing block — which would cause the
 * modal's `position: fixed` to anchor to the header instead of the viewport
 * and clip most of the modal off-screen. The portal escapes that.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Officer } from "@/lib/tenants";

const ROLE_LABEL: Record<Officer["role"], string> = {
  loan_officer: "Loan officer",
  esg_officer: "ESG officer",
  compliance: "Compliance",
  credit_committee: "Credit committee",
};

export function OfficerPicker({
  officers,
  currentOfficer,
}: {
  officers: Officer[];
  currentOfficer: Officer | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Track whether we're mounted client-side (createPortal requires document).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  async function selectOfficer(officerId: string) {
    setBusyId(officerId);
    try {
      const res = await fetch("/api/officer/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ officerId }),
      });
      if (!res.ok) {
        console.warn(`Officer set failed: ${res.status}`);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function clearOfficer() {
    setBusyId("__clear");
    try {
      await fetch("/api/officer/clear", { method: "POST" });
      setOpen(false);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-line bg-panel px-3 py-1 text-xs text-slate-300 hover:bg-line/30"
        title={
          currentOfficer
            ? "Change signed-in officer"
            : "Choose an officer to attribute ESDD and taxonomy captures to"
        }
      >
        {currentOfficer ? (
          <>
            As{" "}
            <span className="font-semibold text-white">
              {currentOfficer.name}
            </span>{" "}
            <span className="text-slate-500">
              · {ROLE_LABEL[currentOfficer.role]}
            </span>
          </>
        ) : (
          "Choose officer"
        )}
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-md"
          style={{ backgroundColor: "rgba(2, 6, 23, 0.92)" }}
          onClick={() => setOpen(false)}
        >
          {/*
            Simpler single-scroll structure. The BACKDROP is the scroll
            container; the modal is a normally-flowing card inside it. That
            means if the roster gets tall the whole page (backdrop + modal)
            scrolls together, which is more robust than a nested flex-col
            with internal overflow-y-auto (that setup was collapsing the
            roster to a single row on some viewports because the middle
            child had no `flex-1 min-h-0`).
          */}
          <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
            <div
              className="w-full max-w-md rounded-2xl border border-line p-6 shadow-2xl"
              style={{ backgroundColor: "#111827" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 text-lg font-semibold text-white">
                Sign in as officer
              </div>
              <div className="mb-4 text-xs text-slate-400">
                Pick who is running the review. ESDD answers and taxonomy
                classifications you record will be attributed to this officer.
              </div>

              <div className="flex flex-col gap-2">
                {officers.map((o) => {
                  const isCurrent = currentOfficer?.id === o.id;
                  const isBusy = busyId === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => selectOfficer(o.id)}
                      disabled={isBusy}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        isCurrent
                          ? "border-white/20 bg-white/5"
                          : "border-line bg-panelAlt hover:border-white/20 hover:bg-white/5"
                      } disabled:opacity-50`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {o.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {ROLE_LABEL[o.role]}
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="text-xs text-slate-400">Current</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-4 text-xs">
                {currentOfficer && (
                  <button
                    type="button"
                    onClick={clearOfficer}
                    disabled={busyId === "__clear"}
                    className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  >
                    Sign out officer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-auto rounded-md border border-line bg-panelAlt px-3 py-1 text-slate-300 hover:bg-line/30"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
