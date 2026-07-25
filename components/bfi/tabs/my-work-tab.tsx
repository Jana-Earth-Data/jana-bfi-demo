"use client";

/**
 * "My work" tab — the personal officer view.
 *
 * Renders the OfficerWorkQueue full-width for the signed-in officer.
 * When no officer is signed in, shows a friendly sign-in prompt with a
 * button that opens the officer picker in the header.
 *
 * This tab replaces the small OfficerWorkQueue panel that used to live
 * on the ESRM tab, so the ESRM tab can be a pure manager view.
 */

import { DashboardSsrData } from "@/components/bfi/dashboard";
import { OfficerWorkQueue } from "@/components/bfi/esrm/officer-work-queue";

export function MyWorkTab({ data }: { data: DashboardSsrData }) {
  const officer = data.currentOfficer;

  if (!officer) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-line bg-panel p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Your ESRM queue
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Sign in as an officer to see your work
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              This view shows the loans assigned to you, ESDD checklists
              you have in progress, and screenings you have completed.
              Pick an officer from the header menu to begin.
            </p>
            <div className="mt-6 text-xs text-slate-500">
              Officers on this tenant:{" "}
              <span className="text-slate-300">
                {data.officers.length > 0
                  ? data.officers.map((o) => o.name).join(", ")
                  : "no officers seeded yet"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <OfficerWorkQueue currentOfficer={officer} />
    </div>
  );
}
