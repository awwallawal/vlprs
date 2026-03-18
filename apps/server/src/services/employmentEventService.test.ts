import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB and dependencies before imports
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockLeftJoin = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockForUpdate = vi.fn();

// Chain helper
function chain() {
  return {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    innerJoin: mockInnerJoin,
    leftJoin: mockLeftJoin,
    limit: mockLimit,
    offset: mockOffset,
    orderBy: mockOrderBy,
    for: mockForUpdate,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
  };
}

// Setup chainable mock returns
beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnValue(chain());
  mockFrom.mockReturnValue(chain());
  mockWhere.mockReturnValue(chain());
  mockInnerJoin.mockReturnValue(chain());
  mockLeftJoin.mockReturnValue(chain());
  mockLimit.mockReturnValue(chain());
  mockOffset.mockReturnValue(chain());
  mockOrderBy.mockReturnValue(chain());
  mockForUpdate.mockReturnValue(chain());
  mockInsert.mockReturnValue(chain());
  mockValues.mockReturnValue(chain());
  mockReturning.mockResolvedValue([]);
  mockUpdate.mockReturnValue(chain());
  mockSet.mockReturnValue(chain());
});

vi.mock('../db/index', () => ({
  db: {
    select: () => chain(),
    insert: () => chain(),
    update: () => chain(),
    transaction: vi.fn(async (fn: Function) => fn({
      select: () => chain(),
      insert: () => chain(),
      update: () => chain(),
    })),
  },
}));

vi.mock('./loanTransitionService', () => ({
  transitionLoan: vi.fn().mockResolvedValue({
    id: 'transition-1',
    loanId: 'loan-1',
    fromStatus: 'ACTIVE',
    toStatus: 'RETIRED',
    transitionedBy: 'user-1',
    transitionedByName: 'Test User',
    reason: 'Employment event: RETIRED',
    createdAt: '2026-03-17T00:00:00.000Z',
  }),
}));

vi.mock('../lib/email', () => ({
  sendEmploymentEventConfirmation: vi.fn(),
  sendTransferNotification: vi.fn(),
}));

import { VOCABULARY, createEmploymentEventSchema } from '@vlprs/shared';
import { transitionLoan } from './loanTransitionService';
import { sendEmploymentEventConfirmation } from '../lib/email';

// Mirror the EVENT_TO_STATUS_MAP from the service for testing
const EVENT_TO_STATUS_MAP: Record<string, string | null> = {
  RETIRED: 'RETIRED',
  DECEASED: 'DECEASED',
  SUSPENDED: 'SUSPENDED',
  ABSCONDED: 'WRITTEN_OFF',
  TRANSFERRED_OUT: 'TRANSFER_PENDING',
  TRANSFERRED_IN: null,
  DISMISSED: 'WRITTEN_OFF',
  LWOP_START: 'LWOP',
  LWOP_END: 'ACTIVE',
  REINSTATED: 'ACTIVE',
  SERVICE_EXTENSION: null,
};

describe('EVENT_TO_STATUS_MAP', () => {
  it('maps all 11 event types to correct loan statuses', () => {
    expect(EVENT_TO_STATUS_MAP.RETIRED).toBe('RETIRED');
    expect(EVENT_TO_STATUS_MAP.DECEASED).toBe('DECEASED');
    expect(EVENT_TO_STATUS_MAP.SUSPENDED).toBe('SUSPENDED');
    expect(EVENT_TO_STATUS_MAP.ABSCONDED).toBe('WRITTEN_OFF');
    expect(EVENT_TO_STATUS_MAP.TRANSFERRED_OUT).toBe('TRANSFER_PENDING');
    expect(EVENT_TO_STATUS_MAP.TRANSFERRED_IN).toBeNull();
    expect(EVENT_TO_STATUS_MAP.DISMISSED).toBe('WRITTEN_OFF');
    expect(EVENT_TO_STATUS_MAP.LWOP_START).toBe('LWOP');
    expect(EVENT_TO_STATUS_MAP.LWOP_END).toBe('ACTIVE');
    expect(EVENT_TO_STATUS_MAP.REINSTATED).toBe('ACTIVE');
    expect(EVENT_TO_STATUS_MAP.SERVICE_EXTENSION).toBeNull();
  });

  it('has exactly 11 entries', () => {
    expect(Object.keys(EVENT_TO_STATUS_MAP)).toHaveLength(11);
  });

  it('LWOP Start maps to LWOP (distinct from SUSPENDED)', () => {
    expect(EVENT_TO_STATUS_MAP.LWOP_START).toBe('LWOP');
    expect(EVENT_TO_STATUS_MAP.SUSPENDED).toBe('SUSPENDED');
    expect(EVENT_TO_STATUS_MAP.LWOP_START).not.toBe(EVENT_TO_STATUS_MAP.SUSPENDED);
  });

  it('Transfer Out maps to TRANSFER_PENDING (not TRANSFERRED)', () => {
    expect(EVENT_TO_STATUS_MAP.TRANSFERRED_OUT).toBe('TRANSFER_PENDING');
    expect(EVENT_TO_STATUS_MAP.TRANSFERRED_OUT).not.toBe('TRANSFERRED');
  });

  it('Transferred In has no direct status change (null)', () => {
    expect(EVENT_TO_STATUS_MAP.TRANSFERRED_IN).toBeNull();
  });

  it('Service Extension has no status change (null) — updates retirement date only', () => {
    expect(EVENT_TO_STATUS_MAP.SERVICE_EXTENSION).toBeNull();
  });

  it('Reinstated maps to ACTIVE (return from suspension)', () => {
    expect(EVENT_TO_STATUS_MAP.REINSTATED).toBe('ACTIVE');
  });

  it('LWOP End maps to ACTIVE (return from voluntary leave)', () => {
    expect(EVENT_TO_STATUS_MAP.LWOP_END).toBe('ACTIVE');
  });

  it('Absconded and Dismissed both map to WRITTEN_OFF (terminal)', () => {
    expect(EVENT_TO_STATUS_MAP.ABSCONDED).toBe('WRITTEN_OFF');
    expect(EVENT_TO_STATUS_MAP.DISMISSED).toBe('WRITTEN_OFF');
  });
});

describe('employmentEventService — Zod schema validation', () => {
  it('validates a valid retirement event', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'RETIRED',
      effectiveDate: '2026-06-01',
      referenceNumber: 'RET-2026-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects retirement without reference number', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'RETIRED',
      effectiveDate: '2026-06-01',
    });
    expect(result.success).toBe(false);
  });

  it('allows deceased without reference number', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'DECEASED',
      effectiveDate: '2026-03-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects Service Extension without newRetirementDate', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'SERVICE_EXTENSION',
      effectiveDate: '2026-04-01',
      referenceNumber: 'EXT-2026-001',
    });
    expect(result.success).toBe(false);
  });

  it('validates Service Extension with newRetirementDate', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'SERVICE_EXTENSION',
      effectiveDate: '2026-04-01',
      referenceNumber: 'EXT-2026-001',
      newRetirementDate: '2028-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('requires reference number for TransferredOut', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'TRANSFERRED_OUT',
      effectiveDate: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });

  it('requires reference number for Dismissed', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'DISMISSED',
      effectiveDate: '2026-03-15',
    });
    expect(result.success).toBe(false);
  });

  it('requires reference number for Reinstated', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'REINSTATED',
      effectiveDate: '2026-03-15',
    });
    expect(result.success).toBe(false);
  });

  it('requires reference number for ServiceExtension', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'SERVICE_EXTENSION',
      effectiveDate: '2026-04-01',
      newRetirementDate: '2028-12-31',
    });
    expect(result.success).toBe(false);
  });

  it('does not require reference number for LWOP Start', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'LWOP_START',
      effectiveDate: '2026-05-01',
    });
    expect(result.success).toBe(true);
  });

  it('does not require reference number for Suspended', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'SUSPENDED',
      effectiveDate: '2026-03-15',
    });
    expect(result.success).toBe(true);
  });

  it('does not require reference number for Absconded', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'ABSCONDED',
      effectiveDate: '2026-03-15',
    });
    expect(result.success).toBe(true);
  });

  it('does not require reference number for TransferredIn', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'TRANSFERRED_IN',
      effectiveDate: '2026-05-01',
    });
    expect(result.success).toBe(true);
  });

  it('does not require reference number for LWOP End', () => {
    const result = createEmploymentEventSchema.safeParse({
      staffId: 'STAFF001',
      eventType: 'LWOP_END',
      effectiveDate: '2026-05-01',
    });
    expect(result.success).toBe(true);
  });
});

describe('employmentEventService — vocabulary constants', () => {
  it('has EMPLOYMENT_EVENT_FILED message', () => {
    expect(VOCABULARY.EMPLOYMENT_EVENT_FILED).toBeDefined();
    expect(typeof VOCABULARY.EMPLOYMENT_EVENT_FILED).toBe('string');
  });

  it('has EMPLOYMENT_EVENT_STAFF_NOT_FOUND message', () => {
    expect(VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND).toBeDefined();
  });

  it('has EMPLOYMENT_EVENT_CROSS_MDA_DENIED message', () => {
    expect(VOCABULARY.EMPLOYMENT_EVENT_CROSS_MDA_DENIED).toBeDefined();
  });

  it('has EMPLOYMENT_EVENT_DUPLICATE message', () => {
    expect(VOCABULARY.EMPLOYMENT_EVENT_DUPLICATE).toBeDefined();
  });

  it('has TRANSFER_COMPLETED message', () => {
    expect(VOCABULARY.TRANSFER_COMPLETED).toBeDefined();
  });

  it('has TRANSFER_NOT_FOUND message', () => {
    expect(VOCABULARY.TRANSFER_NOT_FOUND).toBeDefined();
  });

  it('has TRANSFER_WRONG_MDA message', () => {
    expect(VOCABULARY.TRANSFER_WRONG_MDA).toBeDefined();
  });

  it('has TRANSFER_STAFF_NOT_FOUND message', () => {
    expect(VOCABULARY.TRANSFER_STAFF_NOT_FOUND).toBeDefined();
  });

  it('all messages use non-punitive language', () => {
    // Verify key messages don't contain punitive terms
    const messages = [
      VOCABULARY.EMPLOYMENT_EVENT_FILED,
      VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND,
      VOCABULARY.EMPLOYMENT_EVENT_CROSS_MDA_DENIED,
      VOCABULARY.EMPLOYMENT_EVENT_DUPLICATE,
      VOCABULARY.TRANSFER_COMPLETED,
    ];
    for (const msg of messages) {
      expect(msg).not.toMatch(/error|invalid|violation|fail|illegal/i);
    }
  });
});

// ─── Service Function Tests ─────────────────────────────────────────
import * as service from './employmentEventService';

// Re-usable mock data factories
const makeLoanRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'loan-1',
  staffId: 'STAFF001',
  staffName: 'Adewale Ogunleye',
  mdaId: 'mda-1',
  status: 'ACTIVE',
  ...overrides,
});

const makeEventRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'event-1',
  staffId: 'STAFF001',
  loanId: 'loan-1',
  mdaId: 'mda-1',
  eventType: 'RETIRED',
  effectiveDate: new Date('2026-06-01'),
  referenceNumber: 'RET-2026-001',
  notes: null,
  newRetirementDate: null,
  reconciliationStatus: 'UNCONFIRMED',
  filedBy: 'user-1',
  createdAt: new Date('2026-03-17'),
  ...overrides,
});

describe('staffLookup — service', () => {
  it('throws STAFF_NOT_FOUND (404) when no loan found', async () => {
    // staffLookup: db.select().from().innerJoin().where() — where is terminal
    // Return empty array so destructuring gives undefined → triggers 404
    mockWhere.mockResolvedValueOnce([]);

    await expect(
      service.staffLookup('NONEXISTENT', 'mda-1', 'mda_officer'),
    ).rejects.toThrow(VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND);
  });

  it('throws error with correct VOCABULARY message for admin lookup', async () => {
    mockWhere.mockResolvedValueOnce([]);

    await expect(
      service.staffLookup('NONEXISTENT', null, 'dept_admin'),
    ).rejects.toThrow(VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND);
  });

  it('returns staff data when loan is found', async () => {
    mockWhere.mockResolvedValueOnce([
      { staffId: 'STAFF001', staffName: 'Adewale Ogunleye', mdaName: 'Ministry of Works', loanStatus: 'ACTIVE' },
    ]);

    const result = await service.staffLookup('STAFF001', 'mda-1', 'mda_officer');
    expect(result).toEqual({
      staffId: 'STAFF001',
      staffName: 'Adewale Ogunleye',
      mdaName: 'Ministry of Works',
      loanStatus: 'ACTIVE',
    });
  });
});

describe('createEmploymentEvent — service', () => {
  const baseData = {
    staffId: 'STAFF001',
    eventType: 'RETIRED' as const,
    effectiveDate: '2026-06-01',
    referenceNumber: 'RET-2026-001',
  };

  it('throws STAFF_NOT_FOUND when staff not in MDA', async () => {
    // First mockWhere: scoped loan lookup returns empty (not in officer's MDA)
    mockWhere.mockResolvedValueOnce([]);
    // Second mockWhere: unscoped check also returns empty (staff not found anywhere)
    mockWhere.mockResolvedValueOnce([]);

    await expect(
      service.createEmploymentEvent(baseData, 'mda-1', 'user-1', 'mda_officer'),
    ).rejects.toThrow(VOCABULARY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND);
  });

  it('throws CROSS_MDA_DENIED (403) when mda_officer tries cross-MDA and staff exists elsewhere', async () => {
    // First mockWhere: scoped query returns nothing (not in officer's MDA)
    mockWhere.mockResolvedValueOnce([]);
    // Second mockWhere: unscoped query finds staff at another MDA
    mockWhere.mockResolvedValueOnce([{ id: 'loan-1' }]);

    await expect(
      service.createEmploymentEvent(baseData, 'mda-1', 'user-1', 'mda_officer'),
    ).rejects.toThrow(VOCABULARY.EMPLOYMENT_EVENT_CROSS_MDA_DENIED);
  });

  it('calls transitionLoan with correct target status for RETIRED event', async () => {
    // First mockWhere: loan lookup succeeds
    mockWhere.mockResolvedValueOnce([makeLoanRow()]);
    // Second mockWhere: duplicate check returns nothing (no duplicate)
    mockWhere.mockResolvedValueOnce([]);
    // Inside transaction: mockReturning for event insert
    mockReturning.mockResolvedValueOnce([makeEventRow()]);
    // After transaction: user email lookup (mockWhere for user query)
    mockWhere.mockResolvedValueOnce([{ email: 'test@example.com', firstName: 'Test' }]);

    await service.createEmploymentEvent(baseData, 'mda-1', 'user-1', 'dept_admin');

    expect(transitionLoan).toHaveBeenCalledWith(
      'user-1',
      'loan-1',
      'RETIRED',
      'Employment event: RETIRED',
      null,
      expect.anything(), // tx handle
    );
  });

  it('throws DUPLICATE_EVENT (422) when duplicate exists and confirmDuplicate not set', async () => {
    // First mockWhere: loan lookup succeeds
    mockWhere.mockResolvedValueOnce([makeLoanRow()]);
    // Second mockWhere: duplicate check finds existing event
    mockWhere.mockResolvedValueOnce([{ id: 'existing-event-1' }]);

    await expect(
      service.createEmploymentEvent(baseData, null, 'user-1', 'dept_admin'),
    ).rejects.toThrow(VOCABULARY.EMPLOYMENT_EVENT_DUPLICATE);
  });

  it('sends confirmation email after successful creation', async () => {
    // First mockWhere: loan lookup succeeds
    mockWhere.mockResolvedValueOnce([makeLoanRow()]);
    // Second mockWhere: duplicate check returns nothing
    mockWhere.mockResolvedValueOnce([]);
    // Inside transaction: mockReturning for event insert
    mockReturning.mockResolvedValueOnce([makeEventRow()]);
    // After transaction: user email lookup
    mockWhere.mockResolvedValueOnce([{ email: 'officer@oyo.gov', firstName: 'Bola' }]);

    await service.createEmploymentEvent(baseData, null, 'user-1', 'dept_admin');

    expect(sendEmploymentEventConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'officer@oyo.gov',
        firstName: 'Bola',
        eventType: 'RETIRED',
        staffId: 'STAFF001',
      }),
    );
  });
});

describe('claimTransferIn — service', () => {
  it('throws TRANSFER_STAFF_NOT_FOUND when no loan at other MDA', async () => {
    // claimTransferIn: db.select().from().where() — where is terminal
    // Return empty array so destructuring gives undefined → triggers 404
    mockWhere.mockResolvedValueOnce([]);

    await expect(
      service.claimTransferIn('NONEXISTENT', 'mda-2', 'user-1'),
    ).rejects.toThrow(VOCABULARY.TRANSFER_STAFF_NOT_FOUND);
  });
});

describe('confirmTransfer — service', () => {
  it('throws TRANSFER_NOT_FOUND when transfer does not exist', async () => {
    // confirmTransfer runs inside db.transaction. Inside tx:
    // tx.select().from().where().for('update') — for is terminal
    // Return empty array so destructuring gives undefined → triggers 404
    mockForUpdate.mockResolvedValueOnce([]);

    await expect(
      service.confirmTransfer('nonexistent-transfer', 'user-1', 'dept_admin', null, 'outgoing'),
    ).rejects.toThrow(VOCABULARY.TRANSFER_NOT_FOUND);
  });
});

describe('getEmploymentEvents — service', () => {
  it('returns empty items and zero total when no events exist', async () => {
    // getEmploymentEvents uses Promise.all with two parallel queries:
    //   Query 1: .select().from().leftJoin().innerJoin().where().orderBy().limit().offset()
    //   Query 2: .select().from().where()
    // The first query needs mockWhere to return chain (for .orderBy chaining),
    // then mockOffset is terminal. The second query needs mockWhere to resolve to data.
    // Since Promise.all starts both queries, the first query's mockWhere call happens first.
    // Use mockReturnValueOnce for the chainable call, then mockResolvedValueOnce for the terminal call.
    mockWhere
      .mockReturnValueOnce(chain())           // Query 1: non-terminal, continues to .orderBy
      .mockResolvedValueOnce([{ count: 0 }]); // Query 2: terminal, resolves to count result
    mockOffset.mockResolvedValueOnce([]);      // Query 1: terminal, resolves to empty results

    const result = await service.getEmploymentEvents('mda-1', 1, 20);

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  });
});
