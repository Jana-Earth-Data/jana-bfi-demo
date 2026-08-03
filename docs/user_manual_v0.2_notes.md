# User Manual v0.2 — Working Notes

Working notes captured while drafting `Jana_Financed_Emissions_Dashboard_User_Manual_Demo_v0.2_DRAFT.docx` (November 2026).

## Source files consulted

Read or grepped during the draft:

- `docs/STYLE_NOTES.md` — style rules for Willard's writing (no em dashes; formal-but-approachable register).
- `docs/Jana_Financed_Emissions_Dashboard_User_Manual_Demo_v0.1.pdf` (via `pdftotext` at `/tmp/user_manual.txt`) — v0.1 tone, structure, framing, and the sections that carry forward verbatim.
- `lib/tenants/registry.ts` — tenant display names (First Bank of Nepal default; Laxmi Sunrise Bank), officer rosters.
- `lib/tenants/types.ts` — role labels.
- `lib/regulatory/esdd/annex5-questions.ts` — verbatim Circular 22 ESDD questions, section counts (3 general + 5 EHS + 4 social = 12), loan-category taxonomy, and the 2022 climate addition Q2.5.
- `lib/regulatory/esdd/annex5b-pf-questions.ts` — 148 items across PS1-PS8 (confirmed by `grep -c 'id: "annex5b'`).
- `lib/regulatory/esdd/annex5b-pf-types.ts` — IFC PS titles, risk classes, answer scale.
- `lib/regulatory/esdd/annex5b-pf-scoring.ts` — implied risk-class thresholds (Low/Medium/High/Critical).
- `lib/regulatory/taxonomy/activities.ts` — 19 encoded taxonomy activities. (Spec brief said "17 encoded activities from NRB Oct 2024"; codebase has 19 defined activities — see judgment call below.)
- `lib/regulatory/taxonomy/types.ts`, `dnsh.ts`, `applicability.ts`, `gate.ts` — DNSH check list and taxonomy shape.
- `lib/regulatory/pcaf/scoring.ts` and `pcaf/types.ts` (via panel comments) — PCAF Option 1a/1b/2b/3a mapping and the four flag rows.
- `lib/regulatory/cap/library.ts` and `cap/types.ts` (via panel imports) — CAP statuses, covenant types, monitoring cadence by risk class.
- `lib/settings/types.ts` and `lib/settings/defaults.ts` (via schema imports) — full settings tree, "wired vs coming soon" split (only `esrm.remarksRequired.section1/2/3` is wired).
- `lib/tour/registry.ts` and `lib/tour/types.ts` — six tour scripts per tenant (dashboard, loan-officer, manager, pf-screening, pcaf, nfrs).
- `lib/tooltips/tooltips.ts` — data source citations still current (Climate TRACE v5.6 2024, EDGAR v8.1, GCCT July 2025).
- `components/bfi/header.tsx` — TOUR_LABELS map, header controls (tour selector, officer picker, settings gear, switch bank).
- `components/bfi/tabs/my-work-tab.tsx` — MyWork tab shape, `OfficerWorkQueue`, `FollowupsPanel`.
- `components/bfi/tabs/esrm-tab.tsx` — Manager tab (formerly ESRM Screening); `WorkbenchSubtabStrip` (five sub-tabs); escalation banner; overdue-CAP banner; assignment control; application queue collapse behaviour.
- `components/bfi/tabs/nfrs-tab.tsx` — NFRS tab (formerly NSRS); NRBSIS Green Statement panel; regulatory exports panel; disclosure preview; taxonomy breakdown; top contributors.
- `components/bfi/tabs/loans-tab.tsx`, `taxonomy-tab.tsx` — largely unchanged from v0.1.
- `components/bfi/esrm/officer-work-queue.tsx` — My loans / Available to claim split; auto-claim on Open click; loan card structure with ESDD, Taxonomy, PF screening, PCAF chips.
- `components/bfi/followups/followups-panel.tsx` — Overdue / This week / This month buckets; Circular 22 §7.3.5 + §7.3.7 authority.
- `components/bfi/esdd/wizard.tsx` — 5-step wizard structure, ownership lock, tour-driven step navigation.
- `components/bfi/taxonomy/wizard.tsx` — 4-step wizard (basics → activity → DNSH/criteria → review).
- `components/bfi/pf-screening/wizard.tsx` — 9-step wizard (PS1-PS8 + review), termination triggers, PfScreeningResult risk classes.
- `components/bfi/pcaf/pcaf-wizard.tsx` and `pcaf/availability-panel.tsx` — dedicated single-panel PCAF wizard; four flag rows; AUTO / OVERRIDE badges; PCAF citations.
- `components/bfi/cap/cap-panel.tsx` — CAP items, covenants (5 types), monitoring reports, compliance statuses.
- `components/bfi/shared/evidence-attachments.tsx` — 10 MB per file, multiple files per field, 6 entity types.
- `components/bfi/shared/loan-lock-context.tsx` and `locked-by-banner.tsx` — client-side lock context, rose banner wording ("Locked, owned by [name]. Ask the manager to reassign...").
- `components/bfi/settings/settings-page.tsx` — 9 settings categories, one wired, rest "Coming soon".
- `components/bfi/reports/nrbsis-green-statement-button.tsx` — Excel/PDF/JSON exports for Annex 4b, "Filed" badge.
- `components/bfi/reports/nrb-taxonomy-export-button.tsx` (referenced) — per-loan classification report as supporting evidence.
- `app/enter/page.tsx` — landing page and "Continue as First Bank of Nepal (demo)".
- `app/esdd/[loanId]`, `app/pcaf/[loanId]`, `app/taxonomy/[loanId]`, `app/pf-screening/[loanId]` — confirmed the four wizard routes exist as advertised.

## Judgment calls (with reasons)

1. **19 taxonomy activities, not 17.** The task brief said "17 encoded activities from NRB Oct 2024" but the file `lib/regulatory/taxonomy/activities.ts` currently has 19 `defineActivity` blocks. I described the taxonomy wizard as covering "the activities NRB spells out in the October 2024 taxonomy across the seventeen SIS sectors" and listed the activity families without pinning a specific count in the prose, so the number in the codebase can drift without invalidating the manual. Confirmed 17 remains the count of SIS sectors used in Annex 4b.

2. **Loan portfolio size stated as "tens of thousands" rather than "80,035".** The v0.1 figure of 80,035 loans was not found as a hardcoded constant in the current codebase (the mock generator computes it), and the numbers can drift between builds. Prose deliberately says "tens of thousands" so the manual does not go stale on the next mock-data change.

3. **Cover date set to "November 2026".** v0.1 was June 2026; five months of P25-P43 feature work slot cleanly after that. Willard can override this in the branded PDF pass if he prefers a different pub date.

4. **NFRS effective date stated as "to be determined".** The task brief explicitly asks to avoid implying a specific reporting cycle. Prose reads: "the effective reporting cycle is to be determined once the finalised standards are pronounced." (Contrast v0.1's now-inaccurate "2026 to 2027 reporting cycle.")

5. **Retail loan pools kept as a callout in Loan Book (Part 3), not moved to Glossary alone.** v0.1 places it as a callout in the same tab section; that's the right place for a bank user to encounter the concept, so I preserved it.

6. **PCAF Score 4 vs 3.** The four flag rows in the PCAF wizard produce scores 1, 2, 3, 4 respectively (per `FLAG_ROWS` in `availability-panel.tsx`). Score 5 (revenue-only using sector averages) is always-on as the fallback, so it is documented in the reference table (Part 11.4) but not exposed as a wizard toggle.

7. **Manager tab risk-class monitoring cadences.** Prose cites the CAP default cadence table (Extreme 1 mo / High 3 mo / Medium 6 mo / Low 12 mo) from `lib/regulatory/cap/library.ts`.

8. **Style — no em dashes.** `docs/STYLE_NOTES.md` mandates this for Willard's writing. Grep of the source script for `—` returns zero, so the compiled docx is clean.

9. **Wizard read-only behaviour attributed to the "loan lock".** The prose calls it that consistently, matching the code file name (`loan-lock-context.tsx`) and the banner wording ("Locked, owned by ..."). Manual uses "Ask the manager to reassign this loan" verbatim from the banner.

10. **Table of Contents via `TableOfContents` field.** docx-js emits the field; LibreOffice / Word will prompt to "update fields" when the docx is opened, which populates the TOC. The generated PDF preview (via `soffice --headless`) does NOT auto-update fields, so the exported PDF shows an empty Contents page. This is normal and does not affect the docx itself. In Willard's Word / LibreOffice review pass, opening the file and accepting the field update will populate the TOC.

## Content I could not verify from the codebase (approximations)

1. **"Five to eight minutes long" for guided tours.** Not in the tour registry directly; tour scripts contain per-step audio references but no total runtime constant. Estimate matches v0.1 phrasing ("intended for first-time orientation and for internal training sessions") and the typical audio length of the seeded tour scripts.

2. **"Six-monthly monitoring review" for Medium-risk loans (Part 4.4).** Sourced from `CapSettings.monitoringCadenceMonthsByRiskClass` default in `lib/settings/types.ts` comment (`Extreme=1 mo, High=3 mo, Medium=6 mo, Low=12 mo`). Kept the "six-monthly" phrasing in the risk classification table (Part 4.4) for readability; the same numbers reappear in Part 9.4.

3. **"Any signed-in officer can edit" (Settings).** From the settings-page.tsx docstring "Any signed-in officer can edit (no per-role gating for now per Willard's A/A choice)". Reproduced as-is.

4. **Officer role labels (loan_officer, esg_officer, compliance, credit_committee)** described in Part 1.2 header controls prose. Sourced from `types.ts` and consistent across every wizard's `ROLE_LABEL` map.

## Surfaces documented that are not fully wired yet

Called out explicitly so Willard can see the "real vs promised" split.

- **Settings, all categories except ESRM remarks-required per section**: My Work, Loan Book, Taxonomy (all three toggles), NFRS (all three toggles), CAP & Monitoring, Notifications, Bank. Each is labelled "Coming soon" in the Part 12 status table, matching the pill shown in the interface today. Values persist to the settings blob; the wiring to app behaviour is a follow-on.
- **"Recently closed" section on the My Work queue**: the code has this section but the source comment notes it is "stubbed; requires a loan-status change model to populate for real". Prose says "A Recently closed section appears below when there are loans approved, declined, or withdrawn in the last 30 days" without over-promising the population.
- **Climate-flag badge on the loan card (Circular 22 §4.3 above-threshold + no reduction target)**: shown in the source but depends on borrower record fields that are sparse in the demo. Prose says the badge "appears" when the conditions are met, without asserting how many loans will show it in the demonstration portfolio.

## Surfaces intentionally omitted from v0.2

- **`/admin` routes** (found in `app/admin`) — not user-facing; internal tooling.
- **`/keys-do-not-commit`, `tts.key`, `run_demo.sh`, `docker/`, `docker-compose.*`, `middleware.ts`, `tsconfig.*`, `next.config.ts`** — developer-facing files, out of scope per task brief.
- **The prebuilt v0.1 sections on "sanity check drawer" inside the Manager workbench** — the drawer still exists as legacy code but the primary sanity-check surface for cement borrowers now lives inline in the workbench Overview. v0.2 mentions the sector benchmark and national emissions share in Part 4.4 as the officer's independent-reference surface; the specific "Sanity Check drawer" name from v0.1 is not repeated to avoid confusion.
- **Detailed API endpoint documentation** (e.g. `/api/esdd/officer-queue`, `/api/followups`, `/api/pcaf/availability/[borrowerId]`) — bank users do not consume these directly.
- **Data source ingestion pipeline** — not user-facing.
- **Tour authoring / TTS pipeline** — not user-facing per task brief.

## Verification

- `pdftotext /tmp/user_manual.txt` compared against the drafted content to ensure v0.1 sections that carry forward are updated (First Bank of Nepal → "First Bank of Nepal by default, or Laxmi Sunrise Bank if the corresponding access code has been provided"; "NRB ESRM Guidelines (2018)" → "NRB Circular 22 (Second Edition, 2022)"; "NSRS" → "NFRS S1/S2"; "10 ESDD categories" → "12 questions across 3 sections"; "hydropower under 10 MW" → "all hydropower classified on lifecycle GHG"; "2026 to 2027 reporting cycle" → effective date TBD).
- Data source citations still current: Climate TRACE v5.6 2024, EDGAR v8.1, GCCT July 2025 — grep of `lib/tooltips/tooltips.ts` and `lib/regulatory/pcaf/scoring.ts` confirms.
- 148 items in Annex 5b — `grep -c 'id: "annex5b' lib/regulatory/esdd/annex5b-pf-questions.ts` returns 148.
- LibreOffice conversion to PDF via `python scripts/office/soffice.py --headless --convert-to pdf`: opens cleanly at 30 pages, US Letter, ~309 KB PDF (~38 KB docx). Cover, header/footer, tables all render as expected. Only caveat: the auto-generated Table of Contents is empty until Word / LibreOffice is instructed to update fields (see judgment call 10). This is standard docx-js behaviour.
