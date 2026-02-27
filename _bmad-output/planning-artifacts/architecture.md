---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-14'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-vlprs-2026-02-13.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - docs/vlprs/1-CONCEPT-NOTE.md
  - docs/vlprs/2-PRD.md
  - docs/vlprs/3-DATA-MIGRATION-PLAN.md
  - docs/vlprs/4-GOVERNANCE-PACK.md
  - docs/vlprs/5-ROLLOUT-PLAN.md
  - docs/vlprs/6-CABINET-PRESENTATION.md
  - docs/vlprs_council_slides_rollout_pack_rbac.md
  - docs/vlprs_cabinet_pack_prd_business_proposal.md
  - docs/vehicle_loan_lifecycle_payroll_reconciliation_system_concept_prd_state_machine_compliance.md
workflowType: 'architecture'
project_name: 'vlprs'
user_name: 'Awwal'
date: '2026-02-15'
editHistory:
  - date: '2026-02-27'
    changes: 'Party Mode sessions — FR83-FR86 cascade: Updated FR inventory 82→86 across 17 categories (added Data Export & Self-Service category). Added export endpoint pattern: GET /api/loans/export?format=csv|pdf — reuses searchLoans() query with MDA scoping, outputs to file format. Added loans:export RBAC permission for all 3 MVP roles (scoped by role). Added SubmissionHeatmap data source: GET /api/submissions/heatmap?months=12 — returns per-MDA per-month submission status grid (submitted_at, status classification). Added beneficiary cross-reference service: crossReferenceService — joins approved beneficiary lists against deduction records by Name+MDA. No architectural decisions changed. Side Quest SQ-1 scripts in scripts/legacy-report/ — standalone Node.js, imports computation engine pure functions, no DB dependency, zero collision with main app.'
  - date: '2026-02-21'
    changes: 'Asset inventory & leadership roster: Added public/images/ directory structure (branding/ for Oyo crest in SVG/WebP/PNG, team/ for 6 leadership photos with web-friendly slugs). Source images in docs/team_pics/ mapped to target paths. Leadership order reflects organisational hierarchy (AG → Dir Finance & Accounts → Dir Inspectorate → Dir Treasury → Dir Admin & Supplies → Head PFMU). Updated content/about.ts description to reference 6-leader roster with photos.'
  - date: '2026-02-20'
    changes: 'About page, CMS readiness & integration extension points: Added /about route and AboutPage.tsx to public pages. Removed /scheme/ag-office (content absorbed into /about). Updated routing decision and directory structure. Updated FR inventory 81→82 (FR82 = About the Programme). Added src/content/ directory convention for CMS migration readiness (static content files → future Sanity headless CMS). Added Extension Points & Future Integration section: data ingestion abstraction (DeductionRecord[] interface), API consumer readiness (versioning path, API key auth slot), domain isolation convention (infrastructure vs domain services), event emission pattern (loan.completed, submission.processed). Added Sanity CMS to deferred technologies.'
  - date: '2026-02-20'
    changes: 'Public Website wireframes formalization: Added components/public/ directory (8 shared public components: PublicNavBar, LoginModal, PublicFooter, BreadcrumbNav, PageHeader, CtaBanner, DisclaimerCallout, ProgrammeDisclaimer). Added public zone page template pattern (4 templates: Content Page, Card Grid, Placeholder, Homepage) to Pattern Categories. Updated routing decision to reference page templates. Updated PublicLayout description. Added wireframes-epic-14.md as canonical wireframe reference. No architectural decisions changed.'
  - date: '2026-02-20'
    changes: 'Epic 14 (Public Website & Scheme Information) integration: Expanded public zone routing from 4 routes to full public site (/, /scheme/*, /how-it-works, /resources/*, /support, /privacy, /disclaimer, /accessibility, /eoi, /login). Expanded pages/public/ directory from 4 files to 20 files organised in scheme/, resources/, legal/ subdirectories. All sprint references incremented by 1 (Sprint 2 now reserved for Epic 14). Updated FR inventory references (FR76-FR81). No architectural decisions changed.'
  - date: '2026-02-19'
    changes: 'User invitation pull-forward: emailService.ts (Resend integration) now required in Sprint 1 for welcome emails and password reset emails (previously deferred to Epic 9/13). Added EMAIL_FROM to environment variables. Added userAdminService.ts to Sprint 1 scope. Added CLI commands pnpm user:create-admin and pnpm user:deactivate-admin for super admin lifecycle management. Added must_change_password column to users table. Elevated ux-design-directions.html to canonical visual reference for all UI implementation. No architectural decisions changed.'
  - date: '2026-02-18'
    changes: 'OSLRS playbook integration: Added Playwright to testing strategy (three-layer quality: Vitest → Playwright → UAT). Added packages/testing/ shared test utilities workspace (factories, helpers, setup). Added role constants single source of truth convention (rule 8 — never hardcode role strings). Added TanStack Query hook naming convention (rule 9 — use<Action><Entity>). Added seed-production.ts for initial super admin from env vars. Added SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD to environment variables. No architectural decisions changed.'
  - date: '2026-02-17'
    changes: 'Story 1.8 alignment: Updated implementation sequence step 5 to include screen scaffolding with mock data layer and CI/CD deployment. Added mock data directory (src/mocks/) to frontend source structure. Added seed-demo.ts to database directory. Added mock-first hook pattern note to hooks section. Added VITE_SPRINT_LABEL, VITE_NEXT_MILESTONE, and DEMO_SEED_PASSWORD to environment variables. Added pnpm seed:demo to development workflow commands. Updated cross-component dependencies with mock data wiring pattern. No architectural decisions changed.'
  - date: '2026-02-15'
    changes: 'PRD cascade (FR60-FR75): updated FR inventory from 59→75 across 15 categories. Added 6 new services (preSubmission, employmentEvent, temporalValidation, earlyExit, userAdmin, staffId), 4 new route groups, 5 new client pages, 5 new hooks, 3 new shared type modules, 4 new validator schemas. Added 3 data flow diagrams (submission with pre-submission checkpoint, early exit lifecycle, mid-cycle event). Updated cross-cutting concerns (temporal validation, Staff ID uniqueness), technical constraints (8-field CSV, temporal data required), service boundaries (16 services), and requirements coverage validation. Updated completeness checklist and readiness assessment.'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (82 FRs across 16 categories):**

| Category | FRs | Architectural Weight |
|----------|-----|---------------------|
| Loan Computation & Financial Engine | FR1-FR9 | **Critical** — deterministic, 100% accuracy, banking-grade, 4 tiers parameterised |
| Data Management & Immutable Ledger | FR10-FR15 | **Critical** — append-only ledger, computed views, no UPDATE/DELETE, temporal profile (DOB, appointment date, computed retirement date) |
| MDA Monthly Submission | FR16-FR24 | High — 8-field CSV with conditional fields (event date, cessation reason), atomic upload, validation, comparison engine, neutral language |
| Data Migration | FR25-FR31 | High — column mapping, variance categorisation, baseline creation, temporal data required |
| Executive Dashboard & Reporting | FR32-FR41 | High — real-time aggregation, PDF generation, drill-down, early exit and gratuity receivable metrics |
| Access Control & Authentication | FR42-FR48 | High — 3 MVP roles, API-level RBAC, audit logging |
| Notifications & Alerts | FR49-FR52 | Medium — email (MVP), SMS (fast-follow), scheduled reminders |
| Report Output & Sharing | FR53-FR54 | Medium — branded PDF with Oyo State crest, one-tap share + email attachment |
| Exception Management + Annotations | FR55-FR59 | Medium — priority queue, auto-flagging, correction workflow |
| Pre-Submission & Mid-Cycle Events | FR60-FR62 | High — pre-submission checkpoint, mid-cycle event filing, cross-validation engine reconciling events against CSV |
| Retirement & Tenure Validation | FR63-FR66 | High — retirement date computation (min of DOB+60y, appointment+35y), tenure vs service comparison, gratuity receivable tracking, service extension overrides |
| Early Exit Processing | FR67-FR69 | High — early exit computation workflow with state machine (Computed → Committed → Paid → Closed / Expired), lump sum payoff, Auto-Stop trigger |
| Historical Data & Migration Reconciliation | FR70-FR71 | Medium — historical CSV upload, cross-reference against migration baseline, service status verification report |
| User & Account Administration | FR72-FR73 | Medium — user CRUD by Dept Admin/Super Admin, password reset, account lifecycle audit logging |
| Staff ID Governance | FR74-FR75 | Medium — Staff ID add/update with system-wide duplicate detection, justification logging |
| Public Website & Scheme Information | FR76-FR82 | Medium — static public zone pages (homepage, about, scheme info, resources, legal), responsive navigation, login modal, 4-column footer, semantic HTML, WCAG 2.1 AA. No backend API dependencies |

**Non-Functional Requirements Driving Architecture:**

| NFR | Target | Architectural Impact |
|-----|--------|---------------------|
| Dashboard load (4G) | <3s LCP | Code splitting, API response <1KB for hero metrics |
| CSV processing (100 rows) | <10s | Server-side validation, atomic transactions |
| Search by staff ID | <2s | Database indexing strategy, query optimisation |
| System availability | 99.5% business hours | Hosting strategy, backup/restore procedures |
| Data loss tolerance | Zero | Transaction management, backup strategy, immutable ledger |
| Concurrent submissions | 63 MDAs same week | Connection pooling, transaction isolation |
| Ledger growth | 189,000+ rows over 5 years | Query performance at scale, pagination, computed view caching |
| Financial precision | Kobo-level (2dp decimal) | Decimal/numeric types, never float, rounding strategy |
| Security | OWASP Top 10, NDPR, AES-256 | Input validation, encryption, session management |
| Accessibility | WCAG 2.1 AA | Semantic HTML, ARIA, keyboard navigation |

**UX-Driven Architectural Requirements:**

- SPA with two zones: Public (unauthenticated) + Protected (role-based dashboard)
- Design system: shadcn/ui + Tailwind CSS + Radix UI
- 11 custom components designed with full specs
- Performance budgets: FCP <1.5s, LCP <3s, TTI <3.5s, dashboard route <150KB gzipped
- Responsive breakpoints: Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)
- PWA basic installability (manifest + service worker)
- PDF generation: branded reports with Oyo State crest

### Scale & Complexity

- **Primary domain:** Full-stack web (govtech-fintech)
- **Complexity level:** High
- **Data complexity:** Medium-high — relational with immutable append-only financial records, computed views, multi-tenant-like MDA isolation
- **User interaction complexity:** Medium-high — dashboard drill-down, CSV upload (8-field conditional), comparison views, exception queues, early exit workflow, mid-cycle event filing, pre-submission checkpoint, user account management, Staff ID governance
- **Integration complexity:** Low (MVP standalone) → Medium (Phase 2 external integrations)
- **Regulatory compliance:** High — NDPR, government financial audit requirements, segregation of duties
- **Estimated architectural components:** ~21 (auth, computation engine, ledger, submission, migration, dashboard, reports, notifications, exception management, PDF generation, file upload, search, RBAC, audit logging, public zone, temporal validation, early exit processing, mid-cycle events, pre-submission checkpoint, Staff ID governance, user account admin)

### Technical Constraints & Dependencies

1. **Solo developer** — architecture must maximise velocity without sacrificing correctness
2. **Nigerian 4G network** — dashboard performant on constrained bandwidth (<3s on 4G)
3. **Data sovereignty** — system and data accessible within Nigeria
4. **No floating point for money** — decimal/numeric types mandatory for all financial values
5. **Immutable ledger** — INSERT only, no UPDATE/DELETE on financial records (database + API enforced)
6. **Computed views** — balances derived from ledger entries, never stored as mutable state
7. **API-first** — all data access through structured endpoints for future integration readiness
8. **MVP standalone** — no external system integrations; 8-field CSV upload (with conditional event date and cessation reason fields) and manual entry only
9. **Non-punitive vocabulary** — API responses, error messages, and database enums must use approved terminology
10. **Temporal data required** — DOB and date of first appointment required for new loans, required in migration (flagged "Profile Incomplete" if missing). Retirement date computed, never manually set (except service extension override)

### Cross-Cutting Concerns Identified

1. **Audit logging** — every action, every module, append-only, tamper-resistant. Account lifecycle, Staff ID changes, early exit computations, service extensions all audit-logged
2. **RBAC enforcement** — API-level checks on every endpoint, MDA-scoped data isolation. User account admin scoped: Dept Admin manages MDA Officers, Super Admin manages all levels
3. **Financial computation accuracy** — 100% deterministic, kobo-precise, verifiable by auditors. Extends to early exit payoff computations and gratuity receivable projections
4. **Immutability guarantees** — database constraints + API middleware + no direct DB access
5. **Non-punitive vocabulary** — consistent across API responses, UI, error messages, database enums
6. **Input validation** — server-side at all system boundaries (CSV 8-field conditional logic, forms, API calls, mid-cycle events)
7. **Transaction atomicity** — all-or-nothing for submissions, migrations, state transitions, early exit payment recording
8. **Temporal validation** — retirement date computation (min of DOB+60y, appointment+35y), tenure vs remaining service checks, post-retirement deduction detection. Recomputed on date corrections
9. **Staff ID uniqueness** — system-wide duplicate detection on every Staff ID add/update, with justification logging for intentional overrides

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack web (govtech-fintech)** — PERN stack with separate React SPA frontend + Express REST API backend, both TypeScript, in a pnpm monorepo.

### Starter Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| **A: Monorepo (pnpm workspaces)** — Custom scaffold from official Vite + Express starters | Shared TypeScript types, single repo, full control over structure | **Selected** |
| **B: Two separate repos** (frontend + backend) | Simpler initial setup but types diverge between frontend/backend — risky for financial API contracts | Rejected — type drift unacceptable for kobo-precision system |
| **C: Pre-built PERN boilerplates** (GeekyAnts, etc.) | Outdated dependencies, no shadcn/ui, no Drizzle, no immutable ledger patterns | Rejected — more rework than starting fresh |

### Selected Starter: Monorepo with pnpm Workspaces

**Rationale for Selection:**

1. **Shared TypeScript types** — API request/response types, financial enums (loan tiers, variance categories, non-punitive vocabulary), and database entity types shared between frontend and backend in a `packages/shared` workspace. Critical for a financial system where a kobo mismatch between frontend display and backend computation is unacceptable.
2. **Solo developer velocity** — Single repo, single `pnpm install`, shared linting/formatting config. No context-switching between repos.
3. **Full control** — No opinionated boilerplate to fight against. Every architectural decision (immutable ledger, RBAC middleware, audit logging) implemented deliberately.

**Initialization Command:**

```bash
# 1. Create monorepo root
mkdir vlprs && cd vlprs
pnpm init

# 2. Create workspace config (pnpm-workspace.yaml)
# packages:
#   - "apps/*"
#   - "packages/*"

# 3. Scaffold frontend (React 18 — pinned, not React 19)
npm create vite@latest apps/client -- --template react-ts
# Then pin React 18 in apps/client/package.json:
#   "react": "^18.3.1", "react-dom": "^18.3.1"

# 4. Add shadcn/ui to frontend
cd apps/client && npx shadcn@latest init && cd ../..

# 5. Create backend workspace
mkdir -p apps/server && cd apps/server && pnpm init && cd ../..

# 6. Create shared types workspace
mkdir -p packages/shared && cd packages/shared && pnpm init && cd ../..

# 7. Install all dependencies
pnpm install
```

### Architectural Decisions Established by Starter

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Language & Runtime** | TypeScript 5.x + Node.js | Full-stack type safety, solo dev velocity |
| **Frontend Framework** | React 18.3.x + Vite 6 | Stable (React 19 has known bugs), fast HMR, SPA architecture |
| **UI System** | shadcn/ui + Tailwind CSS v4 + Radix UI | Specified in UX Design Specification, Oyo Crimson palette |
| **Backend Framework** | Express 5.1.x | Stable LTS, mature middleware ecosystem for RBAC/audit/validation |
| **ORM** | Drizzle ORM | SQL-transparent, NUMERIC→string (no float for money), no codegen step, lightweight |
| **Authentication** | Plain JWT (`jsonwebtoken` + `bcrypt`) + custom RBAC middleware | Full control, no abstraction overhead, audit-transparent — every line of auth logic visible for government security review |
| **Database** | PostgreSQL 16.x | NUMERIC precision, ACID transactions, immutable ledger constraints via triggers/rules |
| **Primary Keys** | UUIDv7 | Time-sortable (natural chronological ordering for ledger entries), better index performance than UUIDv4, no sequential ID leakage |
| **Email** | Resend | Developer-friendly transactional email API, TypeScript SDK |
| **Bot Protection** | Google reCAPTCHA | Public zone protection (EOI form, login), prevents automated abuse |
| **Rate Limiting** | express-rate-limit | API endpoint protection, brute-force prevention on auth endpoints |
| **Containerisation** | Docker + Docker Compose | Dev/prod parity, consistent environments, atomic deployments |
| **Hosting** | DigitalOcean | Data sovereignty (Lagos/closest region), Droplet with Docker, managed PostgreSQL available |
| **Package Manager** | pnpm | Fast installs, strict dependency resolution, workspace support |
| **Testing** | Vitest + Playwright | Vitest: unit/integration tests (Vite-native, fast, TypeScript-first). Playwright: E2E smoke tests (login as each role → verify correct home screen, wiring validation after mock→API transitions). Three-layer quality: Unit/Integration → E2E → Structured UAT |
| **Code Organization** | Monorepo — `apps/client`, `apps/server`, `packages/shared` | Shared types, single repo |
| **Build Tooling** | Vite (frontend), tsx/tsup (backend) | Fast builds, TypeScript compilation |

### Project Structure

```
vlprs/
├── apps/
│   ├── client/          # React 18 SPA (Vite + shadcn/ui + Tailwind)
│   │   ├── src/
│   │   │   ├── components/   # UI components (shadcn + custom)
│   │   │   ├── pages/        # Route pages (public + protected zones)
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── lib/          # Utilities, API client, auth helpers
│   │   │   └── styles/       # Global styles, Tailwind config
│   │   └── package.json
│   └── server/          # Express 5 REST API
│       ├── src/
│       │   ├── routes/       # API route handlers
│       │   ├── middleware/   # RBAC, audit, validation, rate-limit
│       │   ├── services/     # Business logic (computation engine, ledger)
│       │   ├── db/           # Drizzle schema, migrations, queries
│       │   └── lib/          # Utilities, email (Resend), PDF generation
│       └── package.json
├── packages/
│   ├── shared/          # Shared TypeScript types & constants
│   │   ├── src/
│   │   │   ├── types/        # API contracts, entity types, enums
│   │   │   ├── constants/    # Non-punitive vocabulary, loan tiers, status codes, ROLES
│   │   │   └── validators/   # Shared Zod schemas (used by both client & server)
│   │   └── package.json
│   └── testing/         # Shared test utilities (from OSLRS playbook)
│       ├── src/
│       │   ├── factories/    # createMockUser(), createMockLoan(), createMockMda()
│       │   ├── helpers/      # Authenticated request helpers, DB cleanup
│       │   └── setup/        # Global test setup, Vitest config base
│       └── package.json
├── docker-compose.dev.yml    # Local dev: PostgreSQL + server (hot-reload) + client (Vite HMR)
├── docker-compose.prod.yml   # Production: Nginx + server + managed PG (external)
├── apps/server/Dockerfile    # Multi-stage build: install → build → slim runtime
├── apps/client/Dockerfile    # Multi-stage build: install → build → Nginx static serve
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json        # Shared TypeScript configuration
```

### Key Technical Notes

- **React 18 (not 19)** — Pinned to React 18.3.x due to known bugs in React 19. Will upgrade when stable.
- **UUIDv7** — All primary keys use UUIDv7 for time-sortable ordering. Critical for immutable ledger entries where chronological sequence matters. Generated server-side.
- **Drizzle NUMERIC→string** — PostgreSQL `NUMERIC(15,2)` values returned as strings by Drizzle, avoiding JavaScript floating-point errors. All financial arithmetic performed server-side using string-based decimal libraries.
- **Plain JWT auth** — `jsonwebtoken` for signing/verifying, `bcrypt` for password hashing. Access token (short-lived) + refresh token (httpOnly cookie). Custom RBAC middleware — no third-party auth abstraction. Full audit transparency.
- **Rate limiting** — Tiered: stricter on auth endpoints (login, token refresh), moderate on submission endpoints, relaxed on read-only dashboard endpoints.
- **Google reCAPTCHA** — Applied to public zone forms (EOI submission, login) to prevent bot abuse. Server-side verification.
- **Resend** — Transactional emails for: submission confirmations, exception alerts, password resets, scheduled reminders (FR49-FR52).
- **DigitalOcean** — Closest region to Nigeria for data sovereignty. Options: Droplet (full control) or App Platform (managed). Managed PostgreSQL for automated backups (zero data loss tolerance).

**Note:** Project initialisation using this structure should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data architecture: immutable ledger schema, financial precision strategy, validation pipeline
- Authentication: JWT token lifecycle, RBAC middleware chain, refresh token security
- API design: REST resource conventions, error response format, non-punitive vocabulary enforcement
- Deployment: CI/CD auto-deploy pipeline, zero-downtime strategy

**Important Decisions (Shape Architecture):**
- Frontend state management, routing, code splitting
- Logging and monitoring strategy
- PDF generation approach
- Backup and disaster recovery

**Deferred Decisions (Post-MVP):**
- Redis caching layer (if PostgreSQL query performance degrades at scale)
- SMS notification provider (fast-follow feature)
- API versioning (only if breaking changes needed post-launch)
- CDN for static assets (premature at current scale)

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Schema management** | Drizzle Kit — schema-first with `drizzle-kit generate` for migrations | Define schema in TypeScript. `drizzle-kit push` for rapid local iteration, `drizzle-kit generate` + `drizzle-kit migrate` for production. Migrations committed to git for auditability |
| **Validation pipeline** | Zod schemas in `packages/shared`, used by both client and server | Single source of truth. Same schema validates CSV upload rows on server AND form inputs on client. `drizzle-zod` auto-generates base schemas from DB schema, extended with business rules |
| **Financial arithmetic** | Server-side only, `decimal.js` library for all Naira/Kobo calculations | Never compute money on client. All financial logic in `apps/server/src/services/computation-engine.ts`. `decimal.js` handles arbitrary-precision arithmetic. Frontend receives pre-formatted display strings |
| **Caching** | No cache layer for MVP — PostgreSQL query optimisation only | 3,100 beneficiaries / ~189K ledger rows over 5 years is well within PostgreSQL capacity. Indexed queries, partial indexes on active loans, materialised views for dashboard aggregates if needed. Redis deferred |
| **Immutable ledger enforcement** | 3-layer defence: DB trigger + Drizzle middleware + Express middleware | **Layer 1 (DB):** PostgreSQL `BEFORE UPDATE OR DELETE` trigger on `ledger_entries` raises exception. **Layer 2 (ORM):** Drizzle query wrapper rejects `.update()` / `.delete()` on ledger tables. **Layer 3 (API):** Express middleware rejects `PUT`/`PATCH`/`DELETE` on `/api/ledger/*` routes. Any single layer failing still leaves two protections |
| **Soft deletes** | Mutable tables (users, MDAs) use `deleted_at` timestamp, never hard delete | Preserves referential integrity and audit trail. Ledger entries are never deleted (not even soft) |
| **UUIDv7 generation** | Server-side via `uuidv7` npm package, stored as PostgreSQL `uuid` type | Generated in service layer before DB insert. Time-sortable component provides natural chronological ordering for ledger entries without relying on auto-increment |

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Auth implementation** | Plain JWT — `jsonwebtoken` for sign/verify, `bcrypt` (12 rounds) for password hashing | No third-party auth framework. Every line of auth logic is visible, auditable, and under full control. Government auditors can inspect the entire auth flow without navigating library internals |
| **Token lifecycle** | Access token (15min, in-memory) + Refresh token (7 days, httpOnly secure cookie) | Access token stored in React state (not localStorage — XSS-safe). Refresh token in `httpOnly`, `secure`, `sameSite: strict` cookie — immune to JavaScript access. On 401, client hits `/api/auth/refresh` to get new access token silently |
| **Refresh token storage** | PostgreSQL `refresh_tokens` table with: `token_hash`, `user_id`, `expires_at`, `created_at`, `revoked_at` | Enables: token rotation (revoke old on refresh), forced logout (revoke all tokens for user), audit trail of all sessions. Hashed with SHA-256 — raw token never stored |
| **Token rotation** | On every refresh, old token is revoked + new token issued | If a refresh token is reused after rotation, ALL tokens for that user are revoked (reuse detection = potential theft). User must re-login |
| **RBAC middleware** | Custom Express middleware checking JWT claims: `{ role, mdaId, userId }` | 3 roles: `super_admin` (all MDAs), `dept_admin` (Car Loan Dept), `mda_officer` (own MDA only). Middleware chain: `authenticate` → `authorise(requiredRoles)` → `scopeToMda` → route handler |
| **MDA data isolation** | Every query automatically scoped by `mda_id` from JWT for `mda_officer` role | `mda_officer` can never access another MDA's data — enforced at query level, not just route level. `super_admin` and `dept_admin` bypass MDA scoping |
| **Password policy** | Minimum 8 chars, at least 1 uppercase, 1 number. Validated by Zod schema | Government users, not public internet — pragmatic security without frustrating non-technical MDA officers |
| **Data encryption at rest** | PostgreSQL `pgcrypto` for PII fields (staff names, employee IDs) + AES-256 | Encrypt sensitive columns at application layer before insert. Decryption keys in environment variables, never in code. NDPR compliance |
| **API security middleware stack** | `helmet` → `cors` → `express-rate-limit` → `authenticate` → `authorise` → `auditLog` → route handler | Each concern separated. Helmet sets security headers. CORS restricts origins to frontend domain. Rate limit applied before auth to prevent brute-force. Audit log captures authenticated user + action |
| **Google reCAPTCHA** | reCAPTCHA v3 (invisible, score-based) on public forms + login | No user friction — runs invisibly, returns risk score. Server-side verification via Google API. Applied to: login, password reset, public EOI form |
| **CSRF protection** | `csurf` or double-submit cookie pattern | Since refresh tokens use httpOnly cookies, CSRF protection is mandatory. CSRF token sent in response header, client includes in `X-CSRF-Token` request header |

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API style** | REST, resource-based, flat URL structure, no versioning for MVP | `/api/auth/*`, `/api/loans/*`, `/api/submissions/*`, `/api/ledger/*`, `/api/dashboard/*`, `/api/exceptions/*`, `/api/reports/*`, `/api/employment-events/*`, `/api/early-exits/*`, `/api/pre-submission/*`, `/api/staff-id/*`, `/api/users/*`, `/api/migrations/*`. Versioning deferred — add `/v2/` only if breaking changes post-launch |
| **Request/Response format** | JSON only, `Content-Type: application/json` except file uploads (`multipart/form-data`) | CSV uploads use multipart. All other endpoints JSON. Response envelope: `{ success: boolean, data?: T, error?: { code: string, message: string, details?: unknown } }` |
| **Non-punitive vocabulary** | Enforced in error codes and messages via shared constants | Error codes use approved terms: `VARIANCE_DETECTED` not `ERROR_FOUND`, `REVIEW_REQUIRED` not `VIOLATION`. Constants defined in `packages/shared/src/constants/vocabulary.ts` |
| **API documentation** | Swagger/OpenAPI via `swagger-jsdoc` + `swagger-ui-express` | Auto-generated from JSDoc annotations on route handlers. Available at `/api/docs` in development. Useful for auditors and future integrators |
| **HTTP client (frontend)** | Native `fetch` with typed wrapper in `apps/client/src/lib/api-client.ts` | Zero-dependency. Wrapper handles: JWT attachment from memory, 401 → silent refresh → retry, response typing from `packages/shared`, error normalisation |
| **Rate limiting tiers** | Strict (auth) → Moderate (mutations) → Relaxed (reads) | Auth endpoints: 5 req/15min per IP. Submission/write endpoints: 30 req/min per user. Dashboard/read endpoints: 120 req/min per user |
| **File upload** | `multer` middleware, max 5MB per CSV, server-side parsing with `papaparse` | 8-field CSV validated row-by-row against Zod schema with conditional logic (fields 7-8 required/blank based on Event Flag and Amount). Atomic: entire file succeeds or entire file rejected with per-row error report referencing field names and row numbers |

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Server state** | TanStack Query v5 | Cache dashboard hero metrics, auto-refetch on window focus, stale-while-revalidate for drill-downs. Deduplicates concurrent requests. Perfect for the AG checking dashboard on phone |
| **Client state** | Zustand (minimal store) | Only for ephemeral UI state: sidebar toggle, active tab, modal visibility, filter selections. All server data lives in TanStack Query cache |
| **Routing** | React Router v7 with lazy routes | Two route groups: public (`/`, `/about`, `/scheme/*`, `/how-it-works`, `/resources/*`, `/support`, `/privacy`, `/disclaimer`, `/accessibility`, `/eoi`, `/login`) and protected (`/dashboard/*`). Public pages share a `PublicLayout` (nav + footer) and are built from 4 page templates: Content Page (8+4 col with sidebar), Card Grid (responsive cards), Placeholder (Coming Soon), Homepage (unique). 8 shared public components in `components/public/`. See wireframes-epic-14.md for full wireframes and component mapping. Each dashboard sub-route lazy-loaded via `React.lazy()` + `Suspense`. Auth guard at `/dashboard` layout level |
| **Forms** | React Hook Form + `@hookform/resolvers/zod` | Zod schemas from `packages/shared` power both client-side validation and server-side validation. Single source of truth for: CSV column mapping form, exception annotation form, loan parameter form |
| **Code splitting** | Vite dynamic imports + React.lazy per major route | Dashboard, submissions, exceptions, reports, admin — each a separate chunk. Target: dashboard route <150KB gzipped per UX performance budget |
| **PDF generation** | Server-side via `@react-pdf/renderer` | Branded PDFs with Oyo State crest rendered on server. Client requests PDF → server generates → returns as `application/pdf` download. No client-side PDF libraries in bundle |
| **Date handling** | `date-fns` (tree-shakeable) | Lightweight, functional, TypeScript-first. Only import needed functions. Used for: loan tenure calculations, submission period formatting, retirement date projections |
| **Charts** | `recharts` (built on D3, React-native) | Dashboard visualisations: fund pool trends, MDA comparison bars, deduction timeline. Responsive, SSR-safe, shadcn-compatible styling |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Containerisation** | Docker + Docker Compose | Dev/prod parity guaranteed. `docker-compose.dev.yml` for local development (PostgreSQL + server + client hot-reload). `docker-compose.prod.yml` for production. Eliminates "works on my machine" issues |
| **DigitalOcean setup** | Ubuntu Droplet + Managed PostgreSQL | Full control over Docker runtime. Managed DB handles automated daily backups + point-in-time recovery (zero data loss). More cost-effective than App Platform for long-running containers |
| **CI/CD** | GitHub Actions — auto-deploy on push to `main` | **Pipeline:** `push to main` → lint → typecheck → test → build Docker images → push to GitHub Container Registry (ghcr.io) → SSH to Droplet → `docker compose pull && docker compose up -d`. **Branch strategy:** `main` (production, protected), `dev` (development). Merge `dev` → `main` via PR triggers deploy |
| **Deploy mechanism** | Docker-based: GitHub Actions builds images → pushes to ghcr.io → Droplet pulls + restarts | Atomic deployments — new container starts, health check passes, old container stops. Rollback = `docker compose up -d` with previous image tag |
| **Branch protection** | `main` branch: require PR, require CI pass, no direct push | Prevents accidental broken deploys. `dev` branch: direct push allowed for solo dev velocity |
| **Process management** | Docker restart policy (`unless-stopped`) + health checks | Docker handles auto-restart on crash. No PM2 needed — Docker is the process manager. Health check endpoint `/api/health` polled by Docker to detect unhealthy containers |
| **Reverse proxy** | Nginx (containerised) | Runs as Docker service. Serves React static build. Proxies `/api/*` to Express container. SSL via Let's Encrypt + Certbot auto-renewal. Gzip compression. Security headers |
| **Environment config** | `.env` files per environment, Docker Compose `env_file` directive | `.env.development`, `.env.production`, `.env.example` (committed as template). Secrets (JWT_SECRET, DB password, Resend API key, reCAPTCHA secret) never committed. GitHub Actions secrets for CI/CD. Production `.env` lives on Droplet only |
| **Logging** | `pino` (structured JSON logs) → Docker log driver | Fast, low-overhead, structured. Every log entry includes: `timestamp`, `level`, `userId`, `mdaId`, `action`, `resource`, `ip`. Docker captures stdout/stderr. `docker logs` for access. Searchable with `pino-pretty` in development |
| **Audit logging** | Dedicated `audit_log` table (append-only, UUIDv7 PK) | Every authenticated API call logged: `user_id`, `role`, `mda_id`, `action`, `resource`, `request_body_hash`, `response_status`, `ip`, `timestamp`. INSERT only — same immutability pattern as ledger. Used by auditors, not displayed in app |
| **Monitoring** | DigitalOcean built-in monitoring + UptimeRobot (free tier) | DO alerts on: CPU >80%, memory >85%, disk >90%. UptimeRobot pings `/api/health` every 5 min for 99.5% availability SLA tracking. Email alerts on downtime |
| **Backup strategy** | Managed PostgreSQL daily auto-backups + weekly `pg_dump` to DigitalOcean Spaces | **Layer 1:** Managed DB automated daily backups with 7-day retention + point-in-time recovery. **Layer 2:** Weekly `pg_dump` via cron → compressed → uploaded to DO Spaces (object storage). Belt and suspenders for zero data loss tolerance |
| **SSL/TLS** | Let's Encrypt via Certbot, auto-renewal via cron | Free, trusted certificates. Auto-renewal ensures no expiry downtime. HTTPS enforced — HTTP redirects to HTTPS |
| **Domain** | Custom domain pointing to Droplet IP via A record | `vlprs.oyostate.gov.ng` (or similar). DNS managed at registrar level |

### Decision Impact Analysis

**Implementation Sequence (critical path):**

1. **Monorepo scaffold** — pnpm workspace, shared tsconfig, ESLint/Prettier
2. **Database schema** — Drizzle schema with immutability triggers, UUIDv7 PKs
3. **Auth system** — JWT sign/verify, bcrypt, refresh token table, RBAC middleware
4. **API skeleton** — Express 5 with middleware chain (helmet → cors → rate-limit → auth → audit)
5. **CI/CD pipeline** — GitHub Actions auto-deploy on merge to `main`. Deployed before frontend so every subsequent commit auto-deploys to client domain
6. **Public website & scheme information** — Static public zone pages (homepage with hero/Programme Notice/loan tiers/CTA, scheme information pages, resources, legal). Responsive navigation with login modal, 4-column footer. No backend API dependencies — purely client-side content pages within the SPA. First public impression for AG, IT Assessors, and stakeholders
7. **Frontend shell + screen scaffolding** — Vite + React 18 + shadcn/ui + React Router, auth flow, design system (Oyo Crimson tokens, Inter/JetBrains Mono typography, extended Badge variants), role-specific skeleton screens (Executive Dashboard, MDA Submission, Operations Hub, MDA Detail, Loan Detail) with mock data layer, demo seed script (5 accounts, 63 MDAs, mock loans). All data access through hook abstractions returning mock data from `src/mocks/` — each hook switchable to real API with zero UI component changes
8. **Computation engine** — `decimal.js` financial calculations, ledger INSERT logic. Wire `useLoanDetail` and `useLoanSearch` hooks to real endpoints
9. **Dashboard wiring** — Replace mock data in `useDashboardMetrics`, `useMdaComplianceGrid`, `useAttentionItems` hooks with TanStack Query calls to real dashboard API endpoints
10. **Submission workflow** — CSV upload → validate → atomic ledger insert → comparison engine. Wire `useSubmissionHistory` hook to real endpoints
11. **Remaining features** — exceptions, reports, PDF, notifications, migration tool. Each feature wires its corresponding mock hooks to real APIs

**Cross-Component Dependencies:**

- **Auth ↔ Every route** — All protected endpoints depend on JWT middleware + RBAC
- **Shared types ↔ Client + Server** — API contracts, Zod schemas, enums consumed by both workspaces
- **Mock data layer ↔ Real APIs** — All frontend screens use hook abstractions (e.g., `useDashboardMetrics()`) that return mock data from Sprint 1. As backend endpoints are delivered, hooks are updated to call real APIs — zero UI component changes required. Wiring map documents each hook→endpoint→sprint mapping
- **Computation engine ↔ Ledger** — Financial calculations write to immutable ledger; dashboard reads computed views from ledger
- **Audit log ↔ Every mutation** — Middleware captures authenticated user + action for every write operation
- **Non-punitive vocabulary ↔ Every response** — Shared constants enforce approved terminology across error messages, API responses, and UI copy
- **Docker ↔ All services** — Consistent runtime environment from local dev to production. Docker Compose orchestrates service dependencies

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**27 critical conflict points** identified across 5 categories where AI agents could make different implementation choices. Each resolved below with binding conventions.

### Naming Patterns

**Database Naming (PostgreSQL/Drizzle):**

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Tables | `snake_case`, **plural** | `ledger_entries`, `refresh_tokens`, `mda_submissions` | `LedgerEntry`, `ledgerEntries` |
| Columns | `snake_case` | `staff_id`, `created_at`, `loan_amount` | `staffId`, `CreatedAt` |
| Primary keys | `id` (UUIDv7) | `id uuid PRIMARY KEY` | `ledger_entry_id`, `pk` |
| Foreign keys | `{referenced_table_singular}_id` | `user_id`, `mda_id`, `loan_id` | `fk_user`, `userId` |
| Indexes | `idx_{table}_{columns}` | `idx_ledger_entries_staff_id` | `ledger_staff_index` |
| Enums | `snake_case` type, `SCREAMING_SNAKE` values | `loan_status` type with `ACTIVE`, `COMPLETED`, `WRITTEN_OFF` | `LoanStatus`, `active` |
| Timestamps | `created_at`, `updated_at`, `deleted_at` | Always `timestamptz`, never `timestamp` | `createdDate`, `date_created` |
| Boolean columns | `is_` or `has_` prefix | `is_active`, `has_retired` | `active`, `retired` |
| Money columns | `_amount` suffix, `NUMERIC(15,2)` | `loan_amount`, `deduction_amount` | `amount` (ambiguous), `FLOAT` |

**API Naming:**

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Endpoints | `/api/{resource}`, **plural**, lowercase | `/api/loans`, `/api/submissions` | `/api/Loan`, `/api/getLoan` |
| Nested resources | `/api/{parent}/{id}/{child}` | `/api/mdas/:mdaId/submissions` | `/api/mda-submissions` |
| Actions (non-CRUD) | `/api/{resource}/{id}/{verb}` | `/api/submissions/:id/approve` | `/api/approveSubmission` |
| Query params | `camelCase` | `?staffId=xxx&page=1&sortBy=createdAt` | `?staff_id=xxx` |
| Route params | `camelCase` | `:loanId`, `:mdaId` | `:loan_id` |
| JSON request/response fields | `camelCase` | `{ loanAmount, staffId, createdAt }` | `{ loan_amount }` |

**Note:** Database is `snake_case`, JSON/API is `camelCase`. Drizzle handles the mapping automatically via column aliases.

**Code Naming:**

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| Files (components) | `PascalCase.tsx` | `HeroMetricCard.tsx`, `LoanTable.tsx` | `hero-metric-card.tsx` |
| Files (utilities/hooks) | `camelCase.ts` | `useAuth.ts`, `apiClient.ts` | `use-auth.ts` |
| Files (routes/middleware) | `camelCase.ts` | `loanRoutes.ts`, `authMiddleware.ts` | `loan-routes.ts` |
| Files (Drizzle schema) | `camelCase.ts` | `schema.ts`, `loanSchema.ts` | `loan-schema.ts` |
| React components | `PascalCase` | `HeroMetricCard`, `SubmissionTable` | `heroMetricCard` |
| Functions | `camelCase`, verb-first | `getLoanById()`, `computeBalance()` | `loanGet()`, `balance()` |
| Variables | `camelCase` | `loanAmount`, `staffId` | `loan_amount` |
| Constants | `SCREAMING_SNAKE` | `MAX_CSV_ROWS`, `JWT_EXPIRY` | `maxCsvRows` |
| Types/Interfaces | `PascalCase`, no `I` prefix | `Loan`, `Submission`, `ApiResponse<T>` | `ILoan`, `LoanInterface` |
| Enums (TS) | `PascalCase` name, `PascalCase` values | `LoanStatus.Active`, `VarianceType.OverDeduction` | `LOAN_STATUS.ACTIVE` |
| Zod schemas | `camelCase` + `Schema` suffix | `loanSchema`, `submissionRowSchema` | `LoanSchema`, `loanValidator` |
| Environment variables | `SCREAMING_SNAKE` | `JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY` | `jwtSecret` |

### Structure Patterns

**Test Location: Co-located with source files**

```
apps/server/src/services/
├── computationEngine.ts
├── computationEngine.test.ts     ← test next to source
├── ledgerService.ts
└── ledgerService.test.ts
```

**Component Organization: By feature, shared components in `components/ui/` and `components/shared/`**

```
apps/client/src/
├── components/
│   ├── ui/                    ← shadcn/ui components (auto-generated)
│   ├── shared/                ← custom shared components (dashboard zone)
│   │   ├── HeroMetricCard.tsx           ← Sprint 1 (mock data)
│   │   ├── NairaDisplay.tsx             ← Sprint 1 (mock data)
│   │   ├── AttentionItemCard.tsx        ← Sprint 1 (mock data)
│   │   ├── FileUploadZone.tsx           ← Sprint 1 (mock data)
│   │   ├── MigrationProgressCard.tsx    ← Sprint 1 (mock data)
│   │   ├── ExceptionQueueRow.tsx        ← Sprint 1 (mock data)
│   │   └── NonPunitiveVarianceDisplay.tsx ← built with Epic 5
│   ├── public/                ← shared public zone components (Sprint 2, Epic 14)
│   │   ├── PublicNavBar.tsx             ← NavigationMenu + Sheet (mobile)
│   │   ├── LoginModal.tsx              ← Dialog with 3 portal entry points
│   │   ├── PublicFooter.tsx            ← 4-column footer + legal strip
│   │   ├── BreadcrumbNav.tsx           ← Breadcrumb for all inner pages
│   │   ├── PageHeader.tsx              ← H1 + subtitle (reused by all content pages)
│   │   ├── CtaBanner.tsx               ← Full-width CTA section (primary + secondary)
│   │   ├── DisclaimerCallout.tsx       ← Teal info callout (Key Clarification pattern)
│   │   └── ProgrammeDisclaimer.tsx     ← Standard programme disclaimer text
│   └── layout/                ← layout components (Sidebar, Header, AuthGuard)
├── content/                   ← static content files (Sprint 2, CMS migration target)
│   ├── about.ts              ← mission, vision, values, leadership, governance
│   ├── news.ts               ← announcements (title, date, body, slug)
│   ├── faq.ts                ← questions grouped by audience category
│   ├── downloads.ts          ← document list (name, format, url, status)
│   └── homepage.ts           ← endorsement quote, capabilities text
├── mocks/                     ← mock data for Sprint 1 screen scaffolding
│   ├── dashboardMetrics.ts    ← Target: GET /api/dashboard/metrics (Sprint 6)
│   ├── mdaComplianceGrid.ts   ← Target: GET /api/dashboard/compliance (Sprint 6)
│   ├── attentionItems.ts      ← Target: GET /api/dashboard/attention (Sprint 6)
│   ├── migrationStatus.ts     ← Target: GET /api/migration/status (Sprint 5)
│   ├── loanSearch.ts          ← Target: GET /api/loans/search (Sprint 3)
│   ├── submissionHistory.ts   ← Target: GET /api/submissions (Sprint 8)
│   └── exceptionQueue.ts      ← Target: GET /api/exceptions (Sprint 10)
├── pages/
│   ├── public/                ← public zone routes (FR76-FR82)
│   │   ├── HomePage.tsx       ← hero, programme notice, loan tiers, CTA
│   │   ├── AboutPage.tsx      ← mission, vision, leadership, governance (FR82)
│   │   ├── HowItWorksPage.tsx ← 4-step beneficiary journey
│   │   ├── EoiPage.tsx        ← expression of interest (Phase 2 placeholder)
│   │   ├── LoginPage.tsx      ← login modal with role-based portals
│   │   ├── scheme/            ← programme overview, about VLPRS, eligibility, repayment
│   │   ├── resources/         ← FAQ, MDA guide, downloads, news, beneficiary lists
│   │   └── legal/             ← support, privacy, disclaimer, accessibility
│   └── dashboard/             ← protected zone routes
│       ├── DashboardPage.tsx
│       ├── MdaDetailPage.tsx
│       ├── LoanDetailPage.tsx
│       ├── SubmissionsPage.tsx
│       ├── OperationsHubPage.tsx
│       ├── ExceptionsPage.tsx
│       └── components/        ← page-specific (used only by this page)
```

**Service Organization: By domain**

```
apps/server/src/
├── routes/                    ← thin route handlers (validate → call service → respond)
├── middleware/                 ← authenticate, authorise, scopeToMda, auditLog, validate, rateLimiter
├── services/                  ← business logic (computationEngine, ledgerService, submissionService, etc.)
├── db/
│   ├── schema.ts              ← Drizzle schema (all tables, single file)
│   ├── migrations/            ← generated by drizzle-kit
│   ├── queries/               ← reusable query builders
│   └── seed.ts                ← development seed data
└── lib/                       ← utilities (jwt, password, uuidv7, decimal, captcha)
```

**Docker File Organization:**

```
vlprs/
├── docker-compose.dev.yml     ← local dev: PG container + server (tsx watch) + client (Vite HMR)
├── docker-compose.prod.yml    ← production: nginx + server containers (PG is managed external)
├── apps/
│   ├── client/
│   │   └── Dockerfile         ← multi-stage: pnpm install → vite build → nginx:alpine serve static
│   └── server/
│       └── Dockerfile         ← multi-stage: pnpm install → tsup build → node:alpine runtime
├── nginx/
│   └── nginx.conf             ← production Nginx config (proxy + static + SSL)
└── .dockerignore              ← node_modules, .env, .git, dist
```

**Configuration Files:**

```
vlprs/
├── .github/workflows/deploy.yml   ← GitHub Actions CI/CD
├── .env.example                    ← committed, no secrets
├── .eslintrc.cjs                   ← shared ESLint config
├── .prettierrc                     ← shared Prettier config
├── .dockerignore                   ← Docker build exclusions
├── tsconfig.base.json              ← shared TypeScript base
├── pnpm-workspace.yaml             ← workspace definition
└── package.json                    ← root scripts (lint, typecheck, test, docker:dev, docker:prod)
```

### Format Patterns

**API Response Envelope:**

```typescript
// Success response
{
  "success": true,
  "data": { ... }
}

// Success with pagination
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 342,
    "totalPages": 18
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VARIANCE_DETECTED",
    "message": "A variance was detected in the submission",
    "details": [ ... ]
  }
}
```

**HTTP Status Code Usage:**

| Status | When |
|--------|------|
| `200` | Successful GET, PUT, PATCH |
| `201` | Successful POST (resource created) |
| `204` | Successful DELETE (no content) |
| `400` | Validation failure (Zod), malformed request |
| `401` | Missing/expired/invalid JWT |
| `403` | Valid JWT but insufficient role or MDA scope |
| `404` | Resource not found |
| `409` | Conflict (duplicate submission for same period) |
| `422` | Business logic rejection (e.g., CSV rows fail validation) |
| `429` | Rate limit exceeded |
| `500` | Unhandled server error (never expose internals) |

**Date/Time Format:**

- Database: `timestamptz` (UTC)
- JSON/API: ISO 8601 strings — `"2026-02-14T10:30:00.000Z"`
- Frontend display: Formatted via `date-fns` — `"14 Feb 2026"`, `"February 2026"`
- Submission periods: `"YYYY-MM"` format — `"2026-02"` for February 2026

**Money Format:**

- Database: `NUMERIC(15,2)` stored as precise decimal
- API JSON: String — `"278602.72"` (never number, never float)
- Frontend display: `NairaDisplay` component — `"₦278,602.72"`
- Computation: `decimal.js` — never `Number`, never `parseFloat`

### Communication Patterns

**TanStack Query Key Convention:**

```typescript
queryKey: ['loans']                          // all loans
queryKey: ['loans', loanId]                  // single loan
queryKey: ['submissions', { mdaId, period }] // filtered list
queryKey: ['dashboard', 'heroMetrics']       // dashboard section (incl. early exit + gratuity receivable)
queryKey: ['dashboard', 'attentionItems']    // dashboard section
queryKey: ['employmentEvents', { staffId }]  // mid-cycle events for staff
queryKey: ['employmentEvents', { mdaId }]    // mid-cycle events for MDA
queryKey: ['earlyExits', loanId]             // early exit computations for loan
queryKey: ['preSubmission', 'checkpoint']    // pre-submission checkpoint data
queryKey: ['staffId', 'search', query]       // Staff ID search results
queryKey: ['users', { role, mdaId }]         // user accounts filtered
```

**Zustand Store Convention:**

```typescript
// One store per UI concern, minimal. NEVER put server data in Zustand.
const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
```

**Logging Levels (pino):**

| Level | Usage |
|-------|-------|
| `error` | Unhandled exceptions, failed DB transactions, auth failures |
| `warn` | Rate limit triggered, variance detected, approaching resource limits |
| `info` | API request/response, auth events, ledger mutations, submission processed |
| `debug` | Query execution, computation steps, middleware chain (dev only) |

**Structured Log Format:**

```json
{
  "level": "info",
  "time": "2026-02-14T10:30:00.000Z",
  "userId": "019...",
  "mdaId": "019...",
  "action": "SUBMISSION_CREATED",
  "resource": "/api/submissions",
  "method": "POST",
  "statusCode": 201,
  "durationMs": 342,
  "ip": "102.89.x.x"
}
```

### Process Patterns

**Error Handling — Server:**

```typescript
// Centralised error handler (last middleware in chain)
// All route handlers throw AppError — never send response directly on error
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,           // SCREAMING_SNAKE, non-punitive
    public message: string,        // human-readable, non-punitive
    public details?: unknown
  ) { super(message) }
}

// Usage: throw new AppError(422, 'VARIANCE_DETECTED', 'Submission contains rows requiring review', rowErrors)
// NEVER: res.status(500).json({...}) in a route handler
```

**Error Handling — Client:**

```typescript
// TanStack Query onError → shadcn Toast notification (non-punitive language)
// Global React ErrorBoundary wraps app for unhandled errors
// 401 errors → silent token refresh → retry → if still 401 → redirect to /login
```

**Loading State Pattern:**

```typescript
// TanStack Query provides: isLoading, isFetching, isError
// Initial load → shadcn Skeleton components
// Background refetch → subtle spinner overlay (data still visible underneath)
// NEVER: blank white screen during loading
// NEVER: custom isLoading boolean in Zustand
```

**Validation Pattern (3-stage):**

1. **Client-side** (React Hook Form + Zod) — instant feedback, prevents bad requests
2. **API middleware** (Zod via `validate` middleware) — rejects malformed requests before service layer
3. **Database** (constraints, triggers) — final safety net, catches anything bypassing layers 1-2

**Auth Flow Pattern:**

```
Login  → POST /api/auth/login
       → verify reCAPTCHA → validate credentials → bcrypt compare
       → generate access token (15min) + refresh token (7d)
       → store refresh token hash in DB
       → return { accessToken } in body + set httpOnly refresh cookie
       → client stores accessToken in React state (memory only)

Request → Authorization: Bearer {accessToken} header on every API call
        → authenticate middleware verifies JWT, extracts { userId, role, mdaId }
        → authorise middleware checks role permission
        → scopeToMda middleware restricts data access

Refresh → 401 from any endpoint
        → interceptor calls POST /api/auth/refresh (cookie sent automatically)
        → server verifies refresh token hash in DB, checks not revoked/expired
        → rotates: revoke old token, issue new access + refresh tokens
        → retry original request with new accessToken

Logout  → POST /api/auth/logout
        → revoke refresh token in DB → clear httpOnly cookie
        → client clears accessToken from state → redirect to /login
```

**Docker Development Workflow:**

```bash
# Start all services (PG + server + client with hot-reload)
docker compose -f docker-compose.dev.yml up

# Run migrations
docker compose -f docker-compose.dev.yml exec server pnpm db:migrate

# Run tests
docker compose -f docker-compose.dev.yml exec server pnpm test

# Seed development data
docker compose -f docker-compose.dev.yml exec server pnpm db:seed
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly — no "creative alternatives"
2. Use `AppError` class for all server errors — never raw `res.status().json()` in route handlers
3. Use non-punitive vocabulary from `packages/shared/src/constants/vocabulary.ts` — no error/mistake/violation terminology
4. Put ALL financial arithmetic in `computationEngine.ts` using `decimal.js` — never compute money elsewhere
5. Use UUIDv7 via `lib/uuidv7.ts` for all new records — never auto-increment, never UUIDv4
6. Use Zod schemas from `packages/shared` — never write inline validation
7. Use TanStack Query for all server state — never fetch in `useEffect`, never store server data in Zustand
8. Import role constants from `@vlprs/shared` — never hardcode role strings (`'super_admin'`, `'dept_admin'`, `'mda_officer'`). Both apps/server and apps/client import `ROLES` from `packages/shared/src/constants/roles.ts` (single source of truth). OSLRS lesson: frontend/backend role string mismatch caused 3 roles to fail at runtime despite 53 passing tests
9. TanStack Query hook naming: individual hooks follow `use<Action><Entity>` pattern — e.g., `useCreateLoan()`, `useDeactivateMda()`, `useSearchLoans()`. Query hooks: `use<Entity>()` or `use<Entity>Detail(id)`. File-level grouping by domain (e.g., `useLoans.ts` exports `useLoans()`, `useLoanDetail()`, `useCreateLoan()`)
10. Co-locate tests with source files — never create a separate `__tests__` directory
9. Ledger table: INSERT only — never write `.update()` or `.delete()` on ledger tables
10. Money values as strings in JSON — never `number` type for financial amounts in API responses
11. Docker Compose for local development — never run services directly on host for integration testing

**Pattern Verification:**

- ESLint custom rules for naming conventions
- TypeScript strict mode catches type mismatches between shared schemas
- CI pipeline runs `pnpm typecheck && pnpm lint && pnpm test` before deploy
- Docker builds must succeed in CI before image is pushed to registry
- Drizzle schema is single source of truth for DB structure — never write raw DDL

## Project Structure & Boundaries

### Requirements to Structure Mapping

| FR Category | FRs | Server Location | Client Location |
|-------------|-----|----------------|-----------------|
| Loan Computation & Financial Engine | FR1-FR9 | `services/computationEngine.ts` | `pages/dashboard/components/` |
| Data Management & Immutable Ledger | FR10-FR15 | `services/ledgerService.ts`, `db/schema.ts` | — (server-only) |
| MDA Monthly Submission | FR16-FR24 | `services/submissionService.ts`, `services/comparisonEngine.ts` | `pages/dashboard/SubmissionsPage.tsx` |
| Data Migration | FR25-FR31 | `services/migrationService.ts` | `pages/dashboard/MigrationPage.tsx` |
| Executive Dashboard & Reporting | FR32-FR41 | `routes/dashboardRoutes.ts` | `pages/dashboard/DashboardPage.tsx` |
| Access Control & Authentication | FR42-FR48 | `middleware/authenticate.ts`, `middleware/authorise.ts`, `lib/jwt.ts` | `lib/authContext.tsx`, `components/layout/AuthGuard.tsx` |
| Notifications & Alerts | FR49-FR52 | `services/emailService.ts`, `services/notificationService.ts` | — (server-driven) |
| Report Output & Sharing | FR53-FR54 | `services/reportService.ts` | `pages/dashboard/ReportsPage.tsx` |
| Exception Management + Annotations | FR55-FR59 | `services/exceptionService.ts` | `pages/dashboard/ExceptionsPage.tsx` |
| Pre-Submission & Mid-Cycle Events | FR60-FR62 | `services/preSubmissionService.ts`, `services/employmentEventService.ts` | `pages/dashboard/PreSubmissionPage.tsx`, `pages/dashboard/EmploymentEventsPage.tsx` |
| Retirement & Tenure Validation | FR63-FR66 | `services/temporalValidationService.ts` | `pages/dashboard/components/RetirementProfileCard.tsx` |
| Early Exit Processing | FR67-FR69 | `services/earlyExitService.ts` | `pages/dashboard/EarlyExitPage.tsx` |
| Historical Data & Migration | FR70-FR71 | `services/migrationService.ts` (extended) | `pages/dashboard/MigrationPage.tsx` (extended) |
| User & Account Administration | FR72-FR73 | `services/userAdminService.ts`, `routes/userRoutes.ts` (extended) | `pages/dashboard/AdminPage.tsx` (extended) |
| Staff ID Governance | FR74-FR75 | `services/staffIdService.ts` | `pages/dashboard/components/StaffIdManager.tsx` |
| Public Website & Scheme Information | FR76-FR82 | N/A (static content, no backend) | `pages/public/HomePage.tsx`, `pages/public/AboutPage.tsx`, `pages/public/scheme/*`, `pages/public/resources/*`, `pages/public/legal/*` |

### Public Zone Page Templates

> 20 public pages share 4 layout templates. Implement templates first, then each page is content. Full wireframes with component annotations in `wireframes-epic-14.md`.

| Template | Layout | Used By | Tailwind Grid |
|----------|--------|---------|---------------|
| **Content Page** | 8-col main + 4-col sidebar (optional) + CTA banner | About the Programme, Programme Overview, About VLPRS, Eligibility, Repayment, How It Works, MDA Guide, Privacy, Disclaimer, Accessibility, Help & Support (11 pages) | `grid grid-cols-1 lg:grid-cols-12 gap-8` |
| **Card Grid** | Page header + responsive card grid | Downloads & Forms, News & Announcements (2 pages) | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` |
| **Placeholder** | Centred styled "Coming Soon" card with icon, description, related links | Approved Beneficiary Lists, Expression of Interest (2 pages) | `max-w-lg mx-auto text-center py-24` |
| **Homepage** | Unique full-page layout — 13 sections, each with distinct grid | Homepage only (1 page) | Varies per section — see wireframes |

**Shared Public Components (8):** All public pages compose from `components/public/`: `PublicNavBar`, `LoginModal`, `PublicFooter`, `BreadcrumbNav`, `PageHeader`, `CtaBanner`, `DisclaimerCallout`, `ProgrammeDisclaimer`. See wireframes-epic-14.md § Shared Components for wireframes, props, and shadcn/ui mapping.

**Page template file convention:** Templates are not separate files — they are layout patterns documented in wireframes. Each page `.tsx` file composes the pattern directly using the shared components. No abstract `<ContentPageTemplate>` wrapper needed — keep it simple.

### Complete Project Directory Structure

```
vlprs/
│
├── .github/
│   └── workflows/
│       └── deploy.yml                    # CI/CD: lint → typecheck → test → Docker build → push → deploy
│
├── apps/
│   ├── client/                           # ─── REACT 18 SPA (Vite + shadcn/ui) ───
│   │   ├── Dockerfile                    # Multi-stage: pnpm install → vite build → nginx:alpine
│   │   ├── package.json
│   │   ├── tsconfig.json                 # Extends ../../tsconfig.base.json
│   │   ├── vite.config.ts                # React plugin, Tailwind plugin, path aliases
│   │   ├── index.html                    # SPA entry point
│   │   ├── public/
│   │   │   ├── manifest.json             # PWA manifest
│   │   │   ├── sw.js                     # Service worker (basic PWA installability)
│   │   │   ├── favicon.ico
│   │   │   └── images/
│   │   │       ├── branding/
│   │   │       │   ├── oyo-crest.svg     # Oyo State crest (vector — nav, footer, fallback)
│   │   │       │   ├── oyo-crest.webp    # Oyo State crest (raster — hero, OG image)
│   │   │       │   └── oyo-crest.png     # Oyo State crest (PNG fallback)
│   │   │       └── team/
│   │   │           ├── adegoke-ka.jpeg   # AG: Mrs. K. A. Adegoke (FCA)
│   │   │           ├── kilanko-oo.jpeg   # Dir Finance & Accounts: Mr. O. O. Kilanko
│   │   │           ├── adewole-ra.jpeg   # Dir Inspectorate & Mgmt Services: Mr. R. A. Adewole
│   │   │           ├── adebayo-tg.jpeg   # Dir Treasury: Mr. T. G. Adebayo
│   │   │           ├── adebiyi-ao.jpeg   # Dir Admin & Supplies: Mrs. A. O. Adebiyi
│   │   │           └── fadipe-cf.jpeg    # Head PFMU: Mrs. C. F. Fadipe
│   │   └── src/
│   │       ├── main.tsx                  # React entry: providers, router mount
│   │       ├── App.tsx                   # Root component: router outlet
│   │       ├── router.tsx                # React Router v7: public + protected route groups
│   │       │
│   │       ├── components/
│   │       │   ├── ui/                   # shadcn/ui auto-generated components
│   │       │   │   ├── button.tsx
│   │       │   │   ├── card.tsx
│   │       │   │   ├── dialog.tsx
│   │       │   │   ├── input.tsx
│   │       │   │   ├── select.tsx
│   │       │   │   ├── skeleton.tsx
│   │       │   │   ├── table.tsx
│   │       │   │   ├── toast.tsx
│   │       │   │   ├── tooltip.tsx
│   │       │   │   └── ...               # Added via `npx shadcn@latest add <component>`
│   │       │   │
│   │       │   ├── shared/               # Custom shared components (dashboard zone)
│   │       │   │   ├── NairaDisplay.tsx               # Formatted ₦ display, NUMERIC→string
│   │       │   │   ├── NonPunitiveVarianceDisplay.tsx  # Variance with approved terminology
│   │       │   │   ├── FileUploadZone.tsx             # CSV drag-drop upload
│   │       │   │   ├── ComparisonPanel.tsx            # MDA vs system side-by-side
│   │       │   │   ├── ComputationTransparencyAccordion.tsx # Show calculation derivation
│   │       │   │   ├── AutoStopCertificate.tsx        # Loan completion certificate
│   │       │   │   └── MigrationProgressCard.tsx      # Migration status display
│   │       │   │
│   │       │   ├── public/              # Shared public zone components (Sprint 2, Epic 14)
│   │       │   │   ├── PublicNavBar.tsx              # FR77: Sticky nav, 2-level dropdowns, mobile Sheet
│   │       │   │   ├── LoginModal.tsx               # FR77: Dialog with Staff/Beneficiary/EOI portals
│   │       │   │   ├── PublicFooter.tsx             # FR77: 4-column footer + legal strip + disclaimer
│   │       │   │   ├── BreadcrumbNav.tsx            # FR81: Home > Section > Page breadcrumb
│   │       │   │   ├── PageHeader.tsx               # FR81: H1 + subtitle, reused by all content pages
│   │       │   │   ├── CtaBanner.tsx                # FR76: Full-width CTA ("Ready to access VLPRS?")
│   │       │   │   ├── DisclaimerCallout.tsx        # FR78: Teal info callout (Key Clarification)
│   │       │   │   └── ProgrammeDisclaimer.tsx      # FR80: Standard programme disclaimer text
│   │       │   │   # NOTE: These 8 components are reused across all 20 public pages.
│   │       │   │   # See wireframes-epic-14.md § Shared Components for wireframes and props.
│   │       │   │
│   │       │   └── layout/               # Layout components
│   │       │       ├── AuthGuard.tsx      # Redirect to /login if no accessToken
│   │       │       ├── RoleGuard.tsx      # Redirect to /dashboard if insufficient role
│   │       │       ├── DashboardLayout.tsx # Sidebar + header + main content area
│   │       │       ├── Sidebar.tsx        # Desktop sidebar navigation
│   │       │       ├── MobileHeader.tsx   # Mobile header with sheet navigation
│   │       │       ├── Breadcrumb.tsx     # Contextual breadcrumb trail (dashboard zone)
│   │       │       └── PublicLayout.tsx   # Public zone layout — wraps PublicNavBar + <Outlet /> + PublicFooter
│   │       │
│   │       ├── pages/
│   │       │   ├── public/               # ─── PUBLIC ZONE (unauthenticated) ───
│   │       │   │   ├── HomePage.tsx       # FR76: Hero, Programme Notice, trust strip, How It Works, loan tiers, CTA
│   │       │   │   ├── AboutPage.tsx     # FR82: Mission, Vision, Leadership, Governance (absorbs AG Office)
│   │       │   │   ├── HowItWorksPage.tsx # FR76: 4-step beneficiary journey (EOI → Review → Decision → Repayment)
│   │       │   │   ├── EoiPage.tsx        # FR78: Expression of Interest placeholder (Phase 2)
│   │       │   │   ├── LoginPage.tsx      # FR77: Login modal with role-based portal access + reCAPTCHA
│   │       │   │   ├── scheme/            # ─── Scheme Information Pages ───
│   │       │   │   │   ├── ProgrammeOverviewPage.tsx  # FR78: Scheme summary, mission, objectives
│   │       │   │   │   ├── AboutVlprsPage.tsx         # FR78: System capabilities, design philosophy
│   │       │   │   │   ├── EligibilityPage.tsx        # FR78: 4 loan tiers with amounts, eligibility criteria
│   │       │   │   │   └── RepaymentRulesPage.tsx     # FR78: Accordion rules, Key Clarification panel
│   │       │   │   ├── resources/         # ─── Resources & Information ───
│   │       │   │   │   ├── FaqPage.tsx               # FR79: Min 15 categorised questions
│   │       │   │   │   ├── MdaGuidePage.tsx          # FR79: MDA submission walkthrough
│   │       │   │   │   ├── DownloadsPage.tsx         # FR79: Forms & document templates
│   │       │   │   │   ├── NewsPage.tsx              # FR79: Announcements & updates
│   │       │   │   │   └── BeneficiaryListsPage.tsx  # FR79: Approved lists placeholder (Phase 2)
│   │       │   │   └── legal/             # ─── Support & Legal ───
│   │       │   │       ├── SupportPage.tsx           # FR79: Help, contact info, office hours
│   │       │   │       ├── PrivacyPage.tsx           # FR80: Privacy policy, NDPR compliance
│   │       │   │       ├── DisclaimerPage.tsx        # FR80: Programme disclaimer
│   │       │   │       └── AccessibilityPage.tsx     # FR80: WCAG 2.1 AA compliance statement
│   │       │   │
│   │       │   └── dashboard/            # ─── PROTECTED ZONE (role-based) ───
│   │       │       ├── DashboardPage.tsx  # FR32-41: hero metrics (incl. early exit + gratuity), attention items, charts
│   │       │       ├── SubmissionsPage.tsx # FR16-24: 8-field CSV upload, comparison, history
│   │       │       ├── PreSubmissionPage.tsx # FR60: checkpoint (approaching retirement, zero deductions, pending events)
│   │       │       ├── EmploymentEventsPage.tsx # FR61-62: mid-cycle event filing, history, reconciliation
│   │       │       ├── LoansPage.tsx      # FR1-9: loan list, detail, computation view
│   │       │       ├── LoanDetailPage.tsx # FR1-9, FR63-66: single loan, ledger, temporal profile, retirement
│   │       │       ├── EarlyExitPage.tsx  # FR67-69: early exit computation, commitment, payment
│   │       │       ├── ExceptionsPage.tsx # FR55-59: exception queue, priority sorting
│   │       │       ├── ReportsPage.tsx    # FR53-54: report generation, download, email sharing
│   │       │       ├── MigrationPage.tsx  # FR25-31, FR70-71: legacy import, historical upload, service status
│   │       │       ├── AdminPage.tsx      # FR42-48, FR72-73: user CRUD, password reset, MDA assignment
│   │       │       └── components/        # Page-specific components (not shared)
│   │       │           ├── HeroMetricCard.tsx
│   │       │           ├── AttentionItemCard.tsx
│   │       │           ├── ExceptionQueueRow.tsx
│   │       │           ├── SubmissionConfirmation.tsx
│   │       │           ├── SubmissionHistoryTable.tsx
│   │       │           ├── PreSubmissionChecklist.tsx      # Checkpoint items before submission
│   │       │           ├── EmploymentEventForm.tsx         # Mid-cycle event form (5 fields)
│   │       │           ├── EarlyExitComputationCard.tsx    # Payoff display + commit/pay actions
│   │       │           ├── RetirementProfileCard.tsx       # Temporal profile + retirement timeline
│   │       │           ├── GratuityReceivableCard.tsx      # Gratuity receivable projection
│   │       │           ├── StaffIdManager.tsx              # Staff ID search, update, duplicate check
│   │       │           ├── LoanParameterForm.tsx
│   │       │           ├── FundPoolChart.tsx
│   │       │           └── MdaComparisonChart.tsx
│   │       │
│   │       ├── hooks/
│   │       │   ├── useAuth.ts            # Access token state, login/logout/refresh
│   │       │   ├── useDashboard.ts       # Sprint 1: returns mock data; Sprint 6: TanStack Query → real API
│   │       │   ├── useSubmissions.ts     # Sprint 1: returns mock data; Sprint 8: TanStack Query → real API
│   │       │   ├── useLoans.ts           # Sprint 1: returns mock data; Sprint 3: TanStack Query → real API
│   │       │   ├── useExceptions.ts      # Sprint 1: returns mock data; Sprint 10: TanStack Query → real API
│   │       │   ├── useMigration.ts       # Sprint 1: returns mock data; Sprint 5: TanStack Query → real API
│   │       │   ├── useEmploymentEvents.ts # TanStack Query hooks for mid-cycle events (Sprint 9)
│   │       │   ├── useEarlyExit.ts       # TanStack Query hooks for early exit workflow (Sprint 12)
│   │       │   ├── usePreSubmission.ts   # TanStack Query hooks for pre-submission checkpoint (Sprint 9)
│   │       │   ├── useStaffId.ts         # TanStack Query hooks for Staff ID operations (Sprint 14)
│   │       │   ├── useUserAdmin.ts       # TanStack Query hooks for user account management (Sprint 14)
│   │       │   └── useDebounce.ts        # Debounced search input
│   │       │   # NOTE: Hooks marked "Sprint 1: returns mock data" implement a mock-first pattern.
│   │       │   # They import from src/mocks/ initially. When the target API is delivered,
│   │       │   # the hook is updated to use TanStack Query with the real endpoint.
│   │       │   # Zero UI component changes required — only the hook internals change.
│   │       │
│   │       ├── lib/
│   │       │   ├── apiClient.ts          # Typed fetch wrapper: JWT attach, refresh, retry
│   │       │   ├── authContext.tsx        # React context: accessToken, user, role
│   │       │   ├── queryClient.ts        # TanStack Query client config
│   │       │   ├── formatters.ts         # Date, currency display formatters (date-fns)
│   │       │   └── constants.ts          # Re-exports from @vlprs/shared
│   │       │
│   │       ├── stores/
│   │       │   └── uiStore.ts            # Zustand: sidebar, filters, modals (UI state only)
│   │       │
│   │       └── styles/
│   │           └── globals.css           # Tailwind directives, CSS custom properties (Oyo Crimson)
│   │
│   └── server/                           # ─── EXPRESS 5 REST API ───
│       ├── Dockerfile                    # Multi-stage: pnpm install → tsup build → node:alpine
│       ├── package.json
│       ├── tsconfig.json                 # Extends ../../tsconfig.base.json
│       ├── tsup.config.ts                # Build config for production bundle
│       └── src/
│           ├── index.ts                  # Express app creation, middleware chain, server start
│           ├── app.ts                    # Express app factory (testable without listen)
│           │
│           ├── routes/
│           │   ├── index.ts              # Route aggregator: mounts all route groups on /api
│           │   ├── authRoutes.ts         # POST /login, /logout, /refresh, /password-reset
│           │   ├── loanRoutes.ts         # GET/POST /loans, GET /loans/:id, computation views
│           │   ├── submissionRoutes.ts   # POST /submissions (8-field CSV upload), GET /submissions
│           │   ├── ledgerRoutes.ts       # GET /ledger (read-only, no PUT/PATCH/DELETE)
│           │   ├── dashboardRoutes.ts    # GET /dashboard/hero-metrics, /attention-items, /charts
│           │   ├── exceptionRoutes.ts    # GET/POST /exceptions, PATCH /exceptions/:id/resolve
│           │   ├── reportRoutes.ts       # GET /reports/:id/pdf (generates branded PDF)
│           │   ├── migrationRoutes.ts    # POST /migrations (legacy data intake + historical upload)
│           │   ├── mdaRoutes.ts          # GET /mdas, GET /mdas/:id/submissions
│           │   ├── userRoutes.ts         # GET/POST /users (admin CRUD), PATCH /users/:id, POST /users/:id/reset-password
│           │   ├── employmentEventRoutes.ts # POST /employment-events (mid-cycle filing), GET by staff/MDA
│           │   ├── earlyExitRoutes.ts    # POST /early-exits/compute, POST /early-exits/:id/commit, POST /early-exits/:id/pay
│           │   ├── preSubmissionRoutes.ts # GET /pre-submission/checkpoint (retirement approaching, zero deductions, pending events)
│           │   ├── staffIdRoutes.ts      # PATCH /staff-id/:loanId, GET /staff-id/search, POST /staff-id/check-duplicate
│           │   └── healthRoutes.ts       # GET /health (Docker health check, uptime monitoring)
│           │
│           ├── middleware/
│           │   ├── authenticate.ts       # JWT verification → attaches user to req
│           │   ├── authorise.ts          # Role check: authorise('super_admin', 'dept_admin')
│           │   ├── scopeToMda.ts         # MDA isolation: injects mdaId filter into queries
│           │   ├── auditLog.ts           # Logs action to audit_log table (append-only)
│           │   ├── validate.ts           # Zod schema validation: validate(bodySchema, querySchema)
│           │   ├── rateLimiter.ts        # Tiered rate limits: auth(5/15min), write(30/min), read(120/min)
│           │   ├── captcha.ts            # Google reCAPTCHA v3 server-side verification
│           │   ├── csrf.ts              # CSRF token validation for cookie-based auth
│           │   ├── errorHandler.ts       # Centralised AppError → JSON response (non-punitive)
│           │   └── requestLogger.ts      # pino request/response logging
│           │
│           ├── services/
│           │   ├── computationEngine.ts  # FR1-9: ALL financial math (decimal.js)
│           │   ├── computationEngine.test.ts
│           │   ├── ledgerService.ts      # FR10-15: immutable INSERT, computed views
│           │   ├── ledgerService.test.ts
│           │   ├── submissionService.ts  # FR16-24: CSV parsing, row validation, atomic insert
│           │   ├── submissionService.test.ts
│           │   ├── comparisonEngine.ts   # FR16-24: MDA vs system variance detection
│           │   ├── comparisonEngine.test.ts
│           │   ├── exceptionService.ts   # FR55-59: auto-flagging, priority queue, resolution
│           │   ├── exceptionService.test.ts
│           │   ├── migrationService.ts   # FR25-31, FR70-71: legacy column mapping, baseline creation, historical upload, service status verification report
│           │   ├── migrationService.test.ts
│           │   ├── reportService.ts      # FR53-54: PDF generation via @react-pdf/renderer
│           │   ├── reportService.test.ts
│           │   ├── emailService.ts       # FR49-52: Resend integration, templates
│           │   ├── emailService.test.ts
│           │   ├── notificationService.ts # FR49-52: node-cron scheduled reminders, alert routing
│           │   ├── authService.ts        # FR42-48: login, token management, password reset
│           │   ├── authService.test.ts
│           │   ├── preSubmissionService.ts  # FR60: pre-submission checkpoint data assembly (approaching retirement, zero deductions, pending events)
│           │   ├── preSubmissionService.test.ts
│           │   ├── employmentEventService.ts # FR61-62: mid-cycle event filing, CSV reconciliation engine
│           │   ├── employmentEventService.test.ts
│           │   ├── temporalValidationService.ts # FR63-66: retirement date computation, tenure validation, gratuity receivable tracking, service extension overrides
│           │   ├── temporalValidationService.test.ts
│           │   ├── earlyExitService.ts  # FR67-69: early exit computation, commitment tracking, payment recording, expiry management
│           │   ├── earlyExitService.test.ts
│           │   ├── userAdminService.ts  # FR72-73: user account CRUD, password reset by admin, account lifecycle audit
│           │   ├── userAdminService.test.ts
│           │   ├── staffIdService.ts    # FR74-75: Staff ID update, system-wide duplicate detection, justification logging
│           │   └── staffIdService.test.ts
│           │
│           ├── db/
│           │   ├── index.ts              # Drizzle client initialisation, connection pool
│           │   ├── schema.ts             # ALL table definitions (single file, Drizzle schema)
│           │   ├── migrations/           # Generated by drizzle-kit generate
│           │   │   └── 0001_initial.sql
│           │   ├── queries/              # Reusable query builders
│           │   │   ├── loanQueries.ts
│           │   │   ├── ledgerQueries.ts
│           │   │   ├── submissionQueries.ts
│           │   │   ├── dashboardQueries.ts
│           │   │   ├── exceptionQueries.ts
│           │   │   ├── employmentEventQueries.ts
│           │   │   ├── earlyExitQueries.ts
│           │   │   ├── temporalQueries.ts
│           │   │   └── staffIdQueries.ts
│           │   ├── seed.ts               # Development seed data
│           │   ├── seed-demo.ts          # Demo seed: 5 named accounts, 63 MDAs, mock loans (pnpm seed:demo)
│           │   └── seed-production.ts    # Production seed: initial super admin from SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD env vars (pnpm seed:production)
│           │
│           └── lib/
│               ├── jwt.ts                # sign, verify, decode (jsonwebtoken)
│               ├── password.ts           # bcrypt hash, compare (12 rounds)
│               ├── uuidv7.ts             # UUIDv7 generator wrapper
│               ├── decimal.ts            # decimal.js helpers for financial arithmetic
│               ├── captcha.ts            # reCAPTCHA server-side verification
│               ├── appError.ts           # AppError class definition
│               └── env.ts                # Environment variable validation (Zod)
│
├── packages/
│   └── shared/                          # ─── SHARED TYPES & CONSTANTS ───
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                 # Barrel export
│           ├── types/
│           │   ├── api.ts               # ApiResponse<T>, PaginatedResponse<T>, ApiError
│           │   ├── auth.ts              # User, Role, JwtPayload, LoginRequest/Response
│           │   ├── loan.ts              # Loan, LoanTier, LoanStatus, LoanDetail, TemporalProfile
│           │   ├── ledger.ts            # LedgerEntry, LedgerEntryType
│           │   ├── submission.ts        # Submission, SubmissionRow (8-field), SubmissionStatus
│           │   ├── exception.ts         # Exception, ExceptionType, ExceptionPriority
│           │   ├── mda.ts               # Mda, MdaSubmissionSummary
│           │   ├── dashboard.ts         # HeroMetrics (incl. earlyExit, gratuity), AttentionItem, ChartData
│           │   ├── report.ts            # ReportType, ReportRequest
│           │   ├── employmentEvent.ts   # EmploymentEvent, EventType (9 types), EventReconciliationStatus
│           │   ├── earlyExit.ts         # EarlyExitComputation, EarlyExitStatus (Computed/Committed/Paid/Expired/Closed)
│           │   └── staffId.ts           # StaffIdUpdate, DuplicateCheckResult
│           ├── constants/
│           │   ├── vocabulary.ts        # NON-PUNITIVE VOCABULARY (absolute authority)
│           │   ├── loanTiers.ts         # 4 loan tier configurations
│           │   ├── roles.ts             # Role enum, permission matrix
│           │   ├── statusCodes.ts       # Machine-readable error codes
│           │   └── limits.ts            # MAX_CSV_ROWS, rate limit values, etc.
│           └── validators/
│               ├── authSchemas.ts       # loginSchema, passwordResetSchema
│               ├── loanSchemas.ts       # createLoanSchema, loanParameterSchema
│               ├── submissionSchemas.ts # submissionRowSchema (8-field with conditional logic), csvUploadSchema
│               ├── exceptionSchemas.ts  # resolveExceptionSchema, annotationSchema
│               ├── employmentEventSchemas.ts # eventFilingSchema (5-field), eventReconciliationSchema
│               ├── earlyExitSchemas.ts  # earlyExitComputeSchema, commitSchema, paymentSchema
│               ├── staffIdSchemas.ts    # staffIdUpdateSchema, duplicateCheckSchema
│               ├── userAdminSchemas.ts  # createUserSchema, deactivateUserSchema, reassignMdaSchema
│               └── commonSchemas.ts     # paginationSchema, uuidSchema, periodSchema
│
├── nginx/
│   └── nginx.conf                       # Production: static files + /api proxy + SSL + gzip
│
├── docker-compose.dev.yml               # Dev: PG 16 + server (tsx watch) + client (Vite HMR)
├── docker-compose.prod.yml              # Prod: nginx + server containers (managed PG external)
├── .dockerignore
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json                         # Root: lint, typecheck, test, docker:dev, docker:prod
```

### Architectural Boundaries

**Request Flow (Client → Database):**

```
Client (React SPA)
    │
    │  HTTPS (JWT in Authorization header)
    ▼
Nginx container (reverse proxy, SSL termination, static files)
    │
    │  HTTP (internal Docker network, /api/* only)
    ▼
Express Middleware Chain
    │  helmet → cors → rateLimiter → [captcha] → authenticate → authorise → scopeToMda → validate → auditLog
    ▼
Route Handler (thin — calls service, formats response)
    │
    ▼
Service Layer (business logic, financial computations)
    │
    ▼
Drizzle ORM (query builders, schema enforcement)
    │
    ▼
PostgreSQL (constraints, triggers, immutability enforcement)
```

**Data Boundaries:**

| Boundary | Rule |
|----------|------|
| `ledger_entries` table | INSERT only. No UPDATE/DELETE at DB, ORM, or API level |
| `audit_log` table | INSERT only. Same immutability pattern as ledger |
| `refresh_tokens` table | INSERT + soft-revoke (`revoked_at`). Never DELETE |
| All other tables | Full CRUD with soft deletes (`deleted_at`). Never hard DELETE |
| Money values | `NUMERIC(15,2)` in DB → string in API → `NairaDisplay` in UI |
| PII fields | Encrypted at rest via `pgcrypto`. Decrypted in service layer only |
| MDA data isolation | `mda_officer`: all queries scoped by `mda_id` from JWT |

**Service Boundaries (ownership + allowed calls):**

| Service | Owns | Calls | Never Calls |
|---------|------|-------|-------------|
| `computationEngine` | Financial math, balance derivation, early exit payoff calculation, gratuity receivable projection | `decimal.ts` | DB directly |
| `ledgerService` | Ledger INSERT, computed views | `computationEngine`, `db/queries/ledgerQueries` | Any UPDATE/DELETE |
| `submissionService` | 8-field CSV parsing, conditional field validation, atomic submission | `ledgerService`, `comparisonEngine`, `employmentEventService`, `emailService` | `computationEngine` directly |
| `comparisonEngine` | Variance detection | `computationEngine` (for system values) | DB writes |
| `exceptionService` | Auto-flagging, priority queue | `comparisonEngine`, `emailService` | `computationEngine` directly |
| `reportService` | PDF generation, email sharing with cover message | `db/queries/*` (read-only), `emailService` | Ledger writes |
| `authService` | Login, tokens, passwords | `jwt.ts`, `password.ts`, DB | Business services |
| `emailService` | Resend API, templates | Resend SDK only | DB, other services |
| `notificationService` | Scheduled reminders (node-cron) | `emailService`, `db/queries/*` | Ledger writes |
| `preSubmissionService` | Checkpoint data assembly (approaching retirement, zero-deduction staff, pending events) | `db/queries/temporalQueries`, `db/queries/submissionQueries`, `db/queries/employmentEventQueries` | Ledger writes |
| `employmentEventService` | Mid-cycle event filing, CSV reconciliation (matched/discrepancy/unconfirmed) | `db/queries/employmentEventQueries`, `emailService` | `computationEngine` directly |
| `temporalValidationService` | Retirement date computation (min DOB+60y, appt+35y), tenure validation, service extension, gratuity receivable tracking | `computationEngine`, `db/queries/temporalQueries` | Ledger writes directly |
| `earlyExitService` | Early exit computation, commitment tracking, payment recording, expiry management, Auto-Stop trigger | `computationEngine`, `ledgerService`, `emailService` | DB directly (uses ledgerService for writes) |
| `userAdminService` | User account CRUD, password reset by admin, MDA reassignment | `authService`, `db/queries/*` | Business services |
| `staffIdService` | Staff ID update, system-wide duplicate detection, justification logging | `db/queries/staffIdQueries` | `computationEngine` |
| `migrationService` | Legacy import, column mapping, baseline creation, historical upload, service status verification report | `ledgerService`, `comparisonEngine`, `temporalValidationService` | Direct ledger UPDATE/DELETE |

### Data Flow: Monthly Submission Lifecycle

```
MDA Officer navigates to Submissions
    │
    ▼
[0] preSubmissionRoutes.ts → GET /pre-submission/checkpoint
    │  → preSubmissionService.ts assembles:
    │     • staff approaching retirement within 12 months
    │     • staff with zero deduction last month and no event filed
    │     • mid-cycle events reported since last submission awaiting CSV confirmation
    │  → MDA Officer reviews and confirms via checkbox
    ▼
[1] submissionRoutes.ts → validate(csvUploadSchema) → multer parses 8-field CSV
    │
    ▼
[2] submissionService.ts → papaparse rows → validate each with submissionRowSchema
    │  (8-field conditional: Event Date required when Event Flag ≠ NONE;
    │   Cessation Reason required when Amount = ₦0 AND Event Flag = NONE;
    │   all-or-nothing: any row fails → entire submission rejected with per-row error
    │   referencing field names and row numbers)
    ▼
[3] submissionService.ts → BEGIN TRANSACTION
    │  → INSERT submission record (status: PROCESSING)
    │  → INSERT each row as ledger_entry (immutable)
    │  → UPDATE submission status → SUBMITTED
    │  → COMMIT
    ▼
[4] comparisonEngine.ts → compare MDA declared vs system computed
    │  → categorise: CLEAN, MINOR_VARIANCE, FLAGGED, ALERT, INFO
    ▼
[5] employmentEventService.ts → reconcile mid-cycle events against CSV rows
    │  → matched events (same staff + event type + dates within 7 days) confirmed
    │  → date discrepancies flagged for Dept Admin reconciliation
    │  → unconfirmed mid-cycle events flagged as "Unconfirmed Event"
    ▼
[6] exceptionService.ts → auto-flag rows exceeding thresholds
    │  → assign priority (HIGH, MEDIUM, LOW) → INSERT exception records
    ▼
[7] emailService.ts → submission confirmation to MDA officer
    │  → exception alerts to Dept Admin (if HIGH priority)
    ▼
[8] Dashboard hero metrics auto-updated on next TanStack Query refetch
```

### Data Flow: Early Exit Processing Lifecycle

```
Dept Admin initiates early exit for active loan
    │
    ▼
[1] earlyExitRoutes.ts → POST /early-exits/compute
    │  → earlyExitService.ts calls computationEngine:
    │     • remaining principal balance (from ledger)
    │     • current month interest (decimal.js)
    │     • total lump sum payoff amount
    │     • computation validity expiry date (last day of current month)
    │     • unique reference number (UUIDv7)
    │  → INSERT early_exit_computation record (status: COMPUTED)
    ▼
[2] Dept Admin records staff commitment
    │  → POST /early-exits/:id/commit
    │  → earlyExitService.ts records agreed payment deadline
    │  → UPDATE status → COMMITTED
    │  → emailService.ts → confirmation to Dept Admin
    ▼
[3a] Payment received before expiry:
    │  → POST /early-exits/:id/pay (amount, date, payment reference)
    │  → earlyExitService.ts verifies amount ≥ payoff
    │  → BEGIN TRANSACTION
    │     → INSERT lump sum ledger entry (immutable)
    │     → UPDATE loan status → COMPLETED
    │     → UPDATE early exit status → CLOSED
    │     → Trigger Auto-Stop Certificate generation
    │     → COMMIT
    │  → emailService.ts → Auto-Stop Certificate to beneficiary + MDA
    ▼
[3b] Expiry without payment:
    │  → node-cron job checks expiry dates nightly
    │  → earlyExitService.ts marks EXPIRED (retained in audit history)
    │  → Committed but unpaid flagged as attention item for Dept Admin
    │  → New computation required for updated payoff amount
```

### Data Flow: Mid-Cycle Employment Event

```
MDA Officer or Dept Admin files mid-cycle event
    │
    ▼
[1] employmentEventRoutes.ts → POST /employment-events
    │  → validate(eventFilingSchema): 5 fields
    │     • Staff ID (with name/MDA lookup confirmation)
    │     • Event Type (Retired, Deceased, Suspended, Absconded, Transferred Out,
    │       Dismissed, LWOP Start, LWOP End, Service Extension)
    │     • Effective Date
    │     • Reference Number (required for Retirement, Transfer, Dismissal)
    │     • Notes (optional)
    ▼
[2] employmentEventService.ts
    │  → INSERT employment_event record
    │  → Update staff loan status immediately
    │  → If Retired: temporalValidationService validates computed retirement date
    │  → emailService.ts → confirmation to filing user
    ▼
[3] Next monthly CSV submission:
    │  → employmentEventService.ts reconciles events against CSV rows:
    │     • Matched (same staff + event type + dates within 7 days) → auto-confirmed
    │     • Date discrepancy → flagged for Dept Admin reconciliation
    │     • Mid-cycle event not in CSV → "Unconfirmed Event" flag
    │     • CSV event with no prior mid-cycle report → accepted normally
```

### External Integration Points

| Service | Provider | Method | Environment Variables |
|---------|----------|--------|----------------------|
| Email | Resend | TypeScript SDK | `RESEND_API_KEY` |
| Bot Protection | Google reCAPTCHA v3 | Server-side API | `RECAPTCHA_SECRET_KEY` |
| Database | DO Managed PostgreSQL | Connection string | `DATABASE_URL` |
| Container Registry | GitHub (ghcr.io) | Docker push/pull | `GHCR_TOKEN` |
| Hosting | DO Droplet | SSH via GitHub Actions | `DROPLET_SSH_KEY`, `DROPLET_IP` |
| Object Storage | DO Spaces | Backup uploads | `DO_SPACES_KEY`, `DO_SPACES_SECRET` |
| Build Status | Client-side env vars | Vite env injection | `VITE_SPRINT_LABEL`, `VITE_NEXT_MILESTONE` |
| Demo Seed | Shared demo password | Seed script config | `DEMO_SEED_PASSWORD` |
| Production Seed | Initial super admin | First-deploy seed | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` |

### Deferred Infrastructure (Post-MVP)

| Technology | Trigger to Add | Purpose |
|------------|---------------|---------|
| Redis | Dashboard query latency >1s at scale | Cache layer for computed views, rate limit store for multi-instance |
| BullMQ | Email delivery reliability SLA required, or complex scheduling | Retry-on-failure job queue, persistent scheduled tasks |
| CDN (DO CDN / Cloudflare) | Static asset load times degrade on 4G | Edge caching for React build, oyo-crest.svg, fonts |
| SMS provider | Phase 2 fast-follow (FR49-52) | SMS notifications alongside email |

### Development Workflow

```bash
# Local development (Docker)
docker compose -f docker-compose.dev.yml up          # Start PG + server + client
docker compose -f docker-compose.dev.yml exec server pnpm db:push      # Push schema
docker compose -f docker-compose.dev.yml exec server pnpm db:seed      # Seed dev data
docker compose -f docker-compose.dev.yml exec server pnpm seed:demo    # Seed demo accounts (5 users, 63 MDAs, mock loans)

# Production first-deploy (run once)
pnpm seed:production   # Creates initial super admin from SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD env vars
docker compose -f docker-compose.dev.yml exec server pnpm test         # Server tests
docker compose -f docker-compose.dev.yml exec client pnpm test         # Client tests

# Root scripts
pnpm lint          # ESLint across all workspaces
pnpm typecheck     # TypeScript strict across all workspaces
pnpm test          # Vitest across all workspaces
pnpm build         # Build client + server for production

# Production deploy (automated via GitHub Actions on merge to main)
# Manual: docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility — PASS:**

| Check | Result |
|-------|--------|
| React 18 + Vite 6 + shadcn/ui | Compatible — shadcn/ui supports React 18, Vite 6 confirmed |
| Express 5.1 + Drizzle ORM + PostgreSQL 16 | Compatible — Drizzle has first-class PostgreSQL support |
| TypeScript 5.x across all workspaces | Compatible — shared `tsconfig.base.json`, strict mode |
| Tailwind CSS v4 + shadcn/ui | Compatible — shadcn docs confirm Tailwind v4 setup |
| `jsonwebtoken` + `bcrypt` + Express 5 | Compatible — standard Node.js ecosystem |
| Docker + pnpm workspaces | Compatible — multi-stage Dockerfiles handle monorepo builds |
| UUIDv7 + Drizzle + PostgreSQL `uuid` type | Compatible — generates and stores natively |
| `decimal.js` + Drizzle NUMERIC→string | Compatible — Drizzle returns string, decimal.js accepts string |
| React Router v7 + TanStack Query v5 | Compatible — both actively maintained |

No contradictory decisions found. No version conflicts.

**Pattern Consistency — PASS:**
- Database `snake_case` → API `camelCase` mapping handled by Drizzle column aliases
- Co-located tests consistent across both client and server
- Zod schemas in `packages/shared` consumed identically by client and server
- Non-punitive vocabulary from single source in `packages/shared/src/constants/vocabulary.ts`

**Structure Alignment — PASS:**
- Monorepo supports shared types pattern
- Service boundaries respect immutability rules
- Middleware chain order matches security requirements
- Docker files co-located with their apps

### Requirements Coverage Validation

**Functional Requirements: 82/82 covered**

| Category | FRs | Coverage | Architectural Support |
|----------|-----|---------|----------------------|
| Loan Computation | FR1-FR9 | 9/9 | `computationEngine.ts` + `decimal.js` + 4 tier configs |
| Immutable Ledger | FR10-FR15 | 6/6 | 3-layer immutability (DB trigger + Drizzle + API middleware), temporal profile fields on loan master |
| MDA Submission | FR16-FR24 | 9/9 | `submissionService.ts` + `comparisonEngine.ts` + 8-field CSV with conditional validation |
| Data Migration | FR25-FR31 | 7/7 | `migrationService.ts` + column mapping + variance categorisation + temporal data required |
| Dashboard & Reporting | FR32-FR41 | 10/10 | `dashboardRoutes.ts` + TanStack Query + recharts + early exit/gratuity metrics |
| Access Control | FR42-FR48 | 7/7 | JWT + RBAC middleware + 3 roles + MDA scoping + audit log |
| Notifications | FR49-FR52 | 4/4 | `emailService.ts` (Resend) + `notificationService.ts` (node-cron) |
| Report Output | FR53-FR54 | 2/2 | `reportService.ts` + `@react-pdf/renderer` + Oyo crest + email sharing |
| Exception Management | FR55-FR59 | 5/5 | `exceptionService.ts` + priority queue + auto-flagging |
| Pre-Submission & Mid-Cycle | FR60-FR62 | 3/3 | `preSubmissionService.ts` + `employmentEventService.ts` + CSV reconciliation engine |
| Retirement & Tenure | FR63-FR66 | 4/4 | `temporalValidationService.ts` + `computationEngine.ts` retirement date computation + service extension |
| Early Exit Processing | FR67-FR69 | 3/3 | `earlyExitService.ts` + state machine (Computed→Committed→Paid→Closed/Expired) + Auto-Stop trigger |
| Historical Data & Migration | FR70-FR71 | 2/2 | `migrationService.ts` (extended) + historical CSV upload + service status verification report |
| User & Account Admin | FR72-FR73 | 2/2 | `userAdminService.ts` + `userRoutes.ts` + account lifecycle audit logging |
| Staff ID Governance | FR74-FR75 | 2/2 | `staffIdService.ts` + system-wide duplicate detection + justification logging |
| Public Website & Scheme Info | FR76-FR82 | 7/7 | Static public zone pages (no backend) — `pages/public/` with AboutPage, scheme/, resources/, legal/ subdirectories + responsive nav + login modal + footer |

**Non-Functional Requirements: 10/10 covered**

| NFR | Target | Architectural Support |
|-----|--------|----------------------|
| Dashboard <3s LCP (4G) | <3s | Code splitting, lazy routes, <150KB gzipped, TanStack Query |
| CSV processing | <10s | Server-side papaparse + atomic transaction + Zod validation |
| Staff search | <2s | PostgreSQL indexes + Drizzle query builders |
| Availability | 99.5% | Docker restart + health checks + UptimeRobot |
| Zero data loss | Zero | Managed PG backups + weekly pg_dump to DO Spaces + immutable ledger |
| 63 concurrent MDAs | Same week | Connection pooling + transaction isolation |
| 189K+ ledger rows | 5 years | UUIDv7 indexed PKs + partial indexes + pagination |
| Kobo precision | NUMERIC(15,2) | `decimal.js` + string transport + never float |
| Security | OWASP/NDPR | helmet + CORS + rate-limit + CSRF + Zod + pgcrypto + reCAPTCHA |
| Accessibility | WCAG 2.1 AA | shadcn/ui (Radix primitives) + semantic HTML + ARIA |

### Implementation Readiness Validation

**Decision Completeness — PASS:** All technology choices with versions, all patterns with code examples, 11 mandatory enforcement rules.

**Structure Completeness — PASS:** Every file annotated, FR→file mapping complete, service boundaries defined with ownership/calls/forbidden.

**Pattern Completeness — PASS:** API envelope, status codes, money format chain, auth flow, Docker workflow all specified.

### Gap Analysis

**Critical Gaps:** None.

**Deferred (documented with triggers):** Redis, BullMQ, API versioning, CDN, SMS provider, Sanity CMS (headless).

### Extension Points & Future Integration

> Cheap conventions now that make future integrations a bolt-on, not a rewrite. None of these add current code complexity — they are organisational patterns for the code already being written.

**1. Content Management Readiness (→ Sanity CMS)**

Public page content that may need non-developer editing is extracted to `src/content/*.ts` files:

```
apps/client/src/
├── content/                    # Static content — future CMS migration target
│   ├── about.ts               # Mission, vision, values, leadership roster (6 leaders w/ photos), governance
│   ├── news.ts                # Announcements (title, date, body, slug)
│   ├── faq.ts                 # Questions grouped by audience category
│   ├── downloads.ts           # Document list (name, format, url, status)
│   └── homepage.ts            # Endorsement quote, capabilities text
```

- **Today:** Components import from `content/*.ts`. Content changes = code commit + CI/CD deploy.
- **Future:** Components import from `useCmsContent()` hook → Sanity API. Content changes = edit in Sanity Studio.
- **Migration scope:** ~half day. Create Sanity schema → import content → swap imports for API calls. Zero template/layout changes.
- **CMS choice:** Sanity (free tier: 3 users, 100K API calls/month; TypeScript-first; GROQ queries; self-hostable Studio for data sovereignty).

**2. Data Ingestion Abstraction (→ State Payroll Database)**

The submission processing pipeline has a clean boundary between "receive/parse data" and "validate and write to ledger":

```
CSV Upload ──→ parse ──→ DeductionRecord[] ──→ validate ──→ ledger INSERT
                              ↑ clean boundary
Future Payroll API ──→ normalize ──→ DeductionRecord[] ──→ (same pipeline)
```

- **Convention:** `submissionService.processRecords(records: DeductionRecord[])` accepts normalised records regardless of source. The CSV parsing happens *before* this function in a separate ingestion adapter.
- **Future:** A `payrollAdapter.ts` normalises Payroll DB data into the same `DeductionRecord[]` shape. Validation and ledger logic untouched.
- **`DeductionRecord` interface** lives in `packages/shared/src/types/` — importable by any future adapter.

**3. API Consumer Readiness (→ Payroll Office, External Systems)**

- **Response envelope consistency:** All API responses use `{ data, meta, error }` envelope (already enforced). External consumers can use the same endpoints as the frontend.
- **API versioning path:** Routes are structured as `/api/route`. When external consumers arrive, prefix with `/api/v1/route`. Deferred until first external consumer (trigger: external system requests API access).
- **External auth slot:** Auth middleware checks JWT for human users. When external system access is needed, add API key authentication as a parallel auth strategy (same middleware chain, different token type). Do not embed frontend-specific concerns in API responses — return data, let consumers decide presentation.

**4. Domain Isolation (→ AG Office Platform Expansion)**

| Infrastructure (domain-agnostic, reusable) | Domain (vehicle-loan-specific) |
|---|---|
| Auth / JWT / sessions (`lib/jwt.ts`, `middleware/authenticate.ts`) | Computation engine (`services/computationEngine.ts`) |
| RBAC middleware (`middleware/authorise.ts`) | Loan tier parameters (`shared/constants/`) |
| Audit logging (`middleware/auditLog.ts`) | Submission CSV parsing (`services/submissionService.ts`) |
| Email service (`services/emailService.ts`) | Auto-Stop logic (`services/autoStopService.ts`) |
| PDF generation | Vehicle Loan Committee rules |
| Immutable ledger pattern (`db/schema.ts` ledger tables) | MDA monthly reporting |
| File upload / storage | Exception categorisation |

- **Convention:** Infrastructure services NEVER import from domain services. Domain services import from infrastructure.
- **RBAC is resource-based:** Permissions are `resource:action` pairs (`loan:read`, `submission:create`), not hardcoded loan-specific checks. Adding a new domain = adding new resource permissions, not rewriting auth.
- **Database namespacing:** Vehicle loan tables use clear domain names (`loans`, `ledger_entries`, `mda_submissions`). Future domains use their own namespace (`staff_advances`, `procurement_*`, etc.).
- **Future:** A new AG Office module (e.g., "Staff Advance Tracking") reuses auth + audit + ledger + email + PDF. Only needs new domain services.

**5. Event Emission Pattern (→ Webhooks, Message Queues)**

Key domain events are emitted as named events within the application:

```typescript
// services/eventBus.ts — simple typed event emitter (Node EventEmitter wrapper)
type DomainEvents = {
  'loan.completed': { loanId: string; staffId: string; mdaId: string };
  'submission.processed': { submissionId: string; mdaId: string; period: string };
  'autostop.triggered': { loanId: string; certificateId: string };
  'exception.flagged': { exceptionId: string; priority: string };
};
```

- **Today:** Events consumed internally (e.g., `loan.completed` triggers Auto-Stop Certificate generation + notification).
- **Future:** Events forwarded to webhook endpoints or message queues (BullMQ, already on deferred list) for external system consumption.
- **Convention:** All service methods that complete a significant workflow emit a domain event. Listeners are registered in a central `eventListeners.ts` file.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context analysed (81 FRs, 10 NFRs, 10 constraints, 9 cross-cutting concerns)
- [x] Scale assessed (3,100 beneficiaries, 63 MDAs, 189K ledger rows/5yr)
- [x] Technical constraints identified (solo dev, 4G, data sovereignty, immutable ledger, temporal data required)
- [x] Cross-cutting concerns mapped (audit, RBAC, precision, immutability, vocabulary, validation, atomicity, temporal validation, Staff ID uniqueness)

**Architectural Decisions**
- [x] Technology stack specified with versions
- [x] 5 decision categories covered (Data, Auth, API, Frontend, Infrastructure)
- [x] Docker containerisation for dev/prod parity
- [x] CI/CD pipeline (GitHub Actions → ghcr.io → DigitalOcean)

**Implementation Patterns**
- [x] 27 conflict points resolved across 5 categories
- [x] Naming conventions: database, API, code, files, env vars
- [x] Format patterns: API envelope, status codes, dates, money
- [x] Process patterns: error handling, loading states, validation, auth flow
- [x] 11 mandatory enforcement rules

**Project Structure**
- [x] Complete directory tree with annotations (including new services, routes, pages for FR60-FR82)
- [x] FR → file mapping (16 categories, 82 FRs)
- [x] Service boundaries with ownership rules (16 services)
- [x] Data flows documented (submission lifecycle with pre-submission checkpoint, early exit lifecycle, mid-cycle event flow)
- [x] External integrations with env vars
- [x] Public zone: 4 page templates, 8 shared components, 20 pages with wireframes (wireframes-epic-14.md)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
1. 3-layer immutable ledger defence — banking-grade financial data protection
2. Shared TypeScript types — prevents frontend/backend drift on financial data
3. Non-punitive vocabulary enforcement — systemically embedded, single source of truth
4. Solo developer optimised — monorepo, Docker, CI/CD, shared configs
5. Audit transparency — all auth and financial logic custom, inspectable, no black boxes
6. Temporal validation chain — retirement date computation, tenure checks, gratuity projections all derived from authoritative dates
7. Early exit state machine — deterministic workflow (Computed→Committed→Paid→Closed) with expiry safety net

**Implementation Handoff — First Priorities:**
1. Scaffold monorepo (pnpm workspace, tsconfig, ESLint, Prettier, Docker)
2. Database schema (Drizzle schema with immutability triggers, temporal profile fields, employment events, early exit computations)
3. Auth system (JWT + bcrypt + RBAC middleware)
4. Computation engine (including retirement date computation and early exit payoff calculations)
