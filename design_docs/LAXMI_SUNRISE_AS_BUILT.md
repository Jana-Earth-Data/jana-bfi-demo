# Laxmi Sunrise Extension — As Built + Remaining Work

Status: **In flight.** Phase 1 done. Phase 2 partially done. Phases 3-8 pending.
Owner: Willard Mechem
Date: July 2026
Companion doc: `LAXMI_SUNRISE_EXTENSION_PLAN.md` (forward plan + locked decisions)

This document is a snapshot of what exists in the codebase today, with a
complete remaining-work list. It is intended to make the next work session
(or the next contributor) fully productive without having to re-read the
whole conversation history.

---

## 1. What exists today, at a glance

- **Multi-tenant runtime.** One deployment serves every bank. Visitors
  identify themselves via a short bank access code (or the "Continue as
  default" fallback). Tenant identity is stored in an HTTP-only cookie
  and drives branding + a `bank_id` scope on every captured Supabase row.
- **Two tenants registered.** `default` (First Bank of Nepal placeholder,
  Jana green palette) and `laxmi_sunrise` (real Laxmi Sunrise Bank orange
  palette, real logo asset). Adding a third tenant is a one-file edit.
- **Officer picker.** Each tenant carries a 4-person demo roster (loan
  officer / ESG officer / compliance / credit committee). The signed-in
  officer is stored in a cookie and stamped on every captured row.
- **NRB ESRM Annex 5 verbatim capture, Sections 1-3.** All 11 general +
  EHS + social risk questions transcribed verbatim from the source PDF
  with their four answer options and NRB guidance notes.
- **ESDD wizard.** Multi-step form at `/esdd/{loanId}` that walks the
  officer through the checklist, saves every answer immediately to
  Supabase, and can resume a partial checklist.
- **Scoring engine.** Aggregates a checklist into a per-section score,
  derives risk class + recommendation + escalation flag + plain-English
  rationale citing driving questions. Not yet surfaced in the review step.
- **Supabase capture schema.** Six new tables in production, all
  scoped by `bank_id` for multi-tenant isolation.
- **Tier 2 branding.** CSS-variable-based theming so the header logo,
  active tab underline, KPI accents, tour Play button, and other
  high-visibility surfaces repaint in the current tenant's brand color
  at runtime — no redeploy per bank.

Not yet built: Phase 2 sector supplements + review-step wiring,
Phase 3 ESRM save endpoint, Phase 4-8 in full.

---

## 2. File map

```
jana-bfi-demo/
├── design_docs/
│   ├── LAXMI_SUNRISE_EXTENSION_PLAN.md      Forward plan + locked decisions
│   └── LAXMI_SUNRISE_AS_BUILT.md            This document
│
├── lib/
│   ├── tenants/                              [NEW] tenant module
│   │   ├── types.ts                          TenantId, Officer, TenantConfig
│   │   ├── registry.ts                       default + laxmi_sunrise entries
│   │   ├── codes.ts                          Code normalisation + lookup
│   │   ├── resolve.ts                        Server-only cookie resolver
│   │   └── index.ts                          Public barrel
│   │
│   ├── officers/                             [NEW] officer identity module
│   │   └── resolve.ts                        Server-only cookie resolver
│   │
│   ├── regulatory/esdd/                      [NEW] regulatory data + logic
│   │   ├── annex5-questions.ts               NRB Annex 5 verbatim, Sections 1-3
│   │   └── scoring.ts                        Answer weights, section aggregate,
│   │                                         risk class derivation
│   │
│   ├── types/bfi.ts                          Extended BfiDemoMeta with
│   │                                         tenantId + tenantLogoPath
│   │
│   └── (existing) data/, api/, auth/, tour/  unchanged except where noted
│
├── app/
│   ├── page.tsx                              [MODIFIED] resolves tenant +
│   │                                         officer, wraps Dashboard in
│   │                                         TenantThemeProvider
│   ├── enter/
│   │   ├── page.tsx                          [NEW] bank access code entry
│   │   └── enter-form.tsx                    [NEW] client form
│   ├── esdd/[loanId]/
│   │   └── page.tsx                          [NEW] ESDD wizard route
│   └── api/
│       ├── tenant/set-code/route.ts          [NEW]
│       ├── tenant/clear/route.ts             [NEW]
│       ├── officer/set/route.ts              [NEW]
│       ├── officer/clear/route.ts            [NEW]
│       ├── esdd/responses/route.ts           [NEW] POST + GET
│       ├── admin/seed-officers/route.ts      [NEW]
│       └── dashboard-data/route.ts           [MODIFIED] enrich with
│                                             tenant + officer state
│
├── components/bfi/
│   ├── tenant-theme.tsx                      [NEW] CSS variable provider
│   ├── officer-picker.tsx                    [NEW] header pill + modal (portal)
│   ├── esdd/
│   │   └── wizard.tsx                        [NEW] multi-step wizard client
│   ├── header.tsx                            [MODIFIED] tenant logo, brand
│   │                                         colors, officer picker,
│   │                                         Switch bank button
│   ├── dashboard.tsx                         [MODIFIED] DashboardSsrData
│   │                                         extended with officers +
│   │                                         currentOfficer; brand-color sweep
│   ├── shared/primitives.tsx                 [MODIFIED] KpiCard, Badge,
│   │                                         ProgressBar brand-color sweep
│   ├── shared/loan-table.tsx                 [MODIFIED] Start ESDD button
│   ├── tour/tour-controls.tsx                [MODIFIED] brand-color sweep
│   └── tabs/loans-tab.tsx, taxonomy-tab.tsx  [MODIFIED] bankName from tenant
│
├── middleware.ts                             [NEW] gates on tenant cookie,
│                                             handles ?bank=CODE handoff
│
├── public/tenants/
│   └── laxmi_sunrise/logo.png                [NEW] Laxmi wordmark asset
│
└── scripts/
    └── supabase-capture-schema.sql           [NEW] 6 capture tables +
                                              RLS + seeded bank rows
```

`[NEW]` = created during this work stream. `[MODIFIED]` = edited from
pre-existing state.

---

## 3. Runtime architecture

### 3.1 Two cookies drive everything

| Cookie | Set by | Read by | Contains |
|---|---|---|---|
| `jana_demo_tenant` | `/enter` page (`?bank=CODE` server handler) or `POST /api/tenant/set-code` | Every SSR page + every capture API | Tenant id (e.g. `laxmi_sunrise`) |
| `jana_demo_officer` | `POST /api/officer/set` | Same | Officer id (e.g. `off-laxmi-01`) |

Both are HTTP-only, `SameSite=Strict`, 7-day TTL.

The officer cookie is validated against the CURRENT tenant's roster on
every resolution, so a Laxmi officer id survives only as long as the
tenant is Laxmi. Switching banks silently drops the officer.

### 3.2 SSR resolution chain

Every server component that renders bank-specific chrome runs:

```
const tenant = await resolveCurrentTenant();      // reads cookie, tenant registry
const officer = await resolveCurrentOfficer();    // reads cookie, validates against tenant
const data = await getBfiDemoData();               // in-memory synthesizer
data.meta = {
  ...data.meta,
  bankName: tenant.branding.displayName,           // override synthesizer default
  tenantId: tenant.id,
  tenantLogoPath: tenant.branding.logoPath,
};
const slice = await buildDashboardSlice(data, token);
const enriched = { ...slice, officers: tenant.demoOfficers, currentOfficer: officer };
return (
  <TenantThemeProvider tenant={tenant}>            // CSS variable provider
    <Dashboard data={enriched} />
  </TenantThemeProvider>
);
```

Two callers use this chain: `app/page.tsx` (dashboard SSR) and
`app/api/dashboard-data/route.ts` (client-refresh path for live enrichment).
`app/esdd/[loanId]/page.tsx` uses the same tenant + officer resolution but
renders the wizard instead.

### 3.3 Middleware

`middleware.ts`:

- URL carrying `?bank=CODE` (any path) → redirect to `/enter?bank=CODE`.
  The `/enter` server handler resolves the code, sets the cookie, and
  finally redirects to `/`.
- No tenant cookie + not on `/enter` → redirect to `/enter`.
- Cookie present → pass through.

Matcher skips `/api`, Next internals, `/tenants/`, `/audio/`,
`favicon.ico`, and `green_logo.png`.

### 3.4 Access-code lifecycle

- Codes live in the code registry (`lib/tenants/registry.ts`),
  `accessCodes: string[]` per tenant.
- Lookup is case-insensitive and whitespace-trimmed
  (`lib/tenants/codes.ts`).
- Rotating a code = editing the array on next deploy. No Supabase change.
  `bank_id` on captured rows is the tenant.id (stable), not the code.
- Current codes:
  - Default tenant: `[]` (fallback via the "Continue as default" button).
  - Laxmi Sunrise: `["LX-K7QN2P"]`.

### 3.5 Officer picker

- Portal-rendered modal to escape the header's `backdrop-blur` containing
  block (fixed positioning was clipping before we portalled to
  `document.body`).
- Modal is a single-scroll structure — backdrop is the scroll container,
  card flows naturally inside. This avoids the flexbox collapse issue we
  saw when the previous sticky-header/scrolling-roster structure
  compressed the roster to one row.
- Selecting an officer POSTs to `/api/officer/set`, which validates the
  officer belongs to the current tenant before setting the cookie.
  Cross-tenant officer ids are rejected with 403.

### 3.6 Brand theming (Tier 2)

- `TenantThemeProvider` (server component) emits five CSS custom
  properties on a wrapping element from the resolved TenantConfig:
  - `--brand-primary` (main hex from registry)
  - `--brand-primary-strong` (12% darker for hover)
  - `--brand-primary-soft` (15% alpha tint for tinted backgrounds)
  - `--brand-accent` (secondary hex)
  - `--brand-fg` (contrast text)
- Components consume via inline `style={{ color: "var(--brand-primary)" }}`
  or `className="bg-[color:var(--brand-primary)]"`.
- Placement is on a wrapper `div` with `className="contents"` so the
  wrapper does not affect layout; only the CSS variables inherit down the
  tree. No client-side flash of wrong color, because SSR emits the right
  values from the first paint.

Surfaces already brand-swept (high-visibility): header logo tile, header
"Live data" badge, header tour Play button, active tab underline,
"Loading live data" banner, KPI card accent value color, ProgressBar
default fill, tour Play button in the tour controls, tour progress
indicator active/done states, Start ESDD button in the loan drawer.

Surfaces still on Jana emerald (deferred): ESRM tab screening workbench,
taxonomy tab specific chart bars, NFRS tab selected-loan highlight, loan
table info-tip focus rings, login button. All of these are behind a
click or two from the landing dashboard, so not meeting-blockers.

---

## 4. Supabase schema

Six new tables, all with `bank_id` foreign key to `bfi_banks`, RLS
enabled, anon revoked, service_role granted. Schema file:
`scripts/supabase-capture-schema.sql`.

| Table | Purpose | Key columns |
|---|---|---|
| `bfi_banks` | Reference: registered tenants | `id`, `display_name`, `is_default` |
| `bfi_officers` | Officer roster per tenant | `id`, `bank_id`, `name`, `role`, `email` |
| `bfi_esdd_responses` | Captured Annex 5 answers | `bank_id`, `loan_id`, `borrower_id`, `officer_id`, `question_id`, `answer`, `remarks`, `captured_at` |
| `bfi_taxonomy_assessments` | Captured Green Finance Taxonomy classifications | `bank_id`, `loan_id`, `borrower_id`, `officer_id`, `activity_id`, `criterion_answers` (jsonb), `computed_color`, `computed_rationale`, `citation` |
| `bfi_esrm_screenings` | Final ESRM decision (from wizard review step) | `bank_id`, `loan_id`, `borrower_id`, `officer_id`, `computed_risk_class`, `computed_recommendation`, `escalation_flag`, `computed_rationale`, `esdd_snapshot` (jsonb) |
| `bfi_borrower_overrides` | Officer edits to borrower basics | `bank_id`, `borrower_id`, `officer_id`, `field_name`, `field_value` |

**ESDD responses are append-only.** Resubmitting a question inserts a
new row with a later `captured_at`; the "latest" row per
`(bank_id, loan_id, question_id)` is the current answer. The API path
already handles that; the wizard loads the latest set on mount.

Seeded rows after migration + `/api/admin/seed-officers`:
- 2 banks (`default`, `laxmi_sunrise`)
- 8 officers (4 per tenant)
- 0 responses, assessments, screenings, or overrides (populated as the
  demo is used).

---

## 5. NRB regulatory data captured

### 5.1 Annex 5 ESDD checklist

Verbatim from `NRB_ESRM_Guidelines_2018_Circular22.pdf` pages 30-38.
Stored in `lib/regulatory/esdd/annex5-questions.ts`.

- Basic Information block (7 fields).
- Section 1 — General Risk: 3 questions (1.1 legal, 1.2 stakeholder
  grievances, 1.3 sensitive areas).
- Section 2 — EHS Risks: 4 questions (2.1 air/noise, 2.2 water,
  2.3 land/waste, 2.4 energy efficiency / renewables).
- Section 3 — Social Risks: 4 questions (3.1 OHS, 3.2 labour conditions,
  3.3 community health & safety, 3.4 stakeholder consultation including
  indigenous people).
- **Total: 11 questions.** All four answer options (a/b/c/d) and NRB
  guidance notes transcribed for each.

### 5.2 Scoring model

`lib/regulatory/esdd/scoring.ts`.

- Answer weights: `a=0, b=1, c=3, d=null` (not applicable).
- Per-section aggregate: `answered`, `applicable`, `totalWeight`,
  `cCount`, `mean = totalWeight / applicable`.
- Overall derivation:

  | Condition | Risk class | Recommendation | Escalation |
  |---|---|---|---|
  | ≥3 'c' or max section mean ≥ 2.5 | extreme | approve-with-conditions | true |
  | ≥2 'c' or max section mean ≥ 2.0 | high | approve-with-conditions | true |
  | 0 'c' AND all sections mean ≤ 0.5 | low | approve | false |
  | Otherwise | medium | approve-with-conditions | false |

- Rationale is a plain-English sentence citing the c-answered question
  ids (e.g. `1.1, 2.3`) so a reviewer can trace back to the specific
  evidence failure.

### 5.3 Section 3 highlights (worth surfacing in a meeting)

- Q3.2 (labour) guidance explicitly says any evidence of child labor or
  forced labor is an automatic escalation regardless of other
  mitigation. The scoring engine already respects this because any 'c'
  answer flags escalation; but a demo talking-point.
- Q3.4 (stakeholder consultation) cites Nepal's 2007 ratification of ILO
  Convention 169 and expects FPIC documentation for projects on or near
  indigenous land.

---

## 6. ESDD wizard flow

Route: `/esdd/{loanId}` (e.g. `/esdd/L-0000123`).

- Server (`app/esdd/[loanId]/page.tsx`) resolves tenant + officer + loan
  + borrower. Redirects to `/?openOfficerPicker=1&returnTo=/esdd/<id>`
  if no officer signed in. Notfound if loan id unknown.
- Client (`components/bfi/esdd/wizard.tsx`) walks five steps:

  | Step | Purpose | State |
  |---|---|---|
  | 0. Basic Info | Prefilled from borrower + loan record | Complete |
  | 1. Section 1 (General Risk) | All 3 NRB questions with a/b/c/d + remarks | Complete |
  | 2. Section 2 (EHS Risks) | All 4 NRB questions | Complete |
  | 3. Section 3 (Social Risks) | All 4 NRB questions | Complete |
  | 4. Review + submit | Show risk class + recommendation, save `bfi_esrm_screenings` | **Placeholder — Phase 3** |

- Every answer POSTs to `/api/esdd/responses` immediately.
- Existing answers load on mount so navigation away and back is safe.
- Left-rail step indicator with brand-colored active/done state.
- Sticky top bar shows tenant name, borrower + loan id + sector,
  officer name + role, "Save & exit" button.

Entry point: **Start ESDD checklist** button on every loan drawer, in
brand color.

---

## 7. Remaining work (ordered)

### 7.1 Phase 2 completion

**Sector supplements to Annex 5** — Annex 2 (hydropower-specific due
diligence) and Annex 3 (sector-specific SME risks) still need to be
transcribed verbatim from the source PDF into
`lib/regulatory/esdd/annex5-questions.ts::ANNEX5_SECTOR_SUPPLEMENTS`.
The wizard already conditionally appends these via `fullChecklist(sectorSlug)`
so the data-side is the only work.

Sector supplement scope (per plan decision Q3, all sectors from day one):
- Hydropower (dam safety, downstream flow, fish passage, reservoir
  emissions, sediment management)
- Cement (kiln stack emissions, PM2.5 impact, quarry rehabilitation)
- Textiles (dyeing effluent, water use, forced labour risk)
- Steel (energy intensity, air emissions)
- Chemicals (hazardous material handling, groundwater contamination)
- Agriculture / processing (agrochemical use, wastewater)
- Brick kilns (traditional emissions, informal labour)

Reasonable time budget: **1 day of compliance extract + code**.

**Auto-open the officer picker after a redirect** — when the wizard
route redirects a visitor with no officer to `/?openOfficerPicker=1`,
the dashboard should open the picker modal automatically and, on
selection, hop back to the `returnTo` path. Small piece of client work
in `components/bfi/dashboard.tsx` reading `useSearchParams()`.

### 7.2 Phase 3 — ESRM automation (~2 days)

Wire the Review step to the scoring engine already written:

1. Compute `deriveEsrm(scoreBySection(responses, sectionLookup))` from
   the loaded responses.
2. Render the derivation: risk class chip, recommendation, rationale,
   list of driving question ids with links back to each question card.
3. "Save final ESRM screening" button → POST to a new
   `/api/esrm/screenings` endpoint that:
   - Reads the current tenant + officer.
   - Snapshots the latest per-question response set into
     `esdd_snapshot` (jsonb).
   - Inserts one row into `bfi_esrm_screenings` with the computed fields.
4. Post-save: navigate to a read-only screening summary page (or back to
   the ESRM tab with the loan in the application queue updated).
5. Surface the escalation flag prominently — a top banner if
   `escalationFlag = true` with "Escalated to credit committee per NRB
   ESRM guidance."

### 7.3 Phase 4 — Taxonomy wizard (~4 days)

Structurally parallel to the ESDD wizard.

1. Extract the NRB Green Finance Taxonomy Oct 2024 activities +
   criteria into `lib/regulatory/taxonomy/activities.ts` +
   `criteria.ts`. This is the big work item — the source PDF is 153
   pages and every activity has an eligibility criterion tree.
2. New route `/taxonomy/{loanId}` with a wizard that:
   - Step 0: Select activity type from the NRB catalog.
   - Step 1-N: Answer activity-specific eligibility criteria
     (yes/no + numeric thresholds).
   - Step Review: Show computed color + citation to NRB clause +
     rationale.
3. POST answers to `/api/taxonomy/assessments`, which writes to
   `bfi_taxonomy_assessments`.
4. Entry point: "Classify against NRB Taxonomy" button in the loan
   drawer, sibling to "Start ESDD checklist".

### 7.4 Phase 5 — Taxonomy classification engine (~2 days)

`lib/regulatory/taxonomy/classification-engine.ts`. Decision-tree
walker keyed to activity + criterion answers. Returns:

```
{
  color: "green" | "amber" | "red" | "unclassified",
  rationale: string,       // plain English
  citation: string,        // e.g. "NRB Oct 2024, §3.4.1a"
  criterionAnswers: object // audit trail of the inputs
}
```

Replaces the current heuristic `taxonomyForLoan()` in `portfolio.ts` for
loans that have a saved taxonomy assessment. Loans without an assessment
continue to render the synthesizer's default color, but with a subtle
"assessed heuristically" tag so the user knows.

### 7.5 Phase 6 — Taxonomy fidelity to NRB reporting requirements (~3 days)

Currently the Taxonomy tab renders color-only aggregates. Full NRB
fidelity per Oct 2024 doc, Section 4 (reporting):

1. **NRB submission export** — a "Generate NRB submission" action on the
   Taxonomy tab that formats the portfolio into the exact NRB quarterly
   reporting template.
2. **Criterion-level drill-down** — show the split within the green
   bucket by activity + specific criterion (e.g. green from §3.4.1a vs
   §3.4.1b). Requires the Phase 4 activity catalog + Phase 5 engine.
3. **DNSH (Do No Significant Harm) tracking** — NRB requires DNSH
   checks alongside primary color assessment. Add DNSH questions to the
   taxonomy wizard, store answers alongside `criterion_answers`, and
   surface DNSH failures on the Taxonomy tab.
4. **Transitional flagging** — NRB flags certain activities as
   transitional (amber-with-conditions). Add a filter on the Taxonomy
   tab and mark transitional rows visually.

### 7.6 Phase 7 — Multi-tenant reset (~1 day)

1. `POST /api/admin/reset?token=<SEED_ADMIN_TOKEN>&bank_id=<id>` —
   deletes from `bfi_esdd_responses`, `bfi_taxonomy_assessments`,
   `bfi_esrm_screenings`, `bfi_borrower_overrides` WHERE
   `bank_id = <id>`. Leaves `bfi_loans_denorm`, `bfi_banks`,
   `bfi_officers` intact.
2. `/demo-admin` page with a token-gated "Reset demo data" button per
   tenant. Useful for back-to-back meetings.

### 7.7 Phase 8 — Testing / polish (~2 days, closest to meeting)

1. End-to-end walkthrough with Willard on both tenants.
2. Tour narration re-recording: current `data/tour-script.json` audio
   references "First Bank of Nepal" throughout, which sounds wrong on
   the Laxmi tenant. Options: (a) re-record per tenant, (b) rewrite
   narration to avoid the bank name.
3. Lower-visibility brand sweep (ESRM screening workbench colors, NFRS
   selected-row highlight, taxonomy chart accents, info-tip focus rings,
   login button).
4. Escalation banner UX polish (Phase 3 output).
5. Meeting-ready walkthroughs documented for Laxmi + generic pitch.

---

## 8. Test flow (current state)

**Prereqs:**

- Supabase migration `scripts/supabase-capture-schema.sql` applied.
- `POST /api/admin/seed-officers?token=...` run once to seed
  `bfi_officers`.

**Steps:**

```
cd repos/jana-bfi-demo
docker compose up -d --build
```

Then:

1. `http://localhost:3001/?bank=LX-K7QN2P` — should land on the
   dashboard with Laxmi Sunrise Bank name, Laxmi orange throughout the
   high-visibility surfaces, real Laxmi logo in the header.
2. Header → "Choose officer" → pick Sujata Adhikari (Loan officer).
3. Loan Book tab → click any commercial loan → drawer opens → click
   "Start ESDD checklist".
4. Wizard opens on Step 0 with borrower basics prefilled. Continue.
5. Answer 1.1 with 'c', add a remarks note. See "Saved [timestamp]".
6. Continue through 1.2, 1.3, then Section 2, then Section 3.
7. Reach the review step placeholder.
8. Refresh the page mid-wizard — answers reload.
9. Header → Switch bank → land back on `/enter` — enter no code and
   click "Continue as First Bank of Nepal (demo)" — Jana green
   everywhere, First Bank of Nepal in the header.

---

## 9. Open decisions and follow-ups

- **Tour narration.** Re-record vs. rewrite? Blocker on the Laxmi
  meeting demo tour. Recommend rewrite to avoid bank name (works for
  all tenants forever).
- **Real bank data seeding.** Per plan decision Q4, no Laxmi loan
  sample assumed. If Laxmi shares an anonymized sample, we would seed a
  Laxmi-scoped extension of `bfi_loans_denorm`. Deferred.
- **Officer roles as filters.** Currently roles are display-only. If
  compliance workflows require role-based gating (e.g. only credit
  committee can save the final screening), Phase 3 or Phase 8 would
  add that.
- **Escalation review workflow.** Phase 3 sets an escalation flag on
  saved screenings, but no follow-up UI (queue for the credit
  committee, notification, etc.). Deferred; likely a Phase 2.5 of the
  broader engagement.

---

## 10. Cost tally

| Bucket | Delivered so far | Remaining estimate |
|---|---|---|
| Phase 1 foundation | ~2 days | 0 (done) |
| Phase 2 ESDD wizard | ~3 of 4 days | ~1 day |
| Phase 3 ESRM automation | 0 | ~2 days |
| Phase 4 Taxonomy wizard | 0 | ~4 days |
| Phase 5 Taxonomy engine | 0 | ~2 days |
| Phase 6 Taxonomy fidelity | 0 | ~3 days |
| Phase 7 Reset endpoint | 0 | ~1 day |
| Phase 8 Testing / polish | 0 | ~2 days |
| **Tier 2 branding (parallel)** | ~1.5 days (high-visibility surfaces) | ~0.5 day (lower-visibility sweep) |
| **Total** | **~6.5 days** | **~15.5 days** |

Original plan estimated ~20 days; this tracks within about 10% of that.

---

*Doc lives at `repos/jana-bfi-demo/design_docs/LAXMI_SUNRISE_AS_BUILT.md`.*
*Update when: a phase completes, a new file is added under `lib/regulatory/`, or an architectural decision changes.*
