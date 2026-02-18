const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Usage: node xlsx-to-csv.js <path-to-xlsx>");
  process.exit(1);
}

const workbook = XLSX.readFile(inputFile);

const outputDir = path.dirname(inputFile);
const baseName = path.basename(inputFile, path.extname(inputFile));

workbook.SheetNames.forEach((sheetName, i) => {
  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);

  const safeName = sheetName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const suffix = workbook.SheetNames.length > 1 ? `_${safeName}` : "";
  const outPath = path.join(outputDir, `${baseName}${suffix}.csv`);

  fs.writeFileSync(outPath, csv, "utf8");
  console.log(`Written: ${outPath}`);
});
