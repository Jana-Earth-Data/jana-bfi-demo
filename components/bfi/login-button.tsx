"use client";

import { useAuth } from "@/lib/auth/auth-context";

export function LoginButton() {
  const { auth, startLogin, cancelLogin, logout } = useAuth();

  if (auth.status === "authenticated") {
    return (
      <button
        onClick={logout}
        className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs text-green-200 transition hover:bg-green-500/20"
      >
        Live data - Sign out
      </button>
    );
  }

  if (auth.status === "pending") {
    const url =
      auth.deviceCode.verification_uri_complete ??
      auth.deviceCode.verification_uri;

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent">
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Waiting for approval...
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent underline underline-offset-2 hover:text-white"
          >
            Open login page
          </a>
        )}
        <button
          onClick={cancelLogin}
          className="text-xs text-slate-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startLogin}
      className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs text-accent transition hover:bg-accent/20"
    >
      Sign in for live data
    </button>
  );
}
