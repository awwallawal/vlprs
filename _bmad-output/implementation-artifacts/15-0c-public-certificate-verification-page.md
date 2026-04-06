# Story 15.0c: Public Certificate Verification Page

Status: done

## Story

As a **beneficiary or third party**,
I want to scan the QR code on my Auto-Stop Certificate and see an official verification page confirming the certificate is authentic,
So that I can prove my loan is fully repaid to my employer, bank, or any requesting party.

**Origin:** UAT Finding #33 (High) from E8 retro. Route `/verify/:certificateId` defined in `router.tsx:189` but `VerifyCertificatePage` component never created. Backend API `GET /api/public/verify/:certificateId` is fully built and tested.

**Priority:** HIGH — certificates already issued with QR codes linking to this page.

**Resolution:** Implemented in Story 8.2 (Auto-Stop Certificate Generation), Task 8. Both the frontend component and backend endpoint were built and tested as part of that story. UAT Finding #33 was raised before Story 8.2 shipped and was resolved by it.

## Acceptance Criteria

1. **Given** a beneficiary scans the QR code on their Auto-Stop Certificate, **When** the `/verify/:certificateId` page loads, **Then** an official verification page renders showing certificate validity, beneficiary name, MDA, and completion date. **VERIFIED** — `VerifyCertificatePage.tsx` renders all four fields.

2. **Given** the certificate ID is valid, **When** the page loads, **Then** a green "Verified" badge with certificate details is displayed. **VERIFIED** — green border/background with `CheckCircle2` icon, beneficiary name, MDA name, formatted completion date.

3. **Given** the certificate ID is invalid or not found, **When** the page loads, **Then** a "Certificate Not Found" message is displayed with guidance to check the ID. **VERIFIED** — `XCircle` icon with "Certificate Not Found" and "Please check the ID and try again" text.

4. **Given** the verification service is unavailable, **When** the fetch fails, **Then** an error state is displayed with "Unable to connect to verification service." **VERIFIED** — `.catch()` handler sets error state, renders amber `XCircle` with retry guidance.

5. **Given** the verification endpoint, **When** accessed without authentication, **Then** the request succeeds (public endpoint, no auth required). **VERIFIED** — backend route at `autoStopRoutes.ts:191` has no auth middleware; integration test at line 604 explicitly tests "No Authorization header — should still succeed."

6. **Given** the verification endpoint is public-facing, **When** receiving high traffic, **Then** rate limiting is applied. **VERIFIED** — `verificationLimiter` middleware applied at `autoStopRoutes.ts:194`.

## Evidence — Files Implementing This Story

### Frontend

| File | Line(s) | What |
|------|---------|------|
| `apps/client/src/pages/public/VerifyCertificatePage.tsx` | 1-121 | Full component: loading, error, valid, and not-found states. Uses `API_BASE` for public fetch (no auth). Lazy-loaded. |
| `apps/client/src/router.tsx` | 189-193 | Route `/verify/:certificateId` wired to lazy-loaded `VerifyCertificatePage` |

### Backend

| File | Line(s) | What |
|------|---------|------|
| `apps/server/src/routes/autoStopRoutes.ts` | 191-220 | `GET /api/public/verify/:certificateId` — public endpoint, rate-limited, no authentication |
| `apps/server/src/services/autoStopCertificateService.ts` | — | Certificate verification logic |
| `apps/server/src/lib/email.ts` | — | QR code URL generation for certificate emails |

### Tests

| File | Line(s) | What |
|------|---------|------|
| `apps/server/src/routes/autoStop.integration.test.ts` | 573-610 | "Public Verification Endpoint (Story 8.2, Task 8)" — 3 tests: valid cert, invalid cert, no-auth access |

### Test Gap

~~No client-side component test existed.~~ **Resolved by code review** — `VerifyCertificatePage.test.tsx` created with 5 tests covering all 4 render states (loading, valid, not-found, error) plus certificate ID display.

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] M1: Add frontend component test for `VerifyCertificatePage` — public-facing page with 4 render states had zero frontend coverage [VerifyCertificatePage.test.tsx created, 5 tests] — **FIXED**
- [x] [AI-Review][LOW] L1: Add AbortController cleanup to `useEffect` fetch — prevents state updates on unmounted component after navigation [VerifyCertificatePage.tsx:21-35] — **FIXED**
- [x] [AI-Review][LOW] L2: Remove unused `generatedAt` from `VerificationResult` interface — received from backend but never rendered [VerifyCertificatePage.tsx:12] — **FIXED**
- [x] [AI-Review][LOW] L3: Replace direct DOM mutation (`style.display = 'none'`) with React state-driven conditional render for crest image [VerifyCertificatePage.tsx:54] — **FIXED**

## Dev Notes

### Why This Story Exists Despite Being Complete

UAT Finding #33 was raised during the E8 retro on 2026-04-06 based on the state of the codebase **before** Story 8.2 shipped. Story 8.2 (Auto-Stop Certificate Generation) included the verification page as Task 8, resolving the finding. The prep sprint planning captured Finding #33 as Story 15.0c without cross-referencing the 8.2 implementation.

This story file exists to:
1. Close the audit trail — Finding #33 is resolved, tracked, and verified
2. Prevent retro confusion — "was this done or not?" has a documented answer
3. Provide evidence for the Code Review Agent — all file paths and line numbers verified against current codebase

### UAT Finding Cross-Reference

| Finding | Description | Resolution |
|---------|-------------|------------|
| #33 | "Public certificate verification page — route exists, component missing" (High) | Resolved by Story 8.2, Task 8. Component created, backend endpoint built, integration tests added. |

### No Code Changes Required

This story required zero code changes. All implementation was completed in Story 8.2.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context) — PM validation only (no dev work)

### Debug Log References

N/A — verification only

### Completion Notes List

1. **Verification:** PM validated all 6 acceptance criteria against the actual codebase. All satisfied.
2. **Evidence documented:** Frontend component (121 lines), router wiring, backend endpoint, rate limiter, and 3 integration tests all confirmed present and functional.
3. **Cross-reference:** UAT Finding #33 formally closed — raised before Story 8.2, resolved by Story 8.2.
4. **Test gap noted:** No `VerifyCertificatePage.test.tsx` exists. Backend is covered. Frontend is low-risk but flagged for hygiene.

### File List

Originally no files modified (documentation-only). Code review added hardening fixes and component test:

| File | Action |
|------|--------|
| `apps/client/src/pages/public/VerifyCertificatePage.tsx` | Modified — AbortController cleanup, removed unused `generatedAt`, React-idiomatic image error state |
| `apps/client/src/pages/public/VerifyCertificatePage.test.tsx` | Created — 5 tests covering all 4 render states + certificate ID display |
| `_bmad-output/implementation-artifacts/15-0c-public-certificate-verification-page.md` | Modified — review follow-ups, status, file list |
