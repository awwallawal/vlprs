import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import { parseCommitteeFile, threeVectorValidation, type ParsedRecord } from './committeeListService';

function createExcelBuffer(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

describe('committeeListService.parseCommitteeFile', () => {
  it('D1.10: parse 5-column approval file → correct schema detection + records', async () => {
    const buffer = createExcelBuffer({
      Sheet1: [
        ['S/N', 'Name', 'MDA', 'GL', 'Amount'],
        [1, 'JOHN DOE', 'HEALTH', '07', 500000],
        [2, 'JANE SMITH', 'AGRICULTURE', '10', 750000],
        [3, 'BOB JONES', 'FINANCE', '12', 600000],
      ],
    });

    const result = await parseCommitteeFile(buffer, 'test.xlsx');

    expect(result.schemaType).toBe('approval');
    expect(result.records.length).toBe(3);
    expect(result.records[0].name).toBe('JOHN DOE');
    expect(result.records[0].mdaRaw).toBe('HEALTH');
    expect(result.records[0].gradeLevel).toBe('07');
    expect(result.records[0].approvedAmount).toBe('500000');
    expect(result.records[0].listType).toBe('APPROVAL');
    // Financial fields should be null for approval schema
    expect(result.records[0].principal).toBeNull();
  });

  it('D1.11: parse 17-column retiree file → correct schema detection + financial fields', async () => {
    const buffer = createExcelBuffer({
      Sheet1: [
        ['S/N', 'Name', 'MDA', 'GL', 'Principal', 'Interest', 'Total Loan', 'Monthly Deduction',
         'Inst Paid', 'Total Princ Paid', 'Total Int Paid', 'Total Loan Paid',
         'Out Principal', 'Out Interest', 'Out Balance', 'Inst Outstanding',
         'Collection Date', 'Commencement Date'],
        [1, 'ADEWALE BOSEDE', 'HEALTH', '10', 500000, 66650, 566650, 9444.17,
         12, 111111.11, 7998, 119109.11,
         388888.89, 58652, 447540.89, 48,
         '2025-01-15', '2024-01-15'],
      ],
    });

    const result = await parseCommitteeFile(buffer, 'test.xlsx');

    expect(result.schemaType).toBe('retiree');
    expect(result.records.length).toBe(1);
    expect(result.records[0].name).toBe('ADEWALE BOSEDE');
    expect(result.records[0].listType).toBe('RETIREE');
    expect(result.records[0].principal).toBe('500000');
    expect(result.records[0].interest).toBe('66650');
    expect(result.records[0].totalLoan).toBe('566650');
    expect(result.records[0].installmentsPaid).toBe(12);
    expect(result.records[0].outstandingBalance).toBe('447540.89');
    expect(result.records[0].collectionDate).toBe('2025-01-15');
  });

  it('D1.12: "LATE ADEWALE BOSEDE" → DECEASED flag + name "ADEWALE BOSEDE"', async () => {
    const buffer = createExcelBuffer({
      Sheet1: [
        ['S/N', 'Name', 'MDA', 'GL', 'Principal', 'Interest', 'Total Loan', 'Monthly Deduction',
         'Inst Paid', 'Total Princ Paid', 'Total Int Paid', 'Total Loan Paid',
         'Out Principal', 'Out Interest', 'Out Balance', 'Inst Outstanding',
         'Collection Date', 'Commencement Date'],
        [1, 'LATE ADEWALE BOSEDE', 'HEALTH', '10', 500000, 66650, 566650, 9444.17,
         12, 111111, 7998, 119109,
         388889, 58652, 447541, 48,
         '2025-01-15', '2024-01-15'],
      ],
    });

    const result = await parseCommitteeFile(buffer, 'test.xlsx');

    expect(result.records[0].name).toBe('ADEWALE BOSEDE');
    expect(result.records[0].listType).toBe('DECEASED');
  });

  it('D1.13: file with title row (no header row) → parsed correctly', async () => {
    const buffer = createExcelBuffer({
      Sheet1: [
        ['VEHICLE LOAN COLLATION 2024'],
        ['S/N', 'Name', 'MDA', 'GL', 'Amount'],
        [1, 'TEST USER', 'FINANCE', '08', 300000],
      ],
    });

    const result = await parseCommitteeFile(buffer, 'test.xlsx');

    expect(result.records.length).toBe(1);
    expect(result.records[0].name).toBe('TEST USER');
    expect(result.records[0].mdaRaw).toBe('FINANCE');
  });

  it('skips PAYMENT sheets for retiree files', async () => {
    const buffer = createExcelBuffer({
      'RETIREES': [
        ['S/N', 'Name', 'MDA', 'GL', 'Principal', 'Interest', 'Total Loan', 'Monthly Deduction',
         'Inst Paid', 'Total Princ Paid', 'Total Int Paid', 'Total Loan Paid',
         'Out Principal', 'Out Interest', 'Out Balance', 'Inst Outstanding',
         'Collection Date', 'Commencement Date'],
        [1, 'WORKER A', 'HEALTH', '10', 500000, 66650, 566650, 9444,
         12, 111111, 7998, 119109, 388889, 58652, 447541, 48, '2025-01', '2024-01'],
      ],
      'PAYMENT LIST': [
        ['Should be skipped'],
      ],
    });

    const result = await parseCommitteeFile(buffer, 'test.xlsx');

    expect(result.sheets.length).toBe(2);
    const paymentSheet = result.sheets.find((s) => s.sheetName === 'PAYMENT LIST');
    expect(paymentSheet?.skipped).toBe(true);
    expect(result.records.length).toBe(1);
  });

  it('flags null GL and duplicate names as data quality issues', async () => {
    const buffer = createExcelBuffer({
      Sheet1: [
        ['S/N', 'Name', 'MDA', 'GL', 'Amount'],
        [1, 'DUPLICATE USER', 'HEALTH', null, 500000],
        [2, 'DUPLICATE USER', 'FINANCE', '10', 600000],
      ],
    });

    const result = await parseCommitteeFile(buffer, 'test.xlsx');

    expect(result.dataQualityFlags.length).toBeGreaterThanOrEqual(2);
    const glFlag = result.dataQualityFlags.find((f) => f.issue === 'Null GL');
    expect(glFlag).toBeDefined();
    const dupFlag = result.dataQualityFlags.find((f) => f.issue.includes('Duplicate name'));
    expect(dupFlag).toBeDefined();
  });
});

describe('threeVectorValidation (Track 2, Task F2)', () => {
  it('categorizes records as clean, variance, or requires_verification', () => {
    const records: ParsedRecord[] = [
      {
        sourceRow: 2, sourceSheet: 'Sheet1', name: 'CLEAN WORKER',
        mdaRaw: 'HEALTH', gradeLevel: '10', approvedAmount: '500000',
        listType: 'RETIREE',
        // Scheme expected for 500000: totalLoan = 566650 (P×13.33%÷60×60 + P)
        principal: '500000', interest: '66650', totalLoan: '566650',
        monthlyDeduction: '9444.17',
        installmentsPaid: 12, totalPrincipalPaid: '100000', totalInterestPaid: '7998',
        totalLoanPaid: '107998', outstandingPrincipal: '400000', outstandingInterest: '58652',
        outstandingBalance: '458652', installmentsOutstanding: 48,
        collectionDate: null, commencementDate: null,
      },
      {
        sourceRow: 3, sourceSheet: 'Sheet1', name: 'NO PRINCIPAL',
        mdaRaw: 'HEALTH', gradeLevel: '10', approvedAmount: null,
        listType: 'RETIREE',
        principal: null, interest: null, totalLoan: '300000',
        monthlyDeduction: '5000',
        installmentsPaid: null, totalPrincipalPaid: null, totalInterestPaid: null,
        totalLoanPaid: null, outstandingPrincipal: null, outstandingInterest: null,
        outstandingBalance: null, installmentsOutstanding: null,
        collectionDate: null, commencementDate: null,
      },
    ];

    const results = threeVectorValidation(records);

    expect(results.length).toBe(2);

    // First record should have scheme expected computed
    expect(results[0].name).toBe('CLEAN WORKER');
    expect(results[0].schemeExpected).not.toBeNull();
    expect(['clean', 'variance']).toContain(results[0].category);

    // Second record has no principal → requires_verification
    expect(results[1].name).toBe('NO PRINCIPAL');
    expect(results[1].schemeExpected).toBeNull();
    expect(results[1].category).toBe('requires_verification');
  });
});
