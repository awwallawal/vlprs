import { describe, it, expect } from 'vitest';
import { mapColumns, extractRecord } from './columnMap';

describe('mapColumns', () => {
  it('maps standard Era 3 headers', () => {
    const headers = [
      'S/N', 'NAME', 'PRINCIPAL', 'INTEREST ACCORDING TO INSTALMENT',
      'TOTAL LOAN', 'NO. OF INSTAL.', 'MONTHLY DEDUCTION', 'MONTHLY INTEREST',
      'MONTHLY PRINCIPAL', 'TOTAL INTEREST PAID', 'TOTAL OUTSTANDING INTEREST',
      'NO. OF INSTAL. PAID', 'NO. OF INSTAL. OUTSTANDING', 'TOTAL LOAN PAID',
      'OUTSTANDING BALANCE', 'START DATE', 'END DATE', 'REMARKS',
    ];
    const mapping = mapColumns(headers);

    expect(mapping.fieldToIndex.get('serialNumber')).toBe(0);
    expect(mapping.fieldToIndex.get('staffName')).toBe(1);
    expect(mapping.fieldToIndex.get('principal')).toBe(2);
    expect(mapping.fieldToIndex.get('interestTotal')).toBe(3);
    expect(mapping.fieldToIndex.get('totalLoan')).toBe(4);
    expect(mapping.fieldToIndex.get('installmentCount')).toBe(5);
    expect(mapping.fieldToIndex.get('monthlyDeduction')).toBe(6);
    expect(mapping.fieldToIndex.get('startDate')).toBe(15);
    expect(mapping.fieldToIndex.get('endDate')).toBe(16);
    expect(mapping.fieldToIndex.get('remarks')).toBe(17);
    expect(mapping.unrecognized.length).toBe(0);
  });

  it('maps Era 1 minimal headers', () => {
    const headers = [
      'S/N', 'NAMES', 'PRINCIPAL', 'INTEREST', 'TOTAL LOAN',
      'NO OF INSTAL', 'MONTHLY DEDUCTION', 'INSTAL PAID',
      'TOTAL LOAN PAID', 'OUTSD. BALANCE', 'REMARK', 'No of instal outst',
    ];
    const mapping = mapColumns(headers);
    expect(mapping.fieldToIndex.get('staffName')).toBe(1);
    expect(mapping.fieldToIndex.get('outstandingBalance')).toBe(9);
  });

  it('captures unrecognized columns', () => {
    const headers = ['S/N', 'NAME', 'PHONE NUMBER', 'BANK NAME'];
    const mapping = mapColumns(headers);
    expect(mapping.unrecognized.length).toBe(2);
    expect(mapping.unrecognized[0].name).toBe('PHONE NUMBER');
  });

  it('maps DOB and appointment date patterns', () => {
    const headers = ['S/N', 'NAME', 'DOB', 'DATE OF FIRST APPOINTMENT'];
    const mapping = mapColumns(headers);
    expect(mapping.fieldToIndex.get('dateOfBirth')).toBe(2);
    expect(mapping.fieldToIndex.get('dateOfFirstAppointment')).toBe(3);
  });

  it('maps D.O.B and APPOINTMENT DATE variants', () => {
    const headers = ['S/N', 'NAME', 'D.O.B', 'APPOINTMENT DATE'];
    const mapping = mapColumns(headers);
    expect(mapping.fieldToIndex.get('dateOfBirth')).toBe(2);
    expect(mapping.fieldToIndex.get('dateOfFirstAppointment')).toBe(3);
  });

  it('first match wins for duplicate column names', () => {
    const headers = ['S/N', 'NAME', 'PRINCIPAL', 'PRINCIPAL'];
    const mapping = mapColumns(headers);
    expect(mapping.fieldToIndex.get('principal')).toBe(2);
  });

  it('strips trailing formatting markers', () => {
    const headers = ['S/N.', 'NAME.', 'PRINCIPAL N', 'TOTAL LOAN #'];
    const mapping = mapColumns(headers);
    expect(mapping.fieldToIndex.get('serialNumber')).toBe(0);
    expect(mapping.fieldToIndex.get('principal')).toBe(2);
    expect(mapping.fieldToIndex.get('totalLoan')).toBe(3);
  });
});

describe('extractRecord', () => {
  it('extracts values from row using mapping', () => {
    const mapping = mapColumns(['S/N', 'NAME', 'PRINCIPAL']);
    const row = [1, 'John Doe', 500000];
    const record = extractRecord(row, mapping);
    expect(record.serialNumber).toBe(1);
    expect(record.staffName).toBe('John Doe');
    expect(record.principal).toBe(500000);
  });

  it('returns null for missing values', () => {
    const mapping = mapColumns(['S/N', 'NAME', 'PRINCIPAL']);
    const row = [1, 'Jane', null];
    const record = extractRecord(row, mapping);
    expect(record.principal).toBeNull();
  });
});
