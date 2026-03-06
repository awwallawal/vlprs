import { describe, it, expect } from 'vitest';
import { extractPeriod } from './periodExtract';

describe('extractPeriod', () => {
  it('extracts from sheet name "APRIL 2019"', () => {
    const result = extractPeriod('APRIL 2019', [], 'file.xlsx');
    expect(result.periods).toEqual([{ year: 2019, month: 4 }]);
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('sheet');
  });

  it('extracts from sheet name "JAN. 2018"', () => {
    const result = extractPeriod('JAN. 2018', [], 'file.xlsx');
    expect(result.periods).toEqual([{ year: 2018, month: 1 }]);
    expect(result.confidence).toBe('high');
  });

  it('extracts from sheet name "JANUARY,2020"', () => {
    const result = extractPeriod('JANUARY,2020', [], 'file.xlsx');
    expect(result.periods).toEqual([{ year: 2020, month: 1 }]);
  });

  it('extracts month range from sheet name "JAN-DEC 2019"', () => {
    const result = extractPeriod('JAN-DEC 2019', [], 'file.xlsx');
    expect(result.periods.length).toBe(12);
    expect(result.periods[0]).toEqual({ year: 2019, month: 1 });
    expect(result.periods[11]).toEqual({ year: 2019, month: 12 });
  });

  it('falls back to title rows', () => {
    const result = extractPeriod('Sheet1', ['MOTOR VEHICLE LOAN PAYMENT FOR THE MONTH OF JANUARY, 2022'], 'file.xlsx');
    expect(result.periods).toEqual([{ year: 2022, month: 1 }]);
    expect(result.source).toBe('title');
  });

  it('falls back to filename', () => {
    const result = extractPeriod('Sheet1', [], 'agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx');
    expect(result.periods.length).toBe(7);
    expect(result.source).toBe('filename');
  });

  it('returns empty periods if nothing found', () => {
    const result = extractPeriod('Sheet1', [], 'unknown.xlsx');
    expect(result.periods.length).toBe(0);
    expect(result.confidence).toBe('low');
  });
});
