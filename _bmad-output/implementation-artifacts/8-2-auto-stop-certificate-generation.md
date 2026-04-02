# Story 8.2: Auto-Stop Certificate Generation

Status: ready-for-dev

## Story

As a **beneficiary**,
I want an official Auto-Stop Certificate with verification code generated when my loan is fully repaid,
So that I have proof that deductions should cease — a document I can present to my MDA.

**Origin:** Epic 8 core story — FR8. The Auto-Stop Certificate is the system's emotional climax — the "never be over-deducted again" guarantee made tangible.

**Dependencies:** Story 8.1 (Zero-Balance Detection & Auto-Stop Trigger) must be complete. This story consumes the `loan_completions` table and COMPLETED loan status from 8.1.

## Acceptance Criteria

1. **Given** a loan that has triggered auto-stop (status = COMPLETED, `loan_completions` record exists), **When** the certificate is generated, **Then** it contains: Oyo State Government crest, "Auto-Stop Certificate" title, beneficiary details (name, staff ID, MDA, loan reference), completion details (original principal, total paid, total interest paid, completion date), certificate ID (format: `ASC-2026-04-0023`), and a QR verification code linking to the public verification endpoint.

2. **Given** the Auto-Stop Certificate PDF, **When** rendered, **Then** it receives premium visual treatment: gold (#B8860B) border, green (#16A34A) celebration panel with "Congratulations!" messaging, Oyo State crest in crimson, official formatting — print-ready A4 portrait proportions.

3. **Given** a loan that transitions to COMPLETED via auto-stop, **When** the transition completes, **Then** a certificate record is automatically created in the `auto_stop_certificates` table with a unique sequential certificate ID and generated PDF stored as a buffer.

4. **Given** a certificate ID (e.g., `ASC-2026-04-0023`) or QR code scan, **When** accessed via the public verification endpoint, **Then** the system responds with verification status: "Verified — Certificate ASC-2026-04-0023 is authentic" along with beneficiary name, MDA, and completion date — no authentication required.

5. **Given** an authenticated user viewing the Loan Detail page for a completed loan, **When** the certificate exists, **Then** a "Download Auto-Stop Certificate" button is shown, and clicking it downloads the PDF.

6. **Given** a certificate that has been generated, **When** queried via the API, **Then** the certificate record includes: `certificateId`, `loanId`, `completionDate`, `beneficiaryName`, `staffId`, `mdaName`, `loanReference`, `generatedAt`, and `verificationToken`.

7. **Given** multiple certificates generated in the same month, **When** certificate IDs are assigned, **Then** they are sequentially numbered within the month: `ASC-2026-04-0001`, `ASC-2026-04-0002`, etc.

## Tasks / Subtasks

- [ ] Task 1: Create `auto_stop_certificates` table (AC: 3, 6, 7)
  - [ ] 1.1: Add `autoStopCertificates` table to `apps/server/src/db/schema.ts`:
    ```typescript
    export const autoStopCertificates = pgTable('auto_stop_certificates', {
      id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
      loanId: uuid('loan_id').notNull().references(() => loans.id),
      certificateId: varchar('certificate_id', { length: 50 }).notNull(),
      verificationToken: varchar('verification_token', { length: 64 }).notNull(),
      beneficiaryName: varchar('beneficiary_name', { length: 255 }).notNull(),
      staffId: varchar('staff_id', { length: 50 }).notNull(),
      mdaId: uuid('mda_id').notNull().references(() => mdas.id),
      mdaName: varchar('mda_name', { length: 255 }).notNull(),
      loanReference: varchar('loan_reference', { length: 50 }).notNull(),
      originalPrincipal: numeric('original_principal', { precision: 15, scale: 2 }).notNull(),
      totalPaid: numeric('total_paid', { precision: 15, scale: 2 }).notNull(),
      totalInterestPaid: numeric('total_interest_paid', { precision: 15, scale: 2 }).notNull(),
      completionDate: timestamp('completion_date', { withTimezone: true }).notNull(),
      generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => [
      uniqueIndex('idx_auto_stop_certificates_loan_id').on(table.loanId),
      uniqueIndex('idx_auto_stop_certificates_certificate_id').on(table.certificateId),
      index('idx_auto_stop_certificates_verification_token').on(table.verificationToken),
      index('idx_auto_stop_certificates_generated_at').on(table.generatedAt),
    ]);
    ```
  - [ ] 1.2: Run `drizzle-kit generate` to create a NEW migration
  - [ ] 1.3: Add `auto_stop_certificates` to `resetDb.ts` explicit table list

- [ ] Task 2: Create certificate ID generator (AC: 7)
  - [ ] 2.1: Create `generateCertificateId(year, month)` in `apps/server/src/services/autoStopCertificateService.ts`:
    - Query `auto_stop_certificates` for MAX sequential number in the given year/month
    - Parse the last 4 digits from the latest `certificate_id` matching `ASC-{year}-{month}-NNNN`
    - Increment by 1, zero-pad to 4 digits
    - Return `ASC-${year}-${String(month).padStart(2,'0')}-${String(seq).padStart(4,'0')}`
    - Handle concurrent inserts: use `FOR UPDATE` lock or retry on unique constraint violation
  - [ ] 2.2: Create `generateVerificationToken()` — random 32-byte hex string (crypto.randomBytes(32).toString('hex'))
  - [ ] 2.3: Unit test in `apps/server/src/services/autoStopCertificateService.test.ts` (**new file**): first certificate of month → `ASC-2026-04-0001`
  - [ ] 2.4: Unit test in same file: after 23 certificates → `ASC-2026-04-0024`
  - [ ] 2.5: Unit test in same file: new month resets counter → `ASC-2026-05-0001`

- [ ] Task 3: Install QR code library and create generator (AC: 1)
  - [ ] 3.1: Install `qrcode` package: `pnpm --filter server add qrcode && pnpm --filter server add -D @types/qrcode`
  - [ ] 3.2: Create `generateQrCodeDataUrl(verificationUrl: string): Promise<string>` helper:
    ```typescript
    import QRCode from 'qrcode';
    export async function generateQrCodeDataUrl(url: string): Promise<string> {
      return QRCode.toDataURL(url, { width: 150, margin: 1, errorCorrectionLevel: 'M' });
    }
    ```
    Returns a `data:image/png;base64,...` string embeddable in @react-pdf via `<Image src={dataUrl} />`
  - [ ] 3.3: Unit test in same file: generates valid data URL from verification URL

- [ ] Task 4: Create Auto-Stop Certificate PDF component (AC: 1, 2)
  - [ ] 4.1: Create `apps/server/src/services/autoStopCertificatePdf.tsx`:
    ```typescript
    export async function generateAutoStopCertificatePdf(
      data: AutoStopCertificateData
    ): Promise<Buffer>
    ```
  - [ ] 4.2: Certificate layout (A4 portrait):
    ```
    ┌──────────────────────────────────────────────┐
    │  ═══════════ GOLD BORDER (#B8860B) ═══════  │
    │                                              │
    │            [Oyo State Crest]                  │
    │         OYO STATE GOVERNMENT                 │
    │     VEHICLE LOAN PROCESSING &                │
    │       RECEIVABLES SYSTEM                     │
    │                                              │
    │  ┌──────────────────────────────────────┐    │
    │  │  ✓  AUTO-STOP CERTIFICATE           │    │
    │  │     Certificate ID: ASC-2026-04-0023│    │
    │  └──────────────────────────────────────┘    │
    │                                              │
    │  ┌──────────────────────────────────────┐    │
    │  │  🎉 GREEN CELEBRATION PANEL (#16A34A)│    │
    │  │                                      │    │
    │  │  Congratulations!                    │    │
    │  │  This certifies that the vehicle     │    │
    │  │  loan for the below-named staff has  │    │
    │  │  been fully repaid. All payroll      │    │
    │  │  deductions should cease immediately.│    │
    │  └──────────────────────────────────────┘    │
    │                                              │
    │  BENEFICIARY DETAILS                         │
    │  ──────────────────                          │
    │  Name:           ALATISE BOSEDE SUSAINAH     │
    │  Staff ID:       OY/2345/BIR                 │
    │  MDA:            Board of Internal Revenue   │
    │  Loan Reference: VL-2026-BIR-0042            │
    │                                              │
    │  COMPLETION DETAILS                          │
    │  ─────────────────                           │
    │  Original Principal:  ₦450,000.00            │
    │  Total Interest Paid: ₦29,992.50             │
    │  Total Amount Paid:   ₦479,992.50            │
    │  Completion Date:     02 April 2026          │
    │                                              │
    │  ┌────────────┐                              │
    │  │  [QR CODE]  │  Scan to verify this        │
    │  │             │  certificate at:             │
    │  │             │  vlprs.oyostate.gov.ng/      │
    │  │             │  verify/ASC-2026-04-0023     │
    │  └────────────┘                              │
    │                                              │
    │  This certificate was automatically          │
    │  generated by the Vehicle Loan Processing    │
    │  & Receivables System on 02 April 2026.      │
    │                                              │
    │  ═══════════ GOLD BORDER (#B8860B) ═══════  │
    └──────────────────────────────────────────────┘
    ```
  - [ ] 4.3: Use `@react-pdf/renderer` components: `Document`, `Page`, `View`, `Text`, `Image`, `StyleSheet`
  - [ ] 4.4: Reuse existing patterns from `reportPdfComponents.tsx`:
    - Crest loading: `CREST_URI` base64 pattern (lines 19-23)
    - `renderToBuffer()` for PDF generation
  - [ ] 4.5: Gold border: `border: '3pt solid #B8860B'` on outer View
  - [ ] 4.6: Green celebration panel: `backgroundColor: '#16A34A'`, white text, rounded corners
  - [ ] 4.7: QR code: embed as `<Image src={qrCodeDataUrl} style={{ width: 100, height: 100 }} />`
  - [ ] 4.8: Financial values: use `NairaDisplay` formatting pattern (₦ prefix, comma-separated)
  - [ ] 4.9: Date formatting: `date-fns format(date, 'dd MMMM yyyy')` → "02 April 2026"

- [ ] Task 5: Create certificate generation service (AC: 3, 6)
  - [ ] 5.1: Create `apps/server/src/services/autoStopCertificateService.ts` with:
    ```typescript
    export async function generateCertificate(loanId: string): Promise<AutoStopCertificate>
    ```
  - [ ] 5.2: Implementation:
    - Fetch loan details (name, staffId, mdaId, loanReference, principalAmount, interestRate)
    - Fetch MDA name via join
    - Fetch `loan_completions` record for totalPaid, totalInterestPaid, completionDate
    - Generate certificateId via `generateCertificateId()`
    - Generate verificationToken via `generateVerificationToken()`
    - Generate QR code data URL pointing to `{PUBLIC_URL}/verify/{certificateId}`
    - Generate PDF buffer via `generateAutoStopCertificatePdf()`
    - Insert into `auto_stop_certificates` table
    - Return certificate record
  - [ ] 5.3: Idempotency: if certificate already exists for this loanId, return existing (don't regenerate)
  - [ ] 5.4: Unit test in same file: generates certificate with all fields populated
  - [ ] 5.5: Unit test in same file: second call for same loan returns existing certificate (idempotent)

- [ ] Task 6: Wire certificate generation into auto-stop trigger (AC: 3)
  - [ ] 6.1: In `apps/server/src/services/autoStopService.ts` (Story 8.1), after `transitionLoan()` and `loan_completions` insert:
    - Call `generateCertificate(loanId)` (fire-and-forget with error logging — certificate generation failure should NOT roll back the loan completion)
  - [ ] 6.2: Update the auto-stop attention item to show "Certificate generated" vs "Certificate pending" per loan

- [ ] Task 7: Create certificate download endpoint (AC: 5)
  - [ ] 7.1: Add `GET /api/certificates/:loanId/pdf` to `apps/server/src/routes/autoStopRoutes.ts` (created in Story 8.1):
    - Authenticate: any role with MDA scope access to the loan's MDA
    - Fetch certificate record by loanId
    - If no certificate: return 404
    - Regenerate PDF buffer from stored data (don't store PDF blob in DB — regenerate on demand). Use **dynamic import** for the PDF service: `const { generateAutoStopCertificatePdf } = await import('../services/autoStopCertificatePdf')` — matching the existing pattern at `reportRoutes.ts:168`
    - Return with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="auto-stop-certificate-ASC-2026-04-0023.pdf"`
  - [ ] 7.2: Add `GET /api/certificates/:loanId` (JSON metadata) for the frontend to check if a certificate exists and display its details
  - [ ] 7.3: Integration test in `apps/server/src/routes/autoStop.integration.test.ts` (extends 8.1's file): download PDF for completed loan with certificate → 200 + PDF buffer
  - [ ] 7.4: Integration test in same file: download for active loan → 404

- [ ] Task 8: Create public verification endpoint (AC: 4)
  - [ ] 8.1: Add `GET /api/public/verify/:certificateId` — NO authentication required:
    ```typescript
    router.get('/public/verify/:certificateId', async (req, res) => {
      const cert = await db.select()
        .from(autoStopCertificates)
        .where(eq(autoStopCertificates.certificateId, req.params.certificateId))
        .limit(1);

      if (!cert.length) {
        return res.json({ success: true, data: { valid: false, message: 'Certificate not found' } });
      }

      return res.json({
        success: true,
        data: {
          valid: true,
          message: `Verified — Certificate ${cert[0].certificateId} is authentic`,
          beneficiaryName: cert[0].beneficiaryName,
          mdaName: cert[0].mdaName,
          completionDate: cert[0].completionDate,
          generatedAt: cert[0].generatedAt,
        },
      });
    });
    ```
  - [ ] 8.2: Rate-limit this endpoint: create a `verificationLimiter` in `apps/server/src/middleware/rateLimiter.ts` (alongside existing `authLimiter`, `writeLimiter`, `readLimiter`) with `windowMs: 60_000, max: 10` to prevent certificate ID enumeration
  - [ ] 8.3: DO NOT return sensitive financial details (principal, amounts) in the public response — only name, MDA, date, and authenticity
  - [ ] 8.4: Integration test in same file: valid certificate ID → verified response
  - [ ] 8.5: Integration test in same file: invalid certificate ID → "not found" response
  - [ ] 8.6: Register public route — the codebase applies `authenticate` **per-route** (NOT globally in app.ts). Simply omit the `authenticate` middleware from this route's handler chain, same as login/refresh endpoints in `authRoutes.ts`. No special registration order needed

- [ ] Task 9: Add certificate UI to Loan Detail page (AC: 5)
  - [ ] 9.1: Add `useCertificate(loanId)` hook in `apps/client/src/hooks/useLoanData.ts` (where `useLoanDetail()` and `useLoanSearch()` already live) or create new `apps/client/src/hooks/useCertificate.ts`. NOTE: `useLoan.ts` does NOT exist — the actual file is `useLoanData.ts`:
    ```typescript
    queryKey: ['certificates', loanId]
    queryFn: () => apiClient(`/certificates/${loanId}`)
    enabled: loan.status === 'COMPLETED'
    ```
  - [ ] 9.2: In `apps/client/src/pages/dashboard/LoanDetailPage.tsx`, when loan status is COMPLETED and certificate exists:
    - Show a celebration banner: green background, gold accent, "Loan Completed — Auto-Stop Certificate Available"
    - "Download Certificate" button → triggers PDF download via `authenticatedFetch` + Blob pattern (same as Story 8.0f export)
  - [ ] 9.3: If loan is COMPLETED but certificate not yet generated (edge case — generation in progress or failed):
    - Show: "Certificate is being generated..." or "Certificate generation pending"

- [ ] Task 10: Create public verification page (AC: 4)
  - [ ] 10.1: Create `apps/client/src/pages/public/VerifyCertificatePage.tsx`:
    - Route: `/verify/:certificateId` (public, no auth required)
    - On mount: call `GET /api/public/verify/:certificateId`
    - If valid: show green success panel with "Verified" badge, beneficiary name, MDA, completion date
    - If invalid: show neutral "Certificate not found" message
  - [ ] 10.2: Add route to public routes in `apps/client/src/router.tsx`
  - [ ] 10.3: Simple, clean design — no sidebar, no dashboard chrome. Use public layout
  - [ ] 10.4: Include Oyo State crest for official appearance

- [ ] Task 11: Full regression and verification (AC: all)
  - [ ] 11.1: Run `pnpm typecheck` — zero errors
  - [ ] 11.2: Run `pnpm test` — zero regressions
  - [ ] 11.3: Manual test: trigger auto-stop for a loan → verify certificate auto-generated → download PDF → scan QR code → verify page shows "Verified"

## Dev Notes

### The Emotional Climax of VLPRS

From the product brief: "The Auto-Stop Certificate — an automatic, system-generated instruction to halt deductions the moment a loan reaches zero. The guarantee that no government worker will ever again be over-deducted."

This is not a routine report. It's the system's single most important output. The visual treatment must be premium — gold borders, green celebration, official crest. It should feel momentous.

### PDF Generation Pattern (Established)

All 6 existing PDF reports follow the same pattern. This story follows it exactly:

**File:** `apps/server/src/services/reportPdfComponents.tsx`

```typescript
// Crest loading (lines 19-23)
const crestBase64 = fs.readFileSync(
  path.resolve(__dirname, '../assets/oyo-crest.png'),
).toString('base64');
const CREST_URI = `data:image/png;base64,${crestBase64}`;

// Rendering (any PDF component)
const doc = (
  <Document title="Auto-Stop Certificate" author="VLPRS">
    <Page size="A4" style={styles.page}>
      {/* content */}
    </Page>
  </Document>
);
const buffer = await renderToBuffer(doc);
return Buffer.from(buffer);
```

**Key reusable components from `reportPdfComponents.tsx`:**
- `CREST_URI` — Oyo State crest as base64 data URL
- `ReportPageWrapper` — A4 page with header/footer (may not fit certificate layout — consider custom page layout)
- NOTE: `generateReferenceNumber()` generates random UUID-based IDs (`VLPRS-{PREFIX}-{YEAR}-{8-CHAR-UUID}`) — do NOT reuse for certificate IDs which are sequential (`ASC-{YEAR}-{MONTH}-{SEQ}`). Use the new `generateCertificateId()` from Task 2.1 instead

### QR Code Strategy

No QR library currently exists in the project. Install `qrcode` (lightweight, pure JS, widely used):

```typescript
import QRCode from 'qrcode';

// Generate data URL for @react-pdf embedding
const qrDataUrl = await QRCode.toDataURL(
  `https://vlprs.oyostate.gov.ng/verify/${certificateId}`,
  { width: 150, margin: 1, errorCorrectionLevel: 'M' }
);

// Embed in @react-pdf
<Image src={qrDataUrl} style={{ width: 100, height: 100 }} />
```

The QR code encodes the public verification URL. When scanned, it opens the verification page.

### Certificate ID: Sequential Within Month

Format: `ASC-2026-04-0023`

```
ASC    — Auto-Stop Certificate prefix
2026   — Year
04     — Month (zero-padded)
0023   — Sequential number within month (zero-padded to 4 digits)
```

Sequential within month means the counter resets each month. The unique index on `certificate_id` prevents duplicates. For concurrent inserts, use the DB unique constraint as a guard — retry with incremented sequence on conflict.

### Regenerate PDF on Demand (Don't Store Blobs)

Store certificate METADATA in the database, not the PDF blob. Regenerate the PDF on each download request using `generateAutoStopCertificatePdf()`. This:
- Keeps the database lean
- Allows PDF template updates without re-generating all certificates
- Follows the pattern used by all existing reports (generate on request)

### Public Verification Endpoint — Security Considerations

The verification endpoint is public (no auth) by design — anyone with a certificate (or a QR scan) should be able to verify it. Security measures:

1. **Rate limiting:** 10 req/min per IP to prevent certificate ID enumeration
2. **Minimal data exposure:** Only return name, MDA, date, and validity — NOT financial amounts
3. **No listing endpoint:** Can only verify by exact certificate ID, not browse
4. **Verification token:** Stored separately for potential future use (e.g., signed verification with token)

### Public Route Registration

The codebase applies `authenticate` per-route, NOT globally. Login and refresh endpoints in `authRoutes.ts` are public simply by omitting `authenticate` from their middleware chain. The verification route follows the same pattern — just don't include `authenticate` in the handler:

```typescript
// In publicVerificationRoutes.ts or autoStopRoutes.ts
router.get('/public/verify/:certificateId', verificationLimiter, async (req, res) => {
  // NO authenticate middleware — this is intentionally public
});
```

Register this route file in `app.ts` with `app.use('/api', publicVerificationRoutes)` alongside other route registrations.

### Color Palette for Certificate

| Element | Color | Hex | Usage |
|---|---|---|---|
| Gold border | Heritage Gold | `#B8860B` | 3pt border around certificate |
| Celebration panel | Green | `#16A34A` | Background of congratulations section |
| Celebration text | White | `#FFFFFF` | Text on green panel |
| Crest | Crimson | `#9C1E23` | Oyo State crest (asset is already crimson) |
| Body text | Navy | `#1a1a2e` | All labels and values |
| Section headers | Dark | `#374151` | "BENEFICIARY DETAILS", "COMPLETION DETAILS" |

### Financial Display Format

Follow existing NairaDisplay pattern:
- `₦450,000.00` — Naira symbol, comma-separated thousands, always 2 decimal places
- Use `Intl.NumberFormat` or existing formatting helper
- All amounts as strings from Decimal.js (never floating point)

### What This Story Does NOT Build

- **Email/notification delivery** — Story 8.3 (Dual Notification)
- **Beneficiary portal view** — future phase (beneficiary login + personal dashboard)
- **Certificate revocation** — not in scope (certificates are permanent)
- **Batch certificate generation** — if multiple loans complete simultaneously, each triggers independently

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Existing PDF components | `apps/server/src/services/reportPdfComponents.tsx` | 19-23 (crest), 240-289 (wrappers) |
| Report routes pattern | `apps/server/src/routes/reportRoutes.ts` | 158-183 (PDF serving) |
| Oyo State crest asset | `apps/server/src/assets/oyo-crest.png` | Base64 embed pattern |
| Auto-stop service (8.1) | `apps/server/src/services/autoStopService.ts` | Hook point for certificate generation |
| Loan completions table (8.1) | `apps/server/src/db/schema.ts` | Created by Story 8.1 |
| Loan detail page | `apps/client/src/pages/dashboard/LoanDetailPage.tsx` | Add certificate download button |
| Public routes | `apps/client/src/router.tsx` | Add /verify/:certificateId |
| Auto-stop routes (8.1) | `apps/server/src/routes/autoStopRoutes.ts` | Add certificate endpoints |
| New PDF component | `apps/server/src/services/autoStopCertificatePdf.tsx` | To be created |
| New service | `apps/server/src/services/autoStopCertificateService.ts` | To be created |
| resetDb | `apps/server/src/test/resetDb.ts` | Add auto_stop_certificates |

### Non-Punitive Vocabulary

- "Congratulations!" — celebration, not just notification
- "Loan completed" — positive event
- "Deductions should cease immediately" — clear instruction, not blame
- "Verified — authentic" — trust language

### Testing Standards

- Co-located tests: `autoStopCertificateService.test.ts`
- Integration tests in `autoStopRoutes.integration.test.ts`
- PDF tests: verify `generateAutoStopCertificatePdf()` returns a non-empty Buffer
- Verification endpoint: test valid + invalid certificate IDs
- Financial assertions via Decimal.js string comparison

### Team Agreements Applicable

- **Extend, don't fork** — reuse existing PDF infrastructure, crest asset, rendering pattern
- **Premium visual treatment** — this is the ONE feature where gold and celebration are appropriate
- **Transaction scope** — certificate generation is fire-and-forget from auto-stop trigger (failure doesn't roll back completion)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2 — Auto-Stop Certificate Generation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Certificate visual treatment, gold border, celebration panel]
- [Source: _bmad-output/planning-artifacts/product-brief-vlprs-2026-02-13.md — "never be over-deducted again"]
- [Source: apps/server/src/services/reportPdfComponents.tsx:19-23 — Crest base64 loading pattern]
- [Source: apps/server/src/services/reportPdfComponents.tsx:240-289 — ReportHeader, ReportPageWrapper]
- [Source: apps/server/src/services/executiveSummaryPdf.tsx — Complete PDF generation pattern]
- [Source: apps/server/src/routes/reportRoutes.ts:158-183 — PDF serving endpoint pattern]
- [Source: apps/server/src/assets/oyo-crest.png — Oyo State Government crest asset]
- [Source: apps/server/src/services/reportPdfComponents.tsx:26-31 — generateReferenceNumber (random UUID-based — do NOT reuse for sequential certificate IDs)]
- [Source: _bmad-output/implementation-artifacts/8-1-zero-balance-detection-auto-stop-trigger.md — loan_completions table, auto-stop trigger]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
