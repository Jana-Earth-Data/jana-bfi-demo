"use client";

/**
 * Client-side form for the reset admin page.
 *
 * Flow:
 *   1. Operator picks a tenant from the dropdown.
 *   2. UI shows the tenant's displayName and asks the operator to type it
 *      back exactly — the destructive button is disabled until the typed
 *      value equals the displayName (case-sensitive).
 *   3. Operator pastes the admin bearer token into a password field.
 *   4. Submit POSTs to /api/admin/reset with Authorization: Bearer <token>.
 *   5. Response counts render below the form on success, errors above.
 *
 * The bearer token lives only in component state and is never persisted.
 */

import { useMemo, useState } from "react";

export type ResetTenantSummary = {
  id: string;
  displayName: string;
  shortName: string;
};

type DeletedCounts = {
  esddResponses: number;
  taxonomyAssessments: number;
  esrmScreenings: number;
  loanAssignments: number;
  borrowerOverrides: number;
};

type ResetResponse = {
  ok: true;
  tenantId: string;
  deleted: DeletedCounts;
};

const COUNT_LABELS: Array<{ key: keyof DeletedCounts; label: string }> = [
  { key: "esddResponses", label: "ESDD responses" },
  { key: "taxonomyAssessments", label: "taxonomy assessments" },
  { key: "esrmScreenings", label: "ESRM screenings" },
  { key: "loanAssignments", label: "loan assignments" },
  { key: "borrowerOverrides", label: "borrower overrides" },
];

export function ResetForm({ tenants }: { tenants: ResetTenantSummary[] }) {
  const [tenantId, setTenantId] = useState<string>(tenants[0]?.id ?? "");
  const [typedName, setTypedName] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResponse | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) ?? null,
    [tenants, tenantId],
  );

  const nameMatches =
    !!selectedTenant && typedName === selectedTenant.displayName;
  const canSubmit = !!selectedTenant && nameMatches && token.length > 0 && !submitting;

  function onTenantChange(nextId: string) {
    setTenantId(nextId);
    setTypedName("");
    setResult(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTenant || !nameMatches || !token) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          confirmName: selectedTenant.displayName,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : `Server returned ${res.status}`,
        );
        return;
      }
      setResult(body as ResetResponse);
      // Clear the confirmation so the operator has to re-type to reset
      // again — prevents an accidental double-click resetting a second
      // (freshly-selected) tenant.
      setTypedName("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Tenant picker */}
      <div>
        <label
          htmlFor="tenant"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-300"
        >
          Tenant
        </label>
        <select
          id="tenant"
          value={tenantId}
          onChange={(e) => onTenantChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-slate-900 px-3 py-2 text-sm text-white focus:border-rose-500/60 focus:outline-none"
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName} ({t.id})
            </option>
          ))}
        </select>
      </div>

      {/* Confirmation input */}
      {selectedTenant && (
        <div>
          <label
            htmlFor="confirm-name"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-300"
          >
            Type the tenant name to confirm
          </label>
          <p className="mt-1 text-sm text-slate-400">
            Copy this exactly (case-sensitive):{" "}
            <span className="font-semibold text-rose-200">
              {selectedTenant.displayName}
            </span>
          </p>
          <input
            id="confirm-name"
            type="text"
            autoComplete="off"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={selectedTenant.displayName}
            className="mt-2 w-full rounded-md border border-line bg-slate-900 px-3 py-2 text-sm text-white focus:border-rose-500/60 focus:outline-none"
          />
          {typedName.length > 0 && !nameMatches && (
            <div className="mt-1 text-xs text-rose-300">
              Does not match. The reset button stays disabled until this
              equals the tenant name exactly.
            </div>
          )}
        </div>
      )}

      {/* Admin token */}
      <div>
        <label
          htmlFor="admin-token"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-300"
        >
          Admin bearer token
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste SEED_ADMIN_TOKEN"
          className="mt-1 w-full rounded-md border border-line bg-slate-900 px-3 py-2 text-sm text-white focus:border-rose-500/60 focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-500">
          Not stored — held only in this form&rsquo;s in-memory state.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
          <div className="font-semibold">
            Reset complete for tenant{" "}
            <span className="text-white">{result.tenantId}</span>.
          </div>
          <ul className="mt-2 space-y-0.5 text-emerald-100/90">
            {COUNT_LABELS.map(({ key, label }) => (
              <li key={key}>
                Deleted{" "}
                <span className="font-semibold text-white">
                  {result.deleted[key]}
                </span>{" "}
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md border border-rose-500/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Resetting…" : "Reset tenant data"}
        </button>
      </div>
    </form>
  );
}
