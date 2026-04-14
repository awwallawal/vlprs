import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { detectHeaderRow } from '../src/migration/headerDetect.ts';
import { mapColumns } from '../src/migration/columnMap.ts';

const file = path.resolve(import.meta.dirname, '../../../docs/Car_Loan/SPORTS_COUNCIL_NEW CAR LOAN TEMPLATE JANUARY 2024.xlsx');
const wb = XLSX.read(fs.readFileSync(file), { cellDates: true });

for (const sn of wb.SheetNames) {
  const sheet = wb.Sheets[sn];
  const header = detectHeaderRow(sheet);
  console.log(`\n=== ${sn} ===`);
  console.log('Header row:', header.headerRowIndex);
  console.log('Confidence:', header.confidence);
  console.log('Raw columns:');
  header.rawColumns.forEach((c, i) => console.log(`  [${i}] "${c}"`));

  const mapping = mapColumns(header.rawColumns);
  console.log('\nMapped:');
  for (const [i, f] of mapping.indexToField) {
    console.log(`  [${i}] "${header.rawColumns[i]}" -> ${f}`);
  }
  console.log('\nUnrecognized:');
  for (const u of mapping.unrecognized) {
    console.log(`  [${u.index}] "${u.name}"`);
  }
}
