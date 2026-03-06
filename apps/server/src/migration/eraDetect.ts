/**
 * eraDetect.ts — Detect format era from column count and field presence.
 * Ported from scripts/legacy-report/analyze.ts → detectEra().
 *
 * Era 1 (pre-2018): <=12 columns, no MDA column, no interest breakdown
 * Era 2 (2018-2020): 13-16 columns, has Employee No / TAVS Commencement Date
 * Era 3 (2020-2023): 17-18 columns, CDU standardised template (dominant format)
 * Era 4 (2023+): 17-19 columns, has START DATE / END DATE fields
 */

export function detectEra(
  columnCount: number,
  hasStartDate: boolean,
  hasMdaCol: boolean,
  hasEmployeeNo: boolean,
): number {
  if (columnCount <= 12 && !hasMdaCol) return 1;
  if (columnCount >= 13 && columnCount <= 16 && hasEmployeeNo) return 2;
  if (hasStartDate) return 4;
  if (columnCount >= 17) return 3;
  if (columnCount >= 13 && columnCount <= 16) return 2;
  return 3; // default to dominant era
}
