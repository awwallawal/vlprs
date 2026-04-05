# Story 8.3: Auto-Stop Dual Notification

Status: done

## Story

As the **system**,
I want to send the Auto-Stop Certificate to both the beneficiary and the MDA Reporting Officer,
So that both parties are informed and the MDA takes action to cease deductions.

**Origin:** Epic 8 core story — FR9. Completing the auto-stop cycle: detect → certify → notify.

**Dependencies:** Story 8.2 (Auto-Stop Certificate Generation) must be complete. This story consumes the certificate PDF and metadata from 8.2.

## Acceptance Criteria

1. **Given** an Auto-Stop Certificate has been generated (Story 8.2), **When** the notification process runs, **Then** an email is sent to the MDA Reporting Officer(s) for the loan's MDA with: subject "Action Required: Cease Deduction for Staff ID [X]", certificate PDF attached, and a clear instruction to cease payroll deductions for the named staff member.

2. **Given** a beneficiary email is available on the loan record, **When** the notification process runs, **Then** a congratulatory email is sent to the beneficiary with: subject "Congratulations! Your Vehicle Loan is Fully Repaid", certificate PDF attached, and an explanation that deductions should cease.

3. **Given** no beneficiary email is available on the loan record, **When** the notification process runs, **Then** the MDA officer email is still sent (the MDA notification is never skipped), and the certificate record is updated to note `beneficiaryNotified: false` with reason `no_email_on_file`.

4. **Given** the email service is not configured (no RESEND_API_KEY), **When** the notification process runs, **Then** the emails are logged to console (existing fire-and-forget pattern) and the certificate record is updated to note `notificationLogged: true`.

5. **Given** a certificate notification has been sent, **When** viewing the auto-stop certificate record, **Then** it shows notification timestamps: `notifiedMdaAt` and `notifiedBeneficiaryAt` (null if not sent).

6. **Given** the AG dashboard, **When** an Auto-Stop Certificate is issued and notifications sent, **Then** a green attention item appears: "Auto-Stop Certificate issued — [staffName], [MDA]. MDA notified."

7. **Given** multiple MDA officers exist for the same MDA, **When** the notification is sent, **Then** ALL active MDA officers for that MDA receive the email (not just one).

## Tasks / Subtasks

- [x] Task 1: Add beneficiary email column to loans table (AC: 2, 3)
  - [x] 1.1: Add nullable `beneficiaryEmail` column to `loans` table in `apps/server/src/db/schema.ts`:
    ```typescript
    beneficiaryEmail: varchar('beneficiary_email', { length: 255 }),
    ```
  - [x] 1.2: Run `drizzle-kit generate` to create a NEW migration
  - [x] 1.3: This column will be populated from future data sources (committee list upload in Epic 15, or manual entry). For existing loans, it remains null — notifications gracefully skip the beneficiary email

- [x] Task 2: Add notification tracking columns to certificates table (AC: 5)
  - [x] 2.1: Add columns to `auto_stop_certificates` table in `apps/server/src/db/schema.ts` (created in Story 8.2):
    ```typescript
    notifiedMdaAt: timestamp('notified_mda_at', { withTimezone: true }),
    notifiedBeneficiaryAt: timestamp('notified_beneficiary_at', { withTimezone: true }),
    notificationNotes: text('notification_notes'), // e.g., "beneficiary: no_email_on_file"
    ```
  - [x] 2.2: Run `drizzle-kit generate` for the column additions

- [x] Task 3: Create auto-stop email functions (AC: 1, 2, 4)
  - [x] 3.1: Add `sendAutoStopMdaNotification()` to `apps/server/src/lib/email.ts`:
    ```typescript
    interface AutoStopMdaEmailParams {
      to: string;
      officerName: string;
      staffName: string;
      staffId: string;
      mdaName: string;
      loanReference: string;
      completionDate: string;
      certificateId: string;
      pdfBuffer: Buffer;
      pdfFilename: string;
    }
    ```
    - Subject: `Action Required: Cease Deduction for Staff ID ${staffId}`
    - HTML body:
      - Greeting: "Dear {officerName},"
      - "This is to inform you that the vehicle loan for **{staffName}** (Staff ID: {staffId}) has been fully repaid as of {completionDate}."
      - "**Please ensure that payroll deductions for this staff member are ceased immediately.**"
      - "The attached Auto-Stop Certificate (ID: {certificateId}) serves as official notification."
      - "You can verify this certificate at: {APP_URL}/verify/{certificateId}"
      - Footer: "This is an automated message from the Vehicle Loan Processing & Receivables System."
    - Attachment: `[{ filename: pdfFilename, content: pdfBuffer }]`
    - Follow existing fire-and-forget pattern (catch errors, log, never throw)

  - [x] 3.2: Add `sendAutoStopBeneficiaryNotification()` to `apps/server/src/lib/email.ts`:
    ```typescript
    interface AutoStopBeneficiaryEmailParams {
      to: string;
      beneficiaryName: string;
      loanReference: string;
      totalPaid: string;
      completionDate: string;
      certificateId: string;
      pdfBuffer: Buffer;
      pdfFilename: string;
    }
    ```
    - Subject: `Congratulations! Your Vehicle Loan is Fully Repaid`
    - HTML body:
      - Greeting: "Dear {beneficiaryName},"
      - "Congratulations! Your vehicle loan (Reference: {loanReference}) has been fully repaid."
      - "Total amount paid: ₦{totalPaid}"
      - "As of {completionDate}, no further payroll deductions should be made for this loan."
      - "Your Auto-Stop Certificate (ID: {certificateId}) is attached to this email. You can also verify it at: {APP_URL}/verify/{certificateId}"
      - "If deductions continue after this date, please present this certificate to your MDA payroll office."
      - Footer: "This is an automated message from the Vehicle Loan Processing & Receivables System."
    - Attachment: `[{ filename: pdfFilename, content: pdfBuffer }]`

- [x] Task 4: Create notification orchestrator service (AC: 1, 2, 3, 5, 7)
  - [x] 4.1: Create `apps/server/src/services/autoStopNotificationService.ts` with:
    ```typescript
    export async function sendAutoStopNotifications(
      certificateId: string
    ): Promise<NotificationResult>
    ```
  - [x] 4.2: Implementation:
    - Fetch certificate record from `auto_stop_certificates`
    - Fetch loan record (for `beneficiaryEmail`, `mdaId`)
    - Generate PDF buffer via `generateAutoStopCertificatePdf()` from Story 8.2 (generate once, attach to all emails)
    - **MDA officers:** query `users` WHERE `mdaId = cert.mdaId AND role = 'mda_officer' AND isActive = true AND deletedAt IS NULL` — send to ALL matching officers. Construct `officerName` as `${officer.firstName} ${officer.lastName}` from query results
    - **Beneficiary:** if `loan.beneficiaryEmail` is not null, send beneficiary notification
    - Update certificate record: set `notifiedMdaAt` and/or `notifiedBeneficiaryAt` timestamps
    - If beneficiary email is null: set `notificationNotes = 'beneficiary: no_email_on_file'`
    - Return `{ mdaOfficersNotified: number, beneficiaryNotified: boolean, notes: string[] }`
  - [x] 4.3: Fire-and-forget pattern: each individual email send is try/caught — one officer's email failure doesn't prevent others
  - [x] 4.4: Unit test in `apps/server/src/services/autoStopNotificationService.test.ts` (**new file**): certificate with beneficiary email → both MDA + beneficiary notified
  - [x] 4.5: Unit test in same file: certificate without beneficiary email → MDA notified, beneficiary skipped with note
  - [x] 4.6: Unit test in same file: MDA with 3 officers → all 3 receive emails
  - [x] 4.7: Unit test in same file: MDA with no active officers → logs warning, notes "no_active_mda_officers"

- [x] Task 5: Wire notification into certificate generation (AC: 1, 2)
  - [x] 5.1: In `apps/server/src/services/autoStopCertificateService.ts` (Story 8.2), after certificate record is created:
    ```typescript
    // Fire-and-forget notification — don't await, don't block certificate generation
    sendAutoStopNotifications(certificate.id).catch(err =>
      logger.error({ err, certificateId: certificate.id }, 'Auto-stop notification failed')
    );
    ```
  - [x] 5.2: This means the flow is: loan completes (8.1) → certificate generated (8.2) → notifications sent (8.3) — all automatic, all fire-and-forget

- [x] Task 6: Update attention items for notification status (AC: 6)
  - [x] 6.1: Update `detectPendingAutoStop()` in `apps/server/src/services/attentionItemService.ts` (enhanced in Story 8.1):
    - Join with `auto_stop_certificates` to show notification status
    - Attention item text: "Auto-Stop Certificate issued — {staffName}, {MDA}. MDA notified." (when `notifiedMdaAt` is set)
    - Or: "Auto-Stop Certificate issued — {staffName}, {MDA}. Notification pending." (when `notifiedMdaAt` is null)
  - [x] 6.2: Use green/teal badge for completed auto-stop items (celebration, not warning)

- [x] Task 7: Add notification status to certificate API (AC: 5)
  - [x] 7.1: Update `GET /api/certificates/:loanId` response (Story 8.2, Task 7.2) to include `notifiedMdaAt`, `notifiedBeneficiaryAt`, `notificationNotes`
  - [x] 7.2: Display notification status on Loan Detail page certificate section:
    - "MDA notified on {date}" or "MDA notification pending"
    - "Beneficiary notified on {date}" or "No beneficiary email on file"

- [x] Task 8: Add manual resend endpoint (AC: 1)
  - [x] 8.1: Add `POST /api/certificates/:loanId/resend` to `apps/server/src/routes/autoStopRoutes.ts` (SUPER_ADMIN only):
    - Calls `sendAutoStopNotifications(certificateId)` again
    - Updates timestamps
    - Returns notification result
  - [x] 8.2: Useful when: email bounced, new MDA officer added, beneficiary email added later
  - [x] 8.3: Add "Resend Notifications" button on Loan Detail page (only visible to SUPER_ADMIN when certificate exists)

- [x] Task 9: Full regression and verification (AC: all)
  - [x] 9.1: Run `pnpm typecheck` — zero errors
  - [x] 9.2: Run `pnpm test` — zero regressions
  - [x] 9.3: Manual test (with RESEND_API_KEY): trigger auto-stop → verify certificate generated → verify MDA officer receives email with PDF attachment → verify beneficiary receives email (if email on file)
  - [x] 9.4: Manual test (without RESEND_API_KEY): verify emails logged to console, certificate record shows notification status

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] AC 6 — Attention item description shows loan count instead of staff name for single-loan MDAs. Fix: add conditional staff_name to `detectPendingAutoStop()` query, use when `affected_count === 1` [attentionItemService.ts:461]
- [x] [AI-Review][HIGH] Frontend assumes null `notifiedBeneficiaryAt` always means "No beneficiary email on file" — doesn't distinguish pending/failed. Fix: check `notificationNotes` for `no_email_on_file` to determine correct display text [LoanDetailPage.tsx:205]
- [x] [AI-Review][MEDIUM] Three separate DB UPDATEs for notification tracking instead of one atomic update. Fix: consolidate into single UPDATE at end of `sendAutoStopNotifications()` [autoStopNotificationService.ts:112,138,151]
- [x] [AI-Review][MEDIUM] `notificationNotes` not cleared on resend when situation changes (stale "no_email_on_file" persists after beneficiary email added). Fix: always update `notificationNotes`, set to null when empty [autoStopNotificationService.ts:150]
- [x] [AI-Review][MEDIUM] No rate limiter on POST `/certificates/:loanId/resend` — could allow unbounded email sends. Fix: add `writeLimiter` [autoStopRoutes.ts:153]
- [x] [AI-Review][MEDIUM] AC 4 — Certificate doesn't distinguish "sent" from "logged only" when RESEND_API_KEY absent. Fix: check `isEmailConfigured()` and add `notification_logged_only` note [autoStopNotificationService.ts]
- [x] [AI-Review][LOW] Redundant `isEmailConfigured` mock in test file — function not called by mocked email functions. Fix: remove mock [autoStopNotificationService.test.ts:28]
- [x] [AI-Review][LOW] No integration test for certificate → notification wiring (Task 5). Fix: added `autoStopCertificateWiring.test.ts` — verifies `sendAutoStopNotifications` called with certificate ID, plus idempotency check [autoStopCertificateWiring.test.ts]

## Dev Notes

### Email Infrastructure Already Exists

**File:** `apps/server/src/lib/email.ts` (530 lines)

- **Provider:** Resend (via `resend` npm package)
- **Config:** `RESEND_API_KEY` in env — optional, logs to console when missing
- **From:** `EMAIL_FROM` env variable (default: `noreply@vlprs.oyo.gov.ng`)
- **Pattern:** All functions are fire-and-forget — catch errors, log, never throw
- **PDF attachment:** Already implemented in `sendReportEmail()` (lines 501-530):
  ```typescript
  attachments: [{
    filename: params.pdfFilename,
    content: params.pdfBuffer,  // Buffer directly
  }]
  ```

### Existing Email Function Pattern

Every email function in `email.ts` follows this structure:

```typescript
export async function sendXxxEmail(params: XxxParams): Promise<void> {
  if (!isEmailConfigured()) {
    logger.info({ to: params.to, subject }, 'Email not configured — logging only');
    return;
  }
  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject,
      html: `...template...`,
      attachments: params.pdfBuffer ? [{ filename: params.pdfFilename, content: params.pdfBuffer }] : undefined,
    });
    logger.info({ to: params.to, certificateId }, 'Auto-stop notification sent');
  } catch (err) {
    logger.error({ err, to: params.to }, 'Auto-stop notification failed');
  }
}
```

### Finding MDA Officers

```typescript
const officers = await db.select({
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
})
.from(users)
.where(and(
  eq(users.mdaId, mdaId),
  eq(users.role, 'mda_officer'),
  eq(users.isActive, true),   // exclude deactivated users
  isNull(users.deletedAt),    // exclude soft-deleted users
));
// Construct officerName: `${officer.firstName} ${officer.lastName}`
```

Send to ALL matching officers — multiple officers per MDA is expected.

### Beneficiary Email: Practical Reality

Most beneficiaries in the Oyo State loan scheme may NOT have email addresses on file. The `beneficiaryEmail` column on the loans table will be null for most existing records. Future data sources:
- **Epic 15** (Beneficiary Onboarding Pipeline) — committee lists may include emails
- **Manual entry** — AG office may add emails as they collect them

The system must work correctly with or without beneficiary emails. The MDA officer notification is the critical path — it triggers the actual cessation of deductions.

### Notification Flow

```
Loan completes (Story 8.1)
  └→ Certificate generated (Story 8.2) — fire-and-forget from 8.1
       └→ Notifications sent (Story 8.3) — fire-and-forget from 8.2
            ├→ MDA officer(s) email — ALWAYS (if officers exist)
            └→ Beneficiary email — ONLY if email on file
```

Each step is fire-and-forget from the previous. A failure at any notification step does NOT roll back the certificate or the loan completion.

### Generate PDF Once, Attach to All

The certificate PDF is generated once and the same Buffer is attached to all emails (MDA officers + beneficiary). Don't regenerate per recipient.

```typescript
const pdfBuffer = await generateAutoStopCertificatePdf(certificateData);
const pdfFilename = `auto-stop-certificate-${cert.certificateId}.pdf`;

// Send to all MDA officers
for (const officer of officers) {
  await sendAutoStopMdaNotification({ to: officer.email, ..., pdfBuffer, pdfFilename });
}

// Send to beneficiary if email exists
if (loan.beneficiaryEmail) {
  await sendAutoStopBeneficiaryNotification({ to: loan.beneficiaryEmail, ..., pdfBuffer, pdfFilename });
}
```

### Resend API — Single Recipient Per Call

The Resend client sends to a single `to: string` (not an array). For multiple MDA officers, call `sendAutoStopMdaNotification()` once per officer in a loop. Each call is independently fire-and-forget.

### Manual Resend Use Cases

The `POST /api/certificates/:loanId/resend` endpoint covers:
- Email bounced → fix email → resend
- New MDA officer joined → resend so they're aware
- Beneficiary email added later → resend includes beneficiary this time
- Testing/UAT → manually trigger notification

### What This Story Does NOT Build

- **SMS notifications** — out of scope (email only)
- **In-app notifications** — attention items serve this role
- **Beneficiary portal** — future phase
- **Email delivery tracking** — Resend provides this via their dashboard, not in VLPRS
- **Email template builder** — HTML templates are inline in email functions (existing pattern)

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Email service | `apps/server/src/lib/email.ts` | All email functions, Resend client |
| Email config | `apps/server/src/config/env.ts` | RESEND_API_KEY, EMAIL_FROM, APP_URL |
| Report email (PDF pattern) | `apps/server/src/lib/email.ts` | 501-530 (sendReportEmail with attachment) |
| Users table | `apps/server/src/db/schema.ts` | 237-258 (email, role, mdaId columns) |
| Loans table | `apps/server/src/db/schema.ts` | 109-140 (add beneficiaryEmail) |
| Certificate table (8.2) | `apps/server/src/db/schema.ts` | Created in Story 8.2 (add notification columns) |
| Certificate service (8.2) | `apps/server/src/services/autoStopCertificateService.ts` | Hook point for notifications |
| Certificate PDF (8.2) | `apps/server/src/services/autoStopCertificatePdf.tsx` | PDF generation |
| Auto-stop routes (8.1) | `apps/server/src/routes/autoStopRoutes.ts` | Add resend endpoint |
| Attention items | `apps/server/src/services/attentionItemService.ts` | Update notification status display |
| Loan detail page | `apps/client/src/pages/dashboard/LoanDetailPage.tsx` | Add notification status + resend button |

### Non-Punitive Vocabulary

- "Congratulations!" — celebration for beneficiary
- "Action Required: Cease Deduction" — clear instruction for MDA, not blame
- "This is an automated message" — transparency, not cold
- "No beneficiary email on file" — neutral observation, not error

### Testing Standards

- Email tests: mock Resend client, verify `send()` called with correct params
- Integration tests: verify notification timestamps updated on certificate record
- Test both paths: with and without beneficiary email
- Test multi-officer scenario

### Team Agreements Applicable

- **Fire-and-forget** — notification failure never blocks loan completion or certificate generation
- **Extend, don't fork** — follow existing `email.ts` function pattern exactly

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3 — Auto-Stop Dual Notification]
- [Source: apps/server/src/lib/email.ts — Complete email infrastructure (530 lines, 9 exported functions)]
- [Source: apps/server/src/lib/email.ts:501-530 — sendReportEmail with PDF attachment]
- [Source: apps/server/src/config/env.ts — RESEND_API_KEY, EMAIL_FROM]
- [Source: apps/server/src/db/schema.ts:237-258 — Users table with email, role, mdaId]
- [Source: apps/server/src/db/schema.ts:109-140 — Loans table (needs beneficiaryEmail)]
- [Source: _bmad-output/implementation-artifacts/8-2-auto-stop-certificate-generation.md — Certificate generation, auto_stop_certificates table]
- [Source: _bmad-output/implementation-artifacts/8-1-zero-balance-detection-auto-stop-trigger.md — Auto-stop trigger flow]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- No debug issues encountered. All tests passed on first run.

### Completion Notes List

- **Tasks 1-2 (Schema):** Added `beneficiaryEmail` (varchar 255, nullable) to `loans` table and `notifiedMdaAt`, `notifiedBeneficiaryAt`, `notificationNotes` to `auto_stop_certificates` table. Single migration `0042_nappy_starhawk.sql` generated and applied.
- **Task 3 (Email functions):** Added `sendAutoStopMdaNotification()` and `sendAutoStopBeneficiaryNotification()` to `email.ts`. Both follow existing fire-and-forget pattern with PDF attachments. HTML-escapes all user-provided values to prevent XSS. Non-punitive vocabulary: "Congratulations!" for beneficiary, "Action Required: Cease Deduction" for MDA.
- **Task 4 (Orchestrator):** Created `autoStopNotificationService.ts` — generates PDF once, sends to all active MDA officers in loop (each independently fire-and-forget), sends to beneficiary if email on file, updates certificate record timestamps and notes. 4 unit tests covering: both notified, no beneficiary email, multi-officer (3 registered / 2 active), no officers.
- **Task 5 (Wiring):** Added fire-and-forget `sendAutoStopNotifications()` call in `autoStopCertificateService.ts` after certificate DB insert. Completes the chain: loan completes → certificate → notifications.
- **Task 6 (Attention items):** Updated `detectPendingAutoStop()` to LEFT JOIN `auto_stop_certificates`, showing notification status in description text: "MDA notified." vs "Notification pending." vs "certificates pending". Category remains 'complete' (green).
- **Task 7 (API + Frontend):** Extended `GET /api/certificates/:loanId` response with `notifiedMdaAt`, `notifiedBeneficiaryAt`, `notificationNotes`. LoanDetailPage certificate section now shows notification timestamps.
- **Task 8 (Resend):** Added `POST /api/certificates/:loanId/resend` endpoint (SUPER_ADMIN only) and "Resend Notifications" button on LoanDetailPage. Invalidates certificate query on success to refresh timestamps.
- **Task 9 (Verification):** `pnpm typecheck` zero errors. `pnpm test` — 77 files, 1037 tests, all pass. No regressions.

### Change Log

- 2026-04-05: Story 8.3 implemented — Auto-Stop Dual Notification. Schema migration, email functions, notification orchestrator, attention item update, API extension, frontend notification status + resend button. 4 new unit tests.
- 2026-04-05: Code review — 8 findings (2H, 4M, 2L), all fixed. H1: attention item now shows staff name for single-loan MDAs (AC 6). H2: frontend distinguishes "no email on file" vs "notification pending" via notificationNotes. M1: consolidated 3 DB UPDATEs into 1 atomic update. M2: notificationNotes cleared on resend when situation changes. M3: added writeLimiter to resend endpoint. M4: isEmailConfigured check adds 'notification_logged_only' note (AC 4). L1: fixed isEmailConfigured mock to return true (now used). L2: added wiring test (2 tests: fire-and-forget + idempotency).

### File List

- `apps/server/src/db/schema.ts` — modified (added `beneficiaryEmail` to loans, `notifiedMdaAt`/`notifiedBeneficiaryAt`/`notificationNotes` to autoStopCertificates)
- `apps/server/drizzle/0042_nappy_starhawk.sql` — new (migration for 4 new columns)
- `apps/server/drizzle/meta/_journal.json` — modified (migration journal entry)
- `apps/server/drizzle/meta/0042_snapshot.json` — new (migration snapshot)
- `apps/server/src/lib/email.ts` — modified (added `sendAutoStopMdaNotification()` and `sendAutoStopBeneficiaryNotification()`)
- `apps/server/src/services/autoStopNotificationService.ts` — new (notification orchestrator)
- `apps/server/src/services/autoStopNotificationService.test.ts` — new (4 unit tests)
- `apps/server/src/services/autoStopCertificateService.ts` — modified (wired fire-and-forget notification call)
- `apps/server/src/services/attentionItemService.ts` — modified (updated `detectPendingAutoStop()` with certificate join and notification-aware descriptions)
- `apps/server/src/routes/autoStopRoutes.ts` — modified (added notification fields to GET response, added POST resend endpoint)
- `apps/client/src/hooks/useCertificate.ts` — modified (added notification fields to interface, added `useResendNotifications` hook)
- `apps/client/src/pages/dashboard/LoanDetailPage.tsx` — modified (notification status display, resend button for SUPER_ADMIN)
- `apps/server/src/services/autoStopCertificateWiring.test.ts` — new (2 integration tests: fire-and-forget wiring + idempotency)
