import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks (must be before imports) ─────────────────────

// Mock db for resolveDiscrepancy (which uses module-level db import)
const mockDbChain = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

vi.mock('../db/index', () => ({
  db: {
    select: (...args: unknown[]) => mockDbChain.select(...args),
    update: (...args: unknown[]) => mockDbChain.update(...args),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Imports (after mocks) ───────────────────────────────────────────

import { EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP } from '@vlprs/shared';
import type { EventFlagType } from '@vlprs/shared';
import { reconcileSubmission, resolveDiscrepancy } from './reconciliationEngine';
import { AppError } from '../lib/appError';

// ─── Mock tx factory for reconcileSubmission ─────────────────────────

/**
 * Builds a mock Drizzle transaction handle that returns sequential
 * query results for each `.select().from().where()` chain, and
 * tracks `.update().set().where()` calls.
 *
 * Query order in reconcileSubmission:
 *   [0] submission_rows WHERE event_flag != NONE  → CSV event rows
 *   [1] employment_events WHERE UNCONFIRMED       → employment events
 *   [2] loans WHERE staffId IN (...)              → staff names
 * Updates: matched batch, discrepancy batch
 */
function buildMockTx(selectResults: unknown[][]) {
  let selectIdx = 0;
  const updateCalls: Array<{ setArg: unknown; whereArg: unknown }> = [];

  const tx = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => {
          const result = selectResults[selectIdx++] ?? [];
          return Promise.resolve(result);
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((setArg: unknown) => ({
        where: vi.fn().mockImplementation((whereArg: unknown) => {
          updateCalls.push({ setArg, whereArg });
          return Promise.resolve(undefined);
        }),
      })),
    })),
  };

  return { tx, updateCalls };
}

// ─── Reset mocks between tests ───────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helper to wire db mock chain for resolveDiscrepancy ─────────────

function wireDbChain(selectResult: unknown[], limitResult?: unknown[]) {
  // select -> from -> where -> limit chain
  mockDbChain.limit.mockResolvedValue(limitResult ?? selectResult);
  mockDbChain.where.mockReturnValue({ limit: mockDbChain.limit });
  mockDbChain.from.mockReturnValue({ where: mockDbChain.where });
  mockDbChain.select.mockReturnValue({ from: mockDbChain.from });

  // update -> set -> where chain
  mockDbChain.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockDbChain.update.mockReturnValue({ set: mockDbChain.set });
}

// =====================================================================
// EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP Tests (kept — tests a real constant)
// =====================================================================

describe('EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP', () => {
  it('maps all 11 real EventFlagType values (excluding NONE) to correct EmploymentEventType', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.RETIREMENT).toBe('RETIRED');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.DEATH).toBe('DECEASED');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.SUSPENSION).toBe('SUSPENDED');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.ABSCONDED).toBe('ABSCONDED');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.TRANSFER_OUT).toBe('TRANSFERRED_OUT');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.TRANSFER_IN).toBe('TRANSFERRED_IN');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.REINSTATEMENT).toBe('REINSTATED');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.DISMISSAL).toBe('DISMISSED');
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.SERVICE_EXTENSION).toBe('SERVICE_EXTENSION');
  });

  it('maps NONE to null (skip reconciliation)', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.NONE).toBeNull();
  });

  it('maps LEAVE_WITHOUT_PAY to [LWOP_START, LWOP_END] array', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.LEAVE_WITHOUT_PAY).toEqual(['LWOP_START', 'LWOP_END']);
  });

  it('covers all 12 EventFlagType values (11 + NONE)', () => {
    const allFlags: EventFlagType[] = [
      'NONE', 'RETIREMENT', 'DEATH', 'SUSPENSION', 'TRANSFER_OUT',
      'TRANSFER_IN', 'LEAVE_WITHOUT_PAY', 'REINSTATEMENT',
      'ABSCONDED', 'SERVICE_EXTENSION', 'DISMISSAL',
    ];
    for (const flag of allFlags) {
      expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP).toHaveProperty(flag);
    }
    expect(Object.keys(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP)).toHaveLength(allFlags.length);
  });

  it('ABSCONDED CSV flag maps to ABSCONDED mid-cycle event (1:1)', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.ABSCONDED).toBe('ABSCONDED');
  });

  it('SERVICE_EXTENSION CSV flag maps to SERVICE_EXTENSION mid-cycle event (1:1)', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.SERVICE_EXTENSION).toBe('SERVICE_EXTENSION');
  });

  it('REINSTATEMENT CSV flag maps to REINSTATED mid-cycle event', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.REINSTATEMENT).toBe('REINSTATED');
  });

  it('TRANSFER_IN CSV flag maps to TRANSFERRED_IN mid-cycle event', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.TRANSFER_IN).toBe('TRANSFERRED_IN');
  });

  it('DISMISSAL CSV flag maps to DISMISSED mid-cycle event (renamed from TERMINATION)', () => {
    expect(EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP.DISMISSAL).toBe('DISMISSED');
  });
});

// =====================================================================
// reconcileSubmission Tests (calls the real function with mock tx)
// =====================================================================

describe('reconcileSubmission', () => {
  const SUB_ID = 'sub-001';
  const MDA_ID = 'mda-001';

  it('returns zero counts and empty details when no event-flagged rows exist', async () => {
    const { tx } = buildMockTx([
      [], // Query 1: no CSV event rows
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts).toEqual({
      matched: 0,
      dateDiscrepancy: 0,
      unconfirmed: 0,
      newCsvEvent: 0,
    });
    expect(result.details).toEqual([]);
  });

  it('matched event: same staff + mapped type + dates within 7 days → counts.matched = 1', async () => {
    const { tx } = buildMockTx([
      // Query 1: CSV event rows
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'RETIREMENT', eventDate: new Date('2026-03-10') }],
      // Query 2: employment events (UNCONFIRMED)
      [{ id: 'evt-1', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-03-08'), loanId: 'loan-1' }],
      // Query 3: loans (staff names)
      [{ staffId: 'STAFF-001', staffName: 'John Doe' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.matched).toBe(1);
    expect(result.counts.dateDiscrepancy).toBe(0);
    expect(result.counts.newCsvEvent).toBe(0);
    expect(result.counts.unconfirmed).toBe(0);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].reconciliationStatus).toBe('matched');
    expect(result.details[0].staffName).toBe('John Doe');
    expect(result.details[0].daysDifference).toBe(2);
    expect(result.details[0].employmentEventId).toBe('evt-1');
  });

  it('date discrepancy: same staff + mapped type + dates > 7 days → counts.dateDiscrepancy = 1', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'RETIREMENT', eventDate: new Date('2026-03-20') }],
      [{ id: 'evt-1', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-03-01'), loanId: 'loan-1' }],
      [{ staffId: 'STAFF-001', staffName: 'Jane Doe' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.dateDiscrepancy).toBe(1);
    expect(result.counts.matched).toBe(0);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].reconciliationStatus).toBe('date_discrepancy');
    expect(result.details[0].daysDifference).toBe(19);
  });

  it('unconfirmed event: employment event with no CSV match → counts.unconfirmed = 1', async () => {
    // CSV has a DEATH event for STAFF-001, but employment events has a RETIRED event for STAFF-002
    const { tx } = buildMockTx([
      // Query 1: CSV event rows — STAFF-001 with DEATH flag
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'DEATH', eventDate: new Date('2026-03-10') }],
      // Query 2: employment events — includes STAFF-001 DECEASED + STAFF-002 RETIRED (no CSV match)
      [
        { id: 'evt-1', staffId: 'STAFF-001', eventType: 'DECEASED', effectiveDate: new Date('2026-03-09'), loanId: 'loan-1' },
        { id: 'evt-2', staffId: 'STAFF-002', eventType: 'RETIRED', effectiveDate: new Date('2026-03-05'), loanId: 'loan-2' },
      ],
      // Query 3: staff names
      [
        { staffId: 'STAFF-001', staffName: 'Alice' },
        { staffId: 'STAFF-002', staffName: 'Bob' },
      ],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.matched).toBe(1);       // STAFF-001 DECEASED matched
    expect(result.counts.unconfirmed).toBe(1);    // STAFF-002 RETIRED had no CSV match
    expect(result.details).toHaveLength(2);

    const unconfirmedDetail = result.details.find(d => d.reconciliationStatus === 'unconfirmed_event');
    expect(unconfirmedDetail).toBeDefined();
    expect(unconfirmedDetail!.staffId).toBe('STAFF-002');
    expect(unconfirmedDetail!.employmentEventId).toBe('evt-2');
    expect(unconfirmedDetail!.csvEventDate).toBeNull();
  });

  it('new CSV event: CSV row with event flag but no matching employment event → counts.newCsvEvent = 1', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'SUSPENSION', eventDate: new Date('2026-03-10') }],
      [], // No employment events at all
      [{ staffId: 'STAFF-001', staffName: 'Charlie' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.newCsvEvent).toBe(1);
    expect(result.counts.matched).toBe(0);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].reconciliationStatus).toBe('new_csv_event');
    expect(result.details[0].employmentEventId).toBeNull();
    expect(result.details[0].eventType).toBe('SUSPENDED');
  });

  it('NONE event flag rows are skipped — do not appear in results', async () => {
    // The query itself filters out NONE via SQL WHERE clause.
    // But if one somehow arrives, the mapping returns null and it is skipped.
    // We verify by sending a NONE-flagged row alongside a real one.
    const { tx } = buildMockTx([
      [
        { id: 'row-1', staffId: 'STAFF-001', eventFlag: 'NONE', eventDate: null },
        { id: 'row-2', staffId: 'STAFF-002', eventFlag: 'DEATH', eventDate: new Date('2026-03-10') },
      ],
      [], // No employment events
      [{ staffId: 'STAFF-002', staffName: 'Dave' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    // NONE row skipped, DEATH row counted as new_csv_event
    expect(result.counts.newCsvEvent).toBe(1);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].staffId).toBe('STAFF-002');
  });

  it('LEAVE_WITHOUT_PAY maps to LWOP_START first, falls back to LWOP_END', async () => {
    // Only an LWOP_END event exists → the function should try LWOP_START first (no match),
    // then find LWOP_END
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'LEAVE_WITHOUT_PAY', eventDate: new Date('2026-03-10') }],
      [{ id: 'evt-1', staffId: 'STAFF-001', eventType: 'LWOP_END', effectiveDate: new Date('2026-03-12'), loanId: 'loan-1' }],
      [{ staffId: 'STAFF-001', staffName: 'Eve' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.matched).toBe(1);
    expect(result.details[0].eventType).toBe('LWOP_END');
    expect(result.details[0].reconciliationStatus).toBe('matched');
  });

  it('LEAVE_WITHOUT_PAY prefers LWOP_START when both exist', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'LEAVE_WITHOUT_PAY', eventDate: new Date('2026-03-10') }],
      [
        { id: 'evt-1', staffId: 'STAFF-001', eventType: 'LWOP_START', effectiveDate: new Date('2026-03-09'), loanId: 'loan-1' },
        { id: 'evt-2', staffId: 'STAFF-001', eventType: 'LWOP_END', effectiveDate: new Date('2026-03-11'), loanId: 'loan-1' },
      ],
      [{ staffId: 'STAFF-001', staffName: 'Eve' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    // Should match LWOP_START (the first mapped type tried)
    expect(result.counts.matched).toBe(1);
    expect(result.details[0].eventType).toBe('LWOP_START');

    // LWOP_END should remain unconfirmed (leftover in map)
    expect(result.counts.unconfirmed).toBe(1);
    const unconfirmed = result.details.find(d => d.reconciliationStatus === 'unconfirmed_event');
    expect(unconfirmed?.eventType).toBe('LWOP_END');
  });

  it('null event_date with non-NONE flag → DATE_DISCREPANCY', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'RETIREMENT', eventDate: null }],
      [{ id: 'evt-1', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-03-10'), loanId: 'loan-1' }],
      [{ staffId: 'STAFF-001', staffName: 'Frank' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.dateDiscrepancy).toBe(1);
    expect(result.counts.matched).toBe(0);
    expect(result.details[0].reconciliationStatus).toBe('date_discrepancy');
    expect(result.details[0].daysDifference).toBeNull();
  });

  it('duplicate employment events (same staff+type) — ALL evaluated independently', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'RETIREMENT', eventDate: new Date('2026-03-10') }],
      [
        { id: 'evt-1', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-03-08'), loanId: 'loan-1' },
        { id: 'evt-2', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-02-01'), loanId: 'loan-2' },
      ],
      [{ staffId: 'STAFF-001', staffName: 'Grace' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    // evt-1: 2 days diff → MATCHED. evt-2: 37 days diff → DATE_DISCREPANCY
    expect(result.counts.matched).toBe(1);
    expect(result.counts.dateDiscrepancy).toBe(1);
    expect(result.details).toHaveLength(2);

    const matched = result.details.find(d => d.employmentEventId === 'evt-1');
    const discrepancy = result.details.find(d => d.employmentEventId === 'evt-2');
    expect(matched!.reconciliationStatus).toBe('matched');
    expect(discrepancy!.reconciliationStatus).toBe('date_discrepancy');
  });

  it('boundary: exactly 7 days difference = MATCHED', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'DEATH', eventDate: new Date('2026-03-17') }],
      [{ id: 'evt-1', staffId: 'STAFF-001', eventType: 'DECEASED', effectiveDate: new Date('2026-03-10'), loanId: 'loan-1' }],
      [{ staffId: 'STAFF-001', staffName: 'Hank' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.matched).toBe(1);
    expect(result.details[0].daysDifference).toBe(7);
    expect(result.details[0].reconciliationStatus).toBe('matched');
  });

  it('boundary: 8 days difference = DATE_DISCREPANCY', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-001', eventFlag: 'DEATH', eventDate: new Date('2026-03-18') }],
      [{ id: 'evt-1', staffId: 'STAFF-001', eventType: 'DECEASED', effectiveDate: new Date('2026-03-10'), loanId: 'loan-1' }],
      [{ staffId: 'STAFF-001', staffName: 'Ivy' }],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.dateDiscrepancy).toBe(1);
    expect(result.details[0].daysDifference).toBe(8);
    expect(result.details[0].reconciliationStatus).toBe('date_discrepancy');
  });

  it('batch updates: matched IDs updated to MATCHED, discrepancy IDs updated to DATE_DISCREPANCY', async () => {
    const { tx, updateCalls } = buildMockTx([
      [
        { id: 'row-1', staffId: 'STAFF-001', eventFlag: 'RETIREMENT', eventDate: new Date('2026-03-10') },
        { id: 'row-2', staffId: 'STAFF-002', eventFlag: 'DEATH', eventDate: new Date('2026-01-01') },
      ],
      [
        { id: 'evt-1', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-03-09'), loanId: 'loan-1' },
        { id: 'evt-2', staffId: 'STAFF-002', eventType: 'DECEASED', effectiveDate: new Date('2026-03-01'), loanId: 'loan-2' },
      ],
      [
        { staffId: 'STAFF-001', staffName: 'A' },
        { staffId: 'STAFF-002', staffName: 'B' },
      ],
    ]);

    await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    // Should have called update twice: once for matched, once for discrepancy
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(updateCalls).toHaveLength(2);
  });

  it('mixed scenario: matched + new_csv_event + unconfirmed in one submission', async () => {
    const { tx } = buildMockTx([
      // CSV rows: STAFF-001 RETIREMENT, STAFF-003 SUSPENSION
      [
        { id: 'row-1', staffId: 'STAFF-001', eventFlag: 'RETIREMENT', eventDate: new Date('2026-03-10') },
        { id: 'row-2', staffId: 'STAFF-003', eventFlag: 'SUSPENSION', eventDate: new Date('2026-03-15') },
      ],
      // Employment events: STAFF-001 RETIRED (match), STAFF-002 DECEASED (no CSV match)
      [
        { id: 'evt-1', staffId: 'STAFF-001', eventType: 'RETIRED', effectiveDate: new Date('2026-03-09'), loanId: 'loan-1' },
        { id: 'evt-2', staffId: 'STAFF-002', eventType: 'DECEASED', effectiveDate: new Date('2026-03-01'), loanId: 'loan-2' },
      ],
      // Staff names
      [
        { staffId: 'STAFF-001', staffName: 'A' },
        { staffId: 'STAFF-002', staffName: 'B' },
        { staffId: 'STAFF-003', staffName: 'C' },
      ],
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.counts.matched).toBe(1);       // STAFF-001 RETIRED ↔ RETIRED
    expect(result.counts.newCsvEvent).toBe(1);    // STAFF-003 SUSPENSION → no employment event
    expect(result.counts.unconfirmed).toBe(1);    // STAFF-002 DECEASED → no CSV match
    expect(result.details).toHaveLength(3);
  });

  it('staffName defaults to "Unknown" when loan record is missing', async () => {
    const { tx } = buildMockTx([
      [{ id: 'row-1', staffId: 'STAFF-GHOST', eventFlag: 'DEATH', eventDate: new Date('2026-03-10') }],
      [], // No employment events
      [], // No loan records for staff name lookup
    ]);

    const result = await reconcileSubmission(SUB_ID, MDA_ID, tx as any);

    expect(result.details[0].staffName).toBe('Unknown');
  });
});

// =====================================================================
// resolveDiscrepancy Tests (calls the real function with mocked db)
// =====================================================================

describe('resolveDiscrepancy', () => {
  it('resolves DATE_DISCREPANCY → MATCHED', async () => {
    wireDbChain([{ id: 'evt-1', reconciliationStatus: 'DATE_DISCREPANCY' }]);

    const result = await resolveDiscrepancy(
      'evt-1',
      'MATCHED',
      'Confirmed via payroll department records',
      'user-001',
    );

    expect(result).toEqual({ id: 'evt-1', reconciliationStatus: 'MATCHED' });
    expect(mockDbChain.update).toHaveBeenCalled();
  });

  it('resolves DATE_DISCREPANCY → UNCONFIRMED', async () => {
    wireDbChain([{ id: 'evt-1', reconciliationStatus: 'DATE_DISCREPANCY' }]);

    const result = await resolveDiscrepancy(
      'evt-1',
      'UNCONFIRMED',
      'Event date does not match department records — rejecting match',
      'user-001',
    );

    expect(result).toEqual({ id: 'evt-1', reconciliationStatus: 'UNCONFIRMED' });
  });

  it('rejects with 422 AppError if current status is not DATE_DISCREPANCY', async () => {
    wireDbChain([{ id: 'evt-1', reconciliationStatus: 'MATCHED' }]);

    await expect(
      resolveDiscrepancy('evt-1', 'MATCHED', 'Some reason that is long enough', 'user-001'),
    ).rejects.toThrow(AppError);

    try {
      await resolveDiscrepancy('evt-1', 'MATCHED', 'Some reason that is long enough', 'user-001');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(422);
      expect((err as AppError).code).toBe('INVALID_RECONCILIATION_STATUS');
    }
  });

  it('rejects with 404 AppError if employment event not found', async () => {
    wireDbChain([]); // Empty result = not found

    await expect(
      resolveDiscrepancy('evt-nonexistent', 'MATCHED', 'Some reason that is long enough', 'user-001'),
    ).rejects.toThrow(AppError);

    try {
      await resolveDiscrepancy('evt-nonexistent', 'MATCHED', 'Some reason that is long enough', 'user-001');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
      expect((err as AppError).code).toBe('EMPLOYMENT_EVENT_NOT_FOUND');
    }
  });
});

// =====================================================================
// resolveDiscrepancySchema validation (kept — tests real Zod schemas)
// =====================================================================

describe('resolveDiscrepancySchema', () => {
  it('accepts MATCHED with valid reason', async () => {
    const { resolveDiscrepancySchema } = await import('@vlprs/shared');
    const result = resolveDiscrepancySchema.safeParse({
      status: 'MATCHED',
      reason: 'Confirmed via payroll department records',
    });
    expect(result.success).toBe(true);
  });

  it('accepts UNCONFIRMED with valid reason', async () => {
    const { resolveDiscrepancySchema } = await import('@vlprs/shared');
    const result = resolveDiscrepancySchema.safeParse({
      status: 'UNCONFIRMED',
      reason: 'Event does not match — rejecting this association',
    });
    expect(result.success).toBe(true);
  });

  it('rejects reason shorter than 10 characters', async () => {
    const { resolveDiscrepancySchema } = await import('@vlprs/shared');
    const result = resolveDiscrepancySchema.safeParse({
      status: 'MATCHED',
      reason: 'Too short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status value', async () => {
    const { resolveDiscrepancySchema } = await import('@vlprs/shared');
    const result = resolveDiscrepancySchema.safeParse({
      status: 'INVALID',
      reason: 'Some reason that is long enough',
    });
    expect(result.success).toBe(false);
  });
});
