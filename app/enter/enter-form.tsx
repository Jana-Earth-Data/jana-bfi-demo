"use client";

/**
 * Bank access-code entry form.
 *
 * Client component. Posts to /api/tenant/set-code with either the entered
 * code or an empty string (for the "continue as default" path). On success
 * the server sets the cookie and we navigate to /.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EnterForm({ defaultBankLabel }: { defaultBankLabel: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCode(codeToSubmit: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/set-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: codeToSubmit }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Server returned ${res.status}`);
        return;
      }
      // Cookie is set by the server. Navigate to the dashboard.
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submitCode(code);
      }}
    >
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-slate-300">Bank access code</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. XX-XXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          className="rounded-md border border-slate-600 bg-slate-800/70 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
      </label>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        title="Landing page uses the neutral Jana palette; brand paint kicks in once the code resolves the tenant."
      >
        {submitting ? "Signing in…" : "Continue"}
      </button>

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <div className="h-px flex-1 bg-slate-700" />
        <span>or</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => submitCode("")}
        className="rounded-md border border-slate-600 bg-slate-800/40 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-400 hover:bg-slate-800/70 disabled:opacity-50"
      >
        Continue as {defaultBankLabel} (demo)
      </button>
    </form>
  );
}
