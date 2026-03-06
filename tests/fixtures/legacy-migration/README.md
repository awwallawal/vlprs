# Legacy Migration Regression Fixture Suite

Curated set of 7 representative legacy Excel files with paired known-good expected outputs, extracted from the SQ-1 analysis pipeline. Used as regression targets for Epic 3 (Data Migration & Legacy Import) stories.

## Fixture Files

| # | File | Purpose | Era | MDA | Sheets | Records | Cols |
|---|------|---------|-----|-----|--------|---------|------|
| 1 | `MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx` | Era 1 — minimal 12-column format, no MDA column, no interest breakdown | 1 | Agriculture (alias) | 13 | 2,125 | 12 |
| 2 | `APRIL 2021 SEC CAR SOFTCOPY.xlsx` | Era 2 — expanded 16-column format with Employee No | 2 | AG Office (alias) | 1 | 123 | 16 |
| 3 | `2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx` | Era 3 — CDU standardised template, dominant format | 3 | CDU (exact) | 18 | 354 | 18 |
| 4 | `AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx` | Era 4 — modern 19-column format with START DATE / END DATE | 4 | Audit Service Commission (alias) | 10 | 38 | 19 |
| 5 | `agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx` | Multi-MDA — Agriculture file containing embedded CDU records ("COCOA DEVELOPMENT UNIT" marker in Column 3 mid-sheet) | 4 | Agriculture (exact) | 2 | 346 | 18 |
| 6 | `APRIL 2020 sec car loan.xlsx` | Edge case — unusual headers: mixed eras (1 & 3) within single file, wildly varying column counts (5/6/7/9/17/21), low header confidence on some sheets | 1,3 | AG Office (alias) | 6 | 846 | 5-21 |
| 7 | `EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx` | Stress test — highest sheet count in corpus, spans eras 1-3, tests volume parsing | 1,2,3 | Education (alias) | 55 | 9,833 | 12-18 |

**Coverage:** All 4 eras, 5 MDAs, CDU embedding pattern, 105 total sheets, 13,665 total records.

## Expected Output Files

Each fixture file has a paired `.expected.json` file (e.g., `MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx.expected.json`) containing the SQ-1 known-good parse output for that file.

### How expected outputs were generated

The `.expected.json` files are **exact extracts** from `docs/legacy_cd/output/catalog.json` — the Phase 1 output of the SQ-1 `analyze.ts` pipeline. No manual edits were applied; the files are byte-identical subsets of the full catalog.

### Expected output structure

Each `.expected.json` contains one catalog entry:

```json
{
  "filename": "string — original Excel filename",
  "mda": {
    "code": "string — MDA code (e.g. AGRICULTURE)",
    "name": "string — resolved MDA name",
    "confidence": "exact | alias | fuzzy | unresolved",
    "source": "string — how MDA was determined (filename, column, title)",
    "rawInput": "string — raw MDA text from file"
  },
  "sheets": [
    {
      "sheet": "string — Excel sheet/tab name",
      "period": { "year": "number", "month": "number" },
      "era": "number — format era (1-4)",
      "headerConfidence": "number — 0-1 confidence score",
      "columnCount": "number — detected columns",
      "unrecognizedColumns": ["string[] — columns not in canonical set"],
      "recordCount": "number — records parsed from this sheet",
      "records": [
        {
          "sourceFile": "string",
          "sheet": "string",
          "rowNumber": "number",
          "period": { "year": "number", "month": "number" },
          "mda": {
            "raw": "string",
            "resolved": "string",
            "code": "string",
            "confidence": "string",
            "source": "string"
          },
          "fields": {
            "staffName": "string",
            "mda": "string",
            "serialNumber": "number | null",
            "principal": "string | null",
            "interestTotal": "string | null",
            "totalLoan": "string | null",
            "monthlyDeduction": "string | null",
            "monthlyInterest": "string | null",
            "monthlyPrincipal": "string | null",
            "totalInterestPaid": "string | null",
            "totalOutstandingInterest": "string | null",
            "totalLoanPaid": "string | null",
            "outstandingBalance": "string | null",
            "installmentCount": "number | null",
            "installmentsPaid": "number | null",
            "installmentsOutstanding": "number | null",
            "remarks": "string | null",
            "startDate": "string | null",
            "endDate": "string | null",
            "employeeNo": "string | null",
            "refId": "string | null",
            "commencementDate": "string | null",
            "station": "string | null"
          }
        }
      ]
    }
  ]
}
```

## SQ-1 Pipeline Context

The SQ-1 legacy analysis pipeline (`scripts/legacy-report/`) processes all 122+ legacy Excel files in `docs/legacy_cd/`:

- **Phase 1 — `analyze.ts`:** Reads `.xlsx` files, detects headers (`utils/header-detect.ts`), maps columns (`utils/column-map.ts`), resolves MDAs (`utils/mda-resolve.ts`), extracts records. Writes `catalog.json` (the source for `.expected.json` files).
- **Phase 2 — `crossref.ts`:** Cross-references catalog records with approved beneficiary lists, builds person timelines. Writes `analysis.json`.
- **Phase 3 — `report.ts`:** Generates HTML reports from analysis.json.

The `.expected.json` files correspond to **Phase 1 output only** — per-file entries from `catalog.json`.

## Regeneration Instructions

If the SQ-1 pipeline is updated and `catalog.json` changes, regenerate the expected outputs:

```bash
# 1. Re-run the SQ-1 pipeline (from repo root)
cd scripts/legacy-report
npx tsx analyze.ts

# 2. Re-extract fixture entries from the updated catalog.json
cd ../..
node -e "
const fs = require('fs');
const path = require('path');
const catalog = JSON.parse(fs.readFileSync('docs/legacy_cd/output/catalog.json', 'utf8'));
const dir = 'tests/fixtures/legacy-migration';
const fixtures = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
for (const fixture of fixtures) {
  const entry = catalog.find(e => e.filename === fixture);
  if (entry) {
    fs.writeFileSync(path.join(dir, fixture + '.expected.json'), JSON.stringify(entry, null, 2));
    console.log('Updated: ' + fixture);
  } else {
    console.log('NOT FOUND: ' + fixture);
  }
}
"
```

## Field Mapping: SQ-1 to VLPRS Schema

Reference for Stories 3.1+ when building the migration engine. The SQ-1 `fields` object maps to VLPRS database columns:

| SQ-1 Field (`fields.*`) | VLPRS Schema Target | Notes |
|--------------------------|---------------------|-------|
| `staffName` | `staff.name` / `loan.borrower_name` | Primary identifier in legacy data |
| `principal` | `loan.principal_amount` | String in SQ-1, numeric in VLPRS |
| `totalLoan` | `loan.total_loan_amount` | Principal + interest |
| `outstandingBalance` | `repayment_ledger` computation | Derived in VLPRS, stored in SQ-1 |
| `monthlyDeduction` | `repayment_schedule.installment_amount` | Per-period deduction amount |
| `installmentCount` | `loan.tenure_months` | Total installments |
| `installmentsPaid` | Derived from `repayment_ledger` | Count of completed payments |
| `employeeNo` | `staff.employee_number` | Era 2+ only |
| `commencementDate` | `loan.commencement_date` | Era 2+ (TAVS date) |
| `startDate` / `endDate` | `loan.start_date` / `loan.end_date` | Era 4 only |
| `mda` | `mda.name` (via `mda_registry`) | Resolved MDA name |
| `station` | `staff.station` | Work location, some eras only |
| `refId` | `loan.reference_id` | Internal reference, some eras only |

**Type conversion notes:**
- SQ-1 stores financial amounts as strings (preserving Excel precision). VLPRS stores them as numeric (`decimal` / `numeric`).
- SQ-1 `period` is `{ year, month }`. VLPRS uses a `period_date` column (`date` type, first of month).
- SQ-1 `era` is inferred from column count. VLPRS may store this as `format_era` metadata on the migration batch.
