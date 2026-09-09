# Project Plan — jana-bfi-demo → Production

**Date:** 2026-09-09
**Target end-state:** **Production** — a real bank (Nepal BFI) relying on real
regulatory numbers (PCAF financed emissions, NRB ESRM/ESDD risk classes, Green
Finance Taxonomy classifications) computed by this application and filed with
Nepal Rastra Bank.
**Branch model:** `feature/<date>_N` → `development` → `main` (Vercel deploys
from `main`). See `CLAUDE.md`.

---

## 0. How to read this plan

This plan synthesises every open item from the three assessment documents into
a single sequenced roadmap:

- `CODE_REVIEW_REPORT.md` — code-level findings (0 critical, 3 high, 9 medium, 9 low)
- `PRODUCTION_READINESS_ASSESSMENT.md` — operational readiness (scalability, reliability, durability, security, deployability, **test coverage**)
- `TEST_STRATEGY.md` — the testing plan referenced throughout Phase 1–2

Each phase has an **objective**, a **task table** (with source reference and
effort), **dependencies**, and an **exit criterion** — the gate that must be
true before the phase is considered done. Effort is in engineer-days unless
noted.

**Guiding principle for a banking product:** correctness of the regulatory
computation is non-negotiable and comes first. Operational hardening (scaling,
CDN, APM) is real but secondary to "the number is right and we can prove it
with a test that runs on every change."

---

## 1. Current state (baseline, 2026-09-09)

**What is solid:**
- Strong application-layer security (tenant isolation, owner-only enforcement, input validation, no secrets in code).
- Clean demo/live build-time boundary, enforced by 10 build guard scripts.
- Well-engineered multi-stage Docker build with working HEALTHCHECK.
- Excellent inline documentation.
- Recently shipped: exit-demo flow, healthcheck IPv4 fix, rate limiting, body-size guards, MIME validation, shared route helpers, async cold-start I/O.

**What blocks production:**
- **Zero automated tests** — the ~8,200 lines of regulatory logic have no behavioural verification.
- **No CI/CD** — no `.github/workflows/`; guards and builds are never run automatically on PR.
- **No Supabase backups / PITR** — officer captures are unrecoverable if lost.
- **No database migration system** — schema applied by hand; two copies can drift.
- **Observability is `console.log`** — no structured logging, no error tracking, no metrics.
- **Missing security headers** — no CSP, no HSTS.
- **No graceful shutdown** — SIGTERM drops in-flight requests.
- **No horizontal scaling / rollback procedure.**
- **One 3,100-line component** (`esrm-tab.tsx`) that is hard to test and maintain.

---

## 2. Phase overview

| Phase | Theme | Objective | Est. duration |
|-------|-------|-----------|---------------|
| **P0** | Foundation | CI/CD + test harness skeleton. Nothing merges without passing checks. | ~1 week |
| **P1** | Correctness | 100% tested regulatory core + API route tests. The numbers are provably right. | ~2 weeks |
| **P2** | Durability | Backups, migrations, graceful shutdown, session persistence. Data survives. | ~1.5 weeks |
| **P3** | Observability & Security | Structured logging, error tracking, metrics, CSP/HSTS, admin audit. We can see and defend. | ~1.5 weeks |
| **P4** | Scale & Resilience | Multi-replica, CDN, reconnection, circuit breakers, component decomposition, E2E. It holds up. | ~2–3 weeks |
| **P5** | Go-live | Staging parity, pilot, runbooks, rollback drill. Ship with confidence. | ~1 week |

Total: roughly **9–10 engineer-weeks** to a defensible production posture,
front-loaded so correctness and the safety net land first.

---

## 3. Phase P0 — Foundation (CI/CD + test harness)

**Objective:** Establish the mechanism that makes every later phase enforceable.
No code should be able to merge that fails lint, type-check, the build guards,
the build, or (as they accrue) the tests.

| # | Task | Source | Effort |
|---|------|--------|--------|
| P0.1 | Create `.github/workflows/ci.yml` — runs on push + PR: `npm ci`, `lint`, `prebuild` (10 guards), `tsc --noEmit`, `build:demo`, `build:live` | PRA §5.2, CRR §4.5 | 1 |
| P0.2 | Install Vitest + `@vitest/coverage-v8` + `@testing-library/react` + `msw`; add `vitest.config.ts` wired to `@/` alias | TS §2 | 1 |
| P0.3 | Add `test`, `test:unit`, `test:watch`, `test:coverage` scripts to `package.json` | TS §5.1 | 0.5 |
| P0.4 | Add coverage reporting to CI (soft/report-only gate initially) | TS §5.2 | 0.5 |
| P0.5 | Add branch protection on `main`/`development` requiring CI to pass | PRA §5.2 | 0.5 |
| P0.6 | `npm audit` step + fix/pin wide semver ranges | CRR §6.1, §6.2 | 0.5 |

**Dependencies:** none — this is the entry point.
**Exit criterion:** A PR that breaks lint/types/guards/build is automatically
blocked from merge. `npm test` exists and runs (even with one trivial test).

---

## 4. Phase P1 — Correctness (the regulatory core)

**Objective:** Every regulatory number the product emits is verified by a test
derived from the regulation, and no future change can silently break one. This
is the heart of a banking product.

| # | Task | Source | Effort |
|---|------|--------|--------|
| P1.1 | Tier 1 tests — PCAF scoring (`pcaf/scoring.ts`): one case per §5 option × asset class, out-of-scope, fail-down | TS §4.1 | 2 |
| P1.2 | Tier 1 tests — ESDD scoring (`esdd/scoring.ts`, `annex5b-pf-scoring.ts`): answer combos → each risk-class boundary | TS §4.1 | 2 |
| P1.3 | Tier 1 tests — Taxonomy (`taxonomy/activities.ts`, `dnsh.ts`): table-driven, per-activity Green/Amber/Red + DNSH | TS §4.1 | 3 |
| P1.4 | Tier 1 tests — CAP (`cap/library.ts`), hydro (`capacity.ts`), loan-category derive, PRNG determinism | TS §4.1 | 1.5 |
| P1.5 | **Flip the hard gate:** `lib/regulatory/**` → 100% line + branch in `vitest.config.ts`, enforced in CI | TS §5.2 | 0.5 |
| P1.6 | Tier 2 tests — API route handlers with mocked Supabase: happy path + auth-fail (no cross-tenant leak) + bad-input, for all 41 routes | TS §4.2 | 4 |
| P1.7 | Fix any bugs surfaced by P1.1–P1.6 (expect some; this is the point) | — | buffer 2 |

**Dependencies:** P0 (harness + CI gate).
**Exit criterion:** `lib/regulatory/**` at 100% line+branch, CI-enforced; every
API route has happy/auth-fail/bad-input coverage; test cases cite the
regulation paragraph they verify. A regulatory branch cannot merge untested.

---

## 5. Phase P2 — Durability (data survives)

**Objective:** Officer work (ESDD responses, PCAF evidence, taxonomy
assessments, assignments, uploaded evidence files) is recoverable, schema
changes are versioned, and deploys don't drop in-flight work.

| # | Task | Source | Effort |
|---|------|--------|--------|
| P2.1 | Enable Supabase automated backups + PITR (Pro plan); document RTO/RPO | PRA §3.1 | 0.5 |
| P2.2 | Periodic export of all `bfi_*` tables to S3; test a restore to a clean instance | PRA §3.1 | 1 |
| P2.3 | Adopt a migration system (Supabase CLI migrations or numbered SQL + `schema_migrations`); single source of truth feeding `initdb.d` | PRA §3.2, CRR §4.3 | 2.5 |
| P2.4 | SIGTERM graceful shutdown: drain in-flight requests, close Supabase client, `STOPSIGNAL SIGTERM`, `stop_grace_period` | PRA §5.6 | 0.5 |
| P2.5 | Move session state (tenant/officer/demo) server-side (Supabase `sessions` or Redis) with session-id cookie + expiry | PRA §3.3 | 2 |
| P2.6 | Evidence storage: retention policy, bucket versioning, consider WORM for audit evidence | PRA §3.4 | 1 |

**Dependencies:** P0 (CI to validate migrations); benefits from P1 (route tests
cover the session refactor).
**Exit criterion:** A documented, *tested* restore brings back all officer
captures; schema changes go through versioned migrations; a rolling deploy
drops zero in-flight requests; officer sessions survive a browser restart.

---

## 6. Phase P3 — Observability & Security headers

**Objective:** Operators can see what the system is doing and are alerted when
it breaks; the app meets baseline web-security header expectations; admin
actions are audited.

| # | Task | Source | Effort |
|---|------|--------|--------|
| P3.1 | Structured logging (pino/winston, JSON); replace `console.*`; add request-duration logging in middleware | PRA §2.2, CRR §2.5 | 2 |
| P3.2 | Error tracking (Sentry — official Next.js SDK) | PRA §2.2 | 1 |
| P3.3 | Metrics/APM: request rate, latency p50/p95/p99, error rate by endpoint, memory/CPU (CloudWatch/Datadog or `/metrics`) | PRA §2.2 | 2 |
| P3.4 | CSP + HSTS + security headers via `next.config.ts`; set `secure: true` cookies behind HTTPS | PRA §4.4, §4.5 | 0.5 |
| P3.5 | Explicit CORS config (whitelist origins) | PRA §4.3 | 0.5 |
| P3.6 | Admin audit logging on all `/api/admin/*` (who/when/where); document `SEED_ADMIN_TOKEN` rotation; move admin token out of query string | PRA §4.6, CRR §1.5 | 1 |
| P3.7 | Consistent API error response shape (fold into shared helpers) | CRR §2.4 | 0.5 |

**Dependencies:** P0 (CI); P3.1 best done before P3.2/P3.3 so logs feed them.
**Exit criterion:** No raw `console.*` in request paths; errors surface in
Sentry; a dashboard shows latency/error rate; security-header scan passes;
every admin call is audited with no token in the URL.

---

## 7. Phase P4 — Scale, resilience & maintainability

**Objective:** The system tolerates load, instance loss, and upstream outages;
the worst component is decomposed; end-to-end journeys are guarded.

| # | Task | Source | Effort |
|---|------|--------|--------|
| P4.1 | Real-data path: point the app at Supabase/Postgres populated by a real ingestion pipeline; retire the in-memory portfolio for live tenants (provider pattern already supports this) | PRA §1.1, CRR §4.1 | 3 |
| P4.2 | DB-level pagination (LIMIT/OFFSET or keyset) for live portfolio; the `queryLoans()` signature already supports it | PRA §1.3 | 1 |
| P4.3 | Horizontal scaling: ≥2 replicas behind a load balancer; audit module-level caches (`facilityCache`, `nplLocationCache`) for per-instance safety or move to Redis | PRA §1.2, CRR §2.3 | 3 |
| P4.4 | Move PDF/Excel generation off the request path (background worker) | PRA §1.2 | 2 |
| P4.5 | CDN for static assets + tour audio (CloudFront/Vercel Edge/Cloudflare) | PRA §1.4 | 1 |
| P4.6 | Supabase client reconnection (health check `SELECT 1`, recreate on failure) | PRA §2.4 | 0.5 |
| P4.7 | Circuit breaker / confirm all external data is pre-ingested per data-sourcing policy | PRA §2.6 | 1 |
| P4.8 | Decompose `esrm-tab.tsx` (~3,100 LOC) into 4–5 sub-components; fold AGGREGATOR-PAIR duplication | CRR §2.1, §2.2 | 3 |
| P4.9 | Tier 3 component tests (wizards) + Tier 3 coverage; tighten non-null assertions / loose coercion | TS §4.3, CRR §5.1, §5.2 | 4 |
| P4.10 | Playwright config + the 6 critical E2E journeys (incl. exit-demo regression) | TS §5.3 | 2.5 |

**Dependencies:** P1 (route tests de-risk the P4.1 data-path swap and P4.8
decomposition); P0 (CI runs E2E).
**Exit criterion:** App runs multi-replica with a real-data tenant; static
assets served from CDN; `esrm-tab` decomposed and tested; 6 E2E journeys green
in CI; upstream outage degrades gracefully, not fatally.

---

## 8. Phase P5 — Go-live

**Objective:** Ship to a real bank with a tested rollback path, a staging
environment that mirrors production, and runbooks the on-call can follow.

| # | Task | Source | Effort |
|---|------|--------|--------|
| P5.1 | Staging environment mirroring prod (same DB engine, auth flow, data volume) | PRA §5.4 | 1.5 |
| P5.2 | CD pipeline: build → tag image with git SHA → push to registry → deploy; keep last 5 images | PRA §5.2, §5.3 | 1 |
| P5.3 | Rollback procedure: documented + drilled (pull previous SHA, restart) / Vercel instant rollback | PRA §5.3 | 0.5 |
| P5.4 | Secrets management: source prod secrets from AWS SSM / Vercel env; startup validation of required env vars | PRA §5.5 | 1 |
| P5.5 | Runbooks: incident response, backup/restore, deploy, rollback, on-call | PRA §3.1, §5.3 | 1 |
| P5.6 | Pilot with one bank on real data; monitor; iterate | — | 1 |

**Dependencies:** all prior phases.
**Exit criterion:** A deploy can be rolled back in minutes and the procedure has
been rehearsed; staging matches prod; a pilot bank is live on real data with
backups, monitoring, and alerting confirmed working.

---

## 9. Dependency graph (critical path)

```
P0 (CI + harness)
 └─> P1 (regulatory 100% + route tests)   ← correctness gate, highest priority
       ├─> P2 (durability: backups, migrations, sessions)
       ├─> P3 (observability + security headers)   [parallel to P2]
       └─> P4 (scale, resilience, decomposition, E2E)
             └─> P5 (staging, rollback, pilot, go-live)
```

P2 and P3 can run in parallel once P1 is done. P4's data-path swap (P4.1) and
component decomposition (P4.8) depend on P1's tests to be safe. P5 gates on
everything.

---

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tests surface existing regulatory bugs | **High** | High (good — that's the point) | P1.7 buffer; treat each as a finding, trace to the regulation, fix with a test |
| In-memory → DB swap changes numbers subtly | Medium | High | P1 route/regulatory tests as the golden reference before P4.1 |
| Supabase restore untested until needed | Medium | Critical | P2.2 explicitly tests restore to a clean instance |
| `esrm-tab` decomposition introduces UI regressions | Medium | Medium | Do P4.9/P4.10 (component + E2E tests) alongside, not after |
| Scope creep delays correctness work | Medium | High | P0+P1 are fixed, front-loaded, and gated; later phases flex |
| Single-instance caches break under multi-replica | Medium | Medium | P4.3 cache audit before enabling ≥2 replicas |

---

## 11. Milestones (suggested gates for review)

| Milestone | Phases | Meaning |
|-----------|--------|---------|
| **M1 — Guarded** | P0 | Nothing merges without passing CI. |
| **M2 — Provably correct** | P1 | The regulatory core is 100% tested; routes verified. **This is the gate before any real bank data touches the system.** |
| **M3 — Durable** | P2, P3 | Data recoverable, changes versioned, system observable and defended. |
| **M4 — Resilient** | P4 | Scales, degrades gracefully, maintainable, E2E-guarded. |
| **M5 — Live** | P5 | Pilot bank in production with rollback rehearsed. |

---

## 12. Maintenance note

This plan supersedes the ad-hoc roadmap tables in
`PRODUCTION_READINESS_ASSESSMENT.md` §Remediation Roadmap and the "Remaining
Phase 1/2" lists in `CLAUDE.md` — those remain accurate as source detail, but
this document is the single sequenced view. When an item ships, check it off
here and in the source doc. When priorities shift, update the phase tables and
the dependency graph together.
