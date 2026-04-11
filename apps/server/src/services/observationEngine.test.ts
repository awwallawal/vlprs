import { describe, it, expect } from 'vitest';
import {
  detectRateVariance,
  detectNegativeBalance,
  detectStalledBalance,
  detectConsecutiveLoan,
  detectGradeTierMismatch,
  detectWithinFileDuplicates,
} from './observationEngine';

const UPLOAD_ID = '00000000-0000-0000-0000-000000000001';
const MDA_ID = '00000000-0000-0000-0000-000000000010';
const mdaMap = new Map([
  [MDA_ID, { id: MDA_ID, name: 'Ministry of Justice', code: 'JUSTICE' }],
]);
const codeToIdMap = new Map([['JUSTICE', MDA_ID]]);

describe('observationEngine — detectRateVariance', () => {
  it('generates accelerated repayment label for 11.11% rate (50-month tenure)', () => {
    const records = [{
      id: 'rec1', staffName: 'BELLO AMINAT', mdaId: MDA_ID, loanId: null,
      hasRateVariance: true, computedRate: '11.110',
      principal: '200000.00', totalLoan: '222220.00', monthlyDeduction: '5000.00',
      installmentCount: 45, employeeNo: 'EMP001', sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 5,
    }];

    const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].type).toBe('rate_variance');
    expect(obs[0].staffName).toBe('BELLO AMINAT');
    expect(obs[0].description).toContain('Accelerated Repayment Detected');
    expect(obs[0].description).toContain('50-month tenure');
    expect(obs[0].context.dataCompleteness).toBe(100);
    expect(obs[0].context.dataPoints).toHaveProperty('matchedTenure', 50);
    expect(obs[0].sourceReference).toEqual({ file: 'file.xlsx', sheet: 'Sheet1', row: 5 });
  });

  it('skips records without rate variance', () => {
    const records = [{
      id: 'rec1', staffName: 'BELLO AMINAT', mdaId: MDA_ID, loanId: null,
      hasRateVariance: false, computedRate: '13.330',
      principal: '200000.00', totalLoan: '226660.00', monthlyDeduction: '5000.00',
      installmentCount: 46, employeeNo: null, sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 5,
    }];

    const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('reduces data completeness when fields are missing', () => {
    const records = [{
      id: 'rec1', staffName: 'BELLO AMINAT', mdaId: MDA_ID, loanId: null,
      hasRateVariance: true, computedRate: '8.000',
      principal: null, totalLoan: null, monthlyDeduction: null,
      installmentCount: null, employeeNo: null, sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 5,
    }];

    const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].context.dataCompleteness).toBe(0);
    // 8.0% matches 36-month accelerated tenure
    expect(obs[0].description).toContain('Accelerated Repayment Detected');
    expect(obs[0].description).toContain('36-month tenure');
  });

  it('generates non-standard rate label for 5.56% rate (~25-month tenure)', () => {
    const records = [{
      id: 'rec1', staffName: 'OJO ADEBAYO', mdaId: MDA_ID, loanId: null,
      hasRateVariance: true, computedRate: '5.560',
      principal: '300000.00', totalLoan: '316680.00', monthlyDeduction: '6000.00',
      installmentCount: 25, employeeNo: 'EMP002', sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 10,
    }];

    const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].description).toContain('Non-Standard Rate');
    expect(obs[0].description).toContain('~25-month tenure');
    expect(obs[0].description).toContain('manual verification');
    expect(obs[0].context.dataPoints).toHaveProperty('knownNonStandard', true);
    expect(obs[0].context.dataPoints).toHaveProperty('computedTenure', 25);
  });

  it('labels all known accelerated rates correctly', () => {
    const acceleratedCases: Array<[string, number]> = [
      ['6.670', 30], ['8.000', 36], ['8.890', 40], ['10.660', 48], ['11.110', 50],
    ];

    for (const [rate, expectedTenure] of acceleratedCases) {
      const records = [{
        id: `rec-${rate}`, staffName: 'TEST', mdaId: MDA_ID, loanId: null,
        hasRateVariance: true, computedRate: rate,
        principal: '100000.00', totalLoan: `${100000 + Number(rate) * 1000}.00`, monthlyDeduction: '5000.00',
        installmentCount: expectedTenure, employeeNo: null, sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 1,
      }];

      const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
      expect(obs[0].description, `Rate ${rate}% should be accelerated`).toContain('Accelerated Repayment Detected');
      expect(obs[0].description, `Rate ${rate}% should show ${expectedTenure}-month`).toContain(`${expectedTenure}-month tenure`);
    }
  });
});

describe('observationEngine — detectNegativeBalance', () => {
  it('generates observation when outstanding_balance < 0', () => {
    const records = [{
      id: 'rec1', staffName: 'OLANIYAN BABATUNDE', mdaId: MDA_ID, loanId: null,
      outstandingBalance: '-15000.00', monthlyDeduction: '5000.00', employeeNo: 'EMP002',
      periodYear: 2023, periodMonth: 6,
      sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 10,
    }];

    const obs = detectNegativeBalance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].type).toBe('negative_balance');
    expect(obs[0].description).toContain('-15000.00');
    expect(obs[0].description).toContain('below zero');
    expect(obs[0].context.dataPoints).toHaveProperty('overAmount', '15000.00');
    expect(obs[0].context.dataPoints).toHaveProperty('estimatedMonths', '3');
  });

  it('keeps most negative per person+MDA', () => {
    const records = [
      {
        id: 'rec1', staffName: 'BELLO AMINAT', mdaId: MDA_ID, loanId: null,
        outstandingBalance: '-5000.00', monthlyDeduction: '5000.00', employeeNo: null,
        periodYear: 2023, periodMonth: 3,
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 3,
      },
      {
        id: 'rec2', staffName: 'BELLO AMINAT', mdaId: MDA_ID, loanId: null,
        outstandingBalance: '-20000.00', monthlyDeduction: '5000.00', employeeNo: null,
        periodYear: 2023, periodMonth: 6,
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 6,
      },
    ];

    const obs = detectNegativeBalance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].context.dataPoints).toHaveProperty('overAmount', '20000.00');
  });

  it('skips records with positive balance', () => {
    const records = [{
      id: 'rec1', staffName: 'BELLO AMINAT', mdaId: MDA_ID, loanId: null,
      outstandingBalance: '50000.00', monthlyDeduction: '5000.00', employeeNo: null,
      periodYear: 2023, periodMonth: 6,
      sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 10,
    }];

    const obs = detectNegativeBalance(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });
});

describe('observationEngine — detectStalledBalance', () => {
  it('detects stalled balance (3+ identical consecutive months)', () => {
    const timelines = [{
      name: 'BELLO AMINAT', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 4, outstandingBalance: '95000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 4 },
      totalMonthsPresent: 4, gapMonths: 0,
    }];

    const obs = detectStalledBalance(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].type).toBe('stalled_balance');
    expect(obs[0].description).toContain('100000');
    expect(obs[0].description).toContain('3 consecutive months');
  });

  it('does not detect stalled balance with fewer than 3 identical months', () => {
    const timelines = [{
      name: 'BELLO AMINAT', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '95000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3, gapMonths: 0,
    }];

    const obs = detectStalledBalance(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('skips timelines with fewer than 3 months', () => {
    const timelines = [{
      name: 'SHORT', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 1 },
      totalMonthsPresent: 1, gapMonths: 0,
    }];

    const obs = detectStalledBalance(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });
});

describe('observationEngine — detectConsecutiveLoan', () => {
  it('detects new loan while prior balance > 0', () => {
    const timelines = [{
      name: 'TWO LOANS', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '95000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '150000', monthlyDeduction: '6000', principal: '300000', totalLoan: '345000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3, gapMonths: 0,
    }];

    const obs = detectConsecutiveLoan(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].type).toBe('consecutive_loan');
    expect(obs[0].description).toContain('300000');
    expect(obs[0].description).toContain('95000');
  });

  it('does not detect when prior balance is zero', () => {
    const timelines = [{
      name: 'CLEAN TRANSITION', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '5000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '0', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '300000', monthlyDeduction: '6000', principal: '300000', totalLoan: '345000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3, gapMonths: 0,
    }];

    const obs = detectConsecutiveLoan(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('returns empty for single-month timelines', () => {
    const timelines = [{
      name: 'SHORT', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '100000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 1 },
      totalMonthsPresent: 1, gapMonths: 0,
    }];

    const obs = detectConsecutiveLoan(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });
});

describe('observationEngine — observation templates', () => {
  it('rate variance template uses non-punitive language', () => {
    // Use a non-standard rate to get the "Non-Standard Rate" template
    const records = [{
      id: 'rec1', staffName: 'TEST', mdaId: MDA_ID, loanId: null,
      hasRateVariance: true, computedRate: '4.440',
      principal: '100000.00', totalLoan: '104440.00', monthlyDeduction: '3000.00',
      installmentCount: 20, employeeNo: null, sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 1,
    }];

    const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
    expect(obs[0].description).not.toContain('error');
    expect(obs[0].description).not.toContain('incorrect');
    expect(obs[0].description).not.toContain('wrong');
    expect(obs[0].description).toContain('verification');
    expect(obs[0].context.possibleExplanations.length).toBeGreaterThanOrEqual(2);
  });

  it('negative balance template uses non-punitive language', () => {
    const records = [{
      id: 'rec1', staffName: 'TEST', mdaId: MDA_ID, loanId: null,
      outstandingBalance: '-10000.00', monthlyDeduction: '5000.00', employeeNo: null,
      periodYear: 2023, periodMonth: 6,
      sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 1,
    }];

    const obs = detectNegativeBalance(records, mdaMap, UPLOAD_ID);
    expect(obs[0].description).not.toContain('over-deduction');
    expect(obs[0].description).not.toContain('unauthorized');
    expect(obs[0].description).toContain('below zero');
    expect(obs[0].description).toContain('Verify');
  });

  it('accelerated rate template uses non-punitive language', () => {
    const records = [{
      id: 'rec1', staffName: 'TEST', mdaId: MDA_ID, loanId: null,
      hasRateVariance: true, computedRate: '11.110',
      principal: '200000.00', totalLoan: '222220.00', monthlyDeduction: '5000.00',
      installmentCount: 50, employeeNo: null, sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 1,
    }];

    const obs = detectRateVariance(records, mdaMap, UPLOAD_ID);
    expect(obs[0].description).not.toContain('error');
    expect(obs[0].description).not.toContain('incorrect');
    expect(obs[0].description).not.toContain('wrong');
    expect(obs[0].description).toContain('recognized');
    expect(obs[0].context.possibleExplanations.length).toBeGreaterThanOrEqual(2);
  });

  it('stalled balance template uses non-punitive language', () => {
    const timelines = [{
      name: 'TEST', mdaCode: 'JUSTICE',
      months: [
        { year: 2020, month: 1, outstandingBalance: '50000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 2, outstandingBalance: '50000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
        { year: 2020, month: 3, outstandingBalance: '50000', monthlyDeduction: '5000', principal: '200000', totalLoan: '230000', sourceFile: 'f.xlsx' },
      ],
      firstSeen: { year: 2020, month: 1 }, lastSeen: { year: 2020, month: 3 },
      totalMonthsPresent: 3, gapMonths: 0,
    }];

    const obs = detectStalledBalance(timelines, codeToIdMap, mdaMap, UPLOAD_ID);
    expect(obs[0].description).not.toContain('error');
    expect(obs[0].description).not.toContain('suspicious');
    expect(obs[0].description).toContain('Confirm');
  });
});

describe('observationEngine — detectGradeTierMismatch', () => {
  it('generates observation when principal exceeds tier max (GL 10, Tier 3)', () => {
    const records = [{
      id: 'rec1', staffName: 'ADESINA FOLAKE', mdaId: MDA_ID, loanId: null,
      principal: '750000.00', gradeLevel: 'GL 10', employeeNo: 'EMP010',
      sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 5,
    }];

    const obs = detectGradeTierMismatch(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].type).toBe('grade_tier_mismatch');
    expect(obs[0].description).toContain('GL 10');
    expect(obs[0].description).toContain('750000.00');
    expect(obs[0].description).toContain('600000.00'); // Tier 3 max
    expect(obs[0].context.dataPoints).toHaveProperty('tier', 3);
  });

  it('does not generate observation when principal is within tier max (GL 12, Tier 4)', () => {
    const records = [{
      id: 'rec1', staffName: 'OGUNBIYI TUNDE', mdaId: MDA_ID, loanId: null,
      principal: '700000.00', gradeLevel: 'LEVEL 12', employeeNo: 'EMP012',
      sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 10,
    }];

    const obs = detectGradeTierMismatch(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0); // ₦700k within Tier 4 max ₦750k
  });

  it('skips GL 11 (no tier)', () => {
    const records = [{
      id: 'rec1', staffName: 'NO TIER', mdaId: MDA_ID, loanId: null,
      principal: '999999.00', gradeLevel: 'GL 11', employeeNo: null,
      sourceFile: 'file.xlsx', sourceSheet: 'Sheet1', sourceRow: 1,
    }];

    const obs = detectGradeTierMismatch(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('skips records with null gradeLevel or principal', () => {
    const records = [
      {
        id: 'rec1', staffName: 'NO GRADE', mdaId: MDA_ID, loanId: null,
        principal: '500000.00', gradeLevel: null, employeeNo: null,
        sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 1,
      },
      {
        id: 'rec2', staffName: 'NO PRINCIPAL', mdaId: MDA_ID, loanId: null,
        principal: null, gradeLevel: 'GL 10', employeeNo: null,
        sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 2,
      },
    ];

    const obs = detectGradeTierMismatch(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('parses various grade level formats', () => {
    const cases: Array<[string, boolean]> = [
      ['GL 10', true],    // GL 10, Tier 3, ₦750k > ₦600k
      ['Level 7', true],  // GL 7, Tier 2, ₦750k > ₦450k
      ['10', true],       // Numeric only
      ['GL-10', true],    // Hyphenated
    ];

    for (const [grade, shouldGenerate] of cases) {
      const records = [{
        id: `rec-${grade}`, staffName: 'TEST', mdaId: MDA_ID, loanId: null,
        principal: '750000.00', gradeLevel: grade, employeeNo: null,
        sourceFile: 'f.xlsx', sourceSheet: 'S1', sourceRow: 1,
      }];

      const obs = detectGradeTierMismatch(records, mdaMap, UPLOAD_ID);
      expect(obs.length > 0, `Grade "${grade}" should ${shouldGenerate ? '' : 'not '}generate observation`).toBe(shouldGenerate);
    }
  });
});

describe('observationEngine — detectWithinFileDuplicates (Story 15.0m)', () => {
  const baseFields = {
    mdaId: MDA_ID,
    employeeNo: null,
    sourceFile: 'file.xlsx',
    sourceSheet: 'Sheet1',
  };

  it('generates one observation when same staff + period appears twice', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 15,
        ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 42,
        ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].type).toBe('within_file_duplicate');
    expect(obs[0].staffName).toBe('ADEBAYO OLUSEGUN');
    expect(obs[0].migrationRecordId).toBe('rec1');
    expect(obs[0].description).toContain('ADEBAYO OLUSEGUN');
    expect(obs[0].description).toContain('2 times');
    expect(obs[0].description).toContain('2024-08');
    expect(obs[0].description).toContain('Review');
    expect(obs[0].context.dataPoints).toHaveProperty('duplicateCount', 2);
    expect(obs[0].context.dataPoints).toHaveProperty('period', '2024-08');
    expect(obs[0].context.dataPoints).toHaveProperty('recordIds', ['rec1', 'rec2']);
    expect(obs[0].context.dataPoints).toHaveProperty('rowNumbers', [15, 42]);
    expect(obs[0].context.dataPoints).toHaveProperty('mdaName', 'Ministry of Justice');
    expect(obs[0].context.dataCompleteness).toBe(100);
  });

  it('generates one observation per period when duplicates span multiple periods', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 15, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 42, ...baseFields,
      },
      {
        id: 'rec3', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 9, sourceRow: 60, ...baseFields,
      },
      {
        id: 'rec4', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 9, sourceRow: 80, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(2);
    const periods = obs.map((o) => String(o.context.dataPoints.period)).sort();
    expect(periods).toEqual(['2024-08', '2024-09']);
  });

  it('normalises names case-insensitively (same person, different case)', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 15, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'Adebayo Olusegun',
        periodYear: 2024, periodMonth: 8, sourceRow: 42, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].context.dataPoints).toHaveProperty('duplicateCount', 2);
  });

  it('emits no observation when same staff appears in different periods only', () => {
    const records = [
      {
        id: 'rec1', staffName: 'BELLO AMINAT',
        periodYear: 2024, periodMonth: 8, sourceRow: 5, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'BELLO AMINAT',
        periodYear: 2024, periodMonth: 9, sourceRow: 6, ...baseFields,
      },
      {
        id: 'rec3', staffName: 'BELLO AMINAT',
        periodYear: 2024, periodMonth: 10, sourceRow: 7, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('emits no observation when records have no duplicates', () => {
    const records = [
      {
        id: 'rec1', staffName: 'BELLO AMINAT',
        periodYear: 2024, periodMonth: 8, sourceRow: 5, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 6, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('skips records with null period (cannot be matched)', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: null, periodMonth: null, sourceRow: 5, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: null, periodMonth: null, sourceRow: 6, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('uses non-punitive vocabulary in description and explanations', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 15, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 42, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    const description = obs[0].description;
    expect(description).not.toMatch(/error|violation|invalid|wrong/i);
    expect(description).toContain('Review');
    expect(obs[0].context.possibleExplanations.length).toBeGreaterThanOrEqual(3);
  });

  it('handles three or more duplicates in the same group', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 10, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 20, ...baseFields,
      },
      {
        id: 'rec3', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 30, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].description).toContain('3 times');
    expect(obs[0].context.dataPoints).toHaveProperty('duplicateCount', 3);
    expect(obs[0].context.dataPoints).toHaveProperty('recordIds', ['rec1', 'rec2', 'rec3']);
  });

  // Review H2: detector must strip honorifics, parentheticals, and interior
  // whitespace — same normalisation as the cross-MDA dedup engine.
  it('collapses honorifics, parentheticals, and double whitespace to the same key', () => {
    const records = [
      {
        id: 'rec1', staffName: 'MRS. ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 10, ...baseFields,
      },
      {
        id: 'rec2', staffName: 'ADEBAYO  OLUSEGUN (LATE)',
        periodYear: 2024, periodMonth: 8, sourceRow: 11, ...baseFields,
      },
      {
        id: 'rec3', staffName: 'Dr. Adebayo Olusegun',
        periodYear: 2024, periodMonth: 8, sourceRow: 12, ...baseFields,
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].context.dataPoints).toHaveProperty('duplicateCount', 3);
    expect(obs[0].context.dataPoints).toHaveProperty('recordIds', ['rec1', 'rec2', 'rec3']);
  });

  // Review M3: distinct-employeeNo escape hatch — two records with the same
  // normalised name but different staff IDs are almost certainly different
  // people and must not be flagged (or blocked at baseline).
  it('skips the group when all records have distinct non-null employeeNos', () => {
    const records = [
      {
        id: 'rec1', staffName: 'MUHAMMED ALIYU',
        periodYear: 2024, periodMonth: 8, sourceRow: 10,
        mdaId: MDA_ID, employeeNo: 'STAFF-1001',
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1',
      },
      {
        id: 'rec2', staffName: 'MUHAMMED ALIYU',
        periodYear: 2024, periodMonth: 8, sourceRow: 11,
        mdaId: MDA_ID, employeeNo: 'STAFF-2042',
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1',
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(0);
  });

  it('still flags a group when employeeNos are the same (single person, double row)', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 10,
        mdaId: MDA_ID, employeeNo: 'STAFF-777',
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1',
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 11,
        mdaId: MDA_ID, employeeNo: 'STAFF-777',
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1',
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].context.dataPoints).toHaveProperty('duplicateCount', 2);
  });

  it('still flags a mixed group where one record has a null employeeNo', () => {
    const records = [
      {
        id: 'rec1', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 10,
        mdaId: MDA_ID, employeeNo: 'STAFF-777',
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1',
      },
      {
        id: 'rec2', staffName: 'ADEBAYO OLUSEGUN',
        periodYear: 2024, periodMonth: 8, sourceRow: 11,
        mdaId: MDA_ID, employeeNo: null,
        sourceFile: 'file.xlsx', sourceSheet: 'Sheet1',
      },
    ];

    const obs = detectWithinFileDuplicates(records, mdaMap, UPLOAD_ID);
    expect(obs).toHaveLength(1);
    expect(obs[0].context.dataPoints).toHaveProperty('duplicateCount', 2);
  });
});
