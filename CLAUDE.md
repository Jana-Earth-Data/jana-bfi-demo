# CLAUDE.md — jana-bfi-demo

## What this is

Next.js 15 sales-demo dashboard for Nepal banking sector. Covers 5 regulatory frameworks (NRB ESRM, Green Finance Taxonomy, PCAF, IFC Performance Standards, CAP/Monitoring). Dual-mode architecture: demo (80K fabricated loans) vs live (real officer captures via Supabase). Deployed on Vercel.

## Production readiness work — status as of 2026-08-27

A full code review and production readiness assessment were completed. Four hardening phases have been done. Remaining work is documented below.

### Key documents (read these before resuming)

- `CODE_REVIEW_REPORT.md` — full codebase audit (40 routes, ~30 components, ~50 lib modules). 0 critical, 3 high, 9 medium, 9 low findings.
- `PRODUCTION_READINESS_ASSESSMENT.md` — scored assessment with remediation roadmap. Updated 2026-08-27.
- `ARCHITECTURE.md` — technical architecture with mermaid diagrams.

### Already completed (Phases 1-4)

- Rate limiting middleware (demo-exempt)
- Health check endpoint + Dockerfile HEALTHCHECK
- Shared route helpers (eliminated boilerplate across 40 routes)
- Request body size guard (256 KB)
- MIME type + magic byte validation on upload
- Async gzip I/O on cold start
- Admin auth accepts Bearer header
- Dead code removal
- Vercel deployment fix (`JANA_DEMO=1`)
- Centralized constants

### Remaining Phase 1 (high priority)

1. CI/CD pipeline (GitHub Actions) — ~1 day
2. Supabase backups — ~2 hours (critical for officer data)
3. Structured logging (replace console.*) — ~1 day
4. CSP and security headers — ~4 hours
5. SIGTERM graceful shutdown — ~4 hours
6. Rollback procedure documentation — ~2 hours
7. Admin token query string normalization

### Remaining Phase 2 (production hardening, if needed)

- Error tracking (Sentry)
- Database migration system
- Unit tests for regulatory logic
- Server-side session state
- Metrics/APM integration
- CDN deployment
- Supabase client reconnection
- Horizontal scaling
- E2E tests (Playwright)

### Open high-severity code review items

- `src/components/esrm-tab.tsx` is ~3,100 lines — needs decomposition
- No automated tests exist

## Git workflow

Uses the standard feature branch workflow from the parent CLAUDE.md. Current working branch: `feature/20260825_1`. Target: `main`.
