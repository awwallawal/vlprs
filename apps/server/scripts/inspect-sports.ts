import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const file = path.resolve(import.meta.dirname, '../../../docs/Car_Loan/SPORTS_COUNCIL_NEW CAR LOAN TEMPLATE JANUARY 2024.xlsx');
const wb = XLSX.read(fs.readFileSync(file), { cellDates: true });
console.log('Sheets:', wb.SheetNames);
for (const sn of wb.SheetNames) {
  const sheet = wb.Sheets[sn];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  console.log(`\n=== ${sn} (${rows.length} rows) ===`);
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const r = rows[i] as unknown[];
    const cells = r.map(c => c == null ? '' : String(c).slice(0, 20)).slice(0, 15);
    console.log(`Row ${i}:`, cells);
  }
}
