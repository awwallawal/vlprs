import { describe, it, expect } from 'vitest';
import { buildTimelines, detectCycles } from './staffProfileService';

describe('staffProfileService — buildTimelines', () => {
  it('builds a single-MDA timeline from records', () => {
    const records = [
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'file1.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 2, outstandingBalance: '95000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'file1.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 3, outstandingBalance: '90000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'file1.xlsx' },
    ];

    const timelines = buildTimelines(records);
    expect(timelines).toHaveLength(1);
    expect(timelines[0].mdaCode).toBe('JUSTICE');
    expect(timelines[0].totalMonthsPresent).toBe(3);
    expect(timelines[0].gapMonths).toBe(0);
    expect(timelines[0].firstSeen).toEqual({ year: 2020, month: 1 });
    expect(timelines[0].lastSeen).toEqual({ year: 2020, month: 3 });
  });

  it('builds separate timelines for different MDAs', () => {
    const records = [
      { staffName: 'OLANIYAN BABATUNDE', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'file1.xlsx' },
      { staffName: 'OLANIYAN BABATUNDE', mdaCode: 'INFORMATION', periodYear: 2021, periodMonth: 6, outstandingBalance: '50000', monthlyDeduction: '3000', principal: '100000', totalLoan: '115000', sourceFile: 'file2.xlsx' },
    ];

    const timelines = buildTimelines(records);
    expect(timelines).toHaveLength(2);
    expect(timelines.map((t) => t.mdaCode).sort()).toEqual(['INFORMATION', 'JUSTICE']);
  });

  it('deduplicates same-month entries (keeps first)', () => {
    const records = [
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'file1.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '99000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'file2.xlsx' },
    ];

    const timelines = buildTimelines(records);
    expect(timelines[0].totalMonthsPresent).toBe(1);
    expect(timelines[0].months[0].outstandingBalance).toBe('100000');
  });

  it('computes gap months for non-consecutive records', () => {
    const records = [
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 4, outstandingBalance: '85000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
    ];

    const timelines = buildTimelines(records);
    // Span: Jan-Apr = 4 months, present = 2, gap = 2
    expect(timelines[0].gapMonths).toBe(2);
    expect(timelines[0].totalMonthsPresent).toBe(2);
  });

  it('skips records with null period', () => {
    const records = [
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: null, periodMonth: null, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
    ];

    const timelines = buildTimelines(records);
    expect(timelines[0].totalMonthsPresent).toBe(1);
  });

  it('sorts months chronologically', () => {
    const records = [
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 6, outstandingBalance: '50000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE', periodYear: 2020, periodMonth: 3, outstandingBalance: '75000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
    ];

    const timelines = buildTimelines(records);
    expect(timelines[0].months[0].month).toBe(1);
    expect(timelines[0].months[1].month).toBe(3);
    expect(timelines[0].months[2].month).toBe(6);
  });
});

describe('staffProfileService — detectCycles', () => {
  it('detects a single active cycle', () => {
    const timelines = [{
      name: 'BELLO AMINAT',
      mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '200000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '195000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '190000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 },
      lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3,
      gapMonths: 0,
    }];

    const cycles = detectCycles(timelines);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].status).toBe('active');
    expect(cycles[0].principal).toBe('200000');
    expect(cycles[0].monthsPresent).toBe(3);
  });

  it('detects a completed cycle (balance reaches zero)', () => {
    const timelines = [{
      name: 'BELLO AMINAT',
      mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '10000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '5000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '0', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 },
      lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3,
      gapMonths: 0,
    }];

    const cycles = detectCycles(timelines);
    expect(cycles.some((c) => c.status === 'completed')).toBe(true);
  });

  it('detects beyond_tenure when months > 60', () => {
    const months = [];
    for (let i = 0; i < 62; i++) {
      const month = (i % 12) + 1;
      const year = 2015 + Math.floor(i / 12);
      months.push({
        year, month,
        outstandingBalance: String(200000 - i * 1000),
        monthlyDeduction: '3000',
        principal: '200000',
        totalLoan: '230000',
        sourceFile: 'f.xlsx',
      });
    }
    const timelines = [{
      name: 'LONG TENURE',
      mdaCode: 'JUSTICE',
      months,
      firstSeen: { year: 2015, month: 1 },
      lastSeen: { year: 2020, month: 2 },
      totalMonthsPresent: 62,
      gapMonths: 0,
    }];

    const cycles = detectCycles(timelines);
    expect(cycles.some((c) => c.status === 'beyond_tenure')).toBe(true);
  });

  it('detects new cycle when principal changes', () => {
    const timelines = [{
      name: 'TWO LOANS',
      mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '95000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '150000', monthlyDeduction: '6000', principal: '300000', totalLoan: '345000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 },
      lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3,
      gapMonths: 0,
    }];

    const cycles = detectCycles(timelines);
    expect(cycles.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for empty timelines', () => {
    expect(detectCycles([])).toEqual([]);
  });

  it('handles timeline with no months', () => {
    const timelines = [{
      name: 'EMPTY',
      mdaCode: 'JUSTICE',
      months: [],
      firstSeen: { year: 2020, month: 1 },
      lastSeen: { year: 2020, month: 1 },
      totalMonthsPresent: 0,
      gapMonths: 0,
    }];

    expect(detectCycles(timelines)).toEqual([]);
  });
});
