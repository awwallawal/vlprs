/**
 * columnMap.ts — Normalize 298+ column naming variants to 24 canonical fields.
 * Ported from scripts/legacy-report/utils/column-map.ts (SQ-1).
 * Extended with dateOfBirth and dateOfFirstAppointment patterns.
 */

import type { CanonicalField } from '@vlprs/shared';

/**
 * Mapping rules: [regex pattern, canonical field name].
 * Order matters — first match wins. More specific patterns go first.
 */
const COLUMN_RULES: Array<[RegExp, CanonicalField]> = [
  // Serial number
  [/^s\/?n\.?o?\.?$/i, 'serialNumber'],

  // Staff name
  [/^staff\s*name$/i, 'staffName'],
  [/^(staff\s*)?names?$/i, 'staffName'],
  [/^name$/i, 'staffName'],
  [/^name\s*of\s*officers?$/i, 'staffName'],
  [/^surname/i, 'staffName'],

  // MDA
  [/^mda'?s?$/i, 'mda'],

  // Start/End dates (must come before generic "date" matchers)
  [/^start\s*date$/i, 'startDate'],
  [/^end\s*date$/i, 'endDate'],
  [/^(tavs\s*)?comme?ncement\s*date$/i, 'commencementDate'],

  // Employee / Staff ID (must come before generic patterns)
  [/^employee\s*no\.?$/i, 'employeeNo'],
  [/^(ref\.?\s*i\.?d\.?|staff\s*id)$/i, 'refId'],

  // Date of Birth (before generic patterns)
  [/^d\.?o\.?b\.?$/i, 'dateOfBirth'],
  [/^date\s*of\s*birth$/i, 'dateOfBirth'],
  [/^birth\s*date$/i, 'dateOfBirth'],

  // Date of First Appointment (before generic patterns)
  [/^date\s*of\s*(first\s*|1st\s*)?app(ointmen)?t\.?$/i, 'dateOfFirstAppointment'],
  [/^(first\s*)?app(ointmen)?t\.?\s*date$/i, 'dateOfFirstAppointment'],
  [/^date\s*of\s*1st\s*appt?\.?$/i, 'dateOfFirstAppointment'],

  // Grade Level (note: bare "level" may match non-grade columns — first-match-wins mitigates)
  [/^grade\s*level$/i, 'gradeLevel'],
  [/^gl$/i, 'gradeLevel'],
  [/^level$/i, 'gradeLevel'],

  // Station
  [/^station$/i, 'station'],

  // Outstanding balance — specific patterns first
  [/^out\s*s?t?a?n?d?i?n?g?\s*balance$/i, 'outstandingBalance'],
  [/^outstanding\s+bal\.?$/i, 'outstandingBalance'],
  [/^outsd\.?\s*bal(ance)?\.?$/i, 'outstandingBalance'],
  [/^bal\.?$/i, 'outstandingBalance'],
  [/^outstanding$/i, 'outstandingBalance'],

  // Total loan paid
  [/^total\s*loan\s*paid/i, 'totalLoanPaid'],

  // Installments outstanding (period after "INSTAL." is common)
  [/^no\.?\s*(of\.?)?\s*instal(l?ment)?\.?\s*outstanding/i, 'installmentsOutstanding'],
  [/^out\s*s?t?a?n?d?i?n?g?\s*instal/i, 'installmentsOutstanding'],

  // Installments paid
  [/^no\.?\s*(of\.?)?\s*instal(l?ment)?\.?\s*paid/i, 'installmentsPaid'],
  [/^instal(l?ment)?\.?\s*paid/i, 'installmentsPaid'],

  // Total outstanding interest
  [/^total\s*outstanding\s*int(e?r[ea]st|rest)/i, 'totalOutstandingInterest'],
  [/^total\s*outstanding$/i, 'totalOutstandingInterest'],

  // Total interest paid
  [/^total\s*interest\s*paid/i, 'totalInterestPaid'],
  [/^total\s*interest$/i, 'totalInterestPaid'],

  // Monthly principal (includes typos)
  [/^mont?ht?l?y\s*principal$/i, 'monthlyPrincipal'],

  // Monthly interest
  [/^monthly\s*interest$/i, 'monthlyInterest'],

  // Monthly deduction
  [/^monthl?y\s*(deduction|ded)/i, 'monthlyDeduction'],

  // Number of installments (count)
  [/^(total\s*)?no\.?\s*(of\.?)?\s*i(n?st|nst)(a?l\.?(l?ment)?)?\.?$/i, 'installmentCount'],

  // Total loan (must come after "total loan paid")
  [/^total\s*loan(\s*#)?$/i, 'totalLoan'],

  // Interest total
  [/^(total\s*)?interest\s*(according\s*to\s*instal|n$)/i, 'interestTotal'],
  [/^interest\s*according$/i, 'interestTotal'],
  [/^interest$/i, 'interestTotal'],

  // Principal (must come after "monthly principal")
  [/^principal(\s*[n#])?$/i, 'principal'],

  // Remarks
  [/^remark/i, 'remarks'],
];

export interface ColumnMapping {
  indexToField: Map<number, CanonicalField>;
  fieldToIndex: Map<CanonicalField, number>;
  unrecognized: Array<{ index: number; name: string }>;
}

export function mapColumns(rawColumns: string[]): ColumnMapping {
  const indexToField = new Map<number, CanonicalField>();
  const fieldToIndex = new Map<CanonicalField, number>();
  const unrecognized: Array<{ index: number; name: string }> = [];

  for (let i = 0; i < rawColumns.length; i++) {
    const raw = rawColumns[i].trim();
    if (!raw) continue;

    // Normalize: collapse whitespace, strip trailing periods/hashes/N formatting markers
    const normalized = raw.replace(/\s+/g, ' ').replace(/[\s.#]+$/, '').replace(/\s+N$/, '').trim();

    let matched = false;
    for (const [pattern, field] of COLUMN_RULES) {
      if (pattern.test(normalized)) {
        if (!fieldToIndex.has(field)) {
          indexToField.set(i, field);
          fieldToIndex.set(field, i);
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Skip pure numeric values (formatting artifacts)
      if (/^\d+$/.test(normalized)) continue;
      unrecognized.push({ index: i, name: raw });
    }
  }

  return { indexToField, fieldToIndex, unrecognized };
}

export function extractRecord(
  row: unknown[],
  mapping: ColumnMapping,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [index, field] of mapping.indexToField) {
    record[field] = row[index] ?? null;
  }
  return record;
}
