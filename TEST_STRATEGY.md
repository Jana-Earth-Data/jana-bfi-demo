# Test Strategy — jana-bfi-demo

**Date:** 2026-09-09
**Author:** Engineering
**Audience:** Includes non-JavaScript readers. Where a JS tool has a Python
equivalent, the Python name is given in parentheses.
**Status:** Proposal. Nothing in here is wired up yet — see §8 for the current
(zero-test) baseline.

---

## 0. TL;DR

This is banking software with **zero automated tests today**. The only
automated safety net is a set of 10 build-time guard scripts and the
TypeScript compiler.

The recommendation is a three-layer test pyramid, all runnable with a single
command after every change:

| Layer | Tool (JS) | Python equivalent | What it covers | Target |
|-------|-----------|-------------------|----------------|--------|
| Unit | **Vitest** | pytest | Pure regulatory logic (PCAF, ESDD, taxonomy, CAP) | **100% of `lib/regulatory/`** |
| Integration | Vitest + mocked Supabase | pytest + responses/mock | API route handlers (41 routes) | Every route: happy path + auth-fail + bad-input |
| End-to-end | **Playwright** (already installed) | Playwright-python / Selenium | Full browser flows (enter → ESDD → CAP → exit) | The 6 critical user journeys |

One command to run everything: `npm test`. One command for the fast inner
loop: `npm run test:unit -- --watch` (like `pytest-watch`).

**The single most important line in this document:** for a zero-tolerance
banking product, the regulatory computation in `lib/regulatory/` must reach
**100% line + branch coverage**, enforced in CI as a hard gate. That code is
~8,200 lines of pure functions that turn a borrower's answers into a
regulatory score an auditor will rely on. It is the highest-value, lowest-cost
code to test in the entire repo.

---

## 1. Why "zero tolerance" changes the approach

For most web apps, testing is about catching regressions. For banking
software the stakes are different:

- A wrong **PCAF score** misstates a bank's financed emissions to the
  regulator (Nepal Rastra Bank). That is a compliance filing built on a bug.
- A wrong **ESDD risk class** either waves through a high-risk borrower or
  buries a low-risk one in unnecessary covenants. Either is a real lending
  decision.
- A wrong **taxonomy classification** (Green/Amber/Red) mislabels a loan in
  the bank's green-finance statement — again, a regulatory filing.

These are all **pure functions**: same inputs → same output, no database, no
network. That is the easiest possible code to test exhaustively, and the
consequences of a bug are the most severe. This is the ideal place to spend
testing effort. The mismatch today (highest stakes, zero tests) is the core
finding.

---

## 2. Recommended stack (the "pytest for JavaScript")

### 2.1 Vitest — the test runner (this is your pytest)

**[Vitest](https://vitest.dev)** is the modern standard for TypeScript
projects. It is to JavaScript what pytest is to Python: you write small
functions that assert expected behaviour, and one command runs them all.

Why Vitest over the alternatives:

- **Jest** (the older incumbent, ≈ `unittest`): works, but slower and needs
  extra configuration to understand TypeScript and the `@/` import alias this
  repo uses everywhere.
- **Vitest** understands the repo's existing `tsconfig.json`, `@/` path
  alias, and Next.js setup with almost no config. It has a **watch mode**
  (like `pytest-watch`), built-in **coverage** (like `pytest-cov`), and runs
  in milliseconds.
- **node:test** (Node's built-in, ≈ nothing in Python's stdlib is as good):
  too bare-bones for component testing.

A Vitest test looks like this (nothing to install to *read* — this is
illustrative):

```typescript
import { describe, it, expect } from "vitest";
import { computePcafScore, assetClassForLoanCategory } from "@/lib/regulatory/pcaf/scoring";

describe("PCAF scoring — §5 data-quality rubric", () => {
  it("falls to Score 5 (sector average) when no better data exists", () => {
    const result = computePcafScore(loanFixture, borrowerFixture, null, {}, "business-loans");
    expect(result.score).toBe(5);
    expect(result.option).toBe("3");          // §5.x option letter
    expect(result.citation).toContain("§5");  // auditor can trace it
  });

  it("is out-of-scope for retail personal loans", () => {
    const result = computePcafScore(loan, borrower, null, { out_of_scope: true }, "out-of-scope");
    expect(result.score).toBeNull();
  });
});
```

The mental model is identical to pytest: `describe` ≈ a test class,
`it` ≈ a `test_` function, `expect(x).toBe(y)` ≈ `assert x == y`.

### 2.2 @testing-library/react — component testing

**[@testing-library/react](https://testing-library.com)** renders a React
component in a simulated DOM and lets you assert on what a user would see
("the risk badge says High"). It is the standard partner to Vitest for the
`.tsx` files. Analogy: it is roughly Django's test `Client` but for rendered
UI instead of HTTP responses.

### 2.3 Playwright — end-to-end (already installed!)

**[Playwright](https://playwright.dev)** drives a real browser through a real
running app. It is **already a devDependency** (`playwright: ^1.62.1`) but is
currently used only for screenshots (`scripts/capture-screenshots.ts`) — there
is no `playwright.config.ts` and no test suite. We should add the test runner
half of it. Python readers may know `playwright-python`; it is the same tool.

E2E is slower and more brittle than unit tests, so we keep it to a small
number of **critical journeys** (§5.3), not exhaustive coverage.

### 2.4 Supporting libraries

| Library | Role | Python analogue |
|---------|------|-----------------|
| `@vitest/coverage-v8` | Coverage reporting + thresholds | `pytest-cov` |
| `@testing-library/jest-dom` | Extra DOM assertions (`toBeVisible`) | — |
| `msw` (Mock Service Worker) | Intercept `fetch`/Supabase in tests | `responses` / `httpretty` |
| `zod` (**already a concept in the repo**) | Schema validation of API payloads in tests | `pydantic` |

Everything above is dev-only; none ships in the production bundle.

---

## 3. Coverage targets — differentiated by risk

"As close to 100% as possible" is the right instinct, but a flat 100% target
across an 18,000-line React UI wastes effort on trivial presentational code
and creates brittle snapshot tests. Instead, tier the targets by how much a
bug there would cost:

| Code area | LOC (approx) | Coverage target | Rationale |
|-----------|-------------:|-----------------|-----------|
| **`lib/regulatory/**`** (PCAF, ESDD, taxonomy, CAP, hydro, climate) | ~8,200 | **100% line + 100% branch** — CI-enforced hard gate | Pure functions producing regulatory numbers. Every branch is a rule. A missed branch is an untested rule. Zero tolerance applies most sharply here. |
| **`lib/` non-regulatory** (tenants, settings, reporting, api helpers, demo synth) | ~4,000 | **90% line** | Business/plumbing logic. High value, mostly pure, cheap to test. |
| **`app/api/**`** (41 route handlers) | ~3,000 | **Every route:** ≥1 happy-path, ≥1 auth-failure, ≥1 bad-input test | Routes are the trust boundary — auth, tenant isolation, input validation live here. Test behaviour, not lines. |
| **`components/**`** (44 files, ~18,000 LOC) | ~18,000 | **70% line**, but **100% on any component that computes/derives regulatory display** (e.g. wizards that call scoring) | Presentational code (charts, primitives) is low-risk. Wizards that drive ESDD/CAP/taxonomy decisions are high-risk and get full treatment. |
| **E2E journeys** | n/a | **6 critical paths pass** (§5.3) | Confidence that the assembled system works, not a coverage number. |

**Why not 100% everywhere:** chasing the last few percent on a 3,136-line
presentational tab (`esrm-tab.tsx`) produces fragile tests that break on every
CSS tweak and train the team to ignore red builds. That is *worse* than no
test. The discipline is: **100% where a bug is a compliance error, pragmatic
elsewhere.**

**Coverage is a floor, not a ceiling.** 100% branch coverage on PCAF scoring
means every branch executed once — it does **not** prove every *rule* is
correct. Pair coverage with **table-driven cases derived from the standard**
(§4.1): one row per PCAF option, per ESDD risk threshold, per taxonomy
activity. That is what actually catches a misread regulation.

---

## 4. What to test first — prioritised backlog

### 4.1 Tier 1 — Regulatory pure functions (start here)

These are deterministic, high-stakes, and cheap. Each already cites the
regulation paragraph in its output, which makes writing the expected value
straightforward: the test asserts the score **and** the citation.

| Module | Entry point | Test approach | Est. cases |
|--------|-------------|---------------|-----------:|
| `lib/regulatory/pcaf/scoring.ts` (443) | `computePcafScore()`, `assetClassForLoanCategory()` | One case per §5 option (1a/1b/2a/2b/3/5) × asset class; out-of-scope short-circuit; fail-down when a flag is unset | ~40 |
| `lib/regulatory/esdd/scoring.ts` (287) | `computeEsrmScore()`, section aggregation | Answer combinations → each risk class boundary; empty/partial answers | ~50 |
| `lib/regulatory/esdd/annex5b-pf-scoring.ts` (183) | PF classification | IFC PS trigger combinations | ~25 |
| `lib/regulatory/taxonomy/activities.ts` (1,782) | per-activity `classify()` | Table-driven: 3–8 criteria combinations per activity → Green/Amber/Red | ~250 |
| `lib/regulatory/taxonomy/dnsh.ts` (358) | `evaluateDnsh()` | Each DNSH criterion pass/fail | ~30 |
| `lib/regulatory/cap/library.ts` (1,200) | `frequencyForRiskClass()`, covenant matching | Risk class → monitoring cadence; covenant template selection | ~20 |
| `lib/regulatory/esdd/loan-category-derive.ts` (70) | sector → category | Every NRB SIS sector code | ~15 |
| `lib/regulatory/hydro/capacity.ts` | MW → classification | Boundary values (just-below / at / just-above each threshold) | ~12 |
| `lib/demo/synth-util.ts` | `mulberry32()` PRNG | Determinism: same seed → same sequence | ~5 |

Tier 1 alone is ~450 test cases and would take a knowledgeable dev roughly
**3–5 days**. It is the highest return on effort in the entire plan.

### 4.2 Tier 2 — API route handlers (the trust boundary)

For each of the 41 routes, mock Supabase (via `msw`) and assert three things:

1. **Happy path** — valid request → correct shape (validate with a `zod`
   schema, like asserting a `pydantic` model).
2. **Auth failure** — missing/invalid officer or admin token → 401/403, and
   critically **no data leakage** across tenants.
3. **Bad input** — malformed body, oversized body, wrong enum → 400, not 500.

The shared helpers (`requireOfficer`, `requireAdminToken`,
`requireCaptureClient`, `apiError`) mean these tests are repetitive and
fast to write once the first is done. Est. **3–4 days**.

Highest-priority routes (touch money/compliance or auth):
`/api/esdd/responses`, `/api/pcaf/scores`, `/api/taxonomy/assessments`,
`/api/cap/[loanId]`, `/api/reports/nrb-taxonomy`,
`/api/reports/nrbsis-green-statement`, all `/api/admin/*`, `/api/evidence/*`.

### 4.3 Tier 3 — Critical components

Test the wizards that *drive regulatory decisions*, because they combine user
input with the Tier-1 scoring functions:

- `bfi/esdd/wizard.tsx` — answers persist, CAP auto-derives on "c" answers
- `bfi/taxonomy/wizard.tsx` — criteria → color shown matches `activities.ts`
- `bfi/cap/cap-panel.tsx` — derived covenants match `cap/library.ts`
- `bfi/pf-screening/wizard.tsx` — PF gating

Skip snapshot-testing the charts and primitives. Est. **3–5 days**.

### 4.4 Tier 4 — E2E journeys (§5.3).

---

## 5. How it runs — the developer workflow

### 5.1 The commands (to be added to `package.json`)

```jsonc
{
  "scripts": {
    "test":          "vitest run && playwright test",   // everything (CI)
    "test:unit":     "vitest run",                       // unit + integration
    "test:watch":    "vitest",                           // inner loop (pytest-watch)
    "test:coverage": "vitest run --coverage",            // coverage report + gate
    "test:e2e":      "playwright test",                  // browser journeys
    "test:e2e:ui":   "playwright test --ui"              // debug E2E visually
  }
}
```

**After every code change**, the fast loop is `npm run test:watch` — it
re-runs only the affected tests on save, in milliseconds, exactly like
`pytest-watch`. Before pushing, `npm test` runs the full suite.

### 5.2 Coverage gate (this is the regression guard the request asks for)

`vitest.config.ts` sets **hard thresholds**. A build fails — locally and in
CI — if coverage drops below them:

```typescript
// illustrative
coverage: {
  provider: "v8",
  thresholds: {
    // Global floor
    lines: 80, functions: 80, branches: 75,
    // Zero-tolerance gate on regulatory logic
    "lib/regulatory/**": { lines: 100, branches: 100, functions: 100 },
  },
}
```

This is the mechanism that makes "bugs are zero tolerance" real: you cannot
merge a change that adds an untested branch to a scoring function, because the
100% gate on `lib/regulatory/**` turns the build red.

### 5.3 The six critical E2E journeys

1. **Enter → dashboard** — bank access code → branded dashboard loads with
   the synthetic portfolio.
2. **Full ESDD** — pick officer → open a loan → complete the ESDD wizard →
   answers persist across a refresh → CAP items auto-derive.
3. **PCAF review** — open PCAF panel → record evidence → score updates and
   cites the correct §5 option.
4. **Taxonomy classification** — run the taxonomy wizard → color shown matches
   the `activities.ts` classification.
5. **Reporting export** — generate the NRB green statement → file downloads,
   magic bytes valid.
6. **Exit / re-entry** — Exit demo → land on `/enter` (empty) → re-enter a
   bank → synthetic portfolio restored (regression guard for the recent
   exit-demo cookie work).

---

## 6. CI/CD integration (ties into the open "no CI/CD" gap)

The Production Readiness Assessment lists **"CI/CD pipeline — CRITICAL"** as an
open item. Tests and CI should land together: a test suite no one runs on every
PR is worth a fraction of its potential. Proposed `.github/workflows/ci.yml`
(runs on every push + PR):

```yaml
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint            # eslint
      - run: npm run prebuild        # the 10 existing guard scripts
      - run: npx tsc --noEmit        # type check
      - run: npm run test:coverage   # unit + integration + coverage gate
      - run: npm run build:demo      # both build targets must compile
      - run: npm run build:live
      - run: npm run test:e2e        # Playwright (against a built app)
```

This makes the existing guard scripts, the type checker, the new tests, and
both build targets a **mandatory gate before merge** — the automated
regression protection the request asks for.

---

## 7. Rollout plan (incremental, non-blocking)

Do not stop feature work to build all of this at once. Sequence:

1. **Week 1 — Infrastructure + Tier 1 start.** Install Vitest + coverage, add
   `vitest.config.ts`, wire `npm test`, add the `.github/workflows/ci.yml`
   with a **soft** (report-only) coverage gate. Write PCAF + ESDD scoring
   tests. This immediately protects the two highest-stakes modules.
2. **Week 2 — Finish Tier 1.** Taxonomy (the big one), DNSH, CAP, hydro,
   loan-category. Flip the `lib/regulatory/**` gate to **hard 100%**. From
   here, no regulatory branch can merge untested.
3. **Week 3 — Tier 2.** API route handlers with mocked Supabase. Add
   Playwright config + the 6 E2E journeys.
4. **Week 4 — Tier 3 + hardening.** Wizard component tests. Raise the global
   floor as coverage naturally climbs.

At the end of week 2 the compliance-critical core is fully protected; the rest
is defence in depth.

---

## 8. Current baseline (what exists today)

Documented honestly so progress is measurable:

- **Automated tests: 0.** No `.test.ts`/`.spec.ts` files, no test runner, no
  test config.
- **`playwright` is installed but unused** for testing — screenshots only, no
  `playwright.config.ts`.
- **CI/CD: none.** No `.github/workflows/` directory exists.
- **Existing safety net (real, but not a substitute for tests):**
  - **TypeScript strict mode** — catches type errors at compile time.
  - **10 build-time guard scripts** (`scripts/check-*.mjs`) run in `prebuild`.
    They enforce architectural invariants — demo/live separation, Supabase
    provenance filtering, no fabricated officers in live audit trails, Docker
    flag wiring. These are excellent and should stay, but they check
    **structure**, not **regulatory correctness**. None of them verify that a
    PCAF score is right.
  - **`npx tsc --noEmit`** and **`npm run lint`** are available and pass.

The gap is precise: **structure and types are guarded; behaviour and
regulatory correctness are not.**

---

## 9. Cost / benefit summary

| | Effort | Protects |
|---|--------|----------|
| Vitest + coverage + CI skeleton | ~1 day | The mechanism for everything below |
| Tier 1 (regulatory 100%) | 3–5 days | Every compliance number the product emits |
| Tier 2 (API routes) | 3–4 days | Auth, tenant isolation, input validation |
| Tier 3 (wizards) | 3–5 days | The UI paths that drive lending decisions |
| E2E (6 journeys) | 2–3 days | End-to-end confidence, incl. exit-demo regression |

**~2.5–3.5 engineer-weeks** for a banking-grade safety net, front-loaded so
the highest-value protection (Tier 1) lands in the first week. After that,
`npm test` on every change is the zero-tolerance regression guard requested.
