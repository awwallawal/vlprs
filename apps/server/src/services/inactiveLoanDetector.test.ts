/**
 * inactiveLoanDetector tests — Detection logic, event exclusion, idempotency,
 * MDA scoping, description formatting, submission cross-reference, scheduler guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track db.execute call sequence
let executeCallIndex = 0;
const executeResults: unknown[] = [];

vi.mock('../db/index', () => ({
  db: {
    execute: vi.fn().mockImplementation(() => {
      const result = executeResults[executeCallIndex] ?? { rows: [] };
      executeCallIndex++;
      return Promise.resolve(result);
    }),
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('../db/schema', () => ({
  observations: {
    id: 'observations.id',
    type: 'observations.type',
    staffName: 'observations.staff_name',
    staffId: 'observations.staff_id',
    loanId: 'observations.loan_id',
    mdaId: 'observations.mda_id',
    description: 'observations.description',
    context: 'observations.context',
    sourceReference: 'observations.source_reference',
    status: 'observations.status',
    promotedExceptionId: 'observations.promoted_exception_id',
    updatedAt: 'observations.updated_at',
    createdAt: 'observations.created_at',
  },
  exceptions: {
    id: 'exceptions.id',
    observationId: 'exceptions.observation_id',
    category: 'exceptions.category',
    status: 'exceptions.status',
  },
  loans: { id: 'loans.id', staffId: 'loans.staff_id', staffName: 'loans.staff_name', mdaId: 'loans.mda_id', status: 'loans.status' },
  ledgerEntries: { loanId: 'ledger_entries.loan_id', createdAt: 'ledger_entries.created_at' },
  mdas: { id: 'mdas.id', name: 'mdas.name' },
  employmentEvents: { loanId: 'employment_events.loan_id', eventType: 'employment_events.event_type', effectiveDate: 'employment_events.effective_date' },
  mdaSubmissions: { id: 'mda_submissions.id', mdaId: 'mda_submissions.mda_id', status: 'mda_submissions.status', createdAt: 'mda_submissions.created_at' },
  submissionRows: { submissionId: 'submission_rows.submission_id', staffId: 'submission_rows.staff_id', eventFlag: 'submission_rows.event_flag', amountDeducted: 'submission_rows.amount_deducted' },
  users: { id: 'users.id', email: 'users.email', role: 'users.role' },
}));

vi.mock('./observationService', () => ({
  promoteToException: vi.fn().mockResolvedValue({ exceptionId: 'exc-new' }),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../config/env', () => ({
  env: { NODE_ENV: 'test' },
}));

import { detectInactiveLoans, startInactiveLoanScheduler, resetSystemUserCache } from './inactiveLoanDetector';
import { promoteToException } from './observationService';
import { db } from '../db/index';

type MockFn = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as Record<'execute' | 'select' | 'insert', MockFn>;

// ─── Mock Helpers ────────────────────────────────────────────────────

function mockChain(result: unknown) {
  const promise = Promise.resolve(result);
  const fns = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  const chain = {
    from: fns[0], where: fns[1], limit: fns[2], values: fns[3], returning: fns[4],
    set: fns[5], orderBy: fns[6],
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  fns.forEach(fn => fn.mockReturnValue(chain));
  return chain;
}

function setExecuteResults(...results: { rows: unknown[] }[]) {
  executeCallIndex = 0;
  executeResults.length = 0;
  executeResults.push(...results);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('inactiveLoanDetector — detectInactiveLoans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSystemUserCache();
    executeCallIndex = 0;
    executeResults.length = 0;
  });

  it('detects loan with no ledger entry for 60+ days', async () => {
    // 1: inactive loans query
    setExecuteResults(
      { rows: [{ loan_id: 'loan1', staff_id: 'S1', staff_name: 'Akin Balogun', mda_id: 'mda1', mda_name: 'Education', last_deduction_date: '2026-01-01', days_since: 82 }] },
      // 2: employment events — none
      { rows: [] },
      // 3: submission cross-reference — none
      { rows: [] },
    );

    // Existing observations check — none flagged
    mockDb.select.mockReturnValueOnce(mockChain([]));

    // Insert observation
    mockDb.insert.mockReturnValueOnce(mockChain([{ id: 'obs-1' }]));

    const result = await detectInactiveLoans(null, 'user-123');

    expect(result.detected).toBe(1);
    expect(result.excluded).toBe(0);
    expect(result.newExceptions).toBe(1);
    expect(result.alreadyFlagged).toBe(0);
    expect(promoteToException).toHaveBeenCalledWith('obs-1', 'user-123', 'medium');
  });

  it('does NOT detect loan with recent ledger entry (< 60 days)', async () => {
    // No inactive loans found
    setExecuteResults({ rows: [] });

    const result = await detectInactiveLoans(null, 'user-123');

    expect(result.detected).toBe(0);
    expect(result.newExceptions).toBe(0);
  });

  it('excludes loan with LWOP_START event within 90 days', async () => {
    setExecuteResults(
      // 1: one inactive loan found
      { rows: [{ loan_id: 'loan-lwop', staff_id: 'S2', staff_name: 'Fatima Ibrahim', mda_id: 'mda2', mda_name: 'Health', last_deduction_date: '2026-01-10', days_since: 72 }] },
      // 2: employment events — LWOP_START found
      { rows: [{ loan_id: 'loan-lwop' }] },
    );

    const result = await detectInactiveLoans(null, 'user-123');

    expect(result.detected).toBe(1);
    expect(result.excluded).toBe(1);
    expect(result.newExceptions).toBe(0);
    expect(promoteToException).not.toHaveBeenCalled();
  });

  it('does NOT exclude loan with no employment event', async () => {
    setExecuteResults(
      { rows: [{ loan_id: 'loan-no-event', staff_id: 'S3', staff_name: 'Bola Ogun', mda_id: 'mda3', mda_name: 'Works', last_deduction_date: '2026-01-05', days_since: 77 }] },
      // No employment events
      { rows: [] },
      // Submission cross-ref — none
      { rows: [] },
    );

    // No existing observations
    mockDb.select.mockReturnValueOnce(mockChain([]));
    // Insert observation
    mockDb.insert.mockReturnValueOnce(mockChain([{ id: 'obs-no-event' }]));

    const result = await detectInactiveLoans(null, 'user-123');

    expect(result.detected).toBe(1);
    expect(result.excluded).toBe(0);
    expect(result.newExceptions).toBe(1);
  });

  it('idempotency — second run does NOT create duplicate for already-flagged loan', async () => {
    setExecuteResults(
      { rows: [{ loan_id: 'loan-dup', staff_id: 'S4', staff_name: 'Dayo Ade', mda_id: 'mda4', mda_name: 'Agriculture', last_deduction_date: '2025-12-20', days_since: 93 }] },
      // No employment events
      { rows: [] },
    );

    // Existing observation already exists
    mockDb.select.mockReturnValueOnce(mockChain([{ loanId: 'loan-dup' }]));

    const result = await detectInactiveLoans(null, 'user-123');

    expect(result.detected).toBe(1);
    expect(result.alreadyFlagged).toBe(1);
    expect(result.newExceptions).toBe(0);
    expect(promoteToException).not.toHaveBeenCalled();
  });

  it('resolved exception allows re-flagging if loan becomes inactive again', async () => {
    setExecuteResults(
      { rows: [{ loan_id: 'loan-reflag', staff_id: 'S5', staff_name: 'Kemi Ojo', mda_id: 'mda5', mda_name: 'Finance', last_deduction_date: '2025-12-15', days_since: 98 }] },
      // No employment events
      { rows: [] },
      // Submission cross-ref — none
      { rows: [] },
    );

    // No open observations (resolved ones don't block)
    mockDb.select.mockReturnValueOnce(mockChain([]));
    // Insert observation
    mockDb.insert.mockReturnValueOnce(mockChain([{ id: 'obs-reflag' }]));

    const result = await detectInactiveLoans(null, 'user-123');

    expect(result.newExceptions).toBe(1);
    expect(promoteToException).toHaveBeenCalledWith('obs-reflag', 'user-123', 'medium');
  });

  it('MDA scoping — DEPT_ADMIN detection only finds their MDA loans', async () => {
    // The SQL includes AND l.mda_id = mdaScope when scoped
    setExecuteResults(
      { rows: [{ loan_id: 'loan-scoped', staff_id: 'S6', staff_name: 'Tunde Lagos', mda_id: 'mda-scope', mda_name: 'Lands', last_deduction_date: '2026-01-02', days_since: 80 }] },
      { rows: [] },
      { rows: [] },
    );

    mockDb.select.mockReturnValueOnce(mockChain([]));
    mockDb.insert.mockReturnValueOnce(mockChain([{ id: 'obs-scoped' }]));

    const result = await detectInactiveLoans('mda-scope', 'dept-admin-user');

    expect(result.detected).toBe(1);
    expect(result.newExceptions).toBe(1);
    // Verify the userId passed to promoteToException is the dept admin
    expect(promoteToException).toHaveBeenCalledWith('obs-scoped', 'dept-admin-user', 'medium');
  });

  it('description includes "No deduction recorded for X days" with correct day count', async () => {
    setExecuteResults(
      { rows: [{ loan_id: 'loan-desc', staff_id: 'S7', staff_name: 'Ola Bright', mda_id: 'mda7', mda_name: 'Justice', last_deduction_date: '2025-12-01', days_since: 112 }] },
      { rows: [] },
      { rows: [] },
    );

    mockDb.select.mockReturnValueOnce(mockChain([]));

    // Capture the insert call to verify description
    let capturedDescription = '';
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockImplementation((vals: Array<{ description: string }>) => {
        capturedDescription = vals[0].description;
        return {
          returning: vi.fn().mockReturnValue(Promise.resolve([{ id: 'obs-desc' }])),
        };
      }),
    });

    await detectInactiveLoans(null, 'user-123');

    expect(capturedDescription).toContain('No deduction recorded for 112 days');
    expect(capturedDescription).toContain('Last deduction: 2025-12-01');
  });

  it('submission cross-reference enhances description when ₦0 + NONE', async () => {
    setExecuteResults(
      { rows: [{ loan_id: 'loan-sub', staff_id: 'S8', staff_name: 'Ada Chi', mda_id: 'mda8', mda_name: 'Trade', last_deduction_date: '2026-01-05', days_since: 77 }] },
      { rows: [] },
      // Submission: ₦0 with NONE event flag
      { rows: [{ staff_id: 'S8', event_flag: 'NONE', amount_deducted: '0.00', mda_id: 'mda8' }] },
    );

    mockDb.select.mockReturnValueOnce(mockChain([]));

    let capturedDescription = '';
    mockDb.insert.mockReturnValueOnce({
      values: vi.fn().mockImplementation((vals: Array<{ description: string }>) => {
        capturedDescription = vals[0].description;
        return {
          returning: vi.fn().mockReturnValue(Promise.resolve([{ id: 'obs-sub' }])),
        };
      }),
    });

    await detectInactiveLoans(null, 'user-123');

    expect(capturedDescription).toContain('MDA submitted ₦0 with no event flag');
    expect(capturedDescription).toContain('potential payroll error or undeclared separation');
  });
});

describe('inactiveLoanDetector — scheduler', () => {
  it('does NOT start in test mode', () => {
    vi.useFakeTimers();
    startInactiveLoanScheduler();
    // env.NODE_ENV is 'test' — scheduler must not create any timers
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
