# Production Readiness Assessment — jana-bfi-demo

**Date:** 2026-08-25 (updated 2026-08-27; reviewed 2026-09-09)
**Scope:** Full assessment of scalability, reliability, durability, security, deployability, and test coverage.
**Branch:** `feature/20260907_1`
**Current state:** Sales demo application. This assessment identifies what has been addressed and what remains.

---

## Overall Readiness Rating

| Dimension | Rating | Summary |
|-----------|--------|---------|
| **Scalability** | N/A | In-memory portfolio is fit for purpose (demo). Not a production bottleneck — see §1.1. |
| **Reliability** | 3.5/5 | Health check added; graceful degradation good; no monitoring or structured logging yet |
| **Durability** | 2/5 | Supabase-dependent; no backup strategy; no migration system |
| **Security** | 4.5/5 | Rate limiting added (demo-exempt); tenant cookie validated; MIME validation on upload; shared auth helpers. Needs CSP/HSTS headers. |
| **Deployability** | 3/5 | Docker well-configured with HEALTHCHECK; no CI/CD pipeline, no automated testing, no rollback strategy |
| **Test Coverage** | **1/5** | **Zero automated tests.** Only safeguards are TypeScript strict mode and 10 build-time guard scripts (structure, not regulatory correctness). See §6 and `TEST_STRATEGY.md`. |

**Overall: Fit for demo use. Operational gaps (CI/CD, backups, logging) and — for any production path handling real regulatory data — the total absence of automated tests remain the blocking concerns.**

---

## 1. Scalability Assessment

### 1.1 In-Memory Portfolio — Fit for Purpose (NOT A BLOCKER)

**Current state:** The demo loads 80,035 fabricated loans (~2.7 MB gzipped) into memory on first request. Every query does a full O(n) scan of the array.

**Why this is acceptable:** This is a demo application serving fabricated data. The 80K-loan portfolio exists to make the demo feel real. A production banking platform would use the Jana platform (Django/Postgres), not this Next.js app. The provider pattern already supports the transition: `getDemoProvider()` returns null in a live build, and routes fall through to Supabase queries.

**When it would matter:** Only if a bank wanted to pilot with their real portfolio in this UI — at which point the app would point at Supabase tables populated by a real ingestion pipeline, bypassing the in-memory path entirely. There is no scenario where this demo needs to scale past its current data volume.

**Status: Dropped from remediation roadmap.**

### 1.2 No Horizontal Scaling Strategy — HIGH

**Current state:** The application is a single Next.js standalone server behind a Docker container. There is no load balancer configuration, no auto-scaling, no worker pool management.

**Impact:**
- A single container handles all traffic. If it crashes, the application is down.
- Next.js standalone server is single-process by default. CPU-bound operations (portfolio filtering, PDF generation, Excel export) block the event loop.

**Remediation plan:**
1. **Add `cluster` mode** or deploy behind a load balancer with 2+ replicas.
2. **Move PDF/Excel generation to background workers.** Currently, report generation happens synchronously in the request handler — a large Excel export can block the event loop for seconds.
3. **Stateless design audit:** Verify all state is in cookies or Supabase (it appears to be). Module-level caches (`facilityCache`, `nplLocationCache`) would need to be per-instance or moved to Redis.

### 1.3 Pagination is Client-Side for In-Memory Data — MEDIUM

**Current state:** `lib/data/portfolio-query.ts` loads all matching loans, sorts them in memory, then slices for the requested page. This means page 1 and page 100 both scan the entire dataset.

**Remediation plan:**
- With the Postgres migration (1.1 above), use `LIMIT`/`OFFSET` or keyset pagination at the database level.
- The existing `queryLoans()` function signature is well-designed for this transition — it already returns `{ rows, total, page, pageSize }`.

### 1.4 No CDN or Static Asset Caching — LOW

**Current state:** All static assets (JS bundles, CSS, images, tour audio MP3s) are served directly by the Next.js server. There is no CDN configuration.

**Remediation plan:**
- Deploy behind CloudFront, Vercel Edge, or Cloudflare.
- Next.js static assets (`/_next/static/`) are immutable-hashed and safe to cache aggressively.
- Tour audio files (`/audio/`) are large and should be cached at the edge.

---

## 2. Reliability Assessment

### 2.1 ~~No Health Check Endpoint~~ — RESOLVED

`GET /api/health` added (`app/api/health/route.ts`). Returns `{ status: "ok", timestamp, demo }`. Dockerfile includes `HEALTHCHECK` via wget. Health endpoint excluded from rate limiting so orchestrator polls are not throttled.

### 2.2 No Monitoring or Alerting — HIGH

**Current state:** The application logs to stdout via `console.log`. There are no metrics, no APM integration, no error tracking (Sentry, Datadog, etc.), and no alerting.

**Impact:**
- Errors go unnoticed until a user reports them.
- Performance degradation is invisible.
- Capacity planning is impossible without usage metrics.

**Remediation plan:**
1. **Phase 1:** Add structured logging (pino or winston) with JSON output. Add request duration logging to middleware.
2. **Phase 2:** Integrate error tracking (Sentry recommended for Next.js — has official SDK).
3. **Phase 3:** Add Prometheus metrics endpoint (`/metrics`) or integrate with CloudWatch/Datadog for:
   - Request rate, latency (p50, p95, p99)
   - Error rate by endpoint
   - Active connections
   - Memory/CPU utilization

### 2.3 Graceful Degradation is Well-Implemented — POSITIVE

The application handles infrastructure failures gracefully:
- Missing Supabase → falls back to in-memory synthesizer
- Failed API calls → returns honest errors, not fabricated data
- Missing climate data → returns partial response with enrichment flags

This is a strong foundation for reliability.

### 2.4 Supabase Client Singleton Has No Reconnection Logic — MEDIUM

**Location:** `lib/data/supabase.ts:15-40`

The Supabase client is created once and cached forever (`let cached`). If the connection breaks (network partition, Supabase maintenance, credential rotation), there is no recovery path. All subsequent requests will fail until the container is restarted.

**Remediation plan:**
- Add a health check to the Supabase client (e.g., `SELECT 1`).
- On failure, clear the cached client and recreate on next request.
- Or use Supabase's built-in reconnection (verify if the JS client handles this).

### 2.5 ~~Synchronous File I/O on Cold Start~~ — RESOLVED

Portfolio loader (`lib/demo/portfolio.ts`) converted to async: uses `fs.promises.readFile` + `promisify(zlib.gunzip)` instead of synchronous variants. All callers updated.

### 2.6 No Circuit Breaker for External Dependencies — LOW

**Current state:** External API calls (Jana API, OpenAQ, EDGAR) have basic error handling but no circuit breaker pattern. If an upstream service is down, every request will attempt the call, wait for timeout, and fail.

**Remediation plan:**
- Implement circuit breaker pattern for external API calls (open after N consecutive failures, half-open after cooldown).
- Or simply ensure all external data is pre-ingested (per the data sourcing policy in CLAUDE.md).

---

## 3. Durability Assessment

### 3.1 No Backup Strategy for Supabase Data — CRITICAL

**Current state:** Officer captures (ESDD responses, PCAF evidence, taxonomy assessments, loan assignments) are stored in Supabase Cloud. There is no documented backup strategy, no point-in-time recovery configuration, and no data export/import tooling.

**Impact:** If Supabase data is lost (accidental deletion, provider incident), all officer work is gone with no recovery path.

**Remediation plan:**
1. **Enable Supabase's built-in backups** (daily automated backups, PITR if on Pro plan).
2. **Add data export functionality** — periodic dump of all `bfi_*` tables to S3.
3. **Test restore procedure** — verify backups can be restored to a clean instance.
4. **Document recovery playbook** — RTO/RPO targets, restore steps, responsible parties.

### 3.2 No Database Migration System — HIGH

**Current state:** Schema changes are managed via:
- `scripts/supabase-*.sql` — manual SQL files applied by hand to Supabase Cloud
- `docker/postgres/initdb.d/*.sql` — auto-run on first boot of offline stack only
- `check-capture-client.mjs` — build-time guard that detects drift between app code and schema

This works for a demo but is fragile:
- No version tracking (which migrations have been applied?)
- No rollback capability
- No way to apply incremental changes (offline stack requires `down -v`)
- Two copies of schema SQL (`scripts/` and `docker/postgres/initdb.d/`) can drift

**Remediation plan:**
1. Adopt a migration tool. Options:
   - **Supabase CLI migrations** (if staying with Supabase)
   - **Prisma Migrate** (if adding an ORM)
   - **Simple numbered SQL files** with a `schema_migrations` version table
2. Single source of truth for schema: generate `initdb.d` from migration files, not the reverse.
3. Add `migrate` command to Docker compose services.

### 3.3 Cookie-Based State is Ephemeral — MEDIUM

**Current state:** Tenant identity, officer selection, and demo mode are stored in HTTP cookies. These are lost when:
- Browser cookies are cleared
- Cookie expires
- User switches browser/device

**Impact:** For a demo, this is acceptable. For production, users expect persistent sessions.

**Remediation plan:**
- Move session state to server-side storage (Supabase `sessions` table or Redis).
- Use a session ID cookie that references server-side state.
- Add session expiry and renewal logic.

### 3.4 Evidence Files Stored in Supabase Storage — MEDIUM

**Current state:** Uploaded evidence files (PDFs, images) are stored in Supabase Storage. There is no documented retention policy, no lifecycle management, and no cross-region replication.

**Remediation plan:**
- Document retention policy (how long are evidence files kept?).
- Enable versioning on the storage bucket.
- For regulatory compliance, consider immutable storage (WORM) for audit evidence.

### 3.5 Precomputed Portfolio is a Single Point of Truth — LOW

**Location:** `lib/demo/precomputed-portfolio.json.gz`

The precomputed portfolio is baked into the Docker image at build time. If this file is corrupted or missing, the demo falls back to in-memory synthesis (~20s cold start). There is no validation that the precomputed data matches the current code version.

**Remediation plan:**
- `precompute-guard.mjs` already validates this at build time. Verify it catches version mismatches.
- Add a hash/version field to the precomputed JSON for runtime verification.

---

## 4. Security Assessment

### 4.1 Application-Layer Security is Strong — POSITIVE

The application demonstrates mature security practices:

- **Zero SQL injection risk** — all database access through parameterized Supabase client
- **Consistent tenant isolation** — every query scopes to `bank_id`
- **Owner-only enforcement** — `assertOwnerOrRespond()` prevents cross-officer data manipulation
- **Input validation** — strict enum validation on all answer fields, whitelist-based filtering
- **No secrets in code** — all credentials from environment variables
- **HTTP-only cookies** — officer and tenant cookies are HTTP-only with SameSite=strict
- **PDF magic byte validation** — prevents garbage output in report downloads
- **Content-Disposition escaping** — prevents header injection in file downloads

### 4.2 ~~No Rate Limiting~~ — RESOLVED

In-memory sliding-window rate limiter added in `middleware.ts` (100 req/min per IP). Demo builds (`JANA_DEMO=1`) are exempt — a bank demo room behind one NAT shares a single IP and a single page load fires 6+ API calls, so even a small group would trip the limit.

**Caveats documented in `lib/api/rate-limit.ts`:** `x-forwarded-for` is taken from the request unconditionally. An attacker can rotate the header to bypass the limit while legitimate users behind a proxy are penalised. Behind a trusted reverse proxy (ALB, CloudFront) that overwrites the header, the value is reliable. A WAF or CDN rate limit should be the primary defence; this layer is a backstop for casual abuse only.

### 4.3 No CORS Configuration — MEDIUM

**Current state:** No explicit CORS headers are set. Next.js defaults to same-origin, which is correct for a server-rendered application. However, if the API is ever called from a different domain (e.g., a mobile app or partner integration), CORS would need to be configured.

**Remediation plan:**
- Add explicit CORS configuration in `next.config.ts` or middleware.
- Whitelist only expected origins.

### 4.4 No Content Security Policy (CSP) — MEDIUM

**Current state:** No CSP headers are sent. The application renders user-provided data (borrower names, officer names) in the UI without CSP protection.

**Impact:** If any XSS vector exists (even in a future code change), there is no CSP to mitigate it.

**Remediation plan:**
- Add CSP headers via `next.config.ts`:
  ```typescript
  headers: async () => [{
    source: '/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org;"
    }]
  }]
  ```
- Tighten `unsafe-inline` as the application matures.

### 4.5 No HTTPS Enforcement — MEDIUM

**Current state:** The application serves HTTP on port 3000. HTTPS termination is expected to happen upstream (load balancer, reverse proxy), but there is no enforcement mechanism.

**Remediation plan:**
- Add `Strict-Transport-Security` header.
- Add HTTP-to-HTTPS redirect in middleware (or rely on the upstream load balancer).
- Set `secure: true` on all cookies when deployed behind HTTPS.

### 4.6 Seed Admin Token Should Be Rotatable — LOW

**Current state:** `SEED_ADMIN_TOKEN` is set via environment variable. There is no rotation mechanism and no audit logging when admin endpoints are called.

**Remediation plan:**
- Add audit logging to all `/api/admin/*` endpoints (who called, when, from where).
- Document token rotation procedure.
- Consider time-limited tokens or TOTP for admin operations.

---

## 5. Deployability Assessment

### 5.1 Docker Configuration is Well-Engineered — POSITIVE

Strengths:
- **Multi-stage build** minimizes image size (builder + runner stages)
- **Non-root user** (`nextjs:nodejs` with UID/GID 1001)
- **Standalone output** — no `node_modules` in production image
- **Build arg propagation** — `JANA_DEMO` correctly crosses FROM boundaries
- **Asset permissions** — `chmod -R a+rX ./public` handles permission issues
- **Two compose files** — online (real APIs) and offline (self-contained Postgres stack)
- **Documented thoroughly** — every Dockerfile line has a comment explaining *why*

### 5.2 No CI/CD Pipeline — CRITICAL

**Current state:** There are no GitHub Actions workflows, no CI configuration, no automated build/test/deploy pipeline.

The build-time guard scripts (`check-*.mjs`) run as part of `npm run build` but:
- There is no automated trigger on push/PR
- There is no automated testing step
- There is no automated deployment step
- There is no image push to a container registry

**Remediation plan:**
1. **Phase 1: CI pipeline** (GitHub Actions)
   ```yaml
   # .github/workflows/ci.yml
   on: [push, pull_request]
   jobs:
     build:
       steps:
         - npm ci
         - npm run lint
         - npm run prebuild  # guard scripts
         - npm run build:demo
         - npm run build:live  # verify both build targets work
         # Future: npm test
   ```
2. **Phase 2: CD pipeline**
   ```yaml
   # .github/workflows/deploy.yml
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       steps:
         - docker build
         - docker push to ECR/registry
         - deploy to ECS/Vercel
   ```
3. **Phase 3: Environment promotion**
   - staging environment for pre-production validation
   - production deployment with approval gate

### 5.3 No Rollback Strategy — HIGH

**Current state:** There is no documented or automated rollback procedure. If a deployment introduces a bug, the only option is to build and deploy a previous commit.

**Remediation plan:**
- Tag Docker images with git SHA.
- Keep the last 5 images in the registry.
- Document rollback: `docker pull <registry>/<image>:<previous-sha> && restart service`.
- For Vercel: use Vercel's built-in instant rollback.

### 5.4 No Environment Parity — MEDIUM

**Current state:** Three deployment modes exist with different behavior:
- `npm run dev` — Next.js development server (hot reload, verbose errors)
- `docker compose up` — Production mode against real APIs
- `docker compose -f docker-compose.offline.yml up` — Self-contained with local Postgres

There is no staging environment that mirrors production configuration.

**Remediation plan:**
- Add a staging compose file or deployment target.
- Ensure staging uses the same database engine, authentication flow, and data volume as production.

### 5.5 Environment Variable Management — MEDIUM

**Current state:** Environment variables are managed via:
- `.env.local` (local development, gitignored)
- `.env.local.example` (template, committed)
- Docker compose `environment:` blocks (hardcoded defaults)
- Dockerfile `ARG`/`ENV` declarations

There is no secrets management service integration (AWS SSM, Vault, etc.) for production credentials.

**Remediation plan:**
- For production: source secrets from AWS SSM Parameter Store or Secrets Manager.
- For Vercel: use Vercel Environment Variables (encrypted at rest).
- Never commit `.env.local` (already gitignored).
- Add a startup script that validates all required env vars are present before the application starts.

### 5.6 No Graceful Shutdown Handling — MEDIUM

**Current state:** The container runs `CMD ["node", "server.js"]`. When Docker sends `SIGTERM` during a rolling deployment, Node.js will immediately terminate, dropping any in-flight requests.

**Remediation plan:**
- Add a `SIGTERM` handler that:
  1. Stops accepting new connections
  2. Waits for in-flight requests to complete (with a timeout)
  3. Closes the Supabase client
  4. Exits cleanly
- Add `STOPSIGNAL SIGTERM` to Dockerfile.
- Set Docker's `stop_grace_period` to match the drain timeout (e.g., 30s).

---

## 6. Test Coverage Assessment

**Full detail and the remediation plan live in `TEST_STRATEGY.md`.** This
section summarises the state for the readiness scorecard.

### 6.1 Zero Automated Tests — CRITICAL (for a production path)

**Current state:** There are no automated tests of any kind — no unit tests,
no integration tests, no end-to-end tests, and no test runner configured.
`playwright` is a devDependency but is used only for screenshot capture
(`scripts/capture-screenshots.ts`); there is no `playwright.config.ts` and no
test suite.

**Impact:** Every change is verified by hand. There is no automated guard
against a regression in the regulatory computation — the ~8,200 lines in
`lib/regulatory/**` that turn borrower answers into PCAF scores, ESDD risk
classes, and green-taxonomy classifications. For a sales demo this is
tolerable. For any deployment where a bank relies on these numbers for an NRB
filing, it is the single largest correctness risk in the system.

### 6.2 Existing Safeguards Are Structural, Not Behavioural — CONTEXT

Two automated safety nets exist and should be retained:

- **TypeScript strict mode** — catches type errors at compile time.
- **10 build-time guard scripts** (`scripts/check-*.mjs`, run in `prebuild`) —
  enforce architectural invariants: demo/live separation, Supabase provenance
  filtering, no fabricated officers in live audit trails, Docker flag wiring.

These verify **structure** (does the code wire together correctly) but not
**behaviour** (is a computed PCAF score correct). None of them would catch a
misread regulation that produces a wrong-but-well-typed number.

### 6.3 Recommendation — CRITICAL

Adopt the three-layer strategy in `TEST_STRATEGY.md`:

1. **Vitest** (the "pytest for TypeScript") for unit + integration tests, with
   a **CI-enforced 100% line + branch coverage gate on `lib/regulatory/**`** —
   the mechanism that makes "zero-tolerance" real for compliance logic.
2. **@testing-library/react** for the wizards that drive lending decisions.
3. **Playwright** (already installed) for 6 critical end-to-end journeys.

Single-command execution (`npm test`) runnable after every change; wired into
the CI pipeline (§5.2) so it gates every merge. Estimated ~2.5–3.5
engineer-weeks, front-loaded so the compliance-critical core (Tier 1) is
protected in the first week.

---

## Remediation Roadmap

### Resolved (Phases 1–4 commits)

| Item | Section | Status |
|------|---------|--------|
| Health check endpoint + Dockerfile HEALTHCHECK | 2.1 | Done |
| Rate limiting in middleware (demo-exempt) | 4.2 | Done |
| Tenant cookie validated against registry | (Code Review 1.6) | Done |
| MIME type + magic byte validation on upload | (Code Review 1.3) | Done |
| Request body size guard (256 KB) | (Code Review 1.2) | Done |
| Shared route helpers (apiError, requireOfficer, requireCaptureClient, requireAdminToken) | (Code Review 3.1–3.4) | Done |
| Admin auth accepts Bearer header | (Code Review 1.5) | Done |
| Async gzip I/O on cold start | 2.5 | Done |
| Centralised constants (file size, body size) | (Code Review 2.6) | Done |
| Dead code removed (retry.ts, .eslintrc.json, unused constants) | — | Done |

### Dropped (not applicable to demo)

| Item | Section | Rationale |
|------|---------|-----------|
| Migrate in-memory portfolio to Postgres | 1.1 | Demo serves fabricated data at fixed scale. Provider pattern already supports the transition if needed. See §1.1. |
| Materialized views for aggregates | 1.1 | Same — aggregates are over the in-memory portfolio, not a production database. |

### Phase 1: Remaining items

| # | Item | Section | Effort | Priority |
|---|------|---------|--------|----------|
| 1 | Add CI/CD pipeline (build + lint + guards + tests) | 5.2, 6.3 | 1 day | CRITICAL |
| 2 | Test harness + 100% coverage on `lib/regulatory/**` (Tier 1) | 6.3 | 3–5 days | CRITICAL (before any real-data path) |
| 3 | Enable Supabase backups | 3.1 | 2 hours | CRITICAL |
| 4 | Add structured logging | 2.2 | 1 day | HIGH |
| 5 | Add CSP and security headers | 4.4, 4.5 | 4 hours | MEDIUM |
| 6 | Add SIGTERM graceful shutdown | 5.6 | 4 hours | MEDIUM |
| 7 | Document rollback procedure | 5.3 | 2 hours | HIGH |

### Phase 2: Production Hardening (if needed)

| # | Item | Section | Effort |
|---|------|---------|--------|
| 8 | Add error tracking (Sentry) | 2.2 | 1 day |
| 9 | Add database migration system | 3.2 | 2-3 days |
| 10 | Tier 2 tests — API route handlers (auth, tenant isolation, input validation) | 6.3, `TEST_STRATEGY.md` §4.2 | 3-4 days |
| 11 | Tier 3 tests — wizard components that drive lending decisions | 6.3, `TEST_STRATEGY.md` §4.3 | 3-5 days |
| 12 | E2E tests — 6 critical journeys (Playwright) | 6.3, `TEST_STRATEGY.md` §5.3 | 2-3 days |
| 13 | Move session state server-side | 3.3 | 2 days |
| 14 | Add metrics/APM integration | 2.2 | 2 days |
| 15 | Deploy behind CDN | 1.4 | 1 day |
| 16 | Add Supabase client reconnection | 2.4 | 4 hours |
| 17 | Horizontal scaling (multi-replica) | 1.2 | 1 week |

---

## Appendix: Current Architecture Diagram

```
                         ┌─────────────┐
                         │   Browser    │
                         └──────┬──────┘
                                │ HTTPS (via LB/Vercel)
                                ▼
                    ┌──────────────────────┐
                    │   Next.js Standalone  │
                    │   (Node.js, port 3000)│
                    │                      │
                    │  ┌────────────────┐  │
                    │  │  middleware.ts  │──┼── Tenant cookie gate
                    │  └────────────────┘  │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │  API Routes    │──┼── 41 endpoints
                    │  │  (app/api/)    │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────▼────────┐  │
                    │  │  In-Memory     │  │   (demo only)
                    │  │  Portfolio     │  │
                    │  │  Cache         │  │
                    │  └────────────────┘  │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  Supabase    │  │  Jana API    │  │  OpenAQ /    │
     │  (Postgres)  │  │  (internal)  │  │  EDGAR APIs  │
     │              │  │              │  │  (via Jana)  │
     │  Officer     │  │  Emissions   │  │  Air quality │
     │  captures,   │  │  data,       │  │  snapshots   │
     │  settings,   │  │  facility    │  │              │
     │  assignments │  │  data        │  │              │
     └──────────────┘  └──────────────┘  └──────────────┘
```

### Offline Architecture (docker-compose.offline.yml)

```
     ┌─────────────┐
     │   Browser    │
     └──────┬──────┘
            │ HTTP :3002
            ▼
  ┌──────────────────┐
  │  Next.js Web     │──── JANA_DEMO=1, MOCKS=true
  │  (container)     │     No external API calls
  └────────┬─────────┘
           │ HTTP :80
           ▼
  ┌──────────────────┐
  │  Nginx Gateway   │──── Strips /rest/v1/ prefix
  │  (supabase-gw)   │     Makes PostgREST look like Supabase
  └────────┬─────────┘
           │ HTTP :3000
           ▼
  ┌──────────────────┐
  │  PostgREST       │──── Supabase-compatible REST API
  └────────┬─────────┘
           │ postgres://
           ▼
  ┌──────────────────┐
  │  PostgreSQL 15   │──── bfi_demo database
  │  (alpine)        │     initdb.d/ for schema
  └──────────────────┘
```

---

## Conclusion

The jana-bfi-demo codebase is a well-architected sales demonstration application with strong security fundamentals, excellent documentation, and thoughtful design decisions (particularly the demo/live build-time boundary).

**Resolved since initial assessment:** Health check endpoint, rate limiting (demo-exempt with documented caveats), tenant cookie validation, MIME validation on upload, request body size guards, shared route helpers eliminating boilerplate across 41 routes, async I/O on cold start, and dead code removal.

**Remaining gaps for any production path:**
1. **Automated tests** — zero today. The ~8,200 lines of regulatory computation (`lib/regulatory/**`) that produce PCAF scores, ESDD risk classes, and green-taxonomy classifications have no behavioural verification. For any path where a bank relies on these numbers for an NRB filing, this is the single largest correctness risk. See `TEST_STRATEGY.md`.
2. **CI/CD pipeline** — no GitHub Actions, no automated build/test/deploy. Should land together with the test harness so tests gate every merge.
3. **Supabase backups** — operational, not code
4. **Structured logging** — still console.log everywhere
5. **Security headers** — CSP and HSTS not configured
6. **Graceful shutdown** — SIGTERM handling for zero-downtime deploys

The in-memory portfolio was dropped from the roadmap — it is fit for purpose as a demo and the provider pattern already supports a database-backed path if product direction changes.

**Note on scope:** as a *sales demo* serving fabricated data, the app is in good shape — strong security fundamentals, clean demo/live separation, well-engineered Docker. The testing gap is a blocker specifically for a path where a real bank's real regulatory numbers are computed and filed. `TEST_STRATEGY.md` lays out a ~2.5–3.5 engineer-week plan, front-loaded so the compliance-critical core is protected first.
