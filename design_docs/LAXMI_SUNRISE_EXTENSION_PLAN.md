# Laxmi Sunrise BFI Demo Extension — Plan

Status: **Locked. In execution.**
Owner: Willard Mechem
Date: July 2026
Requesting bank: Laxmi Sunrise Bank

---

## 0. Decisions locked (July 2026)

| Decision | Choice |
|---|---|
| Extend vs. fork | **Extend the existing demo.** Tenant-configurable branding, single codebase. |
| Officer identity (Q1) | **Picker-based.** "Log in as Riya (loan officer)" style. No SSO for the demo. |
| Officer edits to borrower basics (Q2) | **Allowed.** Overrides captured at the loan level and logged as officer-provided corrections. |
| Sector-specific ESDD supplements (Q3) | **All sectors from day one.** Not a phased subset. |
| Laxmi-supplied loan book (Q4) | **None assumed.** Render the shared 80K synthesized book under the Laxmi tenant. Anticipate later seeding if Laxmi shares an anonymized sample. |
| Timeline (Q5) | **ASAP. All 8 phases in scope.** No cut-down MVP slice. |

Execution kickoff: this session (Phase 1 + Phase 2 begin in parallel).

---

## 1. Executive summary

Laxmi Sunrise asked us to extend the BFI demo so that a loan officer or ESG
officer can **enter** the data required for ESRM screening and Green Finance
Taxonomy classification, capture the full NRB Annex 5 ESDD checklist inside
the demo, and have the demo compute the regulatory outcome (risk class,
taxonomy color, escalation flag) directly from the answers.

**Recommendation.** Extend the existing demo (do not fork) using a
tenant-configurable branding layer plus a new officer-input surface. Persist
answers in Supabase, scoped by `bank_id`, so we can demo other prospects
without seeing Laxmi's data and can wipe Laxmi's captures on demand.

**Effort estimate.** 15 to 20 developer days for a working, branded,
persistence-backed, assessment-automated demo. Detail in Section 10.

---

## 2. What exists in the demo today

Reviewed the current code in `repos/jana-bfi-demo`. Relevant surfaces:

| Surface | File | State today |
|---|---|---|
| Loan Book tab | `components/bfi/tabs/loans-tab.tsx` + `shared/loan-table.tsx` | Read-only. Supabase-backed pagination over 80,035 synthesized loans. |
| ESRM tab | `components/bfi/tabs/esrm-tab.tsx` | Read-only. Application queue + screening workbench + ESDD checklist drawer. |
| Green Finance Taxonomy tab | `components/bfi/tabs/taxonomy-tab.tsx` | Read-only. Aggregated view of pre-classified loans. |
| NFRS tab | `components/bfi/tabs/nfrs-tab.tsx` | Read-only. PCAF disclosure surface. |
| Risk classification | `lib/data/screening.ts::classifyRisk` | **Heuristic only.** Sector name + emissions threshold. Not evidence-based. |
| Taxonomy classification | `lib/data/portfolio.ts::taxonomyForLoan` | **Heuristic only.** Sector name + loan purpose string. Not NRB-criterion-based. |
| ESDD checklist | `esrm-tab.tsx::buildEsddRows` | **Display of "who provides this data"**, not a capture surface. 11 rows (12 for hydropower). |
| Persistence | `app/api/portfolio/loans/route.ts` + Supabase `bfi_loans_denorm` | Loan-book pagination only. No officer inputs stored anywhere. |
| Tenant / branding | Hard-coded "First Bank of Nepal" throughout | No config layer. |

**Bottom line.** Everything the loan officer sees today is derived from the
80K-loan synthesizer; no officer action is captured, and the "risk" and
"taxonomy" labels are heuristics generated at build time, not evidence
produced by the loan officer.

---

## 3. What Laxmi Sunrise is asking for

Restated from the ask:

1. **Interactive capture.** A loan officer / ESG officer can open a new (or
   existing under-review) loan application and enter the data required for
   ESRM screening and Taxonomy classification.
2. **Full NRB question coverage.** Every question in the NRB ESRM Guidelines
   (2018) — Annex 5 ESDD checklist — plus the Green Finance Taxonomy
   (October 2024) classification criteria must be captured, in the wording
   NRB uses, not paraphrased.
3. **Automated assessment.** Where NRB provides decision logic (e.g. answer
   options a/b/c/d in Annex 5, taxonomy activity criteria), the demo must
   compute the outcome (risk classification, taxonomy color, escalation
   flag) from the answers rather than presenting them as prose.
4. **NRB-faithful taxonomy.** The Taxonomy tab and per-loan classification
   must reflect the NRB Green Finance Taxonomy (Oct 2024) criteria, not the
   current heuristic lookup.

---

## 4. Gap analysis (current demo vs. Laxmi ask)

| Ask | Current state | Gap |
|---|---|---|
| Officer can enter ESDD answers | No input surface | **New:** ESDD wizard UI + question definition set + response persistence |
| Officer can enter Taxonomy classification inputs | No input surface | **New:** Taxonomy wizard UI + activity criterion definitions + response persistence |
| All NRB ESDD questions captured verbatim | 11-row display of "who provides data" | **New:** encode Annex 5 verbatim (Basic Info + Section 1 General Risk + Section 2 EHS + Section 3 Social + guidance notes) |
| Answers drive risk classification | `classifyRisk()` is heuristic on sector + emissions | **Replace:** score-based aggregation over Annex 5 answers |
| Answers drive taxonomy color | `taxonomyForLoan()` is heuristic on sector name | **Replace:** rule engine keyed to NRB Oct 2024 activity criteria |
| Officer identity captured | No auth model beyond a demo login button | **New:** officer profile stored with each capture; role field (loan officer / ESG officer / compliance) |
| Laxmi Sunrise branding | Hard-coded FBN placeholder | **New:** tenant config layer (logo, colors, bank name) |
| Data cleanup between prospects | Everything shares one Supabase table | **New:** `bank_id` column on every capture table + admin reset endpoint |
| Escalation & audit trail | None | **New:** every capture logs officer + timestamp + answer + optional remarks |

---

## 5. Up-for-discussion decisions (with recommendations)

### 5.1 Extend the demo or build a new one for Laxmi?

**Recommendation: extend.**

Two arguments push toward extending rather than forking:

- **Sync cost is real.** A cloned "Laxmi demo" and a "generic Jana demo" would
  diverge immediately. Bug fixes, tour improvements, and Nepal data inventory
  updates would need to be applied to both. For a demo we might show to a
  dozen banks over the next two quarters, that duplication is a tax we do not
  want.
- **The Laxmi ask isn't unique.** Interactive ESDD capture, faithful taxonomy
  classification, and evidence-based risk scoring are things NMB, Nabil,
  NIMB, and Sanima will also want the moment they see it working. Building
  it once, correctly, in the main demo means those follow-on conversations
  need only a branding swap.

**Implementation:** introduce a `TENANT` concept in the demo. `TENANT=default`
gives us today's "First Bank of Nepal" placeholder; `TENANT=laxmi_sunrise`
swaps the bank name, logo, brand colors, and any Laxmi-specific default
sector priorities. All read paths honor the tenant; all write paths stamp
the tenant on captured rows.

### 5.2 Add Laxmi Sunrise branding to the UI?

**Recommendation: yes, when demoing to Laxmi. Runtime access-code switch,
not a deployment-time env var.**

The branding is what makes the meeting land ("here is what your ESDD workflow
looks like inside our platform" beats "here is what a generic bank's would
look like"). The tenant resolution is **runtime, driven by an access code
the visitor enters** — not build-time, so **one URL serves every bank**.

Model:

- Store branding assets under `public/tenants/{tenant_slug}/` (logo, favicon,
  optional CSS overrides).
- Store branding metadata + access codes under `lib/tenants/registry.ts`
  (bank name, primary color, accent color, `accessCodes: string[]`).
- Each registered tenant gets one or more short access codes (e.g.
  `LX-K7QN2P` for Laxmi Sunrise). Codes rotate independently of the internal
  tenant id, so leaking a code is a code-rotation event, not a data-model
  event.
- Landing page at `/enter` prompts for the code. `POST /api/tenant/set-code`
  validates and sets an HTTP-only `jana_demo_tenant` cookie carrying the
  tenant id. All server components resolve the tenant from this cookie.
- Pre-configured demo links use `?bank=CODE` in the URL — middleware
  redirects to `/enter?bank=CODE`, the landing page's server handler sets
  the cookie, and the visitor lands on the dashboard with the correct
  branding without ever seeing the form.
- Visitors with no code can click "Continue as First Bank of Nepal (demo)"
  and land on the default tenant.
- A "Switch bank" affordance in the header clears the cookie via
  `POST /api/tenant/clear` and returns them to `/enter`. Useful for
  back-to-back meetings on the same laptop.
- **Same URL for every bank.** One production Vercel deployment; no per-bank
  redeploys; no risk of accidentally shipping Laxmi branding to a Nabil
  meeting.

### 5.3 Data persistence and multi-tenant cleanup

**Recommendation: single Supabase database, `bank_id` on every capture table,
plus a token-gated admin reset endpoint.**

We already use Supabase for loan pagination. Adding capture tables is a small
extension. The critical constraint is that **when we demo for another bank
we must not show Laxmi's captured ESDD answers or officer notes.**

Approach:

- Every new capture table has a `bank_id` (foreign key to a small `bfi_banks`
  reference table).
- Every read query filters by the current tenant's `bank_id`.
- Admin endpoint `POST /api/admin/reset?token=<SEED_ADMIN_TOKEN>&bank_id=<id>`
  wipes captures for that bank only.
- The base loan book (`bfi_loans_denorm`) stays shared — every demo bank
  sees the same 80K synthesized book. Only officer captures are per-tenant.

Alternative considered and rejected: **one Supabase project per tenant.**
Overkill for a demo, adds ops burden, breaks the "clone-branding-only"
principle in Section 5.1.

---

## 6. Proposed architecture

### 6.1 Data model additions (Supabase)

```
bfi_banks
  id (text PK, e.g. "laxmi_sunrise")
  display_name
  logo_url
  primary_color, accent_color
  is_default (bool)

bfi_officers
  id (text PK)
  bank_id (fk)
  name, role (loan_officer | esg_officer | compliance | credit_committee)
  email

bfi_esdd_responses
  id (uuid PK)
  bank_id, loan_id, borrower_id, officer_id
  question_id (text, e.g. "annex5.1.1")
  answer (text, "a" | "b" | "c" | "d")
  remarks (text)
  captured_at (timestamptz)

bfi_taxonomy_assessments
  id (uuid PK)
  bank_id, loan_id, borrower_id, officer_id
  activity_id (fk to bfi_taxonomy_activities catalog)
  criterion_answers (jsonb) -- captures answers to each criterion
  computed_color (green | amber | red | unclassified)
  computed_rationale (text)
  captured_at (timestamptz)

bfi_esrm_screenings
  id (uuid PK)
  bank_id, loan_id, borrower_id, officer_id
  computed_risk_class (low | medium | high | extreme)
  computed_recommendation (approve | approve-with-conditions | decline)
  computed_escalation_flag (bool)
  computed_rationale (text)
  esdd_response_snapshot (jsonb) -- copy of the ESDD answers used
  captured_at (timestamptz)
```

### 6.2 Question definitions (code, not database)

The NRB question set and taxonomy criteria are **regulatory data** — they
change only when NRB updates the document. Keep them in versioned code, not
in Supabase, so a bank can never accidentally corrupt them.

```
lib/regulatory/
  esdd/
    annex5-questions.ts       // all Annex 5 questions verbatim + guidance
    scoring.ts                 // answer weighting: a=0, b=1, c=3, d=null
    risk-aggregation.ts        // score → risk class + recommendation
  taxonomy/
    activities.ts              // NRB Oct 2024 activity catalog
    criteria.ts                // per-activity criterion definitions
    classification-engine.ts   // answers → green/amber/red + rationale
```

### 6.3 New UI surfaces

Add one primary new surface: **"Applications" tab** (or extend the existing
ESRM tab). Officer opens an under-review loan → picks the wizard:

- **ESDD wizard** (step-by-step, one section per step):
  1. Basic Information (date, client name, transaction ID, location, sector,
     product, relationship officer, business line)
  2. Section 1 — General Risk (Questions 1.1, 1.2, 1.3)
  3. Section 2 — Environmental Health & Safety Risks (Questions 2.1, 2.2, 2.3, 2.4)
  4. Section 3 — Social Risks (Questions 3.1, 3.2, 3.3, 3.4)
  5. Sector-specific supplementary questions (e.g. hydropower dam safety)
  6. Review & submit → computed risk class + recommendation shown, escalation
     flag raised if needed.

- **Taxonomy wizard** (step-by-step):
  1. Activity selection from NRB Oct 2024 catalog (e.g. "Solar PV under 10 MW",
     "Hydropower under 25 MW", "Cement plant with WHR retrofit").
  2. Activity-specific eligibility criteria (yes/no or numeric thresholds).
  3. Computed color + citation to NRB clause + rationale.

- **Captured record view** shows every officer's response history for a
  borrower, with edit/revise capability.

---

## 7. Assessment automation design

### 7.1 ESRM risk scoring (rules-based, transparent)

For NRB Annex 5, each answered question contributes a weighted score:

| Answer | Score contribution | Meaning |
|---|---|---|
| a | 0 | Best case — no evidence of risk / all mitigation in place |
| b | 1 | Partial mitigation, has definite plan |
| c | 3 | Poor performance, no definite plan |
| d | null | Not applicable, excluded from denominator |

Section totals aggregate the per-question scores. A single `c` answer
triggers an escalation flag (`requires_credit_committee_review = true`) even
if the section total looks moderate — matching NRB's own "any serious issue
escalates" posture.

Recommendation logic:

- Any `c` answer → escalation flag; recommendation defaults to `approve-with-conditions` or `decline` per section severity.
- Total section score ≥ threshold (calibratable per section) → `high` or `extreme` risk class.
- All `a`/`b` answers → `low` or `medium`.

Each computed outcome carries a plain-English rationale citing which
questions drove which conclusion. Auditable and defensible.

### 7.2 Taxonomy classification (criterion-based, cited)

For NRB Green Finance Taxonomy (Oct 2024), the engine is a decision tree per
activity type. Example for a hydropower loan:

```
Activity: Hydropower generation
├── Capacity ≤ 25 MW (green criterion 3.4.1a)?
│   ├── Yes → GREEN, cite section 3.4.1a
│   └── No → check criterion 3.4.1b
├── Capacity 25–100 MW with environmental safeguards?
│   ├── Yes → AMBER, cite section 3.4.1b
│   └── No → RED
└── No further criteria met → UNCLASSIFIED
```

Every classification returns:
- Color (green / amber / red / unclassified)
- Rationale text (plain English)
- Citation (section reference into NRB Oct 2024 document)
- The criterion answers that drove the outcome (for audit trail)

The regulatory data (activities + criteria) is extracted from the 153-page
NRB Oct 2024 taxonomy PDF and encoded as versioned code. Adding new
activities or updating criteria is a code change reviewed by the compliance
lead, not a database edit.

---

## 8. Multi-tenant data cleanup

Two endpoints, both token-gated:

```
POST /api/admin/reset?token=…&bank_id=laxmi_sunrise
  → DELETE from bfi_esdd_responses WHERE bank_id = 'laxmi_sunrise'
  → DELETE from bfi_taxonomy_assessments WHERE bank_id = 'laxmi_sunrise'
  → DELETE from bfi_esrm_screenings WHERE bank_id = 'laxmi_sunrise'
  → Leaves bfi_loans_denorm and reference tables intact
```

Plus a matching UI-facing "Reset demo data" button in a small `/demo-admin`
page, gated by the same token. Useful when we run back-to-back demos and
want to show a fresh Laxmi surface.

---

## 9. Fidelity check for the Taxonomy tab (the "100% NRB-faithful" ask)

Today the Taxonomy tab shows:
- KPI cards (count and NPR by color)
- Sector breakdown
- Per-loan color chip

For 100% fidelity to NRB Oct 2024 reporting requirements we need to add:

1. **NRB reporting form template.** Section 4 of the taxonomy document
   specifies the exact NRB reporting form that banks must submit quarterly.
   Add a "Generate NRB submission" export that formats the portfolio into
   that template.
2. **Criterion-level breakdown.** Per NRB, taxonomy alignment is reported
   per activity criterion, not just per color. Add a drill-down that shows
   "how much of the green bucket is under criterion 3.4.1a vs 3.4.1b" etc.
3. **Do-no-significant-harm (DNSH) tracking.** NRB requires DNSH checks
   alongside the primary color assessment. Add DNSH answers to the taxonomy
   wizard and surface DNSH failures on the tab.
4. **Interim / transitional flagging.** NRB flags certain activities as
   transitional (amber-with-conditions). Surface these as a distinct sub-tab
   or filter.

These are covered in the effort estimate below.

---

## 10. Effort estimate & phasing

| Phase | Deliverable | Dev days |
|---|---|---|
| **1. Foundation** | Tenant config + Laxmi branding + Supabase schema for capture tables | 2 |
| **2. ESDD wizard** | Encode NRB Annex 5 verbatim (Basic Info + Sections 1–3 + sector supplements) + wizard UI + persistence | 4 |
| **3. ESRM automation** | Score-based aggregation + escalation flag + recommendation engine + rationale generation | 2 |
| **4. Taxonomy wizard** | Extract NRB Oct 2024 activities + criteria into code + wizard UI + persistence | 4 |
| **5. Taxonomy engine** | Decision-tree classification + citation + rationale | 2 |
| **6. Taxonomy fidelity** | NRB reporting form export + criterion drill-down + DNSH tracking | 3 |
| **7. Multi-tenant reset** | Admin endpoints + UI reset button + docs | 1 |
| **8. Testing / polish** | End-to-end walkthrough with Willard, meeting-ready polish | 2 |
| **Total** | | **~20 dev days** |

Phase 1–3 alone gets us a working "Laxmi can walk through an ESDD checklist
and see automated risk classification" story in about 8 days, which is the
minimum viable slice we could show if the meeting timeline compressed.

---

## 11. Open questions — resolved

All five open questions are resolved. See Section 0 (Decisions locked).

---

## 12. Recommended next actions

1. **Willard**: confirm the extend-not-fork decision (Section 5.1) and the
   Laxmi meeting date, and answer the five open questions in Section 11.
2. **Engineering**: begin Phase 1 (tenant config + Supabase capture-table
   migration) in a feature branch off `development`. This is
   non-user-facing and unblocks Phases 2–7 to run in parallel.
3. **Compliance / methodology**: extract NRB ESRM Annex 5 into a structured
   question set (JSON / TypeScript) with guidance-note references. Extract
   NRB Green Finance Taxonomy Oct 2024 activities + criteria into the
   same shape. This is the tallest single work item and should start
   immediately regardless of the engineering start date.
4. **Design**: draft wizard UI wireframes (multi-step form, answer-radio
   pattern, remarks textarea, review screen, escalation banner). One-day
   effort; can happen in parallel.

---

*This document lives at `repos/jana-bfi-demo/design_docs/LAXMI_SUNRISE_EXTENSION_PLAN.md` and should be updated as decisions land.*
