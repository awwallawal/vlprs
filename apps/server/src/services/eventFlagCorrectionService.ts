import { db } from '../db/index.js';
import { loanEventFlagCorrections, users, employmentEvents } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { AppError } from '../lib/appError.js';
import { VOCABULARY, EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP } from '@vlprs/shared';
import type { EventFlagCorrection, EventFlagCorrectionResponse, EventFlagType } from '@vlprs/shared';
import { validateLoanAccess } from './loanAccessHelper.js';

export async function correctEventFlag(
  loanId: string,
  input: {
    originalEventFlag: EventFlagType;
    newEventFlag: EventFlagType;
    correctionReason: string;
    submissionRowId?: string;
  },
  userId: string,
  mdaScope: string | null,
): Promise<EventFlagCorrectionResponse> {
  const loan = await validateLoanAccess(loanId, mdaScope);

  if (input.originalEventFlag === input.newEventFlag) {
    throw new AppError(400, 'SAME_FLAG', VOCABULARY.CORRECTION_SAME_FLAG);
  }

  if (input.correctionReason.length < 10) {
    throw new AppError(400, 'REASON_TOO_SHORT', VOCABULARY.CORRECTION_REASON_TOO_SHORT);
  }

  const [correction] = await db
    .insert(loanEventFlagCorrections)
    .values({
      loanId,
      staffId: loan.staffId,
      submissionRowId: input.submissionRowId ?? null,
      originalEventFlag: input.originalEventFlag,
      newEventFlag: input.newEventFlag,
      correctionReason: input.correctionReason,
      correctedBy: userId,
    })
    .returning();

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // AC 6: Check if new flag maps to an employment event type
  const mapped = EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP[input.newEventFlag as keyof typeof EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP];
  let suggestCreateEvent: boolean | undefined;
  let suggestedEventType: string | undefined;

  if (mapped) {
    const eventType = Array.isArray(mapped) ? mapped[0] : mapped;
    // Check if a matching employment event already exists for this loan
    const [existingEvent] = await db
      .select({ id: employmentEvents.id })
      .from(employmentEvents)
      .where(
        and(
          eq(employmentEvents.loanId, loanId),
          eq(employmentEvents.eventType, eventType),
        ),
      )
      .limit(1);

    if (!existingEvent) {
      suggestCreateEvent = true;
      suggestedEventType = eventType;
    }
  }

  return {
    id: correction.id,
    loanId: correction.loanId,
    staffId: correction.staffId,
    submissionRowId: correction.submissionRowId,
    originalEventFlag: correction.originalEventFlag as EventFlagType,
    newEventFlag: correction.newEventFlag as EventFlagType,
    correctionReason: correction.correctionReason,
    correctedBy: { userId, name: user ? `${user.firstName} ${user.lastName}` : 'Unknown' },
    createdAt: correction.createdAt.toISOString(),
    suggestCreateEvent,
    suggestedEventType,
  };
}

export async function getCorrections(
  loanId: string,
  mdaScope: string | null,
): Promise<EventFlagCorrection[]> {
  await validateLoanAccess(loanId, mdaScope);

  const rows = await db
    .select({
      id: loanEventFlagCorrections.id,
      loanId: loanEventFlagCorrections.loanId,
      staffId: loanEventFlagCorrections.staffId,
      submissionRowId: loanEventFlagCorrections.submissionRowId,
      originalEventFlag: loanEventFlagCorrections.originalEventFlag,
      newEventFlag: loanEventFlagCorrections.newEventFlag,
      correctionReason: loanEventFlagCorrections.correctionReason,
      correctedBy: loanEventFlagCorrections.correctedBy,
      createdAt: loanEventFlagCorrections.createdAt,
      correctorFirstName: users.firstName,
      correctorLastName: users.lastName,
    })
    .from(loanEventFlagCorrections)
    .innerJoin(users, eq(loanEventFlagCorrections.correctedBy, users.id))
    .where(eq(loanEventFlagCorrections.loanId, loanId))
    .orderBy(desc(loanEventFlagCorrections.createdAt));

  return rows.map((r) => ({
    id: r.id,
    loanId: r.loanId,
    staffId: r.staffId,
    submissionRowId: r.submissionRowId,
    originalEventFlag: r.originalEventFlag as EventFlagType,
    newEventFlag: r.newEventFlag as EventFlagType,
    correctionReason: r.correctionReason,
    correctedBy: { userId: r.correctedBy, name: `${r.correctorFirstName} ${r.correctorLastName}` },
    createdAt: r.createdAt.toISOString(),
  }));
}
