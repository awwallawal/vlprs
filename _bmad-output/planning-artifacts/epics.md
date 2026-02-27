---
stepsCompleted: [1, 2, 3, 4]
lastStep: 4
status: 'complete'
completedAt: '2026-02-14'
lastEdited: '2026-02-27'
editHistory:
  - date: '2026-02-27'
    changes: 'Party Mode sessions — 4 new FRs cascaded: Added FR83 (MDA Data Export) to Epic 5 FR coverage + added to Epic 5 description. Added FR84 (MDA Self-Service Reconciliation View) to Epic 11 FR coverage + added to Epic 11 description. Added FR85 (Approved Beneficiary Cross-Reference) to Epic 3 FR coverage + added to Epic 3 description. Added FR86 (Submission Heatmap & Compliance Activity Grid) to Epic 4 FR coverage (AG/Deputy view) and Epic 5 FR coverage (MDA officer self-view) + added to both epic descriptions. Updated FR Coverage Map with FR83-FR86. Added SubmissionHeatmap to UX component references. Updated FR count in Requirements Inventory (82→86). Updated total stories: 62→62 (new FRs attach to existing stories or create minimal new stories during sprint planning). Side Quest SQ-1 documented separately in implementation-artifacts/SQ-1-legacy-cd-analysis-pipeline.md.'
  - date: '2026-02-20'
    changes: 'About page, FR82, CMS & integration readiness: Added About the Programme page (/about) to Story 14.2 with Mission, Vision, Core Values, Programme Leadership (AG, Deputy AG, Director), Programme Governance (Vehicle Loan Committee, AG oversight — absorbs former /scheme/ag-office content), Institutional Story. Added "About" as top-level nav item in Story 14.1. Removed "Role of the AG''s Office" from The Scheme dropdown (content merged into /about). Renamed Story 14.2 to "About & Scheme Information Pages". Updated footer column 1 to include About link. Net page count unchanged (AgOfficePage removed, AboutPage added). Added FR82 (About the Programme page) to FR requirements inventory and FR coverage map. Updated Epic 14 FRs covered: FR76-FR81 → FR76-FR82. Updated Epic 14 description: added About page, content directory pattern (src/content/*.ts), Sanity CMS migration readiness, "About" nav item.'
  - date: '2026-02-20'
    changes: 'Public Website & Scheme Information Portal: Added Epic 14 (3 stories: 14.1 Homepage & Navigation Shell, 14.2 Scheme Information Pages, 14.3 Resources/Support/Legal Pages). Added FR76-FR81 to requirements inventory and FR coverage map. Inserted Epic 14 as Sprint 2 in sprint sequence — shifted existing Sprints 2-13 to Sprints 3-14. Updated totals: 13→14 epics, 58→61 stories, 13→14 sprints (~28 weeks). Updated critical path (Epic 14 depends on Epic 1 only). Updated demonstrability milestones (Sprint 2 delivers institutional public face). Updated MVP feature count from 12 to 13.'
  - date: '2026-02-19'
    changes: 'User invitation & account lifecycle pull-forward: Added Stories 1.9a (User Account Lifecycle API & Email Invitation) and 1.9b (User Administration Interface, Profile Self-Service & First-Login Flow) to Epic 1. Implements downward-only management hierarchy: super_admin manages dept_admin + mda_officer; dept_admin manages mda_officer; super_admin accounts CLI-only. Full account state machine (Active ↔ Deactivated → Deleted). Resend welcome email with temp credentials. Forced first-login password change. Profile self-service. Removed Stories 13.1 (User Account Management) and 13.2 (Password Reset) from Epic 13 — absorbed into 1.9a/1.9b. Epic 13 renamed to Staff ID Governance (2 stories: 13.3, 13.4). FR72/FR73 moved from Epic 13 to Epic 1 in coverage map. Epic 1: 9→11 stories. Epic 13: 4→2 stories. Net total unchanged: 58 stories. Added ux-design-directions.html as canonical visual reference in UX spec. Sprint 1 milestone updated to include user invitation capability.'
  - date: '2026-02-18'
    changes: 'OSLRS playbook integration: Split Story 1.8 into 1.8a (Design Foundation, Components, Mock Data Layer) and 1.8b (Role-Specific Screens, Demo Seed, Wiring Map) per story sizing guardrail (>15 tasks → split). Added spike-first validation criterion to Story 1.7 (deploy Hello World through full pipeline before production Dockerfiles). Added production seed from env vars criterion to Story 1.7. Added Playwright E2E smoke tests to Story 1.6 (login as each role, verify correct home screen). Added packages/testing shared test package criterion to Story 1.1. Updated story counts: 57→58, Epic 1: 8→9 stories.'
  - date: '2026-02-17'
    changes: 'Added Story 1.8 (Frontend Screen Scaffolding, Mock Data Layer & Demo Seed) to Epic 1. Story adds design foundation (Oyo Crimson tokens, typography, extended Badge variants), 6 priority reusable components (HeroMetricCard, NairaDisplay, AttentionItemCard, FileUploadZone, MigrationProgressCard, ExceptionQueueRow), role-specific skeleton screens with mock data (Executive Dashboard, MDA Detail, Loan Detail, MDA Submission, Operations Hub), mock data service layer with hook abstractions for progressive API wiring, demo seed script (5 accounts, 63 MDAs, mock loans), build status indicator, and wiring map documentation. Updated Epic 1 description, sprint sequence (7→8 stories), total stories (56→57), and added Sprint 1 demonstrability milestone. Rationale: eliminate UI dark zone in Sprints 2-3, enable continuous client visibility via hosted domain from Sprint 1.'
  - date: '2026-02-15'
    changes: 'PRD delta cascade (FR60-FR75): Updated FR inventory (FR16/17/20 hardened for 8-field CSV, added FR60-FR75). Updated Additional Requirements (17 custom components, 16 services, new API routes). Updated FR Coverage Map (FR60-FR75 mapped to Epics 10-13). Updated Epic 5 for 8-field CSV. Added 4 new epics: Epic 10 (Staff Temporal Profile & Retirement Validation — 4 stories), Epic 11 (Pre-Submission Checkpoint & Mid-Cycle Events — 4 stories), Epic 12 (Early Exit Processing — 3 stories), Epic 13 (User Administration & Staff ID Governance — 4 stories). Added Sprint Sequence section with 13-sprint implementation order, critical path, and demonstrability milestones. Total: 13 epics, 56 stories covering 75 FRs.'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# VLPRS - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for VLPRS, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: System can compute loan repayment schedules for all 4 grade-level tiers with correct principal, interest, and total amounts
- FR2: System can apply 2-month moratorium (grace period) to new loans with no interest accrual during moratorium
- FR3: System can compute accelerated repayment schedules when tenure is shortened
- FR4: System can apply last-payment adjustment method where the final installment absorbs all accumulated rounding
- FR5: System can auto-split monthly deduction amounts into principal and interest components
- FR6: System can compute outstanding balances from the immutable repayment ledger (derived, never stored)
- FR7: System can detect when a loan balance reaches zero and trigger the auto-stop process
- FR8: System can generate an Auto-Stop Certificate with verification code when a loan is fully repaid
- FR9: System can send the Auto-Stop Certificate to both the beneficiary and the MDA Reporting Officer
- FR10: System can store loan master records (borrower details, loan terms, approval data, MDA assignment)
- FR11: System can record repayment entries as immutable append-only ledger records (no UPDATE or DELETE)
- FR12: System can reconstruct any loan balance at any point in time from the ledger history
- FR13: System can store and retrieve loan records by staff ID, name, MDA, or loan reference number
- FR14: System can track loan lifecycle states (Applied, Approved, Active, Completed, Transferred, Written Off)
- FR15: System can record loan state transitions with timestamp, acting user, and reason
- FR16: MDA Reporting Officers can upload monthly deduction data via CSV file (8 fields: Staff ID, Month, Amount Deducted, Payroll Batch Reference, MDA Code, Event Flag, Event Date, Cessation Reason). Fields 7-8 are conditional: Event Date required when Event Flag ≠ NONE; Cessation Reason required when Amount = ₦0 AND Event Flag = NONE
- FR17: MDA Reporting Officers can enter monthly deduction data manually through a form interface that mirrors the 8-field CSV structure with the same validation rules, conditional field logic, and atomic behaviour as CSV upload
- FR18: System can validate submissions atomically — all rows accepted or entire upload rejected (no partial processing)
- FR19: System can detect and reject duplicate submissions (same staff ID + same month)
- FR20: System can validate data types and format correctness with human-readable error messages referencing specific row numbers. Validated fields: Staff ID (exists in system), Month (valid YYYY-MM format, within open period), Amount Deducted (valid number, ≥0), Payroll Batch Reference (non-empty string), MDA Code (matches assigned MDA), Event Flag (valid enum value), Event Date (valid date when Event Flag ≠ NONE), Cessation Reason (required when Amount = ₦0 AND Event Flag = NONE)
- FR21: System can compare submitted deductions against expected deduction schedules and generate a comparison summary
- FR22: System can display comparison results using neutral language — prohibited terms: "error," "mistake," "fault," "wrong"; required terms: "comparison," "variance," "difference"; informational icons only
- FR23: System can generate a submission confirmation with reference number, timestamp, and row count
- FR24: System can enforce period lock to prevent submissions for future months or already-closed periods
- FR25: Department Admin can upload legacy MDA spreadsheets (.xlsx and .csv) through the migration tool with a column-mapping step to map source columns to required VLPRS fields (up to 10MB / 500 rows per upload)
- FR26: System can validate and categorise migrated records (Clean, Minor Variance, Significant Variance, Structural Error, Anomalous)
- FR27: System can display side-by-side comparison of MDA-declared values vs system-computed values with mathematical explanation
- FR28: Department Admin can acknowledge variances and establish baseline positions ("Accept as Declared")
- FR29: System can create summary ledger entries from migrated data to establish the starting baseline
- FR30: System can track migration status per MDA (Pending, Received, Imported, Validated, Reconciled, Certified)
- FR31: Department Admin can view a Migration Dashboard showing all 63 MDAs and their migration status
- FR32: Super Admin can view an executive dashboard with four headline numbers (Active Loans, Total Exposure, Fund Available, Monthly Recovery) without any interaction
- FR33: Super Admin can view attention items on the dashboard with status indicators
- FR34: Super Admin can drill down from headline numbers to MDA-level detail
- FR35: Super Admin can drill down from MDA-level to individual loan records
- FR36: Super Admin can view MDA compliance status (which MDAs have submitted for the current period)
- FR37: System can generate Executive Summary reports
- FR38: System can generate MDA Compliance reports
- FR39: System can generate Variance reports (declared vs computed, by MDA)
- FR40: System can generate Loan Snapshot reports by MDA (the computed 16-column view)
- FR41: Department Admin can generate weekly AG reports
- FR42: Users can authenticate via email and password with session management policies
- FR43: System can enforce role-based access control with 3 MVP roles (Super Admin, Department Admin, MDA Reporting Officer)
- FR44: Super Admin can view all data across all MDAs
- FR45: Department Admin can view all data, manage loans, process migrations, and resolve exceptions
- FR46: MDA Reporting Officers can only view and submit data for their assigned MDA
- FR47: System can log all authentication events (login, logout, failed attempts)
- FR48: System can log all user actions with timestamp, user identity, role, and IP address
- FR49: System can send email submission reminders to MDA Reporting Officers at T-3 days before deadline
- FR50: System can send overdue email alerts on T+1 to non-submitting MDA Reporting Officers
- FR51: System can send loan completion notifications to beneficiaries when balance reaches zero
- FR52: System can send Auto-Stop Certificate notifications to MDA payroll officers with instruction to cease deductions
- FR53: System can export any generated report as a branded PDF with Oyo State Government crest
- FR54: Super Admin and Department Admin can share generated PDF reports via a one-tap action
- FR55: Super Admin and Department Admin can flag loan records as exceptions with priority level, category, and free-text notes
- FR56: Super Admin and Department Admin can view an exception queue sorted by priority with filtering and resolution workflow
- FR57: System can detect inactive loans (no deduction for 60+ consecutive days) and auto-flag as exceptions
- FR58: Department Admin can add annotations (free-text notes) to any loan record with timestamp and attribution
- FR59: Department Admin can correct a previously submitted event flag through a correction workflow
- FR60: MDA Reporting Officers can review a pre-submission checkpoint screen before CSV upload or manual submission showing: staff approaching retirement within 12 months, staff with zero deduction last month and no event filed, mid-cycle events reported since last submission awaiting CSV confirmation. MDA Reporting Officer must confirm review via checkbox before submission is accepted
- FR61: MDA Reporting Officers and Department Admin can file mid-cycle employment events at any time via a form with 5 fields: Staff ID (with name/MDA lookup confirmation), Event Type (Retired, Deceased, Suspended, Absconded, Transferred Out, Dismissed, LWOP Start, LWOP End, Service Extension), Effective Date, Reference Number (conditional), Notes (optional). System immediately updates staff loan status and sends confirmation
- FR62: System can reconcile mid-cycle employment events against monthly CSV submissions: matched events confirmed automatically; date discrepancies flagged for Department Admin reconciliation; unconfirmed events and new CSV events handled appropriately
- FR63: System can compute remaining service months from computed retirement date at loan setup and compare against loan tenure. If tenure exceeds remaining service, system displays: payroll deduction months, gratuity receivable months, and projected gratuity receivable amount
- FR64: System can track projected gratuity receivable amount (outstanding balance at computed retirement date) for loans where tenure exceeds remaining service, updated monthly. Total gratuity receivable exposure surfaced on executive dashboard
- FR65: System can compute retirement date as the earlier of (date of birth + 60 years) or (date of first appointment + 35 years). Retirement date recomputed automatically if DOB or appointment date is corrected. Stored on loan record for all temporal validations
- FR66: Department Admin can record a service extension for a staff member with: new expected retirement date, approving authority reference number, and notes. Override replaces computed retirement date. Audit-logged with original and new dates
- FR67: Department Admin can initiate an early exit computation for an active loan, generating: remaining principal balance, current month interest, total lump sum payoff amount, and computation validity expiry date (last day of current month). Each computation assigned a unique reference number
- FR68: Department Admin can record: staff commitment to early exit (with agreed payment deadline), and lump sum payment received (with payment date, amount, and payment reference). Upon confirmed payment, system closes loan and triggers Auto-Stop Certificate generation
- FR69: System can mark an early exit computation as expired if it reaches its expiry date without recorded payment. Expired computations retained in audit history. Staff commitment without payment by deadline flagged as attention item
- FR70: MDA Reporting Officers can upload historical monthly deduction records via CSV using the same 8-field format. System validates, timestamps as historical, and cross-references against migration baseline data. Variances surfaced in reconciliation report for Department Admin review
- FR71: System can generate a Service Status Verification Report during migration listing all imported staff whose computed retirement date is before the import date with active loan status. Report includes: staff name, Staff ID, MDA, computed retirement date, months past retirement, and outstanding balance
- FR72: User account lifecycle management with downward-only hierarchy. Super Admin can create, deactivate, reactivate, soft-delete, and reassign Department Admin and MDA Reporting Officer accounts. Department Admin can create, deactivate, reactivate, soft-delete, and reassign MDA Reporting Officer accounts only. Super Admin accounts managed exclusively via CLI. No user can modify their own account through management endpoints. Account states: Active, Deactivated (reversible), Deleted (soft, one-way). Welcome email via Resend with temporary credentials on account creation. Forced first-login password change. Profile self-service (view own details, change own password). All account lifecycle changes audit-logged
- FR73: Admin-initiated password reset scoped by management hierarchy. Department Admin resets MDA Reporting Officer passwords. Super Admin resets Department Admin and MDA Reporting Officer passwords. Generates temporary password, sends reset email via Resend, sets must_change_password flag, revokes all refresh tokens. Password reset events audit-logged
- FR74: MDA Reporting Officers can add or update Staff ID for loan records within their assigned MDA only. Department Admin and Super Admin can search and update Staff IDs system-wide. All Staff ID changes audit-logged
- FR75: System can detect duplicate Staff IDs when a Staff ID is added or updated by checking all existing records. If match found, system displays warning with existing loan reference. User can proceed (with justification note logged) or cancel
- FR76: Public homepage with hero section, Official Programme Notice card, trust strip, How It Works 4-step journey, loan category cards, key capabilities, repayment & settlement rules, Who VLPRS Serves, trust & compliance, endorsement placeholder, news section, and final CTA. Neutral language only
- FR77: Responsive navigation bar with 2-level dropdown structure, login modal (Staff Portal active, Beneficiary Portal and EOI as Phase 2 placeholders), hamburger mobile menu, and 4-column footer with legal strip and Programme Disclaimer
- FR78: Scheme information pages: Programme Overview, About VLPRS, Eligibility & Loan Categories (4 tiers with amounts), Repayment & Settlement Rules (accordion), How It Works (4-step visual with disclaimer)
- FR79: Resources and support pages: FAQ (categorised, minimum 15 questions), MDA Submission Guide, Downloads & Forms, News & Announcements, Help & Support (contact info)
- FR80: Legal and compliance pages: Privacy & Data Protection (NDPR), Programme Disclaimer, Accessibility Statement (WCAG 2.1 AA)
- FR81: All public pages include semantic HTML, meta tags (title, description, Open Graph), proper heading hierarchy, mobile-responsive layout, and 44x44px minimum touch targets
- FR82: About the Programme page (/about) — top-level navigation item. Mission, Vision, Core Values. Programme Leadership section with role-title-prominent card design (AG, Deputy AG, Director — role and institutional description permanent, name swappable for personnel change resilience). Programme Governance section (Vehicle Loan Committee, AG oversight — absorbs former /scheme/ag-office content). Institutional Story section. Content extracted to src/content/about.ts for future CMS migration. Template A (Content Page) layout

### NonFunctional Requirements

- NFR-PERF-1: Executive dashboard load (4G mobile) — <3 seconds to all four headline numbers rendered
- NFR-PERF-2: Subsequent SPA page transitions — <500ms
- NFR-PERF-3: CSV upload processing (100 rows) — <10 seconds
- NFR-PERF-4: Report generation (any standard report) — <10 seconds
- NFR-PERF-5: Loan search by staff ID — <2 seconds
- NFR-PERF-6: Time to Interactive (first visit) — <4 seconds
- NFR-PERF-7: Computation engine (single loan schedule) — <1 second
- NFR-PERF-8: Migration tool (single MDA import, ~50 records) — <15 seconds
- NFR-SEC-1: Email/password authentication with password policy (min 8 chars, 1 uppercase, 1 lowercase, 1 digit)
- NFR-SEC-2: Role-based access control enforced at API level — 100% of endpoints enforce role checks
- NFR-SEC-3: TLS 1.2+ for all communications
- NFR-SEC-4: All personal and financial data encrypted at rest using AES-256
- NFR-SEC-5: No UPDATE or DELETE on repayment ledger — enforced at database and API level
- NFR-SEC-6: Every user action logged with timestamp, user ID, role, IP address, action type
- NFR-SEC-7: Audit logs are append-only — no modification or deletion capability
- NFR-SEC-8: All user inputs validated server-side at API boundary
- NFR-SEC-9: OWASP Top 10 protection verified by automated security scanning
- NFR-SEC-10: 30-minute inactivity timeout, session token regeneration, max 1 concurrent session
- NFR-SEC-11: Account locked for 15 minutes after 5 consecutive failed login attempts
- NFR-SEC-12: NDPR compliance — privacy notices, consent capture, data minimisation, right of access, 7-year retention
- NFR-SCALE-1: 63 MDA officers + 3 admin users concurrent while maintaining performance targets
- NFR-SCALE-2: Performance maintained during monthly submission window (20th-28th)
- NFR-SCALE-3: Support ~3,150 loan records with full ledger history
- NFR-SCALE-4: System performs within targets as ledger accumulates 5+ years (~189,000+ rows)
- NFR-SCALE-5: API-first architecture enables future integrations
- NFR-ACCESS-1: WCAG 2.1 AA compliance
- NFR-ACCESS-2: 16px minimum font size
- NFR-ACCESS-3: Minimum 4.5:1 contrast for body text, 3:1 for large text
- NFR-ACCESS-4: Minimum 44x44px touch targets
- NFR-ACCESS-5: All icons accompanied by text labels
- NFR-ACCESS-6: All core workflows navigable by keyboard
- NFR-ACCESS-7: Status indicators use colour + icon + text — never colour alone
- NFR-REL-1: 99.5% availability during business hours (Mon-Fri, 8am-6pm WAT)
- NFR-REL-2: Zero data loss — no financial record may be lost
- NFR-REL-3: Automated daily backups with tested restore procedures
- NFR-REL-4: <4 hours recovery time objective
- NFR-REL-5: All data submissions are atomic — complete success or complete rollback
- NFR-REL-6: Computation determinism — same inputs always produce identical outputs
- NFR-REL-7: Kobo-level accuracy (2 decimal places) using decimal types, never floating point

### Additional Requirements

**From Architecture:**

- Starter template specified: pnpm monorepo with `apps/client` (React 18 + Vite), `apps/server` (Express 5), `packages/shared` (TypeScript types + Zod validators). Project initialisation should be the first implementation story
- Docker + Docker Compose for dev/prod parity: `docker-compose.dev.yml` (PostgreSQL + server hot-reload + Vite HMR), `docker-compose.prod.yml` (Nginx + server + managed PG external)
- Multi-stage Dockerfiles for server and client
- CI/CD via GitHub Actions: push to `main` triggers lint → typecheck → test → build Docker images → push to ghcr.io → SSH to Droplet → docker compose pull + up
- Branch strategy: `main` (production, protected — requires PR + CI pass), `dev` (direct push allowed)
- Plain JWT auth with access token (15min in-memory) + refresh token (7 days httpOnly cookie) + token rotation with reuse detection
- CSRF protection mandatory (double-submit cookie or csurf) since refresh tokens use cookies
- RBAC middleware chain: `authenticate` → `authorise(requiredRoles)` → `scopeToMda` → route handler
- 3-layer immutable ledger enforcement: DB trigger + Drizzle middleware + Express middleware
- Drizzle Kit schema-first migrations committed to git
- Zod validation schemas in `packages/shared` — single source of truth for client + server
- Financial arithmetic with `decimal.js` — server-side only, never compute money on client
- `pino` structured JSON logging with userId, mdaId, action, resource, ip fields
- Dedicated `audit_log` table (append-only, UUIDv7 PK) for every authenticated API call
- Nginx containerised as reverse proxy + static file server + SSL termination
- Let's Encrypt + Certbot for SSL with auto-renewal
- DigitalOcean Droplet + Managed PostgreSQL for hosting
- Managed PG daily auto-backups + weekly `pg_dump` to DO Spaces (belt-and-suspenders backup)
- UptimeRobot pinging `/api/health` every 5 min for availability tracking
- Google reCAPTCHA v3 (invisible, score-based) on login + public forms
- Resend for transactional emails (confirmations, reminders, password resets)
- express-rate-limit with 3 tiers: strict (auth 5/15min), moderate (mutations 30/min), relaxed (reads 120/min)
- Non-punitive vocabulary enforced via shared constants in `packages/shared/src/constants/vocabulary.ts`
- UUIDv7 for all primary keys (time-sortable)
- PostgreSQL `pgcrypto` for PII field encryption at application layer
- Soft deletes (`deleted_at` timestamp) on mutable tables (users, MDAs)
- Swagger/OpenAPI auto-generated API docs at `/api/docs` in development
- TanStack Query v5 for server state, Zustand for ephemeral UI state only
- React Router v7 with lazy routes and code splitting per major route
- React Hook Form + `@hookform/resolvers/zod` for all forms
- Server-side PDF generation via `@react-pdf/renderer`
- `date-fns` for date handling, `recharts` for dashboard visualisations
- `multer` for CSV upload handling, `papaparse` for CSV parsing
- Vitest for testing across frontend and backend
- 16 server-side services with defined ownership/boundary rules: authService, userAdminService, mdaService, loanService, ledgerService, computationEngine, submissionService, comparisonEngine, migrationService, reportService, certificateService, notificationService, preSubmissionService, employmentEventService, earlyExitService, staffIdService
- New API route groups: `/api/pre-submission/*`, `/api/employment-events/*`, `/api/early-exits/*`, `/api/staff-ids/*`, `/api/users/*`
- temporalValidationService for retirement date computation, remaining service calculation, and post-retirement detection
- userAdminService for user account lifecycle management (create, deactivate, reassign, password reset)

**From UX Design Specification:**

- Mobile-first design for AG Dashboard (<768px primary), desktop-first for data workflows
- Responsive breakpoints: Mobile (<768px), Tablet (768-1024px), Desktop (>1024px), Wide Desktop (1280px+)
- Oyo Crimson `#9C1E23` palette for brand chrome (sidebar, header, primary buttons) — no crimson in data content
- Non-punitive design tokens: `--variance-bg` (neutral grey), `--variance-icon` (teal info circle), `--attention-bg` (amber/gold)
- Chrome vs Content colour separation enforced throughout
- 17 custom components specified: HeroMetricCard, AttentionItemCard, NonPunitiveVarianceDisplay, ComparisonPanel, ComputationTransparencyAccordion, FileUploadZone, SubmissionConfirmation, AutoStopCertificate, ExceptionQueueRow, MigrationProgressCard, NairaDisplay, PreSubmissionChecklist, EmploymentEventForm, EarlyExitComputationCard, RetirementProfileCard, GratuityReceivableCard, StaffIdManager
- shadcn/ui Badge variants extended: `review` (gold), `info` (teal), `complete` (green), `pending` (grey), `variance` (grey bg + teal icon)
- Typography: Inter (variable) for body, JetBrains Mono for financial figures in tables
- Hero metrics: 36px bold with count-up animation (200ms), `font-variant-numeric: tabular-nums`
- Naira currency formatting: ₦ symbol + thousands separator + 2 decimal places throughout
- Skeleton loaders for AG Dashboard (no loading spinners blocking content)
- PWA basic installability: manifest + service worker for home screen icon
- Performance budgets: FCP <1.5s, LCP <3.0s, TTI <3.5s, dashboard route <150KB gzipped, API payload <5KB
- Service worker: cache shell + static assets, dashboard API with 5-minute TTL
- Keyboard navigation: Tab order, focus indicators (2px teal ring), skip link, Ctrl+K search, Escape closes overlays
- Screen reader support: semantic HTML landmarks, ARIA live regions, ARIA labels on custom components
- Focus management: focus to h1 on route change, focus trap in dialogs, focus return on close
- `prefers-reduced-motion: reduce` support for accessibility
- Colour contrast verified: all combinations meet WCAG AA (primary text 12.6:1, sidebar text 7.2:1)
- Button hierarchy: Primary (crimson), Secondary (teal outline), Tertiary (ghost), Destructive (red — only for irreversible actions)
- One primary button per visible context, minimum 44x44px touch targets
- Form patterns: validate on blur, inline amber validation messages, 16px min font on inputs
- Table patterns: 48px row height default, 36px dense mode, sortable columns, sticky header, horizontal scroll on mobile
- Non-punitive language patterns: "Upload needs attention" not "Upload failed", "Comparison Complete" not "Errors Found", info icons only (never warning triangles)
- Toast notifications: auto-dismiss 5s for success, persist for attention items
- Navigation: crimson sidebar (256px fixed desktop, Sheet overlay mobile), breadcrumb drill-down (max 3 levels)
- Global search (Command palette): always visible, Ctrl+K shortcut, searches staff ID/name/MDA/loan ref

### FR Coverage Map

| FR | Epic | Brief Description |
|----|------|-------------------|
| FR1 | Epic 2 | Compute repayment schedules for all 4 tiers |
| FR2 | Epic 2 | Apply 2-month moratorium |
| FR3 | Epic 2 | Compute accelerated repayment |
| FR4 | Epic 2 | Last-payment adjustment method |
| FR5 | Epic 2 | Auto-split deduction into principal/interest |
| FR6 | Epic 2 | Compute outstanding balances from ledger |
| FR7 | Epic 8 | Detect zero balance, trigger auto-stop |
| FR8 | Epic 8 | Generate Auto-Stop Certificate |
| FR9 | Epic 8 | Send certificate to beneficiary + MDA |
| FR10 | Epic 2 | Store loan master records |
| FR11 | Epic 2 | Immutable append-only ledger records |
| FR12 | Epic 2 | Reconstruct balance at any point in time |
| FR13 | Epic 2 | Retrieve loans by staff ID, name, MDA, ref |
| FR14 | Epic 2 | Track loan lifecycle states |
| FR15 | Epic 2 | Record state transitions with audit trail |
| FR16 | Epic 5 | CSV upload (8 fields with conditional Event Date/Cessation Reason) |
| FR17 | Epic 5 | Manual entry form interface (8-field with conditional logic) |
| FR18 | Epic 5 | Atomic validation (all-or-nothing) |
| FR19 | Epic 5 | Duplicate detection |
| FR20 | Epic 5 | Data type validation with row-level errors (8 validated fields) |
| FR21 | Epic 5 | Compare against expected schedule |
| FR22 | Epic 5 | Neutral language display |
| FR23 | Epic 5 | Submission confirmation with reference |
| FR24 | Epic 5 | Period lock enforcement |
| FR25 | Epic 3 | Legacy spreadsheet upload with column mapping |
| FR26 | Epic 3 | Validate and categorise migrated records |
| FR27 | Epic 3 | Side-by-side comparison with math |
| FR28 | Epic 3 | Acknowledge variances, establish baseline |
| FR29 | Epic 3 | Create summary ledger entries |
| FR30 | Epic 3 | Track migration status per MDA |
| FR31 | Epic 3 | Migration Dashboard for all 63 MDAs |
| FR32 | Epic 4 | Executive dashboard with 4 headline numbers |
| FR33 | Epic 4 | Attention items with status indicators |
| FR34 | Epic 4 | Drill down to MDA-level detail |
| FR35 | Epic 4 | Drill down to individual loan records |
| FR36 | Epic 4 | MDA compliance status view |
| FR37 | Epic 6 | Executive Summary reports |
| FR38 | Epic 6 | MDA Compliance reports |
| FR39 | Epic 6 | Variance reports |
| FR40 | Epic 6 | Loan Snapshot reports by MDA |
| FR41 | Epic 6 | Weekly AG reports |
| FR42 | Epic 1 | Email/password authentication |
| FR43 | Epic 1 | RBAC with 3 MVP roles |
| FR44 | Epic 1 | Super Admin — view all data |
| FR45 | Epic 1 | Dept Admin — manage loans, migrations, exceptions |
| FR46 | Epic 1 | MDA Officer — own MDA data only |
| FR47 | Epic 1 | Log authentication events |
| FR48 | Epic 1 | Log all user actions |
| FR49 | Epic 9 | Submission reminder emails (T-3) |
| FR50 | Epic 9 | Overdue alerts (T+1) |
| FR51 | Epic 9 | Loan completion notifications |
| FR52 | Epic 9 | Auto-Stop Certificate notifications |
| FR53 | Epic 6 | Export reports as branded PDF |
| FR54 | Epic 6 | One-tap PDF sharing |
| FR55 | Epic 7 | Flag records as exceptions |
| FR56 | Epic 7 | Exception queue with priority/filter/resolve |
| FR57 | Epic 7 | Auto-detect inactive loans |
| FR58 | Epic 7 | Annotations on loan records |
| FR59 | Epic 7 | Event flag correction workflow |
| FR60 | Epic 11 | Pre-submission checkpoint screen with retirement/event review |
| FR61 | Epic 11 | Mid-cycle employment event filing (5-field form) |
| FR62 | Epic 11 | Event reconciliation against monthly CSV |
| FR63 | Epic 10 | Tenure vs remaining service comparison (gratuity receivable preview) |
| FR64 | Epic 10 | Gratuity receivable tracking, executive dashboard exposure |
| FR65 | Epic 10 | Retirement date computation (DOB + 60 or appointment + 35) |
| FR66 | Epic 10 | Service extension recording with audit trail |
| FR67 | Epic 12 | Early exit computation (lump sum payoff with expiry) |
| FR68 | Epic 12 | Early exit commitment and payment recording |
| FR69 | Epic 12 | Early exit computation expiry and attention flagging |
| FR70 | Epic 11 | MDA historical data upload and cross-validation |
| FR71 | Epic 10 | Service Status Verification Report during migration |
| FR72 | Epic 1 | User account lifecycle with downward-only hierarchy, invitation email, profile self-service |
| FR73 | Epic 1 | Admin-initiated password reset scoped by hierarchy, forced first-login change |
| FR74 | Epic 13 | Staff ID management (add, update, audit-logged) |
| FR75 | Epic 13 | Duplicate Staff ID detection and warning |
| FR76 | Epic 14 | Public homepage with hero, programme notice, trust strip, scheme info sections |
| FR77 | Epic 14 | Responsive navigation, login modal, footer with legal strip |
| FR78 | Epic 14 | Scheme information pages (programme overview, eligibility, repayment, how it works) |
| FR79 | Epic 14 | Resources and support pages (FAQ, MDA guide, downloads, news, help) |
| FR80 | Epic 14 | Legal and compliance pages (privacy/NDPR, disclaimer, accessibility) |
| FR81 | Epic 14 | Semantic HTML, meta tags, and accessibility on all public pages |
| FR82 | Epic 14 | About the Programme page (mission, vision, leadership, governance) |
| FR83 | Epic 5 | MDA Data Export (CSV/PDF download, scoped to assigned MDA) |
| FR84 | Epic 11 | MDA Self-Service Reconciliation View (uploaded vs migration baseline) |
| FR85 | Epic 3 | Approved Beneficiary Cross-Reference (deductions vs approved lists) |
| FR86 | Epic 4 + Epic 5 | Submission Heatmap & Compliance Activity Grid (AG scheme-wide + MDA self-view) |

## Sprint Sequence (Solo Developer — 2-Week Sprints)

Implementation order derived from PRD Build Sequence (14 steps). Each sprint maps to one epic. Dependencies enforce ordering — no sprint can start until its predecessors' data foundations exist.

| Sprint | Epic | Stories | PRD Build Step | Key Dependency | Milestone |
|--------|------|---------|----------------|----------------|-----------|
| 1 | Epic 1: Foundation & Secure Access | 11 | Step 3 | None — first sprint | Dev environment, auth, RBAC, CI/CD, demo-ready UI shell, user invitation & management operational |
| 2 | Epic 14: Public Website & Scheme Information | 3 | Step 4 | Epic 1 (design system, CI/CD, PublicLayout) | Institutional public face live — AG forwards URL to Commissioner and IT Assessors see government-grade portal |
| 3 | Epic 2: Loan Data & Financial Computation | 7 | Steps 1-2 | Epic 1 (auth + audit) | Immutable ledger, computation engine verified |
| 4 | Epic 10: Staff Temporal Profile & Retirement | 4 | Step 5 | Epic 2 (loan master records) | Retirement dates computed, gratuity receivable tracked |
| 5 | Epic 3: Data Migration & Legacy Import | 5 | Step 6 | Epic 10 (temporal validation for post-retirement scan) | All 63 MDAs imported with temporal profiles |
| 6 | Epic 4: Executive Dashboard | 4 | Step 7 | Epic 3 (real data in system) | AG can see headline numbers — political shield active |
| 7 | Epic 6: Reporting & PDF Export | 4 | Step 8 | Epic 4 (dashboard data sources) | System provably correct through reports |
| 8 | Epic 5: MDA Monthly Submission | 5 | Steps 9, 11 | Epic 2 (ledger for deduction posting) | 8-field CSV + validation operational |
| 9 | Epic 11: Pre-Submission & Mid-Cycle Events | 4 | Step 10 | Epic 5 (submission interface), Epic 10 (retirement data) | Checkpoint, event filing, reconciliation live |
| 10 | Epic 7: Exception Management & Annotations | 3 | — | Epic 5 (submission data), Epic 4 (drill-down views) | Exception queue, auto-flagging, annotations |
| 11 | Epic 8: Auto-Stop Certificate | 3 | Step 12 | Epic 2 (zero-balance detection) | Automatic deduction cessation at loan completion — guaranteed |
| 12 | Epic 12: Early Exit Processing | 3 | Step 13 | Epic 8 (Auto-Stop Certificate generation) | Full loan completion paths operational |
| 13 | Epic 9: Notifications & Alerts | 3 | Step 14 | Epic 8 (completion notifications) | Operational loop complete |
| 14 | Epic 13: Staff ID Governance | 2 | Step 15 | Epic 1 (user management foundation) | Staff ID data quality self-sufficiency achieved |

**Total:** 14 sprints, 62 stories, ~28 weeks (7 months). FR83-FR86 attach to existing epics — story count impact determined during sprint planning (may add 1-2 small stories or expand existing stories).

### Critical Path

```
Epic 1 → Epic 14 (public site — parallel-safe, no backend dependency)
Epic 1 → Epic 2 → Epic 10 → Epic 3 → Epic 4 → Epic 5 → Epic 11
                                              ↘ Epic 6
                                    Epic 2 → Epic 8 → Epic 12
                                                     ↘ Epic 9
                                    Epic 1 → Epic 13
                         Epic 4 + Epic 5 → Epic 7
```

**Longest path:** Epic 1 → 2 → 10 → 3 → 4 → 5 → 11 (8 sprints / 16 weeks to full submission workflow — unchanged, Epic 14 runs on a parallel track after Epic 1)

### Demonstrability Milestones

| After Sprint | What's Demonstrable |
|-------------|---------------------|
| Sprint 1 | **Live product shell** — branded login, role-specific screens with mock data, 5 seeded demo accounts, hosted on client domain. User invitation system operational — AG can create dept admin and MDA officer accounts via UI with welcome emails. AG can open dashboard on her phone. |
| Sprint 2 | **Institutional public face live** — AG forwards URL to Commissioner or IT Assessors and they see a government-grade portal: scheme information, eligibility, repayment rules, FAQ, legal pages, trust signals. Professional first impression before login. |
| Sprint 3 | Mathematical core verified — computation engine + immutable ledger |
| Sprint 5 | Real data in system — all 63 MDAs migrated with temporal profiles |
| Sprint 6 | **AG Demo** — dashboard with real numbers, drill-down, 30-second truth |
| Sprint 8 | MDA officers can submit monthly data — adoption engine live |
| Sprint 11 | Auto-Stop Certificates — automatic deduction cessation at loan completion |
| Sprint 14 | Full MVP — all 82 FRs, all 13 features, administrative self-sufficiency |

## Epic List

### Epic 1: Project Foundation & Secure Access
Users can securely log into VLPRS with role-appropriate access. All actions are audit-logged. The development/deployment infrastructure is fully operational. A demo-ready frontend with role-specific screens, mock data, and seeded credentials is deployed to the client's domain — enabling continuous client visibility from Sprint 1. Super Admin and Department Admin can invite new users with welcome emails and manage account lifecycle (deactivate, reactivate, reassign, delete) through a downward-only hierarchy. Includes monorepo scaffold (architecture starter template), Docker setup, database foundation, JWT auth with refresh token rotation, RBAC middleware, audit logging, CI/CD pipeline, frontend screen scaffolding with mock data layer, user invitation system with Resend email integration, and user administration interface with profile self-service.
**FRs covered:** FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR72, FR73

### Epic 2: Loan Data Management & Financial Computation
System maintains an immutable financial record and computes accurate loan schedules, balances, and repayment breakdowns for all 4 grade-level tiers. Any balance is reconstructable from the ledger. Loan lifecycle is fully tracked. The mathematical core — decimal.js arithmetic, 3-layer immutable ledger enforcement, UUIDv7 keys, computed views. Must be 100% accurate before any data enters the system.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR10, FR11, FR12, FR13, FR14, FR15

### Epic 3: Data Migration & Legacy Import
Department Admin can import legacy MDA spreadsheet data, validate and categorise records, acknowledge variances with non-punitive language, and establish baselines for all 63 MDAs. Column mapping, variance categorisation, side-by-side comparison with mathematical explanation, Migration Dashboard tracking all 63 MDAs. Approved beneficiary cross-reference report identifies staff on approved lists but absent from MDA deduction records, and vice versa — compliance audit capability. Gets real data into the system.
**FRs covered:** FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR85

### Epic 4: Executive Dashboard & Scheme Visibility
AG opens VLPRS on her phone and instantly sees scheme-wide status — 4 headline numbers, attention items, compliance status — with drill-down to any MDA or individual loan. Mobile-first hero metrics (<3s on 4G), progressive drill-down, attention items with priority indicators, MDA compliance view. Submission Heatmap (GitHub-style activity grid) shows all 63 MDAs' month-by-month submission status with non-punitive colour coding (teal/amber/gray) — sortable by compliance rate for the Deputy AG's pattern detection. The flagship experience and the system's political shield.
**FRs covered:** FR32, FR33, FR34, FR35, FR36, FR86

### Epic 5: MDA Monthly Submission
MDA Reporting Officers can submit monthly deduction data via 8-field CSV upload (with conditional Event Date and Cessation Reason) or manual entry, receive instant confirmation with reference number, and see neutral comparison summaries with variance detail. Atomic upload, duplicate detection, period lock, conditional field validation, neutral language enforcement. MDA Data Export enables officers to download their MDA's loan portfolio as CSV or branded PDF. MDA officer dashboard includes a Submission Heatmap (self-view) — 12-column-per-year activity grid showing their own submission history (teal/amber/gray). The adoption engine.
**FRs covered:** FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR83, FR86

### Epic 6: Reporting & PDF Export
Admins can generate Executive Summary, MDA Compliance, Variance, and Loan Snapshot reports. All reports exportable as branded PDFs with Oyo State Government crest and shareable via one-tap action. Server-side PDF generation, weekly AG reports. System provably correct through reports.
**FRs covered:** FR37, FR38, FR39, FR40, FR41, FR53, FR54

### Epic 7: Exception Management & Record Annotations
Admin can flag loan records as exceptions, investigate via a priority-sorted queue with filters, resolve with notes and audit trail. Department Admin can annotate records for institutional memory and correct event flags through a tracked workflow. Auto-flagging of inactive loans (60+ days). Preserves institutional knowledge.
**FRs covered:** FR55, FR56, FR57, FR58, FR59

### Epic 8: Auto-Stop Certificate & Loan Completion
When a loan balance reaches zero, the system automatically generates an official Auto-Stop Certificate with verification code and QR, and sends it to both the beneficiary and MDA Reporting Officer with instruction to cease deductions. The "never over-deducted again" guarantee made tangible. Premium visual treatment.
**FRs covered:** FR7, FR8, FR9

### Epic 9: Notifications & Automated Alerts
System automatically sends email submission reminders (T-3), overdue alerts (T+1), and loan completion notifications — keeping all stakeholders informed without manual intervention. Resend transactional emails, node-cron for scheduled reminders. The operational loop is complete.
**FRs covered:** FR49, FR50, FR51, FR52

### Epic 10: Staff Temporal Profile & Retirement Validation
System computes and maintains staff retirement dates from DOB and appointment date, compares loan tenure against remaining service to project gratuity receivables, and generates a Service Status Verification Report during migration to detect post-retirement activity. Department Admin can record service extensions. Temporal validation chain powers downstream features (pre-submission checkpoint, early exit, migration scan).
**FRs covered:** FR63, FR64, FR65, FR66, FR71

### Epic 11: Pre-Submission Checkpoint & Mid-Cycle Events
MDA Reporting Officers review a mandatory checkpoint screen before each submission — surfacing approaching retirements, zero-deduction staff, and unconfirmed mid-cycle events. Mid-cycle events (retirement, death, suspension, transfer, etc.) can be filed at any time via a 5-field form and are reconciled against subsequent CSV submissions. MDA officers can upload historical records for cross-validation against migration baseline. Self-service reconciliation view enables MDA officers to compare their uploaded historical records against the migration baseline, seeing match/variance status per loanee and flagging discrepancies for Department Admin review.
**FRs covered:** FR60, FR61, FR62, FR70, FR84

### Epic 12: Early Exit Processing
Department Admin can compute a lump-sum payoff for active loans, record staff commitment and payment, and close loans through the early exit workflow. Computations expire at month-end if unpaid; expired commitments flagged as attention items. Upon confirmed payment, Auto-Stop Certificate is triggered. State machine: Computed → Committed → Paid → Closed (or → Expired).
**FRs covered:** FR67, FR68, FR69

### Epic 13: Staff ID Governance
MDA officers can manage Staff IDs within their assigned MDA; admin users can manage Staff IDs system-wide. Duplicate Staff ID detection warns before assignment. All changes audit-logged. Staff ID data quality self-sufficiency. (Note: User account management — FR72, FR73 — moved to Epic 1, Stories 1.9a/1.9b.)
**FRs covered:** FR74, FR75

### Epic 14: Public Website & Scheme Information Portal
The institutional public face of VLPRS — a comprehensive, government-grade multi-page public website that the AG, IT Assessors, and the general public encounter before login. Homepage with hero section, Official Programme Notice, trust strip, 4-step "How It Works" beneficiary journey, loan category cards (4 tiers), repayment & settlement rules, key capabilities, and trust & compliance signals. Top-level About the Programme page with Mission, Vision, Core Values, Programme Leadership (role-title-prominent cards for AG, Deputy AG, Director), Programme Governance, and Institutional Story. Sub-pages for programme information, eligibility, repayment rules, FAQ, MDA submission guide, downloads, news, help & support, and legal/compliance pages. Responsive navigation with 2-level dropdown structure, "About" as top-level nav item, login modal, and 4-column footer with legal strip. All copy follows the neutral language rule — describes what VLPRS enables, never what was broken. Static content extracted to `src/content/*.ts` files for future Sanity CMS migration. Uses Sprint 1 design system — no backend API dependencies.
**FRs covered:** FR76, FR77, FR78, FR79, FR80, FR81, FR82

---

## Epic 1: Project Foundation & Secure Access

Users can securely log into VLPRS with role-appropriate access. All actions are audit-logged. The development/deployment infrastructure is fully operational.

### Story 1.1: Monorepo Scaffold & Development Environment

As a **developer**,
I want the VLPRS monorepo initialised with all workspaces, Docker development environment, and foundational configuration,
So that I have a working, reproducible development environment to build upon.

**Acceptance Criteria:**

**Given** the project repository is cloned
**When** I run `pnpm install && docker compose -f docker-compose.dev.yml up`
**Then** PostgreSQL is running in a container, the Express server starts with hot-reload, and the Vite React dev server starts with HMR
**And** the monorepo structure matches: `apps/client`, `apps/server`, `packages/shared`
**And** shared TypeScript base config (`tsconfig.base.json`) is configured for all three workspaces
**And** ESLint + Prettier are configured with a single root config
**And** `packages/shared` exports are importable from both `apps/client` and `apps/server`
**And** `.env.example` exists with all required environment variable templates (no secrets)
**And** `.gitignore` excludes `node_modules`, `.env`, `dist/`, Docker volumes

**Given** the monorepo root
**When** I inspect `pnpm-workspace.yaml`
**Then** it defines workspaces: `apps/*` and `packages/*`

**Given** `apps/client` is scaffolded with Vite + React
**When** I check React version in `apps/client/package.json`
**Then** React is pinned to `^18.3.1` and `react-dom` to `^18.3.1` — not React 19

**Given** `apps/client`
**When** shadcn/ui is initialised (`npx shadcn@latest init`)
**Then** Tailwind CSS v4 is configured, `components.json` exists, and a test component (e.g. `Button`) can be added and renders correctly in the dev server

**Given** `packages/shared`
**When** I inspect its dependencies
**Then** `zod` is installed and a sample Zod schema (e.g. `emailSchema`) is exportable and validatable from both `apps/client` and `apps/server`

**Given** `apps/server`
**When** I inspect its dependencies
**Then** Drizzle ORM and Drizzle Kit are installed, `drizzle.config.ts` exists pointing to the Docker PostgreSQL instance, and `pnpm drizzle-kit push` executes without error against the running database

**Given** a `packages/testing` workspace exists
**When** I inspect its contents
**Then** it contains shared test utilities: test data factories (`createMockUser()`, `createMockLoan()`, `createMockMda()`), common test helpers (authenticated request helper, database cleanup), and global test setup
**And** both `apps/client` and `apps/server` can import from `@vlprs/testing`

**Given** Vitest is configured in all four workspaces
**When** I run `pnpm test` from the monorepo root
**Then** Vitest discovers and passes at least one trivial test in each workspace (`apps/client`, `apps/server`, `packages/shared`, `packages/testing`)

**Given** the repository is initialised with Git
**When** I inspect the branches
**Then** both `main` and `dev` branches exist, with `dev` checked out as the working branch

### Story 1.2: User Registration & Login

As a **system administrator**,
I want to create user accounts and allow users to log in with email and password,
So that only authorised personnel can access the system.

**Acceptance Criteria:**

**Given** the system has a `users` table with UUIDv7 primary keys, `email` (unique constraint), `password_hash`, `role`, `mda_id`, `is_active`, `created_at`, `updated_at`, `deleted_at`
**When** a Super Admin calls `POST /api/auth/register` with valid user data
**Then** a new user is created with bcrypt-hashed password (12 rounds) and the response returns user details (without password)
**And** password validation enforces: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit (FR42)

**Given** the `POST /api/auth/register` endpoint exists
**When** RBAC middleware is not yet implemented (Story 1.4)
**Then** the endpoint is temporarily unprotected — Story 1.4 will restrict it to `super_admin` role only
**And** the production seed script (Story 1.7) creates the initial super admin from environment variables, so no public registration is ever needed

**Given** a caller attempts to register with an email that already exists
**When** they call `POST /api/auth/register`
**Then** the response returns 409 Conflict with message "Email already registered"

**Given** a registered, active user
**When** they call `POST /api/auth/login` with correct email and password
**Then** the response returns a JWT access token (15-minute expiry) in the JSON body and sets a refresh token (7-day expiry) in an `httpOnly`, `secure`, `sameSite: strict` cookie
**And** the access token contains claims: `userId`, `role`, `mdaId`

**Given** a registered user
**When** they call `POST /api/auth/login` with incorrect credentials
**Then** the response returns 401 with message "Invalid email or password" (no credential enumeration)

**Given** a user whose account is deactivated (`is_active = false`) or soft-deleted (`deleted_at IS NOT NULL`)
**When** they call `POST /api/auth/login` with correct credentials
**Then** the response returns 401 with the same message "Invalid email or password" (no account status enumeration)

**Given** `packages/shared` contains Zod validation schemas
**When** I inspect `packages/shared/src/schemas/authSchemas.ts`
**Then** it exports `loginSchema` (email + password) and `registerSchema` (email, password, role, mdaId) with the FR42 password rules
**And** both `apps/server` (request validation) and `apps/client` (form validation in Story 1.6) can import them

**Given** Story 1.2 is implemented
**When** I run `pnpm test` from the monorepo root
**Then** unit tests pass for: password hashing (bcrypt 12 rounds), password policy validation (all FR42 rules), JWT token generation (correct claims and expiry), and Zod schema validation (valid/invalid inputs)
**And** integration tests pass for: successful registration, duplicate email rejection (409), successful login (token in body + cookie set), failed login (401), and deactivated user login (401)

### Story 1.3: Session Security & Token Refresh

As an **authenticated user**,
I want my session to remain secure with automatic token refresh and protection against token theft,
So that my account is protected while maintaining a smooth, uninterrupted experience.

**Acceptance Criteria:**

**Given** a `refresh_tokens` table storing `token_hash` (SHA-256), `user_id`, `expires_at`, `created_at`, `revoked_at`, `last_activity_at`
**When** the client calls `POST /api/auth/refresh` with a valid refresh token cookie
**Then** the old refresh token is revoked, a new refresh token is issued (rotation), and a new access token is returned
**And** the new refresh token replaces the old one in the httpOnly cookie

**Given** an already-rotated refresh token is reused (potential theft)
**When** the client calls `POST /api/auth/refresh` with the reused token
**Then** ALL refresh tokens for that user are revoked (reuse detection) and the response returns 401
**And** the user must re-login

**Given** the `refresh_tokens` table tracks `last_activity_at`, updated on every authenticated API request via the `authenticate` middleware
**When** a client calls `POST /api/auth/refresh` and the associated refresh token's `last_activity_at` is older than 30 minutes
**Then** the refresh token is revoked and the response returns 401 — the user must re-login (NFR-SEC-10)

**Given** a user logs in successfully on a new device or browser
**When** the system issues a new refresh token
**Then** all other active (non-revoked, non-expired) refresh tokens for that user are revoked — enforcing max 1 concurrent session (NFR-SEC-10)

**Given** an authenticated user
**When** they call `POST /api/auth/logout`
**Then** the current refresh token is revoked in the database, the httpOnly cookie is cleared, and the response returns 200
**And** the logout event is recorded for audit logging (FR47)

**Given** a user has 5 consecutive failed login attempts within 10 minutes
**When** they attempt a 6th login
**Then** the account is locked for 15 minutes and a 429 response is returned (NFR-SEC-11)
**And** failed attempts are logged with IP address

**Given** `express-rate-limit` is configured with tiered rate limits
**When** any client exceeds 5 requests per 15 minutes on auth endpoints (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/register`)
**Then** the response returns 429 Too Many Requests — applied per-IP before authentication in the middleware stack (helmet → cors → rate-limit → authenticate)

**Given** CSRF protection is active
**When** any state-changing request is made
**Then** the request must include a valid CSRF token in the `X-CSRF-Token` header, or it is rejected with 403

**Given** an authenticated user
**When** they call `POST /api/auth/change-password` with their current password and a valid new password (FR42 password rules)
**Then** the password is updated (bcrypt 12 rounds), all existing refresh tokens for that user are invalidated, and they must re-login on all devices (FR42)
**And** the response returns 200 with a confirmation message
**And** submitting an incorrect current password returns 401

**Given** Story 1.3 is implemented
**When** I run `pnpm test` from the monorepo root
**Then** unit tests pass for: token rotation (old revoked, new issued), reuse detection (all tokens revoked), inactivity timeout (30-min `last_activity_at` check), and CSRF token validation
**And** integration tests pass for: successful token refresh (new access + refresh tokens), reused token rejection (401 + all revoked), logout (cookie cleared + token revoked), account lockout after 5 failures (429), lockout expiry after 15 minutes, rate limiting on auth endpoints (429), concurrent session enforcement (old session revoked on new login), password change (tokens invalidated + re-login required), and password change with wrong current password (401)

### Story 1.4: Role-Based Access Control

As the **system**,
I want to enforce role-based permissions on every API endpoint,
So that Super Admin, Department Admin, and MDA Officers each access only what they're authorised for.

**Acceptance Criteria:**

**Given** `packages/shared/src/constants/roles.ts` exists
**When** I inspect its exports
**Then** it exports a `ROLES` constant object (`SUPER_ADMIN`, `DEPT_ADMIN`, `MDA_OFFICER`) and a permission matrix mapping roles to allowed actions
**And** both `apps/server` and `apps/client` import role strings exclusively from `@vlprs/shared` — no hardcoded role strings anywhere in the codebase (OSLRS lesson: frontend/backend role string mismatch caused 3 roles to fail at runtime despite 53 passing tests)

**Given** 3 MVP roles exist: `super_admin`, `dept_admin`, `mda_officer`
**When** the middleware chain processes a request: `authenticate` → `authorise(requiredRoles)` → `scopeToMda` → route handler
**Then** each middleware executes in order: JWT verified → role checked → MDA scope applied

**Given** the `POST /api/auth/register` endpoint was temporarily unprotected in Story 1.2
**When** Story 1.4 RBAC middleware is applied
**Then** `POST /api/auth/register` is restricted to `authorise('super_admin')` — only authenticated super admins can create user accounts

**Given** a user with role `super_admin`
**When** they access any API endpoint
**Then** they can view all data across all MDAs — `scopeToMda` middleware is bypassed (FR44)

**Given** a user with role `dept_admin`
**When** they access API endpoints for loans, migrations, exceptions, and reports
**Then** they can view all data across all MDAs — `scopeToMda` middleware is bypassed (same visibility as `super_admin`, different permitted actions) — and they can manage loans, process migrations, and resolve exceptions (FR45)

**Given** a user with role `mda_officer`
**When** they access any API endpoint
**Then** the `scopeToMda` middleware injects `mda_id` from the JWT into the request context (e.g., `req.mdaScope`), and all downstream queries are filtered by this value — enforced at query level, not just route level, so no route handler can accidentally bypass isolation (FR46)
**And** attempting to access another MDA's data returns 403

**Given** any API endpoint
**When** a request arrives without a JWT, or with an expired or malformed JWT
**Then** the request is rejected with 401 before reaching `authorise` or the route handler
**And** an expired JWT returns 401 with an indication the client should attempt a token refresh (via `POST /api/auth/refresh` from Story 1.3)

**Given** any API endpoint
**When** a request arrives with a valid JWT but with insufficient role for that endpoint
**Then** the request is rejected with 403 before reaching the route handler (NFR-SEC-2)

**Given** Story 1.4 is implemented
**When** I run `pnpm test` from the monorepo root
**Then** unit tests pass for: `authorise` middleware (each role allowed/denied per endpoint), `scopeToMda` middleware (injects `mda_id` for `mda_officer`, bypasses for `super_admin` and `dept_admin`), and role constants imported from `@vlprs/shared` (no hardcoded strings in server or client)
**And** integration tests pass for: `super_admin` accessing cross-MDA data (200), `dept_admin` accessing cross-MDA data (200), `mda_officer` accessing own MDA (200), `mda_officer` accessing another MDA (403), unauthenticated request (401), expired JWT (401), wrong role for endpoint (403), and `POST /api/auth/register` blocked for non-super-admin roles (403)

### Story 1.5: Audit Logging & Action Tracking

As the **Accountant General**,
I want every user action logged with timestamp, identity, role, and IP address,
So that all system activity is fully traceable for governance and audit compliance.

**Acceptance Criteria:**

**Given** a dedicated `audit_log` table with UUIDv7 PK, columns: `user_id`, `role`, `mda_id`, `action` (HTTP method + route), `resource` (target entity/ID), `request_body_hash` (SHA-256 of request body, or `null` for GET requests), `response_status` (HTTP status code), `ip_address`, `timestamp`
**When** any authenticated API call is made — including GET (read), POST (create), PUT/PATCH (update), and DELETE (all HTTP verbs, not just mutations)
**Then** an audit log entry is created automatically via the `auditLog` Express middleware (FR48, NFR-SEC-6)
**And** the `request_body_hash` stores a SHA-256 hash of the request body, never the raw body — NDPR data minimisation prevents storing PII or financial data in audit logs
**And** the `audit_log` table is append-only — no UPDATE or DELETE operations permitted (NFR-SEC-7)

**Given** the `auditLog` middleware sits last in the chain (`...validate → auditLog → route handler`) per the architecture middleware stack
**When** a route handler completes and the response is sent
**Then** the middleware captures `response_status` by hooking into `res.on('finish')` — the audit entry is written after the response, ensuring the actual HTTP status code is recorded (not a pre-handler guess)

**Given** a user logs in, logs out, fails a login attempt, or triggers account lockout
**When** the authentication event occurs
**Then** it is logged with: event type, email, IP address, timestamp, and success/failure status (FR47)
**And** this logging is added retroactively to the auth endpoints built in Stories 1.2 and 1.3 — `POST /api/auth/login` (success + failure), `POST /api/auth/logout`, `POST /api/auth/refresh`, `POST /api/auth/register`, and `POST /api/auth/change-password` each emit an auth event log entry inline (in addition to the general `auditLog` middleware entry)

**Given** the audit log
**When** any attempt is made to modify or delete an existing entry via SQL UPDATE or DELETE
**Then** the operation is rejected at the database level via a PostgreSQL trigger that raises an exception (NFR-SEC-7)

**Given** the audit log in the MVP
**When** an authorised auditor needs to review system activity
**Then** audit logs are accessed directly via database queries — there is no API endpoint exposing audit logs in the MVP (audit logs are used by auditors, not displayed in the application UI)

**Given** Story 1.5 is implemented
**When** I run `pnpm test` from the monorepo root
**Then** unit tests pass for: `auditLog` middleware (captures `user_id`, `role`, `mda_id`, `action`, `resource`, `response_status`, `ip_address`, `timestamp` for all HTTP verbs), `request_body_hash` computation (SHA-256 for POST/PUT/PATCH, `null` for GET), and `res.on('finish')` hook (correct status code captured after handler completes)
**And** integration tests pass for: audit entry created on authenticated GET request, audit entry created on authenticated POST request, `response_status` matches actual handler response (e.g., 200, 400, 404), auth event logging for login success, login failure, logout, and registration, and PostgreSQL trigger rejects UPDATE and DELETE on `audit_log` table

### Story 1.6: Frontend Authentication Shell

As any **VLPRS user**,
I want to log in through a secure, polished interface and navigate to my role-appropriate dashboard,
So that I can access the system's features relevant to my role.

**Acceptance Criteria:**

**Given** `apps/client/src/lib/authContext.tsx` exists
**When** I inspect its exports
**Then** it exports an `AuthProvider` React context that holds `accessToken` (in-memory, never localStorage — XSS-safe), `user` (id, email, name), and `role` from the JWT claims
**And** it exports a `useAuth` hook providing: `login(email, password)`, `logout()`, `refresh()`, `isAuthenticated`, `user`, and `role`
**And** `AuthProvider` wraps the entire app at the router level

**Given** `apps/client/src/lib/apiClient.ts` exists
**When** I inspect its exports
**Then** it exports a typed `fetch` wrapper that: attaches the access token from `useAuth` context as `Authorization: Bearer <token>` on every request, types responses using interfaces from `@vlprs/shared`, normalises errors into a consistent `{ code, message, details? }` shape
**And** on a 401 response, it automatically calls `POST /api/auth/refresh`, stores the new access token, and retries the original request once
**And** if the refresh itself fails (expired/revoked refresh token), it clears auth state and redirects to `/login`

**Given** a global `ErrorBoundary` component wraps the entire React app
**When** an unhandled runtime error occurs in any component
**Then** the `ErrorBoundary` catches it and renders a user-friendly fallback screen (not a white page or raw stack trace)

**Given** the React SPA with shadcn/ui + Tailwind CSS and Oyo Crimson palette
**When** an unauthenticated user visits any protected route
**Then** the `AuthGuard` component (at the `/dashboard` layout level) checks `isAuthenticated` from `useAuth` and redirects to the login page

**Given** the login page
**When** a user enters credentials and submits
**Then** the form uses React Hook Form with `loginSchema` from `@vlprs/shared` (via `@hookform/resolvers/zod`) for client-side validation before submission
**And** the login page includes Google reCAPTCHA v3 (invisible)
**And** on success, the access token is stored in auth context (React state), the refresh token is set as httpOnly cookie by the server, and the user is redirected to their role-appropriate dashboard view

**Given** the login page
**When** a user submits invalid credentials and the server returns 401
**Then** an inline error message is displayed below the form: "Invalid email or password" (matching the server's non-enumerating response)
**And** when the server returns 429 (account locked or rate limited), the message displays: "Too many attempts. Please try again later"
**And** form fields retain their values so the user doesn't have to re-type their email

**Given** an authenticated user
**When** they view the application shell
**Then** the Oyo Crimson sidebar (desktop) or header bar (mobile) displays navigation items appropriate to their role (imported from `ROLES` in `@vlprs/shared`)
**And** the sidebar shows the user's name and role badge
**And** a "Logout" action is available that calls `useAuth().logout()`, which hits `POST /api/auth/logout` and redirects to the landing page

**Given** a Public Zone exists
**When** an unauthenticated user visits the root URL
**Then** they see a landing page with Oyo State branding, scheme information, and a "Staff Login" button
**And** a "Beneficiary Portal — Coming Soon (Phase 2)" placeholder is visible

**E2E Smoke Tests (Playwright)**

**Given** Playwright is installed and configured
**When** E2E smoke tests run against the dev environment with seeded demo accounts
**Then** the following flows pass:
- Unauthenticated user → redirected to login page
- Login as `super_admin` → lands on Executive Dashboard
- Login as `dept_admin` → lands on Operations Hub
- Login as `mda_officer` → lands on Submission View scoped to assigned MDA
- Failed login → inline error message displayed, form retains email value
- Logout → returns to landing page
**And** each test validates the correct home screen heading and role badge are visible
**And** Playwright config is committed to the repo with CI-compatible settings

### Story 1.7: CI/CD Pipeline & Production Infrastructure

As the **development team**,
I want automated testing, building, and deployment on every merge to main,
So that the system is always live with the latest verified code and deployments are atomic and reliable.

**Acceptance Criteria:**

**Spike-First Validation (do this BEFORE production Dockerfiles)**

**Given** a fresh DigitalOcean Droplet with Docker installed
**When** I deploy a minimal "Hello World" Express app through the full pipeline: GitHub Actions → Docker build → push to ghcr.io → SSH to Droplet → docker compose up → Nginx → SSL
**Then** `https://vlprs.oyo.gov.ng` (or the target domain) responds with a placeholder page ("VLPRS — Coming Soon")
**And** the full pipeline path is validated end-to-end before investing in production-quality Dockerfiles
**And** SSL termination via Let's Encrypt + Certbot is confirmed working

**Given** a GitHub Actions workflow file (`.github/workflows/deploy.yml`)
**When** a PR is merged to `main`
**Then** the pipeline runs: lint → typecheck → test → `drizzle-kit migrate` (apply pending database migrations) → build Docker images (tagged with commit SHA) → push to ghcr.io → SSH to DigitalOcean Droplet → `docker compose pull && docker compose up -d`
**And** Docker images are tagged with both the git commit SHA and `latest` — the SHA tag enables rollback to any specific deploy

**Given** the following GitHub Actions secrets are configured in the repository settings
**When** I inspect the required secrets list
**Then** the pipeline requires: `GHCR_TOKEN` (GitHub Container Registry push/pull), `DROPLET_SSH_KEY` (SSH private key for deploy), `DROPLET_IP` (Droplet public IP)
**And** the production `.env` file on the Droplet contains: `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `RECAPTCHA_SECRET_KEY`, `RESEND_API_KEY` — never committed to the repository
**And** `.env.example` is committed as a template documenting all required variables (without values)

**Given** multi-stage Dockerfiles for `apps/server` and `apps/client`
**When** Docker images are built
**Then** the server image contains only the production Node.js runtime and compiled JavaScript
**And** the client image contains Nginx serving the static React build

**Given** a `docker-compose.prod.yml`
**When** deployed on the Droplet
**Then** Nginx serves the React SPA, proxies `/api/*` to the Express container, and terminates SSL via Let's Encrypt + Certbot
**And** the Express service is configured with `restart: unless-stopped` so Docker auto-restarts it on crash
**And** the Express service has a Docker `HEALTHCHECK` instruction that polls `GET /api/health` — Docker marks the container as unhealthy if the check fails 3 consecutive times

**Given** the health check endpoint `GET /api/health`
**When** the server is running
**Then** it returns `{ status: "ok", timestamp: "..." }` with 200

**Rollback**

**Given** a production deploy causes issues
**When** a rollback is needed
**Then** running `docker compose -f docker-compose.prod.yml pull ghcr.io/…/server:<previous-commit-sha> && docker compose -f docker-compose.prod.yml up -d` reverts to the previous working version
**And** the rollback procedure is documented in the repository README or `docs/` folder

**Given** branch protection on `main`
**When** a developer attempts to push directly to `main`
**Then** the push is rejected — changes must go through a PR with CI passing

**Backup & Disaster Recovery**

**Given** DigitalOcean Managed PostgreSQL is the production database
**When** the database is provisioned
**Then** automated daily backups are enabled with 7-day retention and point-in-time recovery (NFR-REL-2, NFR-REL-3)

**Given** a weekly backup cron job on the Droplet
**When** the cron fires (e.g., Sunday 2:00 AM WAT)
**Then** `pg_dump` creates a compressed backup, uploads it to DigitalOcean Spaces (object storage), and retains the last 4 weekly backups
**And** the backup script logs success/failure and the backup file size

**Given** a disaster recovery scenario
**When** a database restore is needed
**Then** recovery can be completed within 4 hours using either Managed PG point-in-time recovery or the weekly `pg_dump` from DO Spaces (NFR-REL-4)

**Monitoring**

**Given** the production environment is live
**When** monitoring is configured
**Then** UptimeRobot (free tier) pings `GET /api/health` every 5 minutes and sends email alerts on downtime — tracking the 99.5% availability SLA (NFR-REL-1)
**And** DigitalOcean built-in monitoring alerts on: CPU >80%, memory >85%, disk >90%

**Production Initial Seed**

**Given** the production environment is deployed for the first time
**When** I run `pnpm seed:production`
**Then** an initial super admin account is created using `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from environment variables — never hardcoded
**And** the script is idempotent — running it again does not create duplicates
**And** the initial admin creation is audit-logged

### Story 1.8a: Design Foundation, Priority Components & Mock Data Layer

As a **developer**,
I want the VLPRS design system, reusable components, and mock data service layer established as the foundational frontend pattern,
So that all subsequent screen stories can build on consistent design tokens, tested components, and a clean data abstraction that wires to real APIs with zero component changes.

**Acceptance Criteria:**

**Design Foundation**

**Given** the React SPA with shadcn/ui + Tailwind CSS
**When** I inspect the application styles
**Then** the Oyo Crimson palette is applied: primary `#9C1E23` for brand chrome (sidebar, header, primary buttons), with crimson never used in data content areas
**And** design tokens are defined: `--variance-bg` (neutral grey), `--variance-icon` (teal info circle), `--attention-bg` (amber/gold)
**And** typography is configured: Inter (variable) for body text, JetBrains Mono for financial figures in tables
**And** shadcn/ui Badge variants are extended with: `review` (gold), `info` (teal), `complete` (green), `pending` (grey), `variance` (grey bg + teal icon)
**And** minimum font size is 16px, minimum touch target is 44x44px
**And** button hierarchy follows: Primary (crimson), Secondary (teal outline), Tertiary (ghost) — one primary button per visible context

**Priority Reusable Components**

**Given** the component library
**When** I inspect the shared UI components
**Then** the following are implemented and render correctly with mock data:
- `HeroMetricCard` — large number display (36px bold, `font-variant-numeric: tabular-nums`), label, trend indicator, count-up animation (200ms duration)
- `NairaDisplay` — renders ₦ symbol + thousands separator + 2 decimal places using JetBrains Mono (e.g., ₦2,418,350,000.00)
- `AttentionItemCard` — amber/gold background, info icon (never warning/error icon), description text, priority indicator
- `FileUploadZone` — drag-and-drop area accepting `.csv` files, displays upload instructions and file size limit, shows selected filename on file pick
- `MigrationProgressCard` — MDA name, status badge (Pending/Received/Imported/Validated/Reconciled/Certified), visual progress indicator
- `ExceptionQueueRow` — priority indicator, category badge, MDA name, description, timestamp, action placeholder

**Mock Data Service Layer**

**Given** the frontend data layer
**When** components fetch data
**Then** all data flows through custom hook abstractions: `useDashboardMetrics()`, `useMdaComplianceGrid()`, `useAttentionItems()`, `useMdaDetail(mdaId)`, `useLoanDetail(loanId)`, `useSubmissionHistory(mdaId)`, `useMigrationStatus()`, `useLoanSearch(query)`, `useExceptionQueue()`
**And** each hook returns mock data from a dedicated `src/mocks/` directory
**And** each hook's return type matches the planned API response shape defined in `packages/shared` Zod schemas
**And** switching a hook from mock to real API requires only changing the data source within the hook implementation — zero changes to any consuming component
**And** each mock data file includes a header comment documenting the target API endpoint and the sprint in which it will be wired:
```
// Target: GET /api/dashboard/metrics
// Wire: Sprint 5 (Epic 4: Executive Dashboard)
```

### Story 1.8b: Role-Specific Screens, Demo Seed & Wiring Map

As a **product stakeholder**,
I want to log into the live hosted VLPRS at the client's domain with role-specific credentials and see a fully-designed, navigable product experience with realistic mock data across all major screens,
So that I can visualize the complete product on any device, provide early feedback, and track visible progress as screens are wired to real APIs sprint by sprint.

**Depends on:** Story 1.8a (design tokens, components, and mock data hooks must exist)

**Acceptance Criteria:**

**Executive Dashboard Screen (Super Admin Home)**

**Given** a user logged in with role `super_admin`
**When** they are redirected to their role-appropriate home screen
**Then** the Executive Dashboard displays:
- 4 `HeroMetricCard` components: Active Loans (2,847), Total Exposure (₦2,418,350,000.00), Fund Available (₦892,000,000.00), Monthly Recovery (₦48,250,000.00) — each with count-up animation
- Attention items section with 3 mock `AttentionItemCard` entries using non-punitive language (e.g., "Ministry of Works — submission pending, 3 days past due", "Ministry of Agriculture — variance identified in February submission", "2 loans approaching zero balance — auto-stop certificates pending")
- MDA compliance grid showing all 63 MDAs with mock submission statuses: a realistic mix of Submitted (green badge), Pending (grey badge), and Overdue (amber badge) — never red
- Skeleton loaders displayed during initial data fetch (no loading spinners blocking content)
**And** the dashboard is mobile-first: fully functional and legible on screens <768px
**And** hero metrics render as the first visible content (no layout shift)

**Progressive Drill-Down (Dashboard → MDA → Loan)**

**Given** the Executive Dashboard is displayed
**When** a user taps a hero metric card or an MDA row in the compliance grid
**Then** they navigate to an MDA Detail screen showing: MDA name, reporting officer name, submission history (last 3 months mock), loan count, total exposure for that MDA, and a list of loans with staff name, Staff ID, loan reference, outstanding balance (`NairaDisplay`), and status badge
**And** breadcrumb navigation shows: Dashboard > [MDA Name] (max 3 levels)

**Given** the MDA Detail screen
**When** a user taps a loan row
**Then** they navigate to a Loan Detail screen showing: borrower name, Staff ID, MDA, loan reference, grade level tier, loan amount, tenure, outstanding balance (`NairaDisplay`), loan status badge, and placeholder sections for "Repayment Schedule," "Ledger History," "Annotations," and a collapsed "How was this calculated?" accordion
**And** breadcrumb navigation shows: Dashboard > [MDA Name] > [Loan Ref]

**MDA Submission Screen (MDA Officer Home)**

**Given** a user logged in with role `mda_officer`
**When** they are redirected to their role-appropriate home screen
**Then** the Submission View displays:
- Header showing the officer's assigned MDA name — confirming scope (e.g., "Ministry of Health")
- Pre-submission checkpoint section with mock items: "2 staff approaching retirement within 12 months", "1 staff with zero deduction last month and no event filed" — styled as an informational checklist (not blocking)
- `FileUploadZone` component with instructions: "Upload your monthly 8-field CSV deduction file" and a "Download CSV Template" link placeholder
- "Manual Entry" button (navigates to a placeholder form page)
- Submission history table with 3 mock past submissions: reference number (e.g., "HLT-2026-01-0001"), submission date, row count, status badge
- Mock comparison summary for the most recent submission using non-punitive language: "Comparison Complete" header with info icon, variance items displayed with teal info circles and grey backgrounds — never "error", never red, never warning triangles
**And** the `FileUploadZone` accepts file selection and displays the filename but does not process the upload
**And** all content is scoped to the officer's assigned MDA — no data from other MDAs is visible

**Operations Hub Screen (Department Admin Home)**

**Given** a user logged in with role `dept_admin`
**When** they are redirected to their role-appropriate home screen
**Then** the Operations Hub displays:
- Migration Dashboard section: 63 `MigrationProgressCard` components using real Oyo State MDA names, with mock statuses distributed across all 6 stages (Pending, Received, Imported, Validated, Reconciled, Certified) — showing realistic distribution (e.g., 8 Certified, 15 Validated, 20 Imported, 10 Received, 7 Pending, 3 Reconciled)
- Client-side filter/search on migration cards by MDA name
- Loan search bar that accepts input and returns 3 mock loan results with staff name, Staff ID, MDA, and outstanding balance
- Exception queue section: 3 mock `ExceptionQueueRow` entries sorted by priority (High, Medium, Low) with category badges, MDA names, and descriptions
- Quick action buttons: "Generate Report", "File Employment Event", "Compute Early Exit" — each navigates to a styled placeholder page with "Coming in Sprint [N]" messaging

**Navigation & Responsive Layout**

**Given** any authenticated user on desktop (>1024px)
**When** they view the application
**Then** the Oyo Crimson sidebar (256px fixed) displays: Oyo State crest/logo at top, user's name and role badge, navigation items appropriate to their role (Super Admin sees Dashboard/Reports/Exceptions; Dept Admin sees Operations/Migration/Reports/Exceptions; MDA Officer sees Submit/History), and "Logout" at the bottom
**And** a global search bar is visible at the top with Ctrl+K shortcut hint (non-functional — displays "Search coming soon" on interaction)

**Given** any authenticated user on mobile (<768px)
**When** they view the application
**Then** the sidebar collapses to a hamburger menu (Sheet overlay), the header bar shows the Oyo State crest and user's role badge
**And** all screens are fully usable at mobile width — tables scroll horizontally, hero metrics stack vertically, touch targets remain ≥44x44px

**Build Status Indicator**

**Given** any authenticated user
**When** they view the sidebar footer (desktop) or the settings/about section (mobile)
**Then** a "Build Status" indicator displays: current sprint label, last deployment timestamp (from build metadata or environment variable), and next milestone description
**And** the build status is configured via environment variables so it updates with each deployment without code changes:
```
VITE_SPRINT_LABEL="Sprint 1 — Foundation & UI Shell"
VITE_NEXT_MILESTONE="Sprint 2 — Loan Computation Engine (real numbers)"
```

**Demo Seed Script**

**Given** the development or production environment with the database running
**When** I run `pnpm seed:demo`
**Then** the following accounts are created:

| Email | Role | MDA Scope |
|-------|------|-----------|
| ag@vlprs.oyo.gov.ng | super_admin | All MDAs |
| deputy.ag@vlprs.oyo.gov.ng | super_admin | All MDAs |
| admin@vlprs.oyo.gov.ng | dept_admin | All MDAs |
| health.officer@vlprs.oyo.gov.ng | mda_officer | Ministry of Health |
| education.officer@vlprs.oyo.gov.ng | mda_officer | Ministry of Education |

**And** all accounts use a shared demo password that meets the password policy (min 8 chars, 1 uppercase, 1 lowercase, 1 digit), documented in `.env.example` as `DEMO_SEED_PASSWORD`
**And** 3 MDAs are seeded with full metadata: Ministry of Health, Ministry of Education, Ministry of Works and Transport
**And** mock loan records (10-15 per seeded MDA) are created with realistic Naira amounts at the correct order of magnitude for Oyo State vehicle loans, staff names, grade level tiers, and a distribution of loan statuses (Active, Completed, Applied)
**And** the remaining 60 MDAs are seeded as name-only entries (for the compliance grid and migration dashboard to display all 63)
**And** the seed script is idempotent — safe to run multiple times without duplicating data
**And** the seed script logs what it created: "Seeded 5 users, 63 MDAs, 38 loan records"

**Wiring Map**

**Given** Stories 1.8a and 1.8b are complete
**When** I inspect `WIRING-MAP.md` in the project root
**Then** a documented mapping exists for every mock hook to its target API endpoint and delivery sprint:

| Hook | Target Endpoint | Wire Sprint |
|------|----------------|-------------|
| `useDashboardMetrics()` | `GET /api/dashboard/metrics` | Sprint 5 (Epic 4) |
| `useMdaComplianceGrid()` | `GET /api/dashboard/compliance` | Sprint 5 (Epic 4) |
| `useAttentionItems()` | `GET /api/dashboard/attention` | Sprint 5 (Epic 4) |
| `useMdaDetail(mdaId)` | `GET /api/mdas/:id/summary` | Sprint 5 (Epic 4) |
| `useLoanDetail(loanId)` | `GET /api/loans/:id` | Sprint 2 (Epic 2) |
| `useLoanSearch(query)` | `GET /api/loans/search` | Sprint 2 (Epic 2) |
| `useSubmissionHistory(mdaId)` | `GET /api/submissions?mdaId=` | Sprint 7 (Epic 5) |
| `useMigrationStatus()` | `GET /api/migration/status` | Sprint 4 (Epic 3) |
| `useExceptionQueue()` | `GET /api/exceptions` | Sprint 9 (Epic 7) |

**And** each wiring event is a hook-level change only (swap mock source for API call) — zero UI component modifications required

### Story 1.9a: User Account Lifecycle API & Email Invitation

As a **Super Admin or Department Admin**,
I want to create user accounts that send welcome emails with temporary credentials, and manage account lifecycle (deactivate, reactivate, reassign, delete, password reset),
So that authorised personnel can be onboarded and managed without developer intervention, while respecting the role hierarchy.

**Acceptance Criteria:**

**Role Hierarchy Enforcement**

**Given** the management hierarchy: `super_admin` manages `dept_admin` + `mda_officer`; `dept_admin` manages `mda_officer` only
**When** any user management endpoint is called
**Then** the system enforces downward-only management — the acting user's role must be strictly above the target user's role in the hierarchy (FR72)
**And** attempting to manage a peer or superior role returns 403 with message "Insufficient permissions to manage this account level"
**And** attempting to manage one's own account returns 403 with message "Cannot modify own account through this endpoint"

**Given** the `super_admin` role
**When** any attempt is made to create, deactivate, reactivate, delete, or reset password for another `super_admin` via API
**Then** the request is rejected with 403 — super admin accounts are managed exclusively via CLI commands

**Account Creation with Invitation Email**

**Given** `POST /api/users` with body `{ email, name, role, mdaId? }`
**When** a `super_admin` creates a `dept_admin` or `mda_officer`, or a `dept_admin` creates an `mda_officer`
**Then** the account is created with: UUIDv7 PK, email (unique), name, bcrypt-hashed temporary password (system-generated, 12 chars, meeting FR42 password policy), role, `mda_id` (required for `mda_officer`, null for `dept_admin`), `is_active = true`, `must_change_password = true` (FR72)
**And** a welcome email is sent via Resend containing: login URL, temporary credentials, instruction to change password on first login, and a brief description of their role's capabilities
**And** the creation event is audit-logged with: acting user, new user ID, assigned role, assigned MDA

**Given** `POST /api/users` with an email that already exists (active, deactivated, or soft-deleted)
**When** the request is processed
**Then** it returns 409 Conflict with message "Email already registered"

**Given** `POST /api/users` with role `mda_officer` but no `mdaId`
**When** the request is processed
**Then** it returns 422 with message "MDA assignment required for MDA Reporting Officer accounts"

**Forced Password Change on First Login**

**Given** a user with `must_change_password = true`
**When** they successfully authenticate via `POST /api/auth/login`
**Then** the response includes `{ mustChangePassword: true }` alongside the access token
**And** all API endpoints except `POST /api/auth/change-password` and `POST /api/auth/logout` return 403 with code `PASSWORD_CHANGE_REQUIRED` until the password is changed
**And** after changing password, `must_change_password` is set to false and normal access resumes

**Account Deactivation**

**Given** `POST /api/users/:id/deactivate` with optional body `{ reason: string }`
**When** a permitted admin deactivates an account
**Then** `is_active` is set to false, all refresh tokens for that user are revoked, any active sessions are terminated immediately (FR72)
**And** the deactivation is audit-logged with: acting user, target user, reason, timestamp, IP

**Given** a deactivated user
**When** they attempt to log in with correct credentials
**Then** the response returns 401 with the same generic "Invalid email or password" message (no status enumeration)

**Account Reactivation**

**Given** `POST /api/users/:id/reactivate`
**When** a permitted admin reactivates a previously deactivated account
**Then** `is_active` is set to true and the user can log in again (FR72)
**And** the reactivation is audit-logged
**And** the user's password is NOT reset — they use their existing password (if they forgot it, admin does a separate password reset)

**Given** a soft-deleted account (`deleted_at IS NOT NULL`)
**When** a reactivation is attempted
**Then** the request returns 422 with message "Deleted accounts cannot be reactivated — create a new account instead"

**Account Soft Delete**

**Given** `DELETE /api/users/:id` with required body `{ confirmEmail: string }` (must match target user's email as confirmation)
**When** a permitted admin deletes an account
**Then** `deleted_at` is set to current timestamp, `is_active` is set to false, all refresh tokens revoked, all sessions terminated (FR72)
**And** the deletion is audit-logged with enhanced detail: acting user, target user full profile snapshot, reason, timestamp
**And** the deleted user is excluded from all user list queries (but preserved in DB for audit trail and referential integrity)

**Given** `DELETE /api/users/:id` where `confirmEmail` does not match the target user's email
**When** the request is processed
**Then** it returns 422 with message "Confirmation email does not match — deletion aborted"

**MDA Reassignment**

**Given** `PATCH /api/users/:id` with body `{ mdaId: newMdaId }`
**When** a permitted admin reassigns an `mda_officer` to a different MDA
**Then** the user's `mda_id` is updated and all subsequent API calls are scoped to the new MDA (FR72)
**And** the reassignment is audit-logged with: old MDA, new MDA, acting user, timestamp

**Given** a reassignment of a non-`mda_officer` user
**When** `mdaId` is provided
**Then** the request returns 422 with message "MDA assignment is only applicable to MDA Reporting Officer accounts"

**Admin-Initiated Password Reset**

**Given** `POST /api/users/:id/reset-password`
**When** a permitted admin initiates a password reset
**Then** a new temporary password is generated, bcrypt-hashed and stored, `must_change_password` set to true, all refresh tokens revoked (FR73)
**And** a password reset email is sent via Resend with: temporary credentials, login URL, instruction to change password immediately
**And** the reset is audit-logged with acting user and timestamp

**Email Service (Resend Integration)**

**Given** `apps/server/src/lib/email.ts` (or `services/emailService.ts`)
**When** a welcome email or password reset email is triggered
**Then** the email is sent via Resend SDK using `RESEND_API_KEY` from environment variables
**And** if Resend API fails, the error is logged but the account creation/reset still succeeds (fire-and-forget with logged failure — email delivery does not block account operations)
**And** the email sender is configurable via `EMAIL_FROM` environment variable (e.g., `noreply@vlprs.oyo.gov.ng`)

**User Listing**

**Given** `GET /api/users` with optional query params `{ role?, mdaId?, status?, page?, pageSize? }`
**When** a `super_admin` calls the endpoint
**Then** they see all non-deleted users across all roles (except the acting user's own record is flagged `isSelf: true` but still visible)
**And** response uses the standard pagination envelope

**Given** `GET /api/users`
**When** a `dept_admin` calls the endpoint
**Then** they see only `mda_officer` accounts (their manageable scope)

**Super Admin CLI Management**

**Given** the production server has access to CLI commands
**When** an administrator runs `pnpm user:create-admin --email ag@vlprs.oyo.gov.ng --name "Accountant General"`
**Then** a `super_admin` account is created with a system-generated temporary password displayed in the terminal output (never emailed for super admin accounts — communicated in person or via secure channel)
**And** the account has `must_change_password = true`
**And** the creation is audit-logged as `SYSTEM_CLI` actor

**Given** the CLI
**When** an administrator runs `pnpm user:deactivate-admin --email deputy.ag@vlprs.oyo.gov.ng`
**Then** the super admin account is deactivated following the same rules as API deactivation (sessions terminated, tokens revoked)
**And** the command requires interactive confirmation: "You are about to deactivate a Super Admin account. Type the email again to confirm:"

**Given** the CLI
**When** the deactivation would leave zero active super admin accounts
**Then** the command is rejected with: "Cannot deactivate — this is the last active Super Admin. Create a replacement first."

**Validation Schemas**

**Given** `packages/shared/src/validators/userSchemas.ts`
**When** I inspect its exports
**Then** it exports: `createUserSchema`, `updateUserSchema`, `deactivateUserSchema`, `deleteUserSchema`, `resetPasswordSchema`
**And** both `apps/server` and `apps/client` import them from `@vlprs/shared`

**Tests**

**Given** Story 1.9a is implemented
**When** I run `pnpm test` from the monorepo root
**Then** unit tests pass for: role hierarchy enforcement (all role combinations), temporary password generation (meets FR42 policy), `must_change_password` enforcement, and last-super-admin guardrail
**And** integration tests pass for: `super_admin` creating `dept_admin` (201), `super_admin` creating `mda_officer` (201), `dept_admin` creating `mda_officer` (201), `dept_admin` creating `dept_admin` (403), `mda_officer` creating anyone (403), `super_admin` managing another `super_admin` (403), self-management attempt (403), deactivation + session termination, reactivation, soft delete with email confirmation, soft delete with wrong email (422), reactivation of deleted account (422), MDA reassignment, password reset + token revocation, duplicate email (409), `mda_officer` without `mdaId` (422), forced password change flow (login → `PASSWORD_CHANGE_REQUIRED` → change password → normal access), and user listing with role-based scoping

### Story 1.9b: User Administration Interface, Profile Self-Service & First-Login Flow

As a **Super Admin or Department Admin**,
I want a user management screen where I can view, create, and manage user accounts with clear visual indicators of account status and role hierarchy,
So that user administration is self-service, intuitive, and transparent.

**Depends on:** Story 1.9a (API endpoints and email integration must exist)

**Acceptance Criteria:**

**User Management Page**

**Given** a `super_admin` navigates to `/admin/users`
**When** the page renders
**Then** a table displays all non-deleted users with columns: Name, Email, Role (badge), MDA (if applicable), Status (Active/Deactivated badge), Last Login, Created Date
**And** the table supports: sorting by any column, filtering by role (`dept_admin`, `mda_officer`), filtering by status (Active, Deactivated), filtering by MDA, and text search on name/email
**And** super admin accounts are visible in the list but their action menus show only "View Details" — no deactivate/delete/reset actions (with a tooltip: "Super Admin accounts are managed via system administration")
**And** a prominent "Invite User" button is visible as the primary action (crimson)

**Given** a `dept_admin` navigates to `/admin/users`
**When** the page renders
**Then** only `mda_officer` accounts are listed (their manageable scope)
**And** no `super_admin` or `dept_admin` accounts are visible

**Invite User Dialog**

**Given** the "Invite User" button is clicked
**When** the create user dialog opens
**Then** it displays a form with: Name (required), Email (required, validated), Role (dropdown — options limited to what the acting user can create), MDA (dropdown — required when Role is MDA Reporting Officer, hidden otherwise)
**And** a preview note states: "A welcome email with temporary login credentials will be sent to this address"
**And** submitting the form calls `POST /api/users` and shows a success toast: "Invitation sent to [email]"
**And** the user list refreshes to show the new account

**User Detail / Action Menu**

**Given** a user row in the table
**When** the admin clicks the action menu (three-dot icon)
**Then** available actions are shown based on the hierarchy:
- **Active account:** "Reset Password", "Reassign MDA" (if `mda_officer`), "Deactivate", "Delete"
- **Deactivated account:** "Reactivate", "Delete"
**And** each destructive action (Deactivate, Delete) opens a confirmation dialog with the user's name and email displayed prominently

**Deactivate Confirmation Dialog**

**Given** the "Deactivate" action is selected
**When** the confirmation dialog opens
**Then** it shows: "Deactivate [Name]'s account? They will be logged out immediately and unable to sign in until reactivated."
**And** an optional "Reason" text field is available
**And** confirming calls `POST /api/users/:id/deactivate` and updates the table row's status badge to "Deactivated"

**Delete Confirmation Dialog**

**Given** the "Delete" action is selected
**When** the confirmation dialog opens
**Then** it shows: "Permanently remove [Name]'s account? This action cannot be undone. Type their email to confirm:" with an email input field
**And** the confirm button is disabled until the typed email matches exactly
**And** the confirm button uses the destructive style (red — this is a genuine irreversible action, appropriate use of red per UX spec)
**And** confirming calls `DELETE /api/users/:id` and removes the row from the table

**Password Reset Confirmation**

**Given** the "Reset Password" action is selected
**When** the confirmation dialog opens
**Then** it shows: "Send a temporary password to [email]? Their current sessions will be terminated."
**And** confirming calls `POST /api/users/:id/reset-password` and shows a success toast: "Password reset email sent to [email]"

**MDA Reassignment Dialog**

**Given** the "Reassign MDA" action is selected for an `mda_officer`
**When** the dialog opens
**Then** it shows: current MDA assignment, a dropdown to select the new MDA, and a note: "The officer's data access will immediately switch to the new MDA"
**And** confirming calls `PATCH /api/users/:id` and updates the MDA column in the table

**First-Login Password Change Screen**

**Given** a user logs in with `must_change_password = true`
**When** they are authenticated
**Then** instead of the normal dashboard, they see a full-screen "Set Your Password" form with: current temporary password field, new password field, confirm password field
**And** the new password is validated against FR42 rules (min 8 chars, 1 uppercase, 1 lowercase, 1 digit) with inline validation feedback
**And** the page cannot be navigated away from — sidebar and header show but all navigation links redirect back to this screen
**And** after successful password change, the user is redirected to their role-appropriate home screen with a welcome toast: "Password updated. Welcome to VLPRS."

**Profile Self-Service**

**Given** any authenticated user clicks their name/avatar in the sidebar (desktop) or header (mobile)
**When** the profile dropdown opens
**Then** it shows: "My Profile" link, "Change Password" link, and "Logout"

**Given** a user navigates to `/profile`
**When** the page renders
**Then** it displays their account details as read-only fields: Full Name, Email, Role (badge), MDA assignment (if `mda_officer`), Account Created date, Last Login timestamp
**And** a "Change Password" button is visible
**And** role, email, and MDA fields show a subtle lock icon with tooltip: "Contact your administrator to update"

**Given** the "Change Password" button is clicked
**When** the password change form opens (dialog or inline section)
**Then** it shows: Current Password (required), New Password (required), Confirm New Password (required)
**And** the new password is validated inline against FR42 rules (min 8 chars, 1 uppercase, 1 lowercase, 1 digit) with real-time feedback as the user types
**And** submitting calls `POST /api/auth/change-password` (from Story 1.3)
**And** on success: toast "Password updated successfully", all other sessions terminated (existing Story 1.3 behaviour), user remains logged in on current session
**And** on wrong current password: inline error "Current password is incorrect"

**Navigation Integration**

**Given** the application sidebar
**When** a `super_admin` or `dept_admin` views navigation
**Then** a "User Management" item is visible in the sidebar (below Reports, above Logout)
**And** `mda_officer` users do NOT see this navigation item

**Given** any authenticated user
**When** they view the sidebar (desktop) or header (mobile)
**Then** their profile area shows: name, role badge, and (if `mda_officer`) their assigned MDA name — so they always know which MDA they're scoped to

**Responsive Design**

**Given** the user management page on mobile (<768px)
**When** the table renders
**Then** it uses a card layout (one user per card) instead of a horizontal table, with the action menu accessible via a button on each card
**And** all touch targets are ≥44x44px
**And** dialogs render as full-screen sheets on mobile

**Visual Design Compliance**

**Given** the user management interface
**When** any screen is rendered
**Then** it follows the client-approved visual design established in `_bmad-output/planning-artifacts/ux-design-directions.html` — the canonical visual reference for all VLPRS UI implementation. Specific adherence: Oyo Crimson sidebar, neutral content area, status badges with colour + icon + text, button hierarchy (crimson primary, teal secondary, ghost tertiary, red destructive only for irreversible actions), Inter typography, and all component patterns (cards, tables, badges, dialogs) matching the approved mockup styles

**Empty State**

**Given** the user management page with no users matching filters
**When** the table has zero results
**Then** an empty state is shown: "No users found matching your filters" with a "Clear Filters" action — not a blank table

**Tests**

**Given** Story 1.9b is implemented
**When** I run `pnpm test` from the monorepo root
**Then** integration/E2E tests verify: `super_admin` sees all manageable users + invite button, `dept_admin` sees only `mda_officer` accounts, `mda_officer` does not see the User Management nav item, invite dialog submits and refreshes list, deactivate flow works end-to-end, delete flow requires email confirmation, first-login password change screen appears and redirects after change, super admin rows show restricted action menu, profile page displays correct user details, and password change form validates and submits correctly

---

## Epic 14: Public Website & Scheme Information Portal

The institutional public face of VLPRS — a comprehensive multi-page public website that the AG, IT Assessors, and the general public encounter before login. Uses the Sprint 1 design system (Oyo Crimson, Inter typography, shadcn/ui components). No backend API dependencies — all static content pages rendered within the SPA.

### Story 14.1: Homepage & Navigation Shell

As the **Accountant General**,
I want the VLPRS public URL to present a professional, government-grade homepage with clear navigation and login access,
So that when I forward this URL to the Commissioner, IT Assessors, or Governor's office, it immediately signals institutional credibility and architectural seriousness.

**Depends on:** Story 1.8a (design foundation, Oyo Crimson tokens, Inter typography, shadcn/ui components must exist)

**Acceptance Criteria:**

**Navigation Bar**

**Given** an unauthenticated user visits the VLPRS public URL
**When** the page renders
**Then** a sticky header displays: Oyo State Government crest + "Vehicle Loan Scheme" wordmark with "Accountant-General's Office" subtitle, primary navigation items (Home, About, The Scheme ▾, How It Works, Resources ▾, Help & Support), and a "Staff Login" CTA button (Oyo Crimson)
**And** "About" is a direct link to `/about` (not a dropdown)
**And** "The Scheme" dropdown shows: Programme Overview, About VLPRS, Eligibility & Loan Categories, Repayment & Settlement Rules
**And** "Resources" dropdown shows: Frequently Asked Questions, MDA Submission Guide, Downloads & Forms, News & Announcements, Approved Beneficiary Lists (with "Coming Soon" badge)
**And** on mobile (<768px), the navigation collapses to a hamburger menu with all items accessible in a slide-out Sheet overlay
**And** the header uses glassmorphism effect (semi-transparent background with backdrop blur) matching the design system

**Login Modal**

**Given** the user clicks "Staff Login"
**When** the login modal opens
**Then** it displays 3 entry points in a clean dialog: Staff Portal (active — "For authorised MDA officers, department staff, and administrators" with a "Login to Dashboard" button linking to `/login`), Beneficiary Portal ("View your loan status and documents" with "Coming Soon — Phase 2" badge), Expression of Interest ("Register interest in the scheme" with "Coming Soon — Phase 2" badge)
**And** a footer note: "All portal access is role-based. Contact your department for account setup."
**And** the modal has proper accessibility: `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close

**Hero Section**

**Given** the homepage renders
**When** the hero section loads
**Then** it displays: Oyo State Government crest (prominent), "Vehicle Loan Scheme" as H1 (44px desktop / 32px mobile), subtext: "An official staff welfare programme administered through the Accountant-General's Office. VLPRS provides structured record-keeping, transparent reporting, and auditable repayment tracking.", primary CTA "Staff Login", secondary CTA "Learn How It Works →"
**And** alongside the hero copy (desktop) or below (mobile), an "Official Programme Notice" card displays: "Approvals remain committee-based and policy-led", "Repayment is primarily through payroll deductions; retirement cases are handled via gratuity settlement", "Records are maintained with audit trails for accuracy and accountability", and NDPR fine print: "Data is handled in accordance with applicable data protection requirements (NDPR)"
**And** the hero section has a subtle background gradient (not a stock photo)

**Trust Strip**

**Given** the hero section is visible
**When** the user scrolls past it (or it appears below hero on first render)
**Then** a trust strip displays: "Administered by the Accountant-General's Office" with 3 pill-shaped trust badges: "NDPR-aligned handling", "Audit-ready reporting", "Committee approvals preserved"

**How It Works Section**

**Given** the homepage
**When** the "How It Works" section renders
**Then** 4 step cards display in a horizontal row (desktop) or stacked (mobile): Step 1 "Expression of Interest" → Step 2 "Administrative Review" → Step 3 "Committee Decision" → Step 4 "Payroll Repayment"
**And** each card has: step number badge, title, and 2-line description
**And** the section header includes a disclaimer: "Expression of Interest submission does not constitute loan approval"

**Loan Category Cards**

**Given** the homepage
**When** the "Eligibility & Loan Categories" section renders
**Then** 4 cards display the grade-level tiers: Levels 1-6 (Up to ₦250,000), Levels 7-8 (Up to ₦450,000), Levels 9-10 (Up to ₦600,000), Levels 12+ (Up to ₦750,000)
**And** each card shows: grade level range, maximum loan amount (formatted with ₦ and thousands separator), "Standard tenure: 60 months", and a "See repayment rules" link to the Repayment section/page
**And** a note below: "Eligibility is subject to scheme rules, including tenure-to-retirement provisions"

**Key Capabilities Section**

**Given** the homepage
**When** the capabilities section renders
**Then** 6 feature cards display in a 3x2 grid (desktop) or stacked (mobile): Immutable Financial Ledger ("Banking-grade record integrity — every transaction append-only, auditor-verifiable"), Computed Balances ("Derived from ledger entries — never stored, never manually edited. One formula for all"), Auto-Stop Certificates ("Automatic deduction cessation upon loan completion — guaranteed"), Real-Time Executive Dashboard ("Scheme-wide status visible on any device in under 3 seconds"), Non-Punitive Design ("Comparisons, not accusations. Variances, not mistakes. Adoption through trust"), Audit-Ready from Day One ("Every action logged. Full computation chain reconstructable by any auditor")

**Repayment & Settlement Rules Section**

**Given** the homepage
**When** the repayment section renders
**Then** a 2-column layout displays: left column with accordion/expandable items (Standard Repayment 60 months, Accelerated Repayment shorter tenure, Early Principal Settlement with interest forfeiture, Retirement & Gratuity Settlement), right column with a "Key Clarification" panel: "VLPRS supports record accuracy and reconciliation. It does not replace payroll authority or gratuity processing procedures." with a link to FAQ
**And** on mobile, the layout stacks vertically

**Who VLPRS Serves Section**

**Given** the homepage
**When** the "Who VLPRS Serves" section renders
**Then** 5 role cards display: Accountant General ("Instant scheme-wide visibility from any device"), Deputy AG ("Pattern detection and exception investigation"), Car Loan Department ("Reports in seconds, not days"), MDA Officers — 63 ("Submit 8 fields instead of computing 17 columns"), Beneficiaries — 3,100+ ("Protection from over-deduction — guaranteed")

**Trust & Compliance Section**

**Given** the homepage
**When** the trust section renders
**Then** 3 trust pillar cards display: NDPR Compliant (privacy notices, data minimisation, consent capture), Audit-Ready (every action logged with user, timestamp, role, and IP), Immutable Ledger (no record can be altered or deleted — ever)

**Endorsement Banner**

**Given** the homepage
**When** the endorsement section renders
**Then** a styled blockquote banner displays a placeholder quote attributed to "— Accountant General, Oyo State" with a visual treatment that distinguishes it from regular content (background colour, larger quote marks, etc.)

**News Section**

**Given** the homepage
**When** the news section renders
**Then** 3 announcement cards display with: title, date, short excerpt, and "Read more" link
**And** initial content uses placeholder announcements (e.g., "System deployed to 63 MDAs", "Migration Phase 1 underway", "Beneficiary Portal coming Phase 2")

**Final CTA Section**

**Given** the homepage
**When** the final CTA section renders
**Then** a full-width banner displays: "Ready to access VLPRS?" with two buttons: "Staff Login" (primary) and "Contact Support" (secondary)

**Footer**

**Given** any public page
**When** the footer renders
**Then** it displays a 4-column layout: Column 1 — About & Scheme (About the Programme, Programme Overview, Eligibility, Repayment, How It Works, About VLPRS), Column 2 — Resources (FAQs, MDA Guide, Downloads, News), Column 3 — Contact (Accountant-General's Office, Ibadan Oyo State, email, phone, office hours Mon-Fri 8am-6pm WAT), Column 4 — Staff Portal (login link)
**And** below the columns, a legal strip displays: Programme Disclaimer ("This portal provides general programme information. Loan approvals, payroll deductions, and gratuity processing remain subject to applicable government procedures and committee decisions."), links to Privacy & Data Protection, Accessibility Statement, and Programme Disclaimer pages
**And** bottom bar: "© 2026 Oyo State Government. All rights reserved." with office hours

**Performance & Accessibility**

**Given** the homepage
**When** loaded on a 4G mobile connection
**Then** First Contentful Paint is <2 seconds — hero section is visible immediately
**And** all touch targets are ≥44x44px, all images have alt text, all heading hierarchy is semantic (h1 → h2 → h3), colour contrast meets WCAG AA (4.5:1 body, 3:1 large), and all interactive elements are keyboard-navigable
**And** the page includes: `<title>Vehicle Loan Scheme — Oyo State Government</title>`, meta description, and Open Graph tags

### Story 14.2: About & Scheme Information Pages

As a **government worker considering the vehicle loan scheme**,
I want to read detailed information about the programme's leadership, mission, eligibility, and repayment rules on the public website,
So that I understand the scheme and who stands behind it without visiting the Car Loan Department in person.

**Depends on:** Story 14.1 (navigation shell, PublicLayout, footer must exist)

**Acceptance Criteria:**

**Programme Overview Page (`/scheme`)**

**Given** a user navigates to the Programme Overview page
**When** the page renders
**Then** it displays: scheme objectives (eliminating manual record-keeping, centralising loan administration, establishing auditable records), policy basis (Vehicle Loan Committee governance, Accountant-General's Office administration), benefits to staff (reduced administrative burden, transparent record-keeping, automatic deduction cessation at loan completion, structured grievance resolution), and the role of the Accountant-General's Office (scheme oversight, financial reporting, fund management)
**And** all content follows the neutral language rule — no references to past errors, disputes, or institutional failures
**And** a sidebar or callout displays: "VLPRS is classified as an administrative support system. It records and administers decisions — it does not make them. All loan approvals, rejections, and policy determinations remain the exclusive responsibility of the designated approval authorities."

**About VLPRS Page (`/scheme/about-vlprs`)**

**Given** a user navigates to the About VLPRS page
**When** the page renders
**Then** it displays: what VLPRS is (the digital system of record for the Oyo State Government Car Loan Scheme), the core principle ("MDAs submit facts. VLPRS computes truth. Reports are generated views."), what VLPRS does (6 items: centralised record-keeping, automated computation, retirement obligation tracking, anomaly detection, transparent reporting, audit-ready records), what VLPRS does NOT do (6 items: does not approve or reject loans, does not change loan policy, does not impose sanctions, does not replace payroll systems, does not process gratuity payments, does not impose retrospective sanctions on legacy data)
**And** the "Does / Does Not" section uses a clear two-column or two-card layout

**Eligibility & Loan Categories Page (`/scheme/eligibility`)**

**Given** a user navigates to the Eligibility page
**When** the page renders
**Then** it displays the 4 loan tier cards (same as homepage but with expanded detail): Levels 1-6 up to ₦250,000, Levels 7-8 up to ₦450,000, Levels 9-10 up to ₦600,000, Levels 12+ up to ₦750,000 — each with: grade level range, maximum loan amount, standard tenure (60 months), and interest rate information
**And** eligibility conditions are listed: active government service, grade level qualification, no existing active loan (one loan at a time), committee approval required
**And** a retirement provision note: "Staff within 24 months to retirement may be processed under gratuity settlement procedures where applicable"
**And** a disclaimer: "Eligibility is determined by scheme rules and committee decision. This page provides general information only."

**Repayment & Settlement Rules Page (`/scheme/repayment`)**

**Given** a user navigates to the Repayment Rules page
**When** the page renders
**Then** it displays an expanded version of the homepage accordion with full detail for each settlement path: Standard Repayment (60-month tenure, monthly principal + interest via payroll deduction, 2-month moratorium at loan start), Accelerated Repayment (shorter tenure option, reduced total interest, higher monthly payments), Early Principal Settlement (lump-sum payoff of outstanding principal, interest waiver as incentive), Retirement & Gratuity Settlement (outstanding balance recovered from gratuity for staff retiring before loan completion)
**And** each path includes a brief plain-language example (e.g., "A Level 9 officer with ₦600,000 principal over 60 months pays approximately ₦10,000 per month in principal plus monthly interest")
**And** the Key Clarification panel is displayed: "VLPRS supports record accuracy and reconciliation. It does not replace payroll authority or gratuity processing procedures. Adjustments follow administrative review and applicable regulations."

**How It Works Page (`/how-it-works`)**

**Given** a user navigates to How It Works
**When** the page renders
**Then** it displays an expanded 4-step visual journey with more detail than the homepage version: Step 1 — Expression of Interest ("Submit your interest digitally and receive a reference number for administrative tracking"), Step 2 — Administrative Review ("Applications are screened and prepared for committee consideration under established procedures"), Step 3 — Committee Decision ("Approvals are determined by the designated committee. The portal does not approve loans."), Step 4 — Payroll Repayment ("Approved loans are repaid through payroll deductions. Completion triggers clearance documentation and automatic deduction cessation.")
**And** a "What happens after completion?" section explains: "When your loan balance reaches zero, VLPRS automatically generates a Clearance Certificate and notifies your MDA to cease deductions. No manual intervention required."
**And** the disclaimer is prominent: "Expression of Interest submission does not constitute loan approval. All approvals remain subject to committee decision under existing government procedures."

**About the Programme Page (`/about`)**

**Given** a user navigates to the About page
**When** the page renders
**Then** it displays:
- **Mission Statement** (2-3 sentences — what the programme exists to achieve)
- **Vision Statement** (2-3 sentences — what success looks like for Oyo State civil servants)
- **Core Values** (3-5 values: Transparency, Accountability, Accuracy, Fairness, Institutional Trust)
- **Programme Leadership** section showing the principal team who conceptualized and champion the programme: Accountant-General, Deputy Accountant-General, Director (Car Loan Department) — each displayed with role title (prominent, permanent), name of current office holder (swappable), optional official photo, and brief institutional description of the role (1-2 sentences, permanent)
- **Programme Governance** section showing: the Vehicle Loan Committee structure (who sits on it, decision authority), how VLPRS supports the committee's process (record-keeping, not decision-making), and the AG's Office role in scheme oversight, financial reporting, and fund management (absorbs former `/scheme/ag-office` content)
- **Institutional Story** — brief, neutral-language narrative of what the programme aims to achieve (what is being built, not what was broken)
**And** the Programme Leadership section uses a card layout: role title as H3, name below, institutional description below name — role title and description are permanent institutional text, only the name line changes when personnel rotate
**And** the Programme Governance section includes a callout: "The AG's Office is the authority. VLPRS is the tool that serves that authority."
**And** all content follows the neutral language rule — describes what the programme enables, never what was broken
**And** the page uses Template A (Content Page) with 8-col main content and 4-col sidebar containing quick links to Eligibility, How It Works, FAQ, and Contact

**Cross-Page Requirements**

**Given** any scheme information page
**When** the page renders
**Then** it uses the PublicLayout (navigation + footer from Story 14.1), has a unique `<title>` tag and meta description, has breadcrumb navigation showing: Home > [Section] > [Page], and all content is accessible (semantic HTML, heading hierarchy, keyboard navigable, WCAG AA contrast)
**And** the page renders in <500ms as a client-side SPA transition from any other public page

### Story 14.3: Resources, Support & Legal Pages

As an **MDA Reporting Officer visiting the VLPRS website**,
I want to find FAQs, submission guides, downloadable forms, and contact information,
So that I can prepare for using the system without needing a phone call or office visit.

**Depends on:** Story 14.1 (navigation shell, PublicLayout, footer must exist)

**Acceptance Criteria:**

**FAQ Page (`/resources/faq`)**

**Given** a user navigates to the FAQ page
**When** the page renders
**Then** questions are organised in collapsible accordion groups by audience: "For Beneficiaries" (e.g., How do I check my loan balance? What happens when my loan is paid off? What is an Auto-Stop Certificate?), "For MDA Officers" (e.g., How do I submit monthly deduction data? What is the 8-field CSV format? What happens if I make an error in my submission? When is the submission deadline?), "General" (e.g., What is VLPRS? Who administers the scheme? How is my data protected? What is an Expression of Interest?)
**And** a minimum of 15 questions are included across all categories
**And** each question uses the `<details>`/`<summary>` pattern or equivalent accessible accordion
**And** a search/filter input allows filtering questions by keyword

**MDA Submission Guide Page (`/resources/mda-guide`)**

**Given** a user navigates to the MDA Guide page
**When** the page renders
**Then** it displays a step-by-step guide for the monthly 8-field CSV submission process: what each field means (Staff ID, Month, Amount Deducted, Payroll Batch Reference, MDA Code, Event Flag, Event Effective Date, Deduction Cessation Reason), which fields are conditional (Event Effective Date required when Event Flag ≠ NONE; Cessation Reason required when Amount = ₦0 AND Event Flag = NONE), the submission deadline (28th of each month), what to expect after upload (confirmation, comparison summary), and common questions
**And** a "Download CSV Template" button links to a downloadable `.csv` file with correct headers and one example row
**And** screenshots/illustrations placeholder sections are included (to be populated with actual UI screenshots after Sprint 8)

**Downloads & Forms Page (`/resources/downloads`)**

**Given** a user navigates to Downloads
**When** the page renders
**Then** it displays a list of downloadable resources as cards: CSV Submission Template (.csv, with description), Policy Summary (placeholder — PDF to be provided by AG's Office), MDA Officer Quick Reference Guide (placeholder — to be created post-training), and Training Materials (placeholder — to be created for rollout)
**And** each card shows: document name, format badge (CSV, PDF), file size (where available), and download button
**And** placeholder items show: "Coming Soon" badge instead of download button

**News & Announcements Page (`/resources/news`)**

**Given** a user navigates to News
**When** the page renders
**Then** it displays announcement cards in reverse chronological order with: title, date, excerpt (first 2-3 sentences), and "Read more" link
**And** clicking "Read more" navigates to a detail page showing the full announcement text
**And** initial content includes 3 placeholder announcements with realistic titles and dates
**And** announcements are stored as static content within the codebase (no CMS or database — content updates via code commits and CI/CD deploy)

**Approved Beneficiary Lists Page (`/resources/beneficiary-lists`)**

**Given** a user navigates to Approved Beneficiary Lists
**When** the page renders
**Then** it displays a "Coming Soon — Phase 2" placeholder with: explanation of what this page will contain (published approved batch lists, searchable by name or Staff ID, with NDPR-compliant masked identifiers), expected availability timeline, and a link back to the main Resources page
**And** the page is fully styled — not a bare placeholder — to signal roadmap intentionality

**Help & Support Page (`/support`)**

**Given** a user navigates to Help & Support
**When** the page renders
**Then** it displays: contact information (Accountant-General's Office address in Ibadan, email address, phone number, office hours Mon-Fri 8am-6pm WAT), a "Need help?" section with guidance for different audiences ("If you're an MDA officer, see the Submission Guide. If you have a loan enquiry, contact the Car Loan Department. For technical issues, email support."), and links to FAQ and MDA Guide
**And** the support section uses a prominent banner design (matching the design system) to be visually distinct

**Privacy & Data Protection Page (`/privacy`)**

**Given** a user navigates to Privacy
**When** the page renders
**Then** it displays the NDPR compliance statement covering: what personal data is collected and why (data minimisation), how data is processed (loan administration only), who has access (role-based, need-to-know), data retention policy (minimum 7 years for financial records per government regulations), right of access (beneficiaries can view their own data), consent capture practices, data security measures (encryption at rest AES-256, encryption in transit TLS 1.2+), and contact for data protection enquiries

**Programme Disclaimer Page (`/disclaimer`)**

**Given** a user navigates to Programme Disclaimer
**When** the page renders
**Then** it displays: system scope ("This portal provides general programme information and administrative record-keeping"), committee authority preservation ("All loan approvals, rejections, and policy determinations remain the exclusive responsibility of the Vehicle Loan Committee and designated approval authorities"), EOI disclaimer ("Expression of Interest submission does not constitute, imply, or guarantee loan approval"), no legal commitment ("Information on this portal is for general guidance. Specific loan terms are governed by applicable government policies and committee decisions"), and payroll/gratuity scope ("VLPRS records and tracks deductions. It does not execute payroll changes or process gratuity payments — these remain subject to established government procedures")

**Accessibility Statement Page (`/accessibility`)**

**Given** a user navigates to Accessibility
**When** the page renders
**Then** it displays: WCAG 2.1 AA compliance commitment, accessibility features (keyboard navigation, screen reader support, colour contrast, text resizing, touch targets), known limitations (if any), contact for accessibility issues, and a commitment to continuous improvement

**Expression of Interest Placeholder Page (`/eoi`)**

**Given** a user navigates to Expression of Interest
**When** the page renders
**Then** it displays a "Coming Soon — Phase 2" placeholder with: explanation of what EOI registration will enable, note that "Expression of Interest ≠ approval", link to "How It Works" for the current process, and link to Contact for current enquiries
**And** the page is fully styled with the design system

**Cross-Page Requirements**

**Given** any resources, support, or legal page
**When** the page renders
**Then** it uses the PublicLayout (navigation + footer from Story 14.1), has a unique `<title>` tag and meta description, has breadcrumb navigation, and meets all WCAG AA accessibility requirements
**And** the page renders in <500ms as a client-side SPA transition

---

## Epic 2: Loan Data Management & Financial Computation

System maintains an immutable financial record and computes accurate loan schedules, balances, and repayment breakdowns for all 4 grade-level tiers. Any balance is reconstructable from the ledger. 100% accuracy — zero tolerance for math errors.

### Retrospective Carry-Forward (from Epic 1+14 Retro, 2026-02-24)

The following action items from the Epic 1+14 retrospective have been incorporated into Epic 2 stories:

- **Story 2.0:** Integration test layer (PostgreSQL in CI), automated retro report script, commit summary convention, UAT checkpoint template
- **Story 2.1:** MDA data reconciliation with authoritative list (`docs/mdas_list.txt`), `abbreviation` column, `mda_aliases` table for fuzzy matching, standardised abbreviations for all 63 MDAs
- **Story 2.3:** Sports Council CSV (`docs/NEW CAR LOAN TEMPLATE APRIL, 2025_Sheet1.csv`) as computation engine test fixture, `decimal.js` validation against real-world loan data
- **All stories:** Team agreements — no framework assumptions without source verification; bugs are collective (no blame); UAT discoveries are features (not scope creep)

### Story 2.0: Sprint Infrastructure & Quality Gates

As a **development team**,
I want CI infrastructure improvements and process tooling established before core financial stories begin,
So that the detection gaps identified in Epic 1's production incidents are closed and retrospective commitments are tracked.

**Context:** Epic 1+14 retrospective identified that both production incidents (schema drift, baseline schema mismatch) shared the same root cause — no integration tests against real PostgreSQL. This story closes that gap and establishes process improvements before the immutable ledger (Story 2.2) introduces database triggers that require real-DB testing.

**Acceptance Criteria:**

**Given** the GitHub Actions CI pipeline
**When** server tests run in CI
**Then** a PostgreSQL 17 service container is available for integration tests
**And** at minimum, the migration baseline logic from Story 1.10 is tested against the real database (not mocks)
**And** the integration test pattern is documented for reuse in Stories 2.2+

**Given** a completed story
**When** the developer marks it as done
**Then** the story file includes a `## Commit Summary` section with: total commits, files touched, revert count, and a one-sentence development narrative

**Given** the retrospective workflow
**When** a retrospective is initiated
**Then** a script exists (`scripts/retro-report.sh` or equivalent) that aggregates per-story commit stats (commit count, file churn, fix% vs feat%) and outputs a markdown summary table

**Given** UAT checkpoints every 2-3 stories
**When** a checkpoint is reached (after Stories 2.2, 2.4, 2.7)
**Then** a "What to Test" checklist template exists and is populated with story-specific test scenarios for Awwal's UAT

**Note:** This story can run in parallel with Story 2.1 but MUST complete before Story 2.2 begins (Story 2.2's trigger testing requires the PostgreSQL CI infrastructure).

### Story 2.1: MDA Registry & Loan Master Records

As a **Department Admin**,
I want loan master records stored with borrower details, loan terms, approval data, and MDA assignment,
So that every loan in the system has a complete, queryable record of its origination.

**Acceptance Criteria:**

**Given** an `mdas` table with UUIDv7 PK, `code` (unique, e.g. "OYSHMB"), `name`, `abbreviation` (UI display name), `is_active`, `created_at`, `updated_at`, `deleted_at`
**When** the system is seeded with all 63 MDAs from the authoritative list (`docs/mdas_list.txt`)
**Then** each MDA has a unique code, full official name, and standardised UI abbreviation retrievable via `GET /api/mdas`
**And** abbreviations follow consistent rules: official acronyms retained (OYSHMB, BCOS, TESCOM), descriptive names in Title Case (Sports Council, Local Govt), long names shortened for UI display

**Given** an `mda_aliases` table with `mda_id` (FK), `alias` (unique, case-insensitive)
**When** historical CSV data uses variant MDA names (e.g. "SPORTS COUNCIL", "Oyo State Sports Council", "Sports Council")
**Then** the alias table maps all known variations to the canonical MDA record
**And** alias matching uses 4 layers: exact → normalised (strip prefix, lowercase) → alias table → fuzzy suggestion (human confirms, saved as new alias)

**Given** a `loans` table with UUIDv7 PK, columns: `staff_id`, `staff_name`, `grade_level`, `mda_id` (FK), `principal_amount` (NUMERIC 15,2), `interest_rate`, `tenure_months`, `moratorium_months`, `monthly_deduction_amount`, `approval_date`, `first_deduction_date`, `loan_reference` (unique, e.g. "VLC-2024-0847"), `status`, `created_at`, `updated_at`
**When** a Department Admin creates a loan record via `POST /api/loans`
**Then** the loan is persisted with a UUIDv7 PK and auto-generated loan reference number
**And** all money columns use `NUMERIC(15,2)` — never floating point (NFR-REL-7)
**And** the response returns the complete loan record (FR10)

### Story 2.2: Immutable Repayment Ledger

As an **auditor**,
I want every repayment entry recorded in an immutable, append-only ledger that cannot be modified or deleted,
So that the financial record has banking-grade integrity and any balance is verifiable.

**Acceptance Criteria:**

**Given** a `ledger_entries` table with UUIDv7 PK, columns: `loan_id` (FK), `staff_id`, `mda_id`, `entry_type` (PAYROLL, ADJUSTMENT, MIGRATION_BASELINE, WRITE_OFF), `amount` (NUMERIC 15,2), `principal_component` (NUMERIC 15,2), `interest_component` (NUMERIC 15,2), `period_month`, `period_year`, `payroll_batch_reference`, `source`, `posted_by` (FK users), `created_at`
**When** a ledger entry is inserted via `POST /api/ledger`
**Then** it is persisted with a UUIDv7 PK and immutable timestamp (FR11)

**Given** the 3-layer immutability enforcement
**When** any attempt is made to UPDATE or DELETE a ledger entry
**Then** **Layer 1 (DB):** PostgreSQL `BEFORE UPDATE OR DELETE` trigger raises an exception
**And** **Layer 2 (ORM):** Drizzle query wrapper rejects `.update()` / `.delete()` on ledger tables
**And** **Layer 3 (API):** Express middleware rejects `PUT`/`PATCH`/`DELETE` on `/api/ledger/*` routes (NFR-SEC-5)

**Given** the ledger_entries table
**When** entries are queried for a specific loan
**Then** they are returned in chronological order (UUIDv7 natural ordering) with all fields intact

### Story 2.3: Loan Repayment Schedule Computation

As a **Department Admin**,
I want the system to compute accurate repayment schedules for all 4 grade-level tiers including moratorium periods,
So that every loan has a mathematically correct schedule that any auditor can verify.

**Acceptance Criteria:**

**Given** the 4 loan tiers with parameterised values (grade level, interest rate, max tenure, max principal)
**When** a schedule is computed for any tier
**Then** the same computation function handles all tiers — no per-tier code paths, only parameterised values (FR1)
**And** all arithmetic uses `decimal.js` for arbitrary-precision — never JavaScript floating point

**Given** a loan with a 2-month moratorium
**When** the repayment schedule is generated
**Then** months 1-2 show zero deduction with no interest accrual, and active repayment begins in month 3 (FR2)

**Given** the computation engine
**When** a full 60-month schedule is computed
**Then** it completes in <1 second (NFR-PERF-7)
**And** the output includes: month number, principal component, interest component, total deduction, running balance — for every month
**And** the result is deterministic — same inputs always produce identical outputs (NFR-REL-6)

**Given** the Sports Council car loan report (`fixtures/sports-council-april-2025.csv`) with 21 real loan records
**When** the computation engine processes the same loan parameters (principals: 250K-750K, tenures: 30-60 months)
**Then** computed monthly deductions, interest splits, and outstanding balances match the known correct values from the CSV to kobo (₦0.01) precision
**And** the test suite includes at minimum 5 representative loans covering all principal/tenure combinations present in the CSV

### Story 2.4: Accelerated Repayment, Last-Payment Adjustment & Auto-Split

As a **Department Admin**,
I want the system to handle accelerated repayment, absorb rounding in the final payment, and auto-split deductions,
So that all computation edge cases are covered and every loan balances to exactly zero.

**Acceptance Criteria:**

**Given** a loan with original 60-month tenure shortened to 45 months
**When** the accelerated schedule is computed
**Then** monthly deductions are recalculated for the shorter tenure with correct principal/interest split (FR3)

**Given** accumulated rounding differences across monthly installments
**When** the final installment is computed
**Then** the last-payment adjustment method absorbs all rounding — the final payment equals the exact remaining balance so the loan closes at exactly ₦0.00 (FR4)

**Given** a monthly deduction amount
**When** the system processes a deduction
**Then** it auto-splits the amount into principal and interest components based on the amortisation schedule (FR5)

**Given** a test suite of hand-verified calculations for all 4 tiers
**When** the computation engine is run against the test suite
**Then** every output matches the hand-verified result to the kobo (₦0.01 precision)

### Story 2.5: Outstanding Balance Computation & Historical Reconstruction

As an **auditor**,
I want loan balances computed from the immutable ledger (never stored) and reconstructable at any point in time,
So that I can verify any balance by tracing it back to source entries.

**Acceptance Criteria:**

**Given** a loan with ledger entries
**When** `GET /api/loans/:id/balance` is called
**Then** the outstanding balance is computed by summing all ledger entries against the expected total — not retrieved from a stored field (FR6)
**And** the response includes: computed balance, total principal paid, total interest paid, installments completed, installments remaining

**Given** a loan with ledger entries spanning multiple months
**When** `GET /api/loans/:id/balance?asOf=2025-06-30` is called with a historical date
**Then** the balance is reconstructed using only ledger entries up to that date (FR12)
**And** the computation produces the same result regardless of when it is run

**Given** any computed balance
**When** an auditor traces the computation
**Then** a complete derivation chain is available: each ledger entry → sum formula → final result

### Story 2.6: Loan Search & Record Retrieval

As a **Department Admin**,
I want to search for any loan by staff ID, name, MDA, or loan reference and see the complete record instantly,
So that walk-in enquiries are answered in seconds instead of days.

**Acceptance Criteria:**

**Given** the loan database with indexed columns
**When** a user searches via `GET /api/loans?search=3301` (staff ID) or `?search=Mustapha` (name) or `?search=BIR` (MDA code) or `?search=VLC-2024-0847` (loan reference)
**Then** matching results are returned in <2 seconds (NFR-PERF-5) (FR13)
**And** results include: staff name, staff ID, MDA, loan reference, status, computed balance, tenure progress

**Given** a loan record
**When** `GET /api/loans/:id` is called
**Then** the full loan detail is returned: master data, computed balance, repayment schedule, ledger entry count, lifecycle status, state transition history

**Given** RBAC scoping is active
**When** an `mda_officer` searches for loans
**Then** only loans within their assigned MDA are returned

### Story 2.7: Loan Lifecycle States & Transitions

As a **Department Admin**,
I want to track loan lifecycle states and record every transition with full audit trail,
So that the complete history of every loan decision is preserved.

**Acceptance Criteria:**

**Given** loan status enum: `APPLIED`, `APPROVED`, `ACTIVE`, `COMPLETED`, `TRANSFERRED`, `WRITTEN_OFF`
**When** a loan's status changes (e.g., `APPROVED` → `ACTIVE`)
**Then** a `loan_state_transitions` record is created with: `loan_id`, `from_status`, `to_status`, `transitioned_by` (user FK), `reason`, `created_at` (FR15)

**Given** valid status transitions are defined (e.g., `APPLIED` → `APPROVED`, `ACTIVE` → `COMPLETED`)
**When** an invalid transition is attempted (e.g., `COMPLETED` → `APPLIED`)
**Then** the request is rejected with a 400 response explaining the invalid transition (FR14)

**Given** a loan record
**When** `GET /api/loans/:id/transitions` is called
**Then** the complete transition history is returned in chronological order with acting user and reason for each transition

---

## Epic 3: Data Migration & Legacy Import

Department Admin can import legacy MDA spreadsheet data, validate and categorise records, acknowledge variances with non-punitive language, and establish baselines for all 63 MDAs.

### Story 3.1: Legacy Spreadsheet Upload & Column Mapping

As a **Department Admin**,
I want to upload legacy MDA spreadsheets and map their columns to VLPRS fields,
So that data from varied spreadsheet formats can be imported without requiring a standardised template.

**Acceptance Criteria:**

**Given** the migration tool at `/api/migration/upload`
**When** Department Admin uploads an `.xlsx` or `.csv` file (up to 10MB / 500 rows)
**Then** the system parses the file and presents a column-mapping interface showing detected source columns
**And** the admin maps each source column to the required VLPRS fields (staff ID, staff name, grade level, principal, interest rate, tenure, monthly deduction, outstanding balance, etc.) (FR25)

**Given** the column mapping step
**When** the admin confirms the mapping
**Then** the system processes the file using the mapping in <15 seconds for ~50 records (NFR-PERF-8)
**And** the upload is atomic — all rows processed or none (NFR-REL-5)

### Story 3.2: Migration Validation & Variance Categorisation

As a **Department Admin**,
I want imported records automatically validated and categorised by variance severity,
So that I can focus attention on significant discrepancies while knowing clean records are safe.

**Acceptance Criteria:**

**Given** a processed migration upload
**When** the system validates each record against the computation engine
**Then** each record is categorised as one of: Clean, Minor Variance (<₦500), Significant Variance (₦500-₦50,000), Structural Error (wrong rate/formula), Anomalous (unexplainable) (FR26)

**Given** the categorisation result
**When** Department Admin views the migration report
**Then** a summary shows: count and percentage per category (e.g., "Clean: 14 records (61%), Minor Variance: 5 (22%)...")
**And** all language is non-punitive — "Comparison Complete" header, not "Errors Found"

### Story 3.3: Side-by-Side Comparison with Mathematical Explanation

As a **Department Admin**,
I want to see MDA-declared values alongside system-computed values with mathematical explanations for any variance,
So that I understand exactly why numbers differ and can make informed baseline decisions.

**Acceptance Criteria:**

**Given** a migrated record with a variance
**When** Department Admin clicks on the record
**Then** a ComparisonPanel displays: left panel (MDA Declared — white background), right panel (System Computed — teal-tinted), bottom bar (Difference + explanation) (FR27)

**Given** the comparison detail
**When** the admin expands "How was this calculated?"
**Then** a ComputationTransparencyAccordion shows the complete derivation chain: original terms → expected schedule → monthly breakdown → computed balance
**And** variance explanations use approved vocabulary ("Administrative variance" not "Calculation error")

### Story 3.4: Baseline Acknowledgment & Ledger Entry Creation

As a **Department Admin**,
I want to acknowledge variances and establish baseline positions that create the starting point in the immutable ledger,
So that legacy data enters the system without implying blame and the system has a foundation to compute forward from.

**Acceptance Criteria:**

**Given** a categorised migration record
**When** Department Admin clicks "Accept as Declared — Establish Baseline"
**Then** a summary ledger entry of type `MIGRATION_BASELINE` is created in the immutable ledger with the declared outstanding balance (FR28, FR29)
**And** the variance is recorded as metadata on the baseline entry for audit purposes
**And** no retroactive corrections are applied — the baseline reflects what the MDA declared

**Given** the baseline is created
**When** the loan record is viewed
**Then** it shows the baseline entry as the starting point with annotation "Migrated from legacy system — baseline as declared"

### Story 3.5: Migration Dashboard & MDA Status Tracking

As a **Department Admin**,
I want a Migration Dashboard showing all 63 MDAs and their migration progress through a defined pipeline,
So that I can track batch completion and know which MDAs still need attention.

**Acceptance Criteria:**

**Given** the migration dashboard at the `/migration` route
**When** Department Admin opens it
**Then** all 63 MDAs are listed with their current migration status: Pending, Received, Imported, Validated, Reconciled, Certified (FR30)
**And** a MigrationProgressCard for each MDA shows: MDA name + code, current pipeline stage (1-6), record counts per variance category, last activity timestamp (FR31)

**Given** an MDA's migration is complete
**When** its status reaches "Certified"
**Then** it shows a green "Complete" badge and the record counts are finalised

**Given** the dashboard
**When** Department Admin views progress
**Then** an overall progress indicator shows "X of 63 MDAs complete" with a visual progress bar

---

## Epic 4: Executive Dashboard & Scheme Visibility

AG opens VLPRS on her phone and instantly sees scheme-wide status — 4 headline numbers, attention items, compliance status — with drill-down to any MDA or individual loan. The 30-second truth.

### Story 4.1: Dashboard Hero Metrics API & Display

As the **Accountant General**,
I want to see four headline numbers (Active Loans, Total Exposure, Fund Available, Monthly Recovery) instantly on my phone without clicking anything,
So that I can answer any scheme-level question in real time.

**Acceptance Criteria:**

**Given** the dashboard API endpoint `GET /api/dashboard/metrics`
**When** the AG opens the dashboard on mobile (4G)
**Then** the response returns 4 metrics in <1KB payload
**And** the dashboard renders within <3 seconds including skeleton loaders → hero metrics with subtle count-up animation (FR32, NFR-PERF-1)

**Given** the HeroMetricCard components
**When** displayed on mobile (<768px)
**Then** cards are full-width stacked vertically, each showing: metric label, primary value (NairaDisplay formatting ₦1,840,000,000 or count 3,147), and optional trend indicator
**And** on desktop (>1024px), cards display in a 4-column grid

**Given** skeleton loaders
**When** the dashboard is loading
**Then** layout skeleton renders within 1 second (no blank white screen) and real data replaces skeletons as API responds

### Story 4.2: Attention Items & Status Indicators

As the **Accountant General**,
I want to see attention-worthy items on my dashboard with clear priority indicators,
So that I know immediately if anything needs my awareness without digging through data.

**Acceptance Criteria:**

**Given** the attention items API endpoint `GET /api/dashboard/attention`
**When** the dashboard loads (asynchronously after hero metrics)
**Then** attention items are displayed sorted by priority (FR33)

**Given** attention item sources
**When** any of these conditions exist:
- MDAs with submission variance >5% for 2+ consecutive months
- MDAs with overdue submissions
- Loans with zero deduction for 60+ consecutive days
- Auto-Stop Certificates pending MDA acknowledgment
**Then** each generates an AttentionItemCard with: description, MDA name, category badge (gold "Review" / teal "Info" / green "Complete"), and timestamp

**Given** an attention item
**When** the AG taps it
**Then** it navigates to the relevant detail view (MDA detail, loan record, or certificate)

### Story 4.3: Progressive Drill-Down (Dashboard → MDA → Loan)

As the **Accountant General**,
I want to drill from headline numbers to MDA-level detail to individual loan records,
So that I can investigate any number at any depth without leaving the system.

**Acceptance Criteria:**

**Given** a hero metric card (e.g., "Active Loans: 3,147")
**When** the AG clicks/taps it
**Then** the view navigates to an MDA-level breakdown showing each MDA's contribution to that metric (FR34)
**And** breadcrumb navigation shows: Dashboard > Active Loans

**Given** the MDA-level breakdown
**When** the AG clicks on a specific MDA (e.g., "Ministry of Health — 47 active loans")
**Then** the view shows individual loan records for that MDA with: staff name, staff ID, loan reference, computed balance, status (FR35)
**And** breadcrumb updates: Dashboard > Active Loans > Ministry of Health

**Given** any drill-down level
**When** the AG clicks a breadcrumb link
**Then** navigation returns to that level (NFR-PERF-2: <500ms page transitions)

### Story 4.4: MDA Compliance Status View

As the **Accountant General**,
I want to see which MDAs have submitted their monthly data and which haven't,
So that I know the submission status of all 63 MDAs at a glance.

**Acceptance Criteria:**

**Given** the compliance view at `GET /api/dashboard/compliance`
**When** the AG views MDA compliance status
**Then** all 63 MDAs are listed with their current-period submission status: Submitted (green checkmark + date), Pending (teal clock), Overdue (gold flag) (FR36)
**And** a progress indicator shows "X of 63 MDAs submitted" with a visual progress bar

**Given** the compliance view
**When** the monthly deadline is approaching
**Then** a countdown badge shows "X days until deadline (28th)"

**Given** MDA compliance data
**When** displayed on mobile
**Then** the list is compact with MDA name + status badge, scrollable, with submitted MDAs collapsed by default and pending/overdue shown prominently

---

## Epic 5: MDA Monthly Submission

MDA Reporting Officers can submit monthly deduction data via 8-field CSV upload (with conditional Event Date and Cessation Reason) or manual entry, receive instant confirmation with reference number, and see neutral comparison summaries with variance detail. The adoption engine.

### Story 5.1: CSV Upload & Atomic Validation

As an **MDA Reporting Officer**,
I want to upload a CSV file with 8 fields of monthly deduction data and have it validated atomically,
So that my submission either succeeds completely or fails cleanly with no partial data.

**Acceptance Criteria:**

**Given** the submission endpoint `POST /api/submissions/upload`
**When** the MDA officer uploads a CSV with 8 columns: Staff ID, Month, Amount Deducted, Payroll Batch Reference, MDA Code, Event Flag, Event Date, Cessation Reason (fields 7-8 conditional)
**Then** the system validates all rows atomically — all accepted or entire upload rejected (FR16, FR18)
**And** processing completes in <10 seconds for 100 rows (NFR-PERF-3)

**Given** a CSV with a duplicate entry (same Staff ID + same Month as an existing submission)
**When** the upload is processed
**Then** the entire upload is rejected with a message identifying the duplicate row (FR19)

**Given** a CSV with data type errors (e.g., "14,166.25.00" in amount column)
**When** the upload is processed
**Then** the entire upload is rejected with human-readable error messages referencing specific row numbers: "Row 29: Amount '14,166.25.00' is not a valid number" (FR20)

**Given** a submission attempt for a future month or already-closed period
**When** the upload is processed
**Then** it is rejected with: "Submission period March 2026 is not currently open" (FR24)

### Story 5.2: Manual Entry Form

As an **MDA Reporting Officer**,
I want to enter monthly deduction data manually through a form interface,
So that I can submit data even without a prepared CSV file.

**Acceptance Criteria:**

**Given** the manual entry interface at the submission page
**When** the MDA officer selects "Manual Entry" instead of CSV upload
**Then** a form is displayed with 8 fields matching the CSV structure: Staff ID, Month (pre-selected current), Amount Deducted, Payroll Batch Reference, MDA Code (pre-filled from profile), Event Flag (dropdown), Event Date (conditional — shown when Event Flag ≠ NONE), Cessation Reason (conditional — shown when Amount = ₦0 AND Event Flag = NONE)
**And** the officer can add multiple rows before submitting (FR17)

**Given** multiple manually entered rows
**When** the officer clicks "Submit All"
**Then** all rows are validated and processed atomically with the same rules as CSV upload (FR18)
**And** validation errors reference specific row numbers with the same human-readable messages

### Story 5.3: Submission Confirmation & Reference

As an **MDA Reporting Officer**,
I want immediate confirmation after a successful submission with a reference number,
So that I have proof of submission and know exactly what was received.

**Acceptance Criteria:**

**Given** a successful submission (CSV or manual)
**When** processing completes
**Then** a SubmissionConfirmation component displays: green success indicator, reference number (format: "BIR-2026-02-0001"), timestamp, record count, "Upload Complete" header (FR23)
**And** the confirmation appears BEFORE any comparison data (Confirm, Then Compare principle)

**Given** the confirmation
**When** the officer views the reference number
**Then** they can copy it to clipboard with one click

### Story 5.4: Comparison Summary with Neutral Language

As an **MDA Reporting Officer**,
I want to see how my submitted deductions compare to the expected schedule in neutral, non-accusatory language,
So that I'm informed of variances without feeling blamed or threatened.

**Acceptance Criteria:**

**Given** a successful submission
**When** the comparison summary is displayed (after confirmation)
**Then** it shows: count of aligned records (green checkmark), count of minor variances (teal info icon), count of variances with amounts (teal info icon) (FR21)
**And** the header reads "Comparison Summary" — never "Error Report" or "Validation Results" (FR22)

**Given** a variance in the comparison
**When** the officer expands the variance detail
**Then** the NonPunitiveVarianceDisplay shows: staff ID, declared amount, expected amount, difference, and mathematical explanation
**And** the icon is always info circle (ℹ) in teal — never warning triangle
**And** language uses only approved terms: "variance," "comparison," "difference" — never "error," "mistake," "fault" (FR22)

**Given** the comparison summary
**When** the officer views variances
**Then** a note reads: "No action required from you. Variances are logged for reconciliation."
**And** the officer can close the browser — no mandatory action on variances

### Story 5.5: Submission Frontend & Template Download

As an **MDA Reporting Officer**,
I want a clean submission interface with template download, pre-filled fields, and drag-drop upload,
So that my monthly submission takes 15 minutes instead of half a day.

**Acceptance Criteria:**

**Given** the MDA officer's dashboard
**When** they view their home screen
**Then** "Submit Monthly Data" is the largest, most prominent primary action button

**Given** the submission page
**When** the officer arrives
**Then** the period is pre-selected to the current open month and MDA code is pre-filled from their profile
**And** a "Download CSV Template" link is visible near the upload zone

**Given** the FileUploadZone component
**When** the officer drags a CSV file over the zone
**Then** the zone highlights with teal accent and accepts the drop
**And** on mobile, drag-drop is replaced with a tap-to-browse file picker

**Given** a rejected upload
**When** the officer sees the "Upload needs attention" screen (never "Upload failed")
**Then** specific row-level issues are listed with plain-language fixes
**And** a re-upload zone is available on the same screen — no navigation required
**And** "No data was processed — your previous submission is unchanged" reassurance is displayed

---

## Epic 6: Reporting & PDF Export

Admins can generate Executive Summary, MDA Compliance, Variance, and Loan Snapshot reports. All reports exportable as branded PDFs with Oyo State Government crest and shareable via one-tap action.

### Story 6.1: Executive Summary & MDA Compliance Reports

As the **Accountant General**,
I want to generate Executive Summary and MDA Compliance reports on demand,
So that I have comprehensive, formatted reports for governance meetings and Commissioner briefings.

**Acceptance Criteria:**

**Given** the reports interface
**When** a Super Admin or Department Admin requests an Executive Summary report
**Then** the system generates a report containing: scheme overview (total active loans, total exposure, fund available, monthly recovery rate), MDA compliance status, top 5 variances by magnitude, exception summary (open/resolved counts), and month-over-month trend for key metrics (FR37)
**And** generation completes in <10 seconds (NFR-PERF-4)

**Given** the reports interface
**When** a user requests an MDA Compliance report
**Then** the system generates a report showing all 63 MDAs with submission status, dates, record counts, and compliance percentage for the selected period (FR38)

### Story 6.2: Variance & Loan Snapshot Reports

As a **Department Admin**,
I want Variance reports and Loan Snapshot reports to verify system accuracy and share with MDAs,
So that the system's computations are transparent and verifiable.

**Acceptance Criteria:**

**Given** the reports interface
**When** a user requests a Variance report for a specific MDA or all MDAs
**Then** the system generates declared vs computed comparisons for the selected scope, showing: staff ID, declared amount, computed amount, difference, variance category (FR39)

**Given** the reports interface
**When** a user requests a Loan Snapshot report for a specific MDA
**Then** the system generates the computed 16-column view: staff ID, name, grade level, principal, interest rate, tenure, moratorium, deduction amount, installments paid, outstanding balance, status, last deduction date, next deduction date, approval date, loan reference, MDA code (FR40)

### Story 6.3: Weekly AG Report

As a **Department Admin**,
I want to generate a weekly report for the AG covering the past 7 days of activity,
So that the AG receives a concise operational summary without requesting individual reports.

**Acceptance Criteria:**

**Given** the weekly report generator
**When** Department Admin requests a weekly AG report
**Then** the report covers the 7-day period ending on the generation date and contains: executive summary, compliance status (submissions received this week), exceptions resolved with resolution notes, and outstanding attention items (FR41)
**And** the report is generated in <10 seconds (NFR-PERF-4)

### Story 6.4: Branded PDF Export & One-Tap Sharing

As any **admin user**,
I want to export any report as a branded PDF with the Oyo State Government crest and share it with one action,
So that reports are suitable for official circulation to the Commissioner, Governor, or auditors.

**Acceptance Criteria:**

**Given** any generated report
**When** the user clicks "Export as PDF"
**Then** the server generates a branded PDF via `@react-pdf/renderer` containing: Oyo State Government crest (SVG), official formatting, generation date, VLPRS reference number, and the report content (FR53)
**And** the PDF downloads to the user's device

**Given** a generated PDF
**When** a Super Admin or Department Admin clicks the "Share" action
**Then** they can download the PDF or trigger an email send — one-tap from report view (FR54)

**Given** the PDF output
**When** viewed on any device or printed
**Then** the formatting is consistent, professional, and suitable for Commissioner/Governor circulation

---

## Epic 7: Exception Management & Record Annotations

Admin can flag loan records as exceptions, investigate via a priority-sorted queue with filters, resolve with notes and audit trail. Department Admin can annotate records for institutional memory and correct event flags through a tracked workflow.

### Story 7.1: Exception Flagging & Queue

As a **Department Admin**,
I want to flag loan records as exceptions and manage them through a priority-sorted queue,
So that data quality issues are tracked, investigated, and resolved systematically.

**Acceptance Criteria:**

**Given** any loan record
**When** a Super Admin or Department Admin flags it as an exception
**Then** an exception is created with: priority level (High, Medium, Low), category (Over-deduction, Under-deduction, Inactive, Data Mismatch), and free-text notes (FR55)

**Given** the exception queue at `/exceptions`
**When** an admin views it
**Then** all open exceptions are displayed sorted by priority (High → Medium → Low) with: ExceptionQueueRow showing priority indicator, category badge, staff ID + name, MDA, description, created date (FR56)
**And** the queue is filterable by category and MDA
**And** the admin can click any exception to view the full loan detail + flag reason

**Given** an open exception
**When** an admin resolves it
**Then** they enter a resolution note and action taken, the exception is marked as resolved, and an immutable audit trail entry is created (FR56)

### Story 7.2: Automatic Inactive Loan Detection

As the **system**,
I want to automatically detect loans with no deduction recorded for 60+ consecutive days and flag them,
So that potential issues (undeclared transfers, separations, payroll errors) are surfaced proactively.

**Acceptance Criteria:**

**Given** the inactive loan detection process
**When** the system evaluates active loans
**Then** any loan with no ledger entry for 60+ consecutive days is auto-flagged as an exception with category "Inactive" and priority "Medium" (FR57)

**Given** an auto-flagged inactive loan
**When** it appears in the exception queue
**Then** the description includes: "No deduction recorded for X days. Last deduction: [date]. MDA declared event flag: NONE."
**And** it follows the same resolution workflow as manually flagged exceptions

### Story 7.3: Record Annotations & Event Flag Corrections

As a **Department Admin**,
I want to add annotations to loan records and correct event flags through a tracked workflow,
So that institutional knowledge is preserved and data corrections have a complete audit trail.

**Acceptance Criteria:**

**Given** any loan record
**When** Department Admin adds an annotation
**Then** the annotation (free-text note) is saved with: `loan_id`, `content`, `created_by` (user FK), `created_at` (FR58)
**And** annotations are displayed chronologically on the loan detail view
**And** annotations are immutable — they can be added but not edited or deleted

**Given** a loan record with an incorrect event flag
**When** Department Admin initiates a correction
**Then** a correction workflow captures: original value, new value, correction reason, and correcting user (FR59)
**And** the correction is logged as an audit trail entry
**And** the original value is preserved (never overwritten — the correction record shows both old and new)

---

## Epic 8: Auto-Stop Certificate & Loan Completion

When a loan balance reaches zero, the system automatically generates an official Auto-Stop Certificate with verification code and QR, and sends it to both the beneficiary and MDA Reporting Officer with instruction to cease deductions.

### Story 8.1: Zero-Balance Detection & Auto-Stop Trigger

As the **system**,
I want to detect when a loan balance reaches zero after processing a deduction,
So that the auto-stop process is triggered immediately and no further deductions occur.

**Acceptance Criteria:**

**Given** a monthly deduction is posted to the ledger
**When** the computed outstanding balance reaches ≤ 0
**Then** the system triggers the auto-stop process: loan status transitions from `ACTIVE` to `COMPLETED`, and the auto-stop certificate generation begins (FR7)

**Given** the last-payment adjustment method
**When** the final deduction brings the balance to exactly ₦0.00
**Then** the system correctly identifies completion even when the final payment differs from the regular schedule amount

**Given** a loan that is already `COMPLETED`
**When** a deduction is submitted for that staff member
**Then** it is flagged as a post-completion deduction variance (not silently accepted)

### Story 8.2: Auto-Stop Certificate Generation

As a **beneficiary**,
I want an official Auto-Stop Certificate with verification code generated when my loan is fully repaid,
So that I have proof that deductions should cease — a document I can present to my MDA.

**Acceptance Criteria:**

**Given** a loan that has triggered auto-stop
**When** the certificate is generated
**Then** it contains: Oyo State Government crest, certificate title, beneficiary details (name, staff ID, MDA, loan reference), completion details (original amount, total paid, completion date), certificate ID (format: "ASC-2026-04-0023"), and QR verification code (FR8)

**Given** the AutoStopCertificate component
**When** displayed on screen
**Then** it receives premium visual treatment: gold border, green celebration panel, official formatting
**And** it is downloadable as a print-ready PDF with A4 proportions

**Given** a certificate ID or QR code
**When** scanned or looked up
**Then** the system verifies the certificate and displays: "Verified — Certificate ASC-2026-04-0023 is authentic"

### Story 8.3: Auto-Stop Dual Notification

As the **system**,
I want to send the Auto-Stop Certificate to both the beneficiary and the MDA Reporting Officer,
So that both parties are informed and the MDA takes action to cease deductions.

**Acceptance Criteria:**

**Given** a generated Auto-Stop Certificate
**When** the notification process runs
**Then** an email is sent to the beneficiary with: "Congratulations!" subject, certificate PDF attached, clear explanation that the loan is fully repaid (FR9)
**And** an email is sent to the MDA Reporting Officer with: "Action Required: Cease Deduction for Staff ID [X]" subject, certificate PDF attached, specific instruction to cease payroll deductions (FR9)

**Given** the AG dashboard
**When** an Auto-Stop Certificate is issued
**Then** a green "Complete" attention item appears: "Auto-Stop Certificate issued — Staff [name], [MDA]"
**And** the Active Loans count decrements by 1

---

## Epic 9: Notifications & Automated Alerts

System automatically sends email submission reminders (T-3), overdue alerts (T+1), and loan completion notifications — keeping all stakeholders informed without manual intervention.

### Story 9.1: Submission Reminder Emails (T-3)

As the **system**,
I want to send email reminders to MDA Reporting Officers who haven't submitted 3 days before the deadline,
So that submission compliance is maximised without manual follow-up by the Department Admin.

**Acceptance Criteria:**

**Given** the 28th of the month is the submission deadline
**When** T-3 (25th of the month) arrives and an MDA Reporting Officer has not yet submitted for the current period
**Then** an email is sent via Resend containing: MDA name, submission period, expected record count (based on active loans), and a direct link to the submission interface (FR49)

**Given** the scheduled reminder job
**When** it runs on the 25th
**Then** it only sends to officers who have NOT yet submitted — officers who already submitted are excluded

### Story 9.2: Overdue Alerts & Non-Compliance List (T+1)

As the **system**,
I want to send overdue alerts the day after the deadline and a consolidated list to the Department Admin,
So that non-compliance is surfaced immediately for follow-up.

**Acceptance Criteria:**

**Given** the 28th deadline has passed
**When** T+1 (29th of the month) arrives and an MDA Reporting Officer has not submitted
**Then** an email is sent to the officer containing: MDA name, submission period, days overdue, and a direct link to submit (FR50)

**Given** the T+1 alert job
**When** it runs
**Then** a consolidated non-compliance list email is sent to the Department Admin showing: all non-submitting MDAs with officer names, contact info, and days overdue (FR50)

### Story 9.3: Loan Completion & Auto-Stop Notifications

As the **system**,
I want to send loan completion notifications to beneficiaries and Auto-Stop Certificate notifications to MDA officers,
So that all parties are informed when a loan is fully repaid and deductions should cease.

**Acceptance Criteria:**

**Given** a loan balance reaches zero
**When** the auto-stop process completes
**Then** a completion notification email is sent to the beneficiary with congratulatory message and certificate attachment (FR51)
**And** an Auto-Stop Certificate notification is sent to the MDA Reporting Officer with "Action Required: Cease Deduction" instruction and certificate attachment (FR52)

**Given** the notification system
**When** email sending fails (Resend API error)
**Then** the failure is logged and the notification is queued for retry (fire-and-forget with logged failure — no blocking of the auto-stop process)

---

## Epic 10: Staff Temporal Profile & Retirement Validation

System computes and maintains staff retirement dates from DOB and appointment date, compares loan tenure against remaining service to project gratuity receivables, and generates a Service Status Verification Report during migration to detect post-retirement activity.

### Story 10.1: Retirement Date Computation & Storage

As a **Department Admin**,
I want the system to compute each staff member's retirement date from their date of birth and date of first appointment,
So that all temporal validations (pre-submission, migration scan, early exit) have an authoritative retirement date.

**Acceptance Criteria:**

**Given** a loan record with `date_of_birth` and `date_of_first_appointment` fields (both `DATE` type, nullable)
**When** both dates are present
**Then** the system computes retirement date as `min(DOB + 60 years, appointment_date + 35 years)` and stores it as `computed_retirement_date` on the loan record (FR65)

**Given** either `date_of_birth` or `date_of_first_appointment` is corrected (updated)
**When** the correction is saved
**Then** `computed_retirement_date` is recomputed automatically and all downstream temporal validations use the new date (FR65)
**And** the correction is audit-logged with old value, new value, acting user, and timestamp

**Given** a loan record where DOB or appointment date is missing
**When** the record is viewed
**Then** the retirement date field shows "Profile Incomplete — DOB/appointment date required" (amber indicator)
**And** the record is excluded from retirement-based validations until the missing field is provided

### Story 10.2: Service Extension Recording

As a **Department Admin**,
I want to record a service extension for a staff member that overrides the computed retirement date,
So that staff who receive authorised extensions continue to have accurate temporal validations.

**Acceptance Criteria:**

**Given** a loan record with a computed retirement date
**When** Department Admin records a service extension via `POST /api/loans/:id/service-extension`
**Then** the request requires: `new_retirement_date`, `approving_authority_reference`, and `notes` (FR66)
**And** the `computed_retirement_date` is replaced with the extension date for all temporal validations

**Given** a service extension is recorded
**When** the audit log is queried
**Then** the entry contains: original computed date, new override date, reference number, reason, acting user, and timestamp (FR66)

**Given** a loan with a service extension
**When** the loan detail is viewed
**Then** a RetirementProfileCard displays both the original computed date and the active extension date with the reference number

### Story 10.3: Tenure vs Remaining Service & Gratuity Receivable

As an **approving authority**,
I want to see if a loan's tenure will extend beyond the staff member's remaining service,
So that I can understand the gratuity receivable exposure before approving the loan.

**Acceptance Criteria:**

**Given** a loan record with a computed retirement date and an active loan tenure
**When** the loan tenure exceeds the staff member's remaining service months
**Then** the system computes and displays: payroll deduction months (months until retirement), gratuity receivable months (months after retirement), and projected gratuity receivable amount (outstanding balance at computed retirement date) (FR63)
**And** a GratuityReceivableCard shows this breakdown on the loan detail view

**Given** loans with gratuity receivable exposure
**When** the executive dashboard metrics are loaded
**Then** a "Total Gratuity Receivable Exposure" metric is included showing the aggregate across all such loans (FR64)

**Given** a loan with gratuity receivable
**When** monthly deductions are posted
**Then** the projected gratuity receivable amount is updated (recalculated from remaining balance at retirement date) (FR64)

### Story 10.4: Service Status Verification Report

As a **Department Admin**,
I want a report listing all imported staff whose computed retirement date has already passed but who have active loans,
So that I can investigate whether these staff have retired, received extensions, or have incorrect dates.

**Acceptance Criteria:**

**Given** a migration import is processed
**When** the system generates the Service Status Verification Report
**Then** it lists all staff where `computed_retirement_date < import_date` AND loan status is active (FR71)
**And** each row contains: staff name, Staff ID (if available), MDA, computed retirement date, months past retirement, and outstanding balance

**Given** the report
**When** Department Admin reviews a flagged staff member
**Then** they can take action: file a retirement event (loan transitions to ceased-deduction state), record a service extension (retirement date updated), or flag for further investigation

**Given** no staff meet the criteria
**When** the report is generated
**Then** it shows "No post-retirement activity detected" with a green indicator

---

## Epic 11: Pre-Submission Checkpoint & Mid-Cycle Events

MDA Reporting Officers review a mandatory checkpoint screen before each submission. Mid-cycle employment events can be filed at any time and are reconciled against subsequent CSV submissions. MDA officers can upload historical records for cross-validation.

### Story 11.1: Pre-Submission Checkpoint Screen

As an **MDA Reporting Officer**,
I want to review a checkpoint screen before submitting monthly data showing approaching retirements, missing deductions, and pending events,
So that I submit with full awareness of my MDA's staff status.

**Acceptance Criteria:**

**Given** the MDA officer navigates to the submission page
**When** the pre-submission checkpoint loads via `GET /api/pre-submission/:mdaId`
**Then** the PreSubmissionChecklist component displays three sections (FR60):
1. **Approaching Retirement** — staff within 12 months of computed retirement date (name, Staff ID, retirement date)
2. **Zero Deduction Alert** — staff with ₦0 deduction last month and no employment event filed
3. **Pending Events** — mid-cycle events reported since last submission that await CSV confirmation

**Given** the checkpoint screen
**When** the MDA officer reviews all sections
**Then** they must check a confirmation checkbox ("I have reviewed the above items") before the "Proceed to Upload" button becomes active (FR60)

**Given** the checkpoint has no items in any section
**When** displayed
**Then** each empty section shows "No items require attention" with a green checkmark, and the confirmation checkbox is still required

### Story 11.2: Mid-Cycle Employment Event Filing

As an **MDA Reporting Officer**,
I want to file employment events (retirement, death, suspension, transfer, etc.) at any time between monthly submissions,
So that critical staff changes are recorded immediately rather than waiting for the next CSV upload.

**Acceptance Criteria:**

**Given** the employment events page
**When** the user clicks "Report Employment Event"
**Then** the EmploymentEventForm displays 5 fields: Staff ID (with auto-lookup showing name and MDA for confirmation), Event Type dropdown (Retired, Deceased, Suspended, Absconded, Transferred Out, Dismissed, LWOP Start, LWOP End, Service Extension), Effective Date, Reference Number (required for Retirement, Transfer, Dismissal; optional for others), Notes (optional) (FR61)

**Given** a valid employment event submission via `POST /api/employment-events`
**When** the event is saved
**Then** the system immediately updates the staff member's loan status accordingly, sends a confirmation to the filing user, and the event enters the pre-submission checkpoint as "Pending CSV Confirmation" (FR61)

**Given** an MDA officer files an event
**When** the event references a Staff ID not in their assigned MDA
**Then** the request is rejected with 403 (RBAC scoping applies)

### Story 11.3: Event Reconciliation Engine

As the **system**,
I want to reconcile mid-cycle employment events against monthly CSV submissions,
So that events are confirmed, discrepancies are flagged, and the data remains consistent.

**Acceptance Criteria:**

**Given** a monthly CSV submission is processed
**When** the reconciliation engine runs
**Then** it matches mid-cycle events against CSV rows by Staff ID + Event Type (FR62):
- **Matched** (same staff + same event type + dates within 7 days): event confirmed automatically
- **Date discrepancy** (same staff + same event type + dates >7 days apart): flagged for Department Admin reconciliation
- **Unconfirmed event**: mid-cycle event with no corresponding CSV row — flagged as "Unconfirmed Event"
- **New CSV event**: CSV event flag with no prior mid-cycle report — accepted and recorded normally

**Given** reconciliation results
**When** Department Admin views them
**Then** a reconciliation summary shows: confirmed count, date discrepancy count, unconfirmed event count, new event count

### Story 11.4: MDA Historical Data Upload

As an **MDA Reporting Officer**,
I want to upload historical monthly deduction records (prior months/years) for cross-validation against migration baseline data,
So that my MDA's historical records can verify and triangulate the central migration data.

**Acceptance Criteria:**

**Given** the historical upload page
**When** the MDA officer uploads a CSV with the standard 8-field format
**Then** the system validates the data, timestamps all records as "historical" (not current-period), and cross-references each row against migration baseline data for the same MDA (FR70)

**Given** the cross-validation results
**When** displayed to the MDA officer
**Then** a summary shows: matched records (count), variance records (count with largest variance amount)
**And** the full reconciliation report is queued for Department Admin review

**Given** the historical upload
**When** a row references a future month or a month with an existing current-period submission
**Then** the row is rejected with a clear message: "Row X: Month YYYY-MM already has a current-period submission"

---

## Epic 12: Early Exit Processing

Department Admin can compute a lump-sum payoff for active loans, record staff commitment and payment, and close loans through the early exit workflow. State machine: Computed → Committed → Paid → Closed (or → Expired).

### Story 12.1: Early Exit Computation

As a **Department Admin**,
I want to compute the lump-sum payoff amount for an active loan so a staff member can settle early,
So that staff have a clear, time-bound figure for early loan settlement.

**Acceptance Criteria:**

**Given** an active loan
**When** Department Admin initiates an early exit computation via `POST /api/early-exits`
**Then** the system generates an EarlyExitComputationCard showing (FR67):
- Remaining principal balance
- Current month interest amount
- Total lump sum payoff amount (principal + interest)
- Computation validity expiry date (last day of current month)
- Unique reference number (format: "EEC-2026-02-0001")

**Given** the computation
**When** the current month ends without recorded payment
**Then** the computation is marked as `EXPIRED` and a new computation is required for an updated payoff amount (FR69)

**Given** an expired computation
**When** viewed in the audit history
**Then** it is retained with status "Expired" and full computation details preserved (FR69)

### Story 12.2: Early Exit Commitment & Payment

As a **Department Admin**,
I want to record a staff member's commitment to early exit and subsequently record their lump-sum payment,
So that the early exit workflow progresses from computation to loan closure.

**Acceptance Criteria:**

**Given** an active early exit computation (not expired)
**When** Department Admin records staff commitment via `PUT /api/early-exits/:id/commit`
**Then** the computation status transitions from `COMPUTED` to `COMMITTED` with: agreed payment deadline, and commitment timestamp (FR68)

**Given** a committed early exit
**When** Department Admin records payment via `PUT /api/early-exits/:id/pay`
**Then** the request requires: payment date, payment amount, and payment reference (FR68)
**And** if the payment amount ≥ the computed payoff amount, the loan is closed:
- Loan status transitions to `COMPLETED`
- A ledger entry of type `EARLY_EXIT_PAYMENT` is created in the immutable ledger
- Auto-Stop Certificate generation is triggered
- Early exit status transitions to `PAID` then `CLOSED`

**Given** a committed early exit where the payment deadline passes without payment
**When** the system evaluates overdue commitments
**Then** the early exit is flagged as an attention item for Department Admin: "Early exit commitment overdue — Staff [name], Reference [ref]" (FR69)

### Story 12.3: Early Exit Dashboard & History

As a **Department Admin**,
I want to view all early exit computations with their current status and full history,
So that I can track which staff are in the process of settling early and follow up on overdue commitments.

**Acceptance Criteria:**

**Given** the early exit dashboard at `/early-exits`
**When** Department Admin views it
**Then** all early exit records are listed with: staff name, Staff ID, loan reference, computation date, payoff amount, status (Computed/Committed/Paid/Closed/Expired), and expiry date

**Given** the early exit list
**When** filtered by status
**Then** the list shows only records matching the selected status (e.g., "Committed" to see all pending payments)

**Given** an early exit record
**When** Department Admin clicks on it
**Then** the full history is shown: computation details, commitment details (if applicable), payment details (if applicable), expiry details (if applicable), and all audit trail entries

---

## Epic 13: Staff ID Governance

MDA officers can manage Staff IDs within their assigned MDA; admin users can manage Staff IDs system-wide. Staff ID data quality self-sufficiency.

> **Note:** Stories 13.1 (User Account Management) and 13.2 (Password Reset) were moved to Epic 1 as Stories 1.9a and 1.9b. See Epic 1 for full user account lifecycle and invitation system.

### Story 13.3: Staff ID Management

As an **MDA Reporting Officer**,
I want to add or update Staff IDs for loan records within my MDA,
So that all loan records have accurate Staff ID assignments for payroll reconciliation.

**Acceptance Criteria:**

**Given** a loan record within the officer's assigned MDA
**When** the MDA officer adds or updates the Staff ID via `PUT /api/loans/:id/staff-id`
**Then** the Staff ID is updated and the change is audit-logged with: old value, new value, acting user, and timestamp (FR74)

**Given** a Department Admin or Super Admin
**When** they search for and update a Staff ID
**Then** they can update Staff IDs on any loan record system-wide (not scoped to a single MDA) (FR74)

**Given** the StaffIdManager component
**When** displayed on the loan detail view
**Then** it shows: current Staff ID, edit button (if authorised), and a history link showing all prior Staff ID values with change dates and acting users

### Story 13.4: Duplicate Staff ID Detection

As the **system**,
I want to detect when a Staff ID being assigned already exists on another loan record,
So that accidental duplicate assignments are caught before they cause data quality issues.

**Acceptance Criteria:**

**Given** a Staff ID is being added or updated
**When** the system checks all existing loan records for the same Staff ID
**Then** if a match is found, the system displays: "This Staff ID is already assigned to loan record [VLPRS reference]. Please verify before proceeding." (FR75)

**Given** the duplicate warning
**When** the user decides to proceed anyway
**Then** they must enter a justification note that is logged with the Staff ID change audit entry (FR75)

**Given** the duplicate warning
**When** the user decides to cancel
**Then** the Staff ID update is not applied and no audit entry is created
