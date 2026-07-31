"use client";

/**
 * SettingsPage — tenant-level settings UI backed by /api/settings.
 *
 * Left rail: category nav (mirrors the dashboard tab structure plus
 * cross-cutting "CAP & Monitoring" and "Notifications" + "Bank").
 * Right pane: form controls for the selected category.
 *
 * Any signed-in officer can edit (no per-role gating for now per
 * Willard's A/A choice). Save-button hits POST /api/settings with a
 * partial payload; the API deep-merges it over the saved blob.
 *
 * Every setting except esrm.remarksRequired.section1/2/3 renders a
 * "Coming soon" pill — the value still persists, the wiring to app
 * behaviour is landing in future PRs.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  TenantSettings,
  EscalationTrigger,
  AutoAssignment,
  NprDisplayFormat,
  FiscalYearMode,
  EsrmGateMode,
  ReportingFrequency,
  EmailDigestCadence,
} from "@/lib/settings/types";
import { SETTINGS_CATEGORIES } from "@/lib/settings/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

type Props = {
  tenantId: string;
  tenantDisplayName: string;
  tenantLogoPath: string | null | undefined;
  officerName: string;
};

type CategoryKey = (typeof SETTINGS_CATEGORIES)[number]["key"];

export function SettingsPage({
  tenantDisplayName,
  officerName,
}: Props) {
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<TenantSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>("esrm");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          const s = (body?.settings as TenantSettings) ?? DEFAULT_SETTINGS;
          setSettings(s);
          setSavedSettings(s);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        setSavedSettings(settings);
        setToast("Settings saved");
        setTimeout(() => setToast(null), 2500);
      } else {
        const body = await res.json().catch(() => ({}));
        setToast(`Save failed: ${body?.error ?? res.status}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      setToast(`Save failed: ${(e as Error).message}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  // Small setter helpers so category panels can be terse.
  const updateEsrm = (patch: Partial<TenantSettings["esrm"]>) =>
    setSettings((s) => ({ ...s, esrm: { ...s.esrm, ...patch } }));
  const updateLoanBook = (patch: Partial<TenantSettings["loanBook"]>) =>
    setSettings((s) => ({ ...s, loanBook: { ...s.loanBook, ...patch } }));
  const updateTaxonomy = (patch: Partial<TenantSettings["taxonomy"]>) =>
    setSettings((s) => ({ ...s, taxonomy: { ...s.taxonomy, ...patch } }));
  const updateNfrs = (patch: Partial<TenantSettings["nfrs"]>) =>
    setSettings((s) => ({ ...s, nfrs: { ...s.nfrs, ...patch } }));
  const updateCap = (patch: Partial<TenantSettings["cap"]>) =>
    setSettings((s) => ({ ...s, cap: { ...s.cap, ...patch } }));
  const updateNotifications = (
    patch: Partial<TenantSettings["notifications"]>,
  ) =>
    setSettings((s) => ({
      ...s,
      notifications: { ...s.notifications, ...patch },
    }));
  const updateBank = (patch: Partial<TenantSettings["bank"]>) =>
    setSettings((s) => ({ ...s, bank: { ...s.bank, ...patch } }));

  return (
    <div className="min-h-screen bg-surface text-slate-100">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {tenantDisplayName} — Settings
            </div>
            <div className="text-base font-semibold text-white">
              Configuration
            </div>
            <div className="text-xs text-slate-400">
              Signed in as {officerName} · any signed-in officer can edit
            </div>
          </div>
          <div className="flex items-center gap-3">
            {toast && (
              <div
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200"
                role="status"
              >
                {toast}
              </div>
            )}
            <Link
              href="/"
              className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-slate-300 hover:bg-line/30"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-40"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 p-6">
        <aside className="w-56 shrink-0">
          <ol className="flex flex-col gap-1">
            {SETTINGS_CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => setCategory(c.key as CategoryKey)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${
                      active
                        ? "border-white/20 bg-white/5"
                        : "border-line bg-panel/40 hover:bg-white/5"
                    }`}
                    style={
                      active
                        ? { borderColor: "var(--brand-primary)" }
                        : undefined
                    }
                  >
                    <div className="text-sm font-semibold text-white">
                      {c.label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {c.description}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="flex-1">
          {loading ? (
            <div className="rounded-2xl border border-line bg-panel p-6 text-sm text-slate-400">
              Loading settings…
            </div>
          ) : (
            <>
              {category === "mywork" && <MyWorkPanel />}
              {category === "esrm" && (
                <EsrmPanel
                  esrm={settings.esrm}
                  onChange={updateEsrm}
                />
              )}
              {category === "loanBook" && (
                <LoanBookPanel
                  loanBook={settings.loanBook}
                  onChange={updateLoanBook}
                />
              )}
              {category === "taxonomy" && (
                <TaxonomyPanel
                  taxonomy={settings.taxonomy}
                  onChange={updateTaxonomy}
                />
              )}
              {category === "nfrs" && (
                <NfrsPanel
                  nfrs={settings.nfrs}
                  onChange={updateNfrs}
                />
              )}
              {category === "cap" && (
                <CapPanel
                  cap={settings.cap}
                  onChange={updateCap}
                />
              )}
              {category === "notifications" && (
                <NotificationsPanel
                  notifications={settings.notifications}
                  onChange={updateNotifications}
                />
              )}
              {category === "bank" && (
                <BankPanel
                  bank={settings.bank}
                  onChange={updateBank}
                  registryDisplayName={tenantDisplayName}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared micro-components
// ---------------------------------------------------------------------------

function ComingSoon() {
  return (
    <span
      className="ml-2 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
      title="Value persists; wiring to app behaviour lands in a follow-up commit"
    >
      Coming soon
    </span>
  );
}

function Row({
  label,
  hint,
  comingSoon,
  children,
}: {
  label: string;
  hint?: string;
  comingSoon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line py-4 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-semibold text-white">
          {label}
          {comingSoon && <ComingSoon />}
        </label>
        <div className="flex-shrink-0">{children}</div>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        value ? "bg-emerald-500" : "bg-slate-600"
      } disabled:opacity-40`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          value ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-md border border-line bg-panelAlt px-2 py-1 text-sm text-slate-100 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-md border border-line bg-panelAlt px-2 py-1 text-right text-sm text-slate-100 focus:outline-none"
      />
      {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-category panels
// ---------------------------------------------------------------------------

function MyWorkPanel() {
  return (
    <Panel
      title="My Work"
      subtitle="How your officer queue routes and reminds. Settings for the officer-facing queue live under ESRM (escalation rules), CAP & Monitoring (follow-up cadence), and Notifications (email / SMS / push)."
    >
      <p className="text-sm text-slate-400">
        Nothing to configure here directly — see the neighbouring
        categories.
      </p>
    </Panel>
  );
}

function EsrmPanel({
  esrm,
  onChange,
}: {
  esrm: TenantSettings["esrm"];
  onChange: (patch: Partial<TenantSettings["esrm"]>) => void;
}) {
  return (
    <Panel
      title="ESRM"
      subtitle="Circular 22 checklist behaviour + escalation rules. NRB source citations shown per row."
    >
      <Row
        label="Remarks required · Section 1 (General Risk)"
        hint="NRB Circular 22 Annex 5 has a Remarks column but leaves it optional. Turn on to require remarks on every answered Section 1 question before advance."
      >
        <Toggle
          value={esrm.remarksRequired.section1}
          onChange={(v) =>
            onChange({
              remarksRequired: { ...esrm.remarksRequired, section1: v },
            })
          }
        />
      </Row>
      <Row
        label="Remarks required · Section 2 (Environmental H&S)"
        hint="Same as above, applied to Section 2 questions incl. Q2.5 climate risks."
      >
        <Toggle
          value={esrm.remarksRequired.section2}
          onChange={(v) =>
            onChange({
              remarksRequired: { ...esrm.remarksRequired, section2: v },
            })
          }
        />
      </Row>
      <Row
        label="Remarks required · Section 3 (Social Risks)"
        hint="Section 3 hosts the labour + community H&S questions that most often drive escalation. Laxmi requires remarks here."
      >
        <Toggle
          value={esrm.remarksRequired.section3}
          onChange={(v) =>
            onChange({
              remarksRequired: { ...esrm.remarksRequired, section3: v },
            })
          }
        />
      </Row>
      <Row
        label="Escalation trigger"
        hint='NRB Circular 22 §7.3.5: "any unmitigated concern". Default "any-c" maps that verbatim.'
        comingSoon
      >
        <Select<EscalationTrigger>
          value={esrm.escalationTrigger}
          onChange={(v) => onChange({ escalationTrigger: v })}
          options={[
            { value: "any-c", label: "Any 'c' answer" },
            { value: "two-c", label: "Two or more 'c' answers" },
            { value: "section3-only", label: "Only 'c' in Section 3" },
          ]}
        />
      </Row>
      <Row
        label="Q2.5 (climate risks) required"
        hint="Q2.5 was added by the 2022 ESRM update. Off by default — banks phasing it in can leave it optional."
        comingSoon
      >
        <Toggle
          value={esrm.q25Required}
          onChange={(v) => onChange({ q25Required: v })}
        />
      </Row>
      <Row
        label="Auto-assignment"
        hint="How the officer queue treats unassigned loans."
        comingSoon
      >
        <Select<AutoAssignment>
          value={esrm.autoAssignment}
          onChange={(v) => onChange({ autoAssignment: v })}
          options={[
            {
              value: "unassigned-in-all-queues",
              label: "Unassigned in all queues",
            },
            { value: "round-robin", label: "Round-robin" },
            { value: "manual-only", label: "Manual only" },
          ]}
        />
      </Row>
    </Panel>
  );
}

function LoanBookPanel({
  loanBook,
  onChange,
}: {
  loanBook: TenantSettings["loanBook"];
  onChange: (patch: Partial<TenantSettings["loanBook"]>) => void;
}) {
  return (
    <Panel
      title="Loan Book"
      subtitle="Number formatting + fiscal year for the loan browser."
    >
      <Row
        label="NPR display format"
        hint="Nepal often uses crore for large sums. Filings to NRB use plain NPR."
        comingSoon
      >
        <Select<NprDisplayFormat>
          value={loanBook.nprDisplayFormat}
          onChange={(v) => onChange({ nprDisplayFormat: v })}
          options={[
            { value: "plain", label: "NPR (plain)" },
            { value: "millions", label: "NPR millions" },
            { value: "crores", label: "NPR crores" },
          ]}
        />
      </Row>
      <Row
        label="Fiscal year"
        hint="Nepal fiscal year is Shrawan–Ashad, mid-July to mid-July."
        comingSoon
      >
        <Select<FiscalYearMode>
          value={loanBook.fiscalYear}
          onChange={(v) => onChange({ fiscalYear: v })}
          options={[
            { value: "calendar-jan-dec", label: "Calendar (Jan–Dec)" },
            {
              value: "nepal-fiscal-mid-jul",
              label: "Nepal fiscal (mid-Jul to mid-Jul)",
            },
          ]}
        />
      </Row>
    </Panel>
  );
}

function TaxonomyPanel({
  taxonomy,
  onChange,
}: {
  taxonomy: TenantSettings["taxonomy"];
  onChange: (patch: Partial<TenantSettings["taxonomy"]>) => void;
}) {
  return (
    <Panel
      title="Taxonomy"
      subtitle="Green Finance Taxonomy gates + activity visibility."
    >
      <Row
        label="ESRM-before-Taxonomy gate"
        hint="NRB GFT §3.2.2 requires ESRM completion before taxonomy classification. Hard-enforce (default) blocks the wizard; warn-and-allow lets the officer proceed with a banner."
        comingSoon
      >
        <Select<EsrmGateMode>
          value={taxonomy.esrmGateMode}
          onChange={(v) => onChange({ esrmGateMode: v })}
          options={[
            { value: "hard-enforce", label: "Hard-enforce (default)" },
            { value: "warn-and-allow", label: "Warn and allow" },
          ]}
        />
      </Row>
      <Row
        label="Hidden activity IDs"
        hint="Comma-separated list of taxonomy activity ids to hide from the classification picker."
        comingSoon
      >
        <input
          type="text"
          value={taxonomy.hiddenActivityIds.join(", ")}
          onChange={(e) =>
            onChange({
              hiddenActivityIds: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="e.g. fossil-generation, brick"
          className="w-72 rounded-md border border-line bg-panelAlt px-2 py-1 text-sm text-slate-100 focus:outline-none"
        />
      </Row>
      <Row
        label="Missing classification escalates to manager"
        hint="When a loan lacks a taxonomy classification, escalate to the manager review lane rather than leave it in the officer's queue."
        comingSoon
      >
        <Toggle
          value={taxonomy.missingClassificationEscalatesToManager}
          onChange={(v) =>
            onChange({ missingClassificationEscalatesToManager: v })
          }
        />
      </Row>
    </Panel>
  );
}

function NfrsPanel({
  nfrs,
  onChange,
}: {
  nfrs: TenantSettings["nfrs"];
  onChange: (patch: Partial<TenantSettings["nfrs"]>) => void;
}) {
  return (
    <Panel
      title="NFRS"
      subtitle="Disclosure aggregate + PCAF sign-off."
    >
      <Row
        label="PCAF dual sign-off"
        hint="Require both an ESG officer and a compliance countersign before a PCAF score change is considered final."
        comingSoon
      >
        <Toggle
          value={nfrs.pcafDualSignoff}
          onChange={(v) => onChange({ pcafDualSignoff: v })}
        />
      </Row>
      <Row
        label="Reporting frequency"
        hint="How often the bank produces the NFRS disclosure aggregate. NFRS S1/S2 exposure drafts assume annual."
        comingSoon
      >
        <Select<ReportingFrequency>
          value={nfrs.reportingFrequency}
          onChange={(v) => onChange({ reportingFrequency: v })}
          options={[
            { value: "annual", label: "Annual (default)" },
            { value: "semi-annual", label: "Semi-annual" },
            { value: "quarterly", label: "Quarterly" },
          ]}
        />
      </Row>
      <Row
        label="Include unclassified in aggregate"
        hint="When true, exposures classified 'unclassified' still count in the disclosure headline. When false, they're reported separately."
        comingSoon
      >
        <Toggle
          value={nfrs.includeUnclassifiedInAggregate}
          onChange={(v) => onChange({ includeUnclassifiedInAggregate: v })}
        />
      </Row>
    </Panel>
  );
}

function CapPanel({
  cap,
  onChange,
}: {
  cap: TenantSettings["cap"];
  onChange: (patch: Partial<TenantSettings["cap"]>) => void;
}) {
  const cadence = cap.monitoringCadenceMonthsByRiskClass;
  const updateCadence = (
    band: keyof typeof cadence,
    v: number,
  ) =>
    onChange({
      monitoringCadenceMonthsByRiskClass: { ...cadence, [band]: v },
    });

  return (
    <Panel
      title="CAP & Monitoring"
      subtitle="NRB Circular 22 §7.3.5 (CAP deadlines) + §7.3.7 (periodic monitoring)."
    >
      <Row
        label="Monitoring cadence · Extreme"
        hint="Months between monitoring reports for extreme-risk loans."
        comingSoon
      >
        <NumberField
          value={cadence.extreme}
          onChange={(v) => updateCadence("extreme", v)}
          min={1}
          max={24}
          suffix="months"
        />
      </Row>
      <Row
        label="Monitoring cadence · High"
        comingSoon
      >
        <NumberField
          value={cadence.high}
          onChange={(v) => updateCadence("high", v)}
          min={1}
          max={24}
          suffix="months"
        />
      </Row>
      <Row
        label="Monitoring cadence · Medium"
        comingSoon
      >
        <NumberField
          value={cadence.medium}
          onChange={(v) => updateCadence("medium", v)}
          min={1}
          max={24}
          suffix="months"
        />
      </Row>
      <Row
        label="Monitoring cadence · Low"
        comingSoon
      >
        <NumberField
          value={cadence.low}
          onChange={(v) => updateCadence("low", v)}
          min={1}
          max={24}
          suffix="months"
        />
      </Row>
      <Row
        label="CAP overdue grace period"
        hint="Days past the deadline before a CAP item is flagged as overdue in the UI. 0 = strict."
        comingSoon
      >
        <NumberField
          value={cap.overdueGraceDays}
          onChange={(v) => onChange({ overdueGraceDays: v })}
          min={0}
          max={30}
          suffix="days"
        />
      </Row>
    </Panel>
  );
}

function NotificationsPanel({
  notifications,
  onChange,
}: {
  notifications: TenantSettings["notifications"];
  onChange: (patch: Partial<TenantSettings["notifications"]>) => void;
}) {
  return (
    <Panel
      title="Notifications"
      subtitle="Email · SMS · push · digest cadence. Delivery pipes land in a follow-up commit."
    >
      <Row label="Email" comingSoon>
        <Toggle
          value={notifications.emailEnabled}
          onChange={(v) => onChange({ emailEnabled: v })}
        />
      </Row>
      <Row label="SMS" comingSoon>
        <Toggle
          value={notifications.smsEnabled}
          onChange={(v) => onChange({ smsEnabled: v })}
        />
      </Row>
      <Row label="Web-push" comingSoon>
        <Toggle
          value={notifications.pushEnabled}
          onChange={(v) => onChange({ pushEnabled: v })}
        />
      </Row>
      <Row
        label="Email digest cadence"
        hint="Off (individual reminders) · daily · weekly digest."
        comingSoon
      >
        <Select<EmailDigestCadence>
          value={notifications.emailDigestCadence}
          onChange={(v) => onChange({ emailDigestCadence: v })}
          options={[
            { value: "off", label: "Off" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ]}
        />
      </Row>
    </Panel>
  );
}

function BankPanel({
  bank,
  onChange,
  registryDisplayName,
}: {
  bank: TenantSettings["bank"];
  onChange: (patch: Partial<TenantSettings["bank"]>) => void;
  registryDisplayName: string;
}) {
  return (
    <Panel
      title="Bank"
      subtitle="Display name override. Full branding editor (logo, colours) lands in a follow-up."
    >
      <Row
        label="Display name override"
        hint={`Registry value: "${registryDisplayName}". Leave blank to use the registry name.`}
        comingSoon
      >
        <input
          type="text"
          value={bank.displayNameOverride ?? ""}
          onChange={(e) =>
            onChange({
              displayNameOverride: e.target.value.trim() || null,
            })
          }
          placeholder={registryDisplayName}
          className="w-72 rounded-md border border-line bg-panelAlt px-2 py-1 text-sm text-slate-100 focus:outline-none"
        />
      </Row>
    </Panel>
  );
}
