# Story 1.1: Monorepo Scaffold & Development Environment

Status: ready-for-dev

<!-- Amended 2026-02-18: Added packages/testing/ workspace per OSLRS playbook integration (shared test factories, helpers, setup). -->
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want the VLPRS monorepo initialised with all workspaces, Docker development environment, and foundational configuration,
so that I have a working, reproducible development environment to build upon.

## Acceptance Criteria (BDD)

### AC1: Monorepo Structure & Installation

```gherkin
Given the project repository is cloned
When I run `pnpm install && docker compose -f compose.dev.yaml up`
Then PostgreSQL is running in a container
And the Express server starts with hot-reload
And the Vite React dev server starts with HMR
And the monorepo structure matches: `apps/client`, `apps/server`, `packages/shared`, `packages/testing`
And shared TypeScript base config (`tsconfig.base.json`) is configured for all four workspaces
And ESLint + Prettier are configured with a single root config
And `packages/shared` exports are importable from both `apps/client` and `apps/server`
And `.env.example` exists with all required environment variable templates (no secrets)
And `.gitignore` excludes `node_modules`, `.env`, `dist/`, Docker volumes
```

### AC2: Workspace Configuration

```gherkin
Given the monorepo root
When I inspect `pnpm-workspace.yaml`
Then it defines workspaces: `apps/*` and `packages/*`
```

### AC3: React Version & Configuration

```gherkin
Given `apps/client` is scaffolded with Vite + React
When I check React version in `apps/client/package.json`
Then React is pinned to `^18.3.1` and `react-dom` to `^18.3.1` — not React 19
```

### AC4: shadcn/ui Integration

```gherkin
Given `apps/client`
When shadcn/ui is initialised (`npx shadcn init`)
Then Tailwind CSS v4 is configured
And `components.json` exists
And a test component (e.g. `Button`) can be added and renders correctly in the dev server
```

### AC5: Shared Package Validation

```gherkin
Given `packages/shared`
When I inspect its dependencies
Then `zod` is installed (v4.x, imported via `zod/v4`)
And a sample Zod schema (e.g. `emailSchema`) is exportable and validatable from both `apps/client` and `apps/server`
```

### AC6: Server Dependencies

```gherkin
Given `apps/server`
When I inspect its dependencies
Then Drizzle ORM and Drizzle Kit are installed (0.45.x stable)
And `drizzle.config.ts` exists pointing to the Docker PostgreSQL instance
And `pnpm drizzle-kit push` executes without error against the running database
```

### AC7: Testing Setup

```gherkin
Given Vitest is configured in all four workspaces
When I run `pnpm test` from the monorepo root
Then Vitest discovers and passes at least one trivial test in each workspace (`apps/client`, `apps/server`, `packages/shared`, `packages/testing`)
```

### AC8: Git Initialization

```gherkin
Given the repository is initialised with Git
When I inspect the branches
Then both `main` and `dev` branches exist
And `dev` is checked out as the working branch
```

## Tasks / Subtasks

- [ ] Task 1: Initialise monorepo root (AC: #1, #2)
  - [ ] 1.1 Create project root with `pnpm init`
  - [ ] 1.2 Create `pnpm-workspace.yaml` defining `apps/*` and `packages/*`
  - [ ] 1.3 Create `tsconfig.base.json` with strict mode, path aliases
  - [ ] 1.4 Create root ESLint + Prettier config (single shared config)
  - [ ] 1.5 Create `.env.example` with all required variable templates
  - [ ] 1.6 Create `.gitignore` (node_modules, .env, dist/, Docker volumes)
  - [ ] 1.7 Create root `package.json` scripts: `lint`, `typecheck`, `test`, `build`, `docker:dev`
- [ ] Task 2: Scaffold `apps/client` — React 18 + Vite (AC: #3, #4)
  - [ ] 2.1 Scaffold with Vite + React 18 TypeScript template
  - [ ] 2.2 Pin React to `^18.3.1` and react-dom to `^18.3.1`
  - [ ] 2.3 Initialise shadcn/ui (`npx shadcn init`) with Tailwind CSS v4
  - [ ] 2.4 Add a test `Button` component to verify shadcn/ui renders
  - [ ] 2.5 Configure path aliases in `vite.config.ts` and `tsconfig.json`
- [ ] Task 3: Scaffold `apps/server` — Express 5 (AC: #6)
  - [ ] 3.1 Create workspace with `pnpm init`
  - [ ] 3.2 Install Express 5.2.x, Drizzle ORM 0.45.x, Drizzle Kit
  - [ ] 3.3 Create `drizzle.config.ts` pointing to Docker PostgreSQL
  - [ ] 3.4 Create basic Express server entry with health check endpoint (`GET /api/health`)
  - [ ] 3.5 Configure tsx for hot-reload development
- [ ] Task 4: Scaffold `packages/shared` — TypeScript types + Zod (AC: #5)
  - [ ] 4.1 Create workspace with `pnpm init`
  - [ ] 4.2 Install Zod 4.x, configure TypeScript
  - [ ] 4.3 Create sample Zod schema (`emailSchema`) and export
  - [ ] 4.4 Verify import from both `apps/client` and `apps/server`
- [ ] Task 4b: Scaffold `packages/testing` — Shared Test Infrastructure (AC: #7)
  - [ ] 4b.1 Create workspace with `pnpm init`
  - [ ] 4b.2 Install Vitest, configure TypeScript (extends `tsconfig.base.json`)
  - [ ] 4b.3 Create `src/factories/` directory with placeholder factory (e.g., `createTestUser()`)
  - [ ] 4b.4 Create `src/helpers/` directory with placeholder test helper
  - [ ] 4b.5 Create `src/setup.ts` for shared test setup (e.g., environment reset)
  - [ ] 4b.6 Create barrel export `src/index.ts`
  - [ ] 4b.7 Verify `packages/testing` exports are importable from other workspaces
  - [ ] 4b.8 Create one trivial test in `packages/testing` for AC7 compliance
- [ ] Task 5: Docker development environment (AC: #1)
  - [ ] 5.1 Create `compose.dev.yaml` with PostgreSQL, server (tsx watch), client (Vite HMR)
  - [ ] 5.2 Create `Dockerfile.server` (multi-stage)
  - [ ] 5.3 Create `Dockerfile.client` (multi-stage)
  - [ ] 5.4 Create `.dockerignore`
  - [ ] 5.5 Verify `pnpm install && docker compose -f compose.dev.yaml up` boots all services
  - [ ] 5.6 Verify `pnpm drizzle-kit push` runs against Docker PostgreSQL
- [ ] Task 6: Testing foundation (AC: #7)
  - [ ] 6.1 Install and configure Vitest in all four workspaces
  - [ ] 6.2 Create one trivial test per workspace (4 total)
  - [ ] 6.3 Verify `pnpm test` from root discovers and passes all tests
- [ ] Task 7: Git initialisation (AC: #8)
  - [ ] 7.1 Initialise git repository
  - [ ] 7.2 Create `main` and `dev` branches
  - [ ] 7.3 Ensure `dev` is checked out as working branch

## Dev Notes

### Critical Context — What This Story Sets Up

This is **Story 1 of 58** — the foundation everything else builds on. Every architectural decision here propagates through the entire project. The dev agent MUST get the structure right because 6 subsequent stories in Epic 1 (auth, RBAC, audit logging, frontend shell, CI/CD) and all 12 remaining epics depend on this scaffold being correct.

**VLPRS is a government financial system** — a Vehicle Loan Processing & Receivables System for Oyo State Government managing 3,100+ active loans across 63 MDAs. This means:
- Financial precision is non-negotiable (decimal.js, NUMERIC(15,2), never float)
- Immutability patterns must be baked in from day one (append-only ledger)
- Audit trail infrastructure must be structurally present
- Security patterns (RBAC middleware chain, JWT) are established in Stories 1.2-1.4 but the scaffold must not prevent them

### What NOT To Do

1. **DO NOT use React 19** — pinned to 18.3.1 per architecture decision (known bugs in 19 at time of decision). Do not let Vite scaffold default to React 19.
2. **DO NOT use `react-router-dom`** — React Router v7 uses a single `react-router` package. The `react-router-dom` package is deprecated.
3. **DO NOT use Zod v3 import syntax** — Zod 4.x requires `import { z } from "zod/v4"` (not `import { z } from "zod"`). The old import gives you Zod 3 for backward compatibility.
4. **DO NOT install Drizzle ORM v1 beta** — use 0.45.x stable. The v1 beta is NOT production ready.
5. **DO NOT use `docker-compose.yml`** — Docker Compose v2.40+ uses `compose.yaml` as the preferred filename. Use `compose.dev.yaml` and `compose.prod.yaml`.
6. **DO NOT use the `version:` field** in compose files — it's deprecated and generates warnings.
7. **DO NOT run services directly on host** — everything runs through Docker Compose. No `node server.js` or `npx vite` directly.
8. **DO NOT use `npm` or `yarn`** — pnpm only. Monorepo workspaces depend on pnpm's strict dependency resolution.
9. **DO NOT create a `__tests__` directory** — tests are co-located next to source files (e.g., `foo.ts` + `foo.test.ts`).
10. **DO NOT use `localStorage` for tokens** — access tokens go in React state (memory only). This is established in Story 1.6 but the scaffold must not create patterns that contradict it.
11. **DO NOT use floating point for money** — ever. This story doesn't implement financial logic but must install `decimal.js` in server deps and establish the pattern.
12. **DO NOT create a `tailwind.config.js`** — Tailwind CSS v4 uses CSS-first configuration with `@theme` directives. No JS config file.

### Cross-Story Dependencies This Scaffold Enables

| Story | What it needs from this scaffold |
|---|---|
| 1.2 User Registration & Login | Express server, PostgreSQL, Drizzle ORM, bcrypt, JWT, users table pattern |
| 1.3 Session Security | refresh_tokens table, cookie configuration, CSRF setup |
| 1.4 RBAC | Middleware chain architecture (authenticate → authorise → scopeToMda → handler) |
| 1.5 Audit Logging | audit_log table pattern, Express middleware for automatic logging, pino |
| 1.6 Frontend Auth Shell | React Router v7, Zustand, TanStack Query, shadcn/ui sidebar, crimson theme |
| 1.7 CI/CD Pipeline | Dockerfiles (multi-stage), GitHub Actions, health check endpoint |

### Environment Variables (`.env.example` template)

```env
# Database
DATABASE_URL=postgresql://vlprs:vlprs_dev@localhost:5432/vlprs_dev

# JWT (Story 1.2 will use these)
JWT_SECRET=change-me-in-production
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=3001
NODE_ENV=development

# Client
VITE_API_URL=http://localhost:3001/api

# Email (Story 1.5+ will use)
RESEND_API_KEY=

# reCAPTCHA (Story 1.6 will use)
RECAPTCHA_SECRET_KEY=
RECAPTCHA_SITE_KEY=

# Infrastructure (Story 1.7 will use)
DROPLET_IP=
DROPLET_SSH_KEY=
DO_SPACES_KEY=
DO_SPACES_SECRET=
GHCR_TOKEN=
```

### Technical Requirements — Exact Stack & Versions

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Runtime** | Node.js | Latest LTS (22.x) | Required by pnpm 10 and Vite |
| **Package Manager** | pnpm | 10.x | Lifecycle scripts disabled by default — whitelist in `pnpm.onlyBuiltDependencies` |
| **Language** | TypeScript | 5.x (strict mode) | Shared `tsconfig.base.json` across all workspaces |
| **Frontend Framework** | React | ^18.3.1 | Pinned. NOT React 19. |
| **Frontend Build** | Vite | 6.x | Architecture specifies Vite 6. Vite 7 drops Node 18 — stay on 6.x for now to preserve Node 18 compat if needed |
| **UI Components** | shadcn/ui | (unversioned) | `npx shadcn init`. Uses unified `radix-ui` package |
| **CSS Framework** | Tailwind CSS | 4.x | CSS-first config (`@theme` directives, `@import "tailwindcss"`). No `tailwind.config.js` |
| **Backend Framework** | Express | 5.2.x | Requires Node 18+. Use `express@latest` |
| **ORM** | Drizzle ORM | 0.45.x | Stable. Schema-first. Single `schema.ts` file |
| **DB Migrations** | Drizzle Kit | (matches ORM) | `drizzle-kit push` for dev, `drizzle-kit generate` + `drizzle-kit migrate` for prod |
| **Database** | PostgreSQL | 17.x | Use PG 17 (2x write throughput over 16). Docker image: `postgres:17-alpine` |
| **Validation** | Zod | 4.x | Import via `zod/v4`. 14x faster string parsing vs Zod 3 |
| **Routing** | React Router | 7.x | Single `react-router` package. Lazy routes via `route.lazy` API |
| **Server State** | TanStack Query | 5.x | Install `@tanstack/react-query`. Do NOT install in this story — Story 1.6 |
| **Client State** | Zustand | latest | Ephemeral UI state only. Do NOT install in this story — Story 1.6 |
| **Testing** | Vitest | latest compatible with Vite 6 | Co-located tests. `pnpm test` from root |
| **Logging** | pino | latest | Structured JSON logging. Install in `apps/server` |
| **Financial Math** | decimal.js | latest | Install in `apps/server`. Never used on client |
| **Dev Server (backend)** | tsx | latest | Hot-reload for Express in development |
| **Build (backend)** | tsup | latest | Production builds for Express |
| **Docker** | Docker Compose | v2.40+ | `compose.dev.yaml` / `compose.prod.yaml` |
| **Linting** | ESLint | latest | Single root config, shared across workspaces |
| **Formatting** | Prettier | latest | Single root config |

### Architecture Compliance

**Middleware Chain Order** (established in scaffold, enforced from Story 1.2+):
```
helmet → cors → express-rate-limit → [captcha] → authenticate → authorise → scopeToMda → validate → auditLog → route handler
```
This story creates the Express app shell. The middleware will be added incrementally in Stories 1.2-1.5. The scaffold MUST structure the app so middleware can be inserted in this exact order.

**Service Architecture** — 16 services will be built across epics. This story creates the directory structure:
```
apps/server/src/
├── index.ts              # Express app entry
├── routes/               # Thin route handlers (validate → call service → respond)
│   └── healthRoutes.ts   # GET /api/health (this story)
├── middleware/            # Empty — populated in Stories 1.2-1.5
├── services/             # Empty — populated from Story 1.2+
├── db/
│   ├── schema.ts         # Drizzle schema (single file for all tables)
│   └── index.ts          # Drizzle client instance
├── lib/                  # Shared utilities
│   └── uuidv7.ts         # UUIDv7 generator (used for all PKs)
└── config/
    └── env.ts            # Environment variable validation (Zod)
```

**Client Architecture** — established in this story, populated in Story 1.6:
```
apps/client/src/
├── main.tsx              # React entry
├── App.tsx               # Root component with router
├── components/
│   ├── ui/               # shadcn/ui components (auto-generated)
│   └── shared/           # Shared custom components
├── layouts/              # Layout components (sidebar, header)
├── pages/                # Route page components (lazy loaded)
├── hooks/                # Custom React hooks
├── lib/                  # Utilities
│   └── utils.ts          # shadcn/ui cn() utility
├── styles/
│   └── globals.css       # Tailwind v4 imports + @theme config
└── types/                # Client-specific types
```

**Shared Package Structure:**
```
packages/shared/src/
├── index.ts              # Public exports
├── schemas/              # Zod validation schemas
│   └── emailSchema.ts    # Sample schema (this story)
├── types/                # Shared TypeScript types
├── constants/
│   └── vocabulary.ts     # Non-punitive vocabulary (placeholder for Story 1.5+)
└── utils/                # Shared utilities
```

**API Response Format** (all endpoints MUST follow):
```typescript
// Success
{ "success": true, "data": { ... } }

// Success with pagination
{ "success": true, "data": [...], "pagination": { "page": 1, "pageSize": 20, "totalItems": 342, "totalPages": 18 } }

// Error (use AppError class, never raw res.status().json())
{ "success": false, "error": { "code": "SCREAMING_SNAKE", "message": "Human-readable, non-punitive", "details": [...] } }
```

**Health Check Endpoint** (implemented in this story):
```typescript
// GET /api/health → 200
{ "status": "ok", "timestamp": "2026-02-17T10:30:00.000Z" }
```

**Database Conventions:**
- Primary keys: UUIDv7 (time-sortable, no sequential ID leakage) via `lib/uuidv7.ts`
- Tables: `snake_case`, plural (e.g., `ledger_entries`, `users`)
- Columns: `snake_case` (e.g., `staff_id`, `created_at`)
- Foreign keys: `{referenced_table_singular}_id` (e.g., `user_id`)
- Timestamps: Always `timestamptz` (UTC), never `timestamp`
- Money: `NUMERIC(15,2)` — never `FLOAT` or `REAL`
- Soft deletes: `deleted_at` timestamp on mutable tables
- Booleans: `is_` or `has_` prefix (e.g., `is_active`)

**Naming Conventions:**
- Component files: `PascalCase.tsx` (e.g., `HeroMetricCard.tsx`)
- Utility/hook files: `camelCase.ts` (e.g., `useAuth.ts`)
- Route/middleware files: `camelCase.ts` (e.g., `healthRoutes.ts`, `authMiddleware.ts`)
- Functions: `camelCase`, verb-first (e.g., `getLoanById()`)
- Constants: `SCREAMING_SNAKE` (e.g., `MAX_CSV_ROWS`)
- Types/Interfaces: `PascalCase`, no `I` prefix (e.g., `Loan`, `ApiResponse<T>`)
- Zod schemas: `camelCase` + `Schema` suffix (e.g., `emailSchema`)
- Environment variables: `SCREAMING_SNAKE` (e.g., `DATABASE_URL`)
- API endpoints: `/api/{resource}`, plural, lowercase (e.g., `/api/loans`)
- JSON fields: `camelCase` (e.g., `{ loanAmount, staffId }`)

### Library & Framework Requirements

**Install in `apps/client/package.json`** (this story):
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "typescript": "^5.x",
    "vite": "^6.x",
    "@vitejs/plugin-react": "latest",
    "vitest": "compatible with vite 6",
    "tailwindcss": "^4.x",
    "@tailwindcss/vite": "^4.x"
  }
}
```
shadcn/ui adds its own deps via `npx shadcn init` — do NOT manually install Radix.

**Install in `apps/server/package.json`** (this story):
```json
{
  "dependencies": {
    "express": "^5.2.1",
    "drizzle-orm": "^0.45.0",
    "pino": "latest",
    "pino-pretty": "latest",
    "decimal.js": "latest",
    "helmet": "latest",
    "cors": "latest",
    "dotenv": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "^0.45.0",
    "@types/express": "latest",
    "@types/cors": "latest",
    "typescript": "^5.x",
    "tsx": "latest",
    "tsup": "latest",
    "vitest": "compatible with vite 6"
  }
}
```
Do NOT install auth, rate-limiting, CSRF, or email packages yet — those come in Stories 1.2-1.7.

**Install in `packages/shared/package.json`** (this story):
```json
{
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "compatible with vite 6"
  }
}
```

**pnpm 10 Configuration** — add to root `package.json`:
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["bcrypt"]
  }
}
```
This whitelists lifecycle scripts for packages that need native compilation (bcrypt will be needed in Story 1.2). Without this, pnpm 10 silently skips post-install scripts.

### File Structure Requirements

**Complete file tree this story must produce:**

```
vlprs/
├── pnpm-workspace.yaml
├── package.json                    # Root scripts, pnpm config
├── pnpm-lock.yaml                  # Auto-generated
├── tsconfig.base.json              # Shared TS config (strict)
├── .eslintrc.cjs                   # Root ESLint config
├── .prettierrc                     # Root Prettier config
├── .env.example                    # Variable template (no secrets)
├── .env                            # Local dev values (gitignored)
├── .gitignore
├── .dockerignore
├── compose.dev.yaml                # Dev: PG + server + client
├── compose.prod.yaml               # Prod: Nginx + server (PG external)
├── Dockerfile.server               # Multi-stage (install → build → runtime)
├── Dockerfile.client               # Multi-stage (install → build → nginx)
│
├── apps/
│   ├── client/
│   │   ├── package.json
│   │   ├── tsconfig.json           # Extends tsconfig.base.json
│   │   ├── vite.config.ts          # Path aliases, React plugin
│   │   ├── components.json         # shadcn/ui config
│   │   ├── index.html
│   │   ├── public/
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── App.test.tsx        # Trivial test (AC7)
│   │       ├── components/
│   │       │   ├── ui/             # shadcn/ui (Button added for AC4)
│   │       │   └── shared/
│   │       ├── layouts/
│   │       ├── pages/
│   │       ├── hooks/
│   │       ├── lib/
│   │       │   └── utils.ts        # cn() utility from shadcn
│   │       ├── styles/
│   │       │   └── globals.css     # @import "tailwindcss" + @theme
│   │       └── types/
│   │
│   └── server/
│       ├── package.json
│       ├── tsconfig.json           # Extends tsconfig.base.json
│       ├── drizzle.config.ts       # Points to Docker PG
│       └── src/
│           ├── index.ts            # Express app entry + listen
│           ├── app.ts              # Express app factory (for testing)
│           ├── index.test.ts       # Trivial test (AC7)
│           ├── routes/
│           │   └── healthRoutes.ts # GET /api/health
│           ├── middleware/          # Empty — Stories 1.2-1.5
│           ├── services/           # Empty — Story 1.2+
│           ├── db/
│           │   ├── schema.ts       # Drizzle schema (empty, ready for tables)
│           │   └── index.ts        # Drizzle client connection
│           ├── lib/
│           │   └── uuidv7.ts       # UUIDv7 generator
│           └── config/
│               └── env.ts          # Zod-validated env vars
│
└── packages/
    ├── shared/
    │   ├── package.json
    │   ├── tsconfig.json           # Extends tsconfig.base.json
    │   └── src/
    │       ├── index.ts            # Public barrel export
    │       ├── index.test.ts       # Trivial test (AC7)
    │       ├── schemas/
    │       │   └── emailSchema.ts  # Sample Zod v4 schema
    │       ├── types/
    │       ├── constants/
    │       │   └── vocabulary.ts   # Placeholder for non-punitive vocab
    │       └── utils/
    └── testing/
        ├── package.json
        ├── tsconfig.json           # Extends tsconfig.base.json
        └── src/
            ├── index.ts            # Public barrel export
            ├── index.test.ts       # Trivial test (AC7)
            ├── factories/          # Shared test factories (e.g., createTestUser)
            ├── helpers/            # Shared test helpers
            └── setup.ts            # Shared test setup (env reset)
```

**Key Structural Rules:**
1. `apps/server/src/app.ts` exports the Express app (for test imports). `index.ts` calls `app.listen()`.
2. `apps/server/src/db/schema.ts` is a SINGLE file for all Drizzle table definitions — never split across files.
3. `packages/shared` must have `"main"` and `"types"` fields in `package.json` pointing to compiled output, OR use TypeScript project references so workspaces can import directly from `src/`.
4. Every directory that will be populated in future stories should exist NOW with an empty placeholder or index file — prevents dev agents from creating ad-hoc structures later.

### Testing Requirements

**Framework:** Vitest (Vite-native, TypeScript-first)

**Test Location:** Co-located with source files. Pattern: `filename.ts` + `filename.test.ts` in the same directory. NO `__tests__` directories.

**This Story's Tests (4 trivial tests — one per workspace):**

1. **`apps/client/src/App.test.tsx`** — Verify App component renders without crashing
2. **`apps/server/src/index.test.ts`** — Verify health endpoint returns `{ status: "ok" }` with 200
3. **`packages/shared/src/index.test.ts`** — Verify `emailSchema` validates a correct email and rejects an invalid one
4. **`packages/testing/src/index.test.ts`** — Verify a sample factory function returns expected shape

**Root Script:**
```json
{
  "scripts": {
    "test": "pnpm -r run test"
  }
}
```
Each workspace has its own `vitest.config.ts` (or vitest config in `vite.config.ts` for client).

**CI Expectations** (enforced from Story 1.7):
- `pnpm lint` — zero errors
- `pnpm typecheck` — zero errors (`tsc --noEmit` per workspace)
- `pnpm test` — all tests pass

All three must pass before any Docker build or deployment. This story establishes the local equivalents.

### Latest Technology Intelligence (Feb 2026)

**Version Drift from Architecture Document — Developer MUST use these updated values:**

| Technology | Architecture Says | Current Reality (Feb 2026) | Dev Action |
|---|---|---|---|
| Express | 5.1.x | **5.2.1** is latest stable | Use `express@^5.2.1` |
| Vite | 6 | Vite 7.3.1 exists but **drops Node 18** | **Stay on Vite 6.x** — architecture decision preserved. Vite 6 still receives patches |
| Vitest | (unspecified) | **4.0.18** (aligned with Vite major) | Use Vitest version compatible with Vite 6 — check `vitest@^2.x` or `vitest@^3.x` for Vite 6 compat |
| Zod | (unspecified) | **4.3.6** with breaking import change | `import { z } from "zod/v4"` — NOT `from "zod"`. The old import silently gives Zod 3 |
| pnpm | (unspecified) | **10.29.3** with breaking lifecycle change | Must add `pnpm.onlyBuiltDependencies` in root package.json for native deps |
| PostgreSQL | 16.x | **17.8** recommended for new projects | Use `postgres:17-alpine` Docker image. 2x write throughput, 20x less vacuum memory |
| React Router | v7 (react-router-dom) | **7.13.0** — single `react-router` package | `pnpm add react-router` — NOT `react-router-dom` (deprecated) |
| Docker Compose | docker-compose.yml | **compose.yaml** is preferred filename | Use `compose.dev.yaml` / `compose.prod.yaml`. No `version:` field |
| shadcn/ui | npx shadcn@latest init | `npx shadcn init` (no @latest needed) | Unified `radix-ui` package. RTL support available |
| Tailwind CSS | v4 | **4.1.18** stable | CSS-first config. `@import "tailwindcss"` replaces `@tailwind` directives. No JS config file |
| Drizzle ORM | (unspecified) | **0.45.1** stable, v1 in beta | Use 0.45.x. Do NOT use v1 beta (not production ready) |
| TanStack Query | v5 | **5.90.21** | Mature, stable. Install in Story 1.6, not now |

**Zod v4 Critical Migration Notes:**
- `.strict()` and `.passthrough()` are replaced by `z.strictObject()` and `z.looseObject()`
- `z.uuid()` now enforces RFC 4122 — not compatible with Zod 3's `z.string().uuid()`
- For UUIDv7 validation, use `z.uuidv7()` if available, otherwise `z.string().regex()` pattern
- Error customization APIs have been overhauled — check docs if custom error maps are needed
- `@zod/mini` (1.9 KB gzipped) available for client-side if bundle size is critical

**Tailwind CSS v4 Critical Notes:**
- `tailwind.config.js` is GONE — replaced by `@theme` directives directly in CSS
- PostCSS plugin: use `@tailwindcss/postcss` (not `tailwindcss`)
- Vite plugin: use `@tailwindcss/vite` (preferred over PostCSS for Vite projects)
- `@tailwind base/components/utilities` replaced with single `@import "tailwindcss"`
- New Oxide engine (Rust-based): 2-5x faster builds
- Browser requirement: Safari 16.4+, Chrome 111+, Firefox 128+

**PostgreSQL 17 vs 16 — Why Upgrade:**
- Up to 2x write throughput improvement
- 20x less memory for vacuum operations
- Streaming I/O for faster sequential scans
- Better B-tree IN clause handling
- PostgreSQL 18 exists (18.2) but is very new — PG 17 is the battle-tested safe choice
- Docker image: `postgres:17-alpine`

### Docker Configuration Specifications

**`compose.dev.yaml`:**
```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: vlprs
      POSTGRES_PASSWORD: vlprs_dev
      POSTGRES_DB: vlprs_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vlprs -d vlprs_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
      target: development
    ports:
      - "3001:3001"
    volumes:
      - ./apps/server:/app/apps/server
      - ./packages/shared:/app/packages/shared
      - /app/node_modules
    environment:
      - DATABASE_URL=postgresql://vlprs:vlprs_dev@db:5432/vlprs_dev
      - NODE_ENV=development
      - PORT=3001
    depends_on:
      db:
        condition: service_healthy
    command: pnpm --filter server dev

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
      target: development
    ports:
      - "5173:5173"
    volumes:
      - ./apps/client:/app/apps/client
      - ./packages/shared:/app/packages/shared
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3001/api
    depends_on:
      - server
    command: pnpm --filter client dev --host

volumes:
  pgdata:
```

**`Dockerfile.server` (multi-stage):**
```dockerfile
# Stage 1: Base
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Stage 3: Development (hot-reload)
FROM deps AS development
COPY . .
EXPOSE 3001

# Stage 4: Build
FROM deps AS build
COPY . .
RUN pnpm --filter shared build && pnpm --filter server build

# Stage 5: Production
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**`Dockerfile.client` (multi-stage):**
```dockerfile
# Stage 1: Base
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Stage 3: Development (HMR)
FROM deps AS development
COPY . .
EXPOSE 5173

# Stage 4: Build
FROM deps AS build
COPY . .
RUN pnpm --filter shared build && pnpm --filter client build

# Stage 5: Production (Nginx)
FROM nginx:alpine AS production
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### UX Foundation — Theme Configuration

**`apps/client/src/styles/globals.css`** must establish the Oyo State brand theme:

```css
@import "tailwindcss";

@theme {
  /* Brand — Oyo State Heritage */
  --color-crimson: #9C1E23;
  --color-crimson-dark: #7A181D;
  --color-crimson-medium: #B83338;
  --color-crimson-50: #FCECED;

  /* Secondary — Complementary Teal */
  --color-teal: #0D7377;
  --color-teal-hover: #10969B;
  --color-teal-50: #E0F5F5;

  /* Tertiary — Heritage Gold */
  --color-gold: #D4A017;
  --color-gold-dark: #B8860B;
  --color-gold-50: #FDF8E8;

  /* Semantic */
  --color-success: #16A34A;
  --color-danger: #DC2626;

  /* Surfaces */
  --color-background: #FFFFFF;
  --color-surface: #F8FAFC;
  --color-border: #E2E8F0;
  --color-text-primary: #1E293B;
  --color-text-secondary: #64748B;
  --color-text-muted: #94A3B8;

  /* Focus */
  --color-focus-ring: #0D7377;

  /* Typography */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Spacing */
  --radius-card: 8px;
  --radius-button: 6px;
}
```

**Chrome vs Content Rule:** Crimson lives ONLY in sidebar, header, and primary buttons. Data areas use neutral colours (white, slate, grey, teal, gold). NO crimson in variance displays, comparison panels, or data indicators.

### Project Structure Notes

- This story creates the VLPRS monorepo from scratch — greenfield, no existing codebase
- All directory paths and module names align with the architecture document exactly
- No conflicts or variances detected between PRD, architecture, epics, and UX design specifications
- The architecture specifies `docker-compose.dev.yml` but Docker Compose v2.40+ convention is `compose.dev.yaml` — this story uses the modern convention

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Style]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication]
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing]
- [Source: _bmad-output/planning-artifacts/architecture.md#Deployment]
- [Source: _bmad-output/planning-artifacts/prd.md#Technical Requirements]
- [Source: _bmad-output/planning-artifacts/prd.md#Non-Functional Requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Framework]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

- 2026-02-17: Story created by SM agent (context compilation). Ultimate context engine analysis completed — comprehensive developer guide created.
- 2026-02-18: PM amendment — added `packages/testing/` workspace (shared test factories, helpers, setup) per OSLRS playbook integration. Updated AC1, AC7, Task 4b, Task 6, file tree, test count (3→4). Story count updated 56→58.
