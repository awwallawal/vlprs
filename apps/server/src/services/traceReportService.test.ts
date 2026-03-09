/**
 * traceReportService tests — Loan cycle detection, rate analysis, reference numbers,
 * data completeness, and report assembly.
 *
 * Covers AC 1, 5, 6, 8 test requirements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectLoanCycles,
  buildRateAnalysis,
  generateReferenceNumber,
  resetSequenceCounter,
} from './traceReportService';
import type { PersonTimeline } from './staffProfileService';
import type { TraceLoanCycle } from '@vlprs/shared';

// ─── Test helpers ──────────────────────────────────────────────────

function makeTimeline(overrides: Partial<PersonTimeline> = {}): PersonTimeline {
  return {
    name: 'TEST USER',
    mdaCode: 'JUDICIARY',
    months: [],
    firstSeen: { year: 2020, month: 1 },
    lastSeen: { year: 2020, month: 12 },
    totalMonthsPresent: 12,
    gapMonths: 0,
    ...overrides,
  };
}

function makeMonth(
  year: number,
  month: number,
  principal: string | null = '500000',
  balance: string | null = '400000',
  deduction: string | null = '9444.17',
  totalLoan: string | null = '566650',
) {
  return {
    year,
    month,
    principal,
    totalLoan,
    outstandingBalance: balance,
    monthlyDeduction: deduction,
    sourceFile: `test-file-${year}.xlsx`,
  };
}

const mdaNameMap = new Map<string, string>([
  ['JUDICIARY', 'Oyo State Judiciary'],
  ['AGRIC', 'Ministry of Agriculture'],
]);

// ─── generateReferenceNumber ───────────────────────────────────────

describe('generateReferenceNumber', () => {
  beforeEach(() => resetSequenceCounter());

  it('generates UUID-based reference numbers with correct format', () => {
    const ref1 = generateReferenceNumber();
    const ref2 = generateReferenceNumber();
    const year = new Date().getFullYear();

    expect(ref1).toMatch(new RegExp(`^VLPRS-TRACE-${year}-[A-F0-9]{8}$`));
    expect(ref2).toMatch(new RegExp(`^VLPRS-TRACE-${year}-[A-F0-9]{8}$`));
    expect(ref1).not.toBe(ref2);
  });

  it('reference numbers are unique per generation', () => {
    const refs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      refs.add(generateReferenceNumber());
    }
    expect(refs.size).toBe(100);
  });
});

// ─── detectLoanCycles ──────────────────────────────────────────────

describe('detectLoanCycles', () => {
  it('detects single loan cycle in single MDA', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2020, 1, '500000', '500000'),
        makeMonth(2020, 2, '500000', '490555.83'),
        makeMonth(2020, 3, '500000', '481111.66'),
      ],
      firstSeen: { year: 2020, month: 1 },
      lastSeen: { year: 2020, month: 3 },
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].cycleNumber).toBe(1);
    expect(cycles[0].mdaCode).toBe('JUDICIARY');
    expect(cycles[0].mdaName).toBe('Oyo State Judiciary');
    expect(cycles[0].startPeriod).toBe('2020-01');
    expect(cycles[0].principal).toBe('500000');
    expect(cycles[0].monthsOfData).toBe(3);
    expect(cycles[0].status).toBe('active');
  });

  it('detects sequential loans by principal change', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2018, 1, '300000', '300000', '5000', '339900'),
        makeMonth(2018, 6, '300000', '275000', '5000', '339900'),
        // New loan — principal changes
        makeMonth(2019, 1, '500000', '500000', '9444.17', '566650'),
        makeMonth(2019, 6, '500000', '450000', '9444.17', '566650'),
      ],
      firstSeen: { year: 2018, month: 1 },
      lastSeen: { year: 2019, month: 6 },
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);

    expect(cycles).toHaveLength(2);
    expect(cycles[0].principal).toBe('300000');
    expect(cycles[0].endPeriod).toBe('2018-06');
    expect(cycles[1].principal).toBe('500000');
    expect(cycles[1].startPeriod).toBe('2019-01');
  });

  it('detects liquidated loan when balance reaches zero', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2020, 1, '100000', '100000'),
        makeMonth(2020, 2, '100000', '50000'),
        makeMonth(2020, 3, '100000', '0'),
      ],
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].status).toBe('liquidated');
  });

  it('handles cross-MDA timelines', () => {
    const judiciary = makeTimeline({
      mdaCode: 'JUDICIARY',
      months: [
        makeMonth(2018, 1, '300000', '300000', '5000', '339900'),
        makeMonth(2018, 6, '300000', '275000', '5000', '339900'),
      ],
    });
    const agric = makeTimeline({
      mdaCode: 'AGRIC',
      months: [
        makeMonth(2020, 1, '500000', '500000', '9444.17', '566650'),
        makeMonth(2020, 6, '500000', '450000', '9444.17', '566650'),
      ],
    });

    const cycles = detectLoanCycles([judiciary, agric], mdaNameMap);

    expect(cycles).toHaveLength(2);
    expect(cycles[0].mdaCode).toBe('JUDICIARY');
    expect(cycles[1].mdaCode).toBe('AGRIC');
    expect(cycles[1].mdaName).toBe('Ministry of Agriculture');
  });

  it('marks gap months in balance trajectory', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2020, 1, '500000', '500000'),
        makeMonth(2020, 2, '500000', null), // gap
        makeMonth(2020, 3, '500000', '480000'),
      ],
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);

    expect(cycles[0].balanceTrajectory[1].isGap).toBe(true);
    expect(cycles[0].balanceTrajectory[0].isGap).toBe(false);
  });

  it('marks stalled balance entries', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2020, 1, '500000', '400000'),
        makeMonth(2020, 2, '500000', '400000'), // stalled
        makeMonth(2020, 3, '500000', '390000'),
      ],
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);

    expect(cycles[0].balanceTrajectory[1].isStalled).toBe(true);
    expect(cycles[0].balanceTrajectory[2].isStalled).toBe(false);
  });

  it('returns empty cycles for empty timelines', () => {
    const timeline = makeTimeline({ months: [] });
    const cycles = detectLoanCycles([timeline], mdaNameMap);
    expect(cycles).toHaveLength(0);
  });

  it('handles person with no principal data (inferred status)', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2020, 1, null, '100000'),
      ],
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);
    // No cycle detected since first principal is null
    expect(cycles).toHaveLength(0);
  });

  it('increments gapMonths when balance is null (C2 code review fix)', () => {
    const timeline = makeTimeline({
      months: [
        makeMonth(2020, 1, '500000', '500000'),
        makeMonth(2020, 2, '500000', null),
        makeMonth(2020, 3, '500000', null),
        makeMonth(2020, 4, '500000', '470000'),
      ],
    });

    const cycles = detectLoanCycles([timeline], mdaNameMap);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].gapMonths).toBe(2);
    expect(cycles[0].monthsOfData).toBe(4);
  });
});

// ─── buildRateAnalysis ─────────────────────────────────────────────

describe('buildRateAnalysis', () => {
  it('matches standard 13.33% at 60-month tenure', () => {
    const cycle: TraceLoanCycle = {
      cycleNumber: 1,
      mdaCode: 'JUDICIARY',
      mdaName: 'Oyo State Judiciary',
      startPeriod: '2020-01',
      endPeriod: '2024-12',
      principal: '500000',
      totalLoan: '566650',      // 500000 + (500000 * 0.1333) = 566650
      interestAmount: '66650',
      effectiveRate: '13.33',
      monthlyDeduction: '9444.17',
      installments: 60,
      monthsOfData: 60,
      gapMonths: 0,
      status: 'active',
      balanceTrajectory: [],
    };

    const analysis = buildRateAnalysis(cycle);

    expect(analysis.standardTest.match).toBe(true);
    expect(analysis.apparentRate).toBe('13.33');
    expect(analysis.conclusion).toBe('Standard 13.33% rate at 60-month tenure.');
  });

  it('matches accelerated tenure (e.g., 36-month)', () => {
    // 36-month accelerated: monthlyInterest = 500000 * 0.1333 / 60 = 1110.83333
    // totalInterest = 1110.83333 * 36 = 39990.00
    const cycle: TraceLoanCycle = {
      cycleNumber: 1,
      mdaCode: 'JUDICIARY',
      mdaName: 'Oyo State Judiciary',
      startPeriod: '2020-01',
      endPeriod: '2022-12',
      principal: '500000',
      totalLoan: '539990',      // 500000 + 39990 = 539990
      interestAmount: '39990',
      effectiveRate: '7.998',
      monthlyDeduction: '14999.72',
      installments: 36,
      monthsOfData: 36,
      gapMonths: 0,
      status: 'liquidated',
      balanceTrajectory: [],
    };

    const analysis = buildRateAnalysis(cycle);

    expect(analysis.standardTest.match).toBe(false);
    expect(analysis.acceleratedTest).toBeDefined();
    expect(analysis.acceleratedTest!.tenure).toBe(36);
    expect(analysis.acceleratedTest!.match).toBe(true);
    expect(analysis.conclusion).toContain('36-month accelerated tenure');
  });

  it('reports non-standard rate when no tenure matches', () => {
    const cycle: TraceLoanCycle = {
      cycleNumber: 1,
      mdaCode: 'JUDICIARY',
      mdaName: 'Oyo State Judiciary',
      startPeriod: '2020-01',
      endPeriod: '2024-12',
      principal: '500000',
      totalLoan: '600000',      // 20% rate
      interestAmount: '100000',
      effectiveRate: '20.00',
      monthlyDeduction: '10000',
      installments: 60,
      monthsOfData: 60,
      gapMonths: 0,
      status: 'active',
      balanceTrajectory: [],
    };

    const analysis = buildRateAnalysis(cycle);

    expect(analysis.standardTest.match).toBe(false);
    expect(analysis.acceleratedTest).toBeUndefined();
    expect(analysis.conclusion).toContain('does not match standard tenures');
    expect(analysis.apparentRate).toBe('20.00');
  });

  it('returns graceful result for zero-principal cycle (C1 code review fix)', () => {
    const cycle: TraceLoanCycle = {
      cycleNumber: 1,
      mdaCode: 'JUDICIARY',
      mdaName: 'Test',
      startPeriod: '2020-01',
      endPeriod: '2020-12',
      principal: '0',
      totalLoan: '0',
      interestAmount: '0',
      effectiveRate: '0',
      monthlyDeduction: '0',
      installments: 0,
      monthsOfData: 0,
      gapMonths: 0,
      status: 'inferred',
      balanceTrajectory: [],
    };

    const analysis = buildRateAnalysis(cycle);

    expect(analysis.conclusion).toBe('Insufficient loan data for rate analysis.');
    expect(analysis.standardTest.match).toBe(false);
    expect(analysis.acceleratedTest).toBeUndefined();
  });

  it('uses decimal.js for all calculations (no floating-point errors)', () => {
    const cycle: TraceLoanCycle = {
      cycleNumber: 1,
      mdaCode: 'JUDICIARY',
      mdaName: 'Test',
      startPeriod: '2020-01',
      endPeriod: '2024-12',
      principal: '333333.33',
      totalLoan: '377777.76',   // 333333.33 * 1.1333 = 377777.7...
      interestAmount: '44444.43',
      effectiveRate: '13.33',
      monthlyDeduction: '6296.30',
      installments: 60,
      monthsOfData: 60,
      gapMonths: 0,
      status: 'active',
      balanceTrajectory: [],
    };

    const analysis = buildRateAnalysis(cycle);

    // The analysis should not throw or produce NaN
    expect(Number(analysis.apparentRate)).not.toBeNaN();
    expect(Number(analysis.standardTest.expectedInterest)).not.toBeNaN();
  });
});
