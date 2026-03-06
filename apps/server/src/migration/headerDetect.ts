/**
 * headerDetect.ts — Smart multi-row header detection for legacy CD Excel files.
 * Ported from scripts/legacy-report/utils/header-detect.ts (SQ-1).
 *
 * Scans rows 0-15, scores by keyword matches, handles multi-row headers
 * and merged cells.
 */

import XLSX from 'xlsx';
type WorkSheet = XLSX.WorkSheet;
type XlsxRange = XLSX.Range;

export interface HeaderResult {
  headerRowIndex: number;
  columns: string[];      // resolved column names (lowercased+trimmed)
  rawColumns: string[];   // original column names as-is
  confidence: 'high' | 'medium' | 'low';
  titleRows: string[];    // text from rows above header
}

const HEADER_KEYWORDS = [
  'S/N', 'S/NO', 'SN',
  'NAME', 'NAMES', 'STAFF',
  'PRINCIPAL',
  'INTEREST',
  'LOAN',
  'INSTALMENT', 'INSTALLMENT', 'INSTAL',
  'DEDUCTION',
  'BALANCE',
  'OUTSTANDING',
  'MDA',
  'REMARK',
  'MONTHLY',
  'TOTAL',
  'NO OF',
  'EMPLOYEE',
  'REF',
  'STATION',
  'START DATE', 'END DATE',
  'COMMENCEMENT',
];

function scoreRow(cells: unknown[]): number {
  let score = 0;
  for (const cell of cells) {
    if (cell === null || cell === undefined) continue;
    const s = String(cell).trim().toUpperCase();
    if (s === '') continue;
    for (const keyword of HEADER_KEYWORDS) {
      if (s.includes(keyword)) {
        score++;
        break;
      }
    }
  }
  return score;
}

function isDataRow(cells: unknown[]): boolean {
  const first = cells[0];
  if (first === null || first === undefined) return false;
  const n = Number(first);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function extractTitleText(rows: unknown[][], upToRow: number): string[] {
  const titles: string[] = [];
  for (let i = 0; i < upToRow && i < rows.length; i++) {
    const row = rows[i];
    const texts = row
      .filter((c): c is string | number => c !== null && c !== undefined)
      .map(c => String(c).trim())
      .filter(s => s.length > 0);
    if (texts.length > 0) {
      titles.push(texts.join(' '));
    }
  }
  return titles;
}

function resolveHeaderMerges(
  headerCells: unknown[],
  merges: XlsxRange[] | undefined,
  headerRowIdx: number,
  totalCols: number,
): string[] {
  const resolved: string[] = new Array(totalCols).fill('');

  for (let c = 0; c < totalCols; c++) {
    const val = headerCells[c];
    if (val !== null && val !== undefined) {
      resolved[c] = String(val).trim();
    }
  }

  if (merges) {
    for (const merge of merges) {
      if (merge.s.r <= headerRowIdx && merge.e.r >= headerRowIdx) {
        const val = resolved[merge.s.c] || '';
        for (let c = merge.s.c; c <= merge.e.c && c < totalCols; c++) {
          if (!resolved[c]) resolved[c] = val;
        }
      }
    }
  }

  return resolved;
}

function isLikelyHeaderContinuation(row: unknown[]): boolean {
  const first = row[0];
  if (first !== null && first !== undefined) {
    const n = Number(first);
    if (Number.isInteger(n) && n >= 1 && n <= 10) return false;
  }

  let textCells = 0;
  let numericCells = 0;
  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    if (typeof cell === 'number') numericCells++;
    else if (typeof cell === 'string' && cell.trim()) textCells++;
  }

  const total = textCells + numericCells;
  if (total === 0) return false;
  return numericCells < total * 0.5;
}

function tryMergeAdjacentRow(
  primary: string[],
  adjacent: unknown[],
  totalCols: number,
): string[] {
  if (!isLikelyHeaderContinuation(adjacent)) return primary;

  const improved = [...primary];
  let improvements = 0;

  for (let c = 0; c < totalCols; c++) {
    const adj = adjacent[c] !== null && adjacent[c] !== undefined
      ? String(adjacent[c]).trim()
      : '';
    if (!adj) continue;

    if (!primary[c]) {
      if (typeof adjacent[c] === 'string') {
        improved[c] = adj;
        improvements++;
      }
    } else if (primary[c].length <= 20 && adj.length > 0 && typeof adjacent[c] === 'string') {
      const combined = primary[c] + ' ' + adj;
      if (scoreRow([combined]) > 0) {
        improved[c] = combined;
        improvements++;
      }
    }
  }

  return improvements > 0 ? improved : primary;
}

export function detectHeaderRow(sheet: WorkSheet): HeaderResult {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  });

  const maxScan = Math.min(rows.length, 16);
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  const totalCols = range ? range.e.c + 1 : 0;

  let bestRowIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i];
    if (!row) continue;
    const score = scoreRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = i;
    }
  }

  if (bestRowIdx === -1 || bestScore < 2) {
    for (let i = 0; i < maxScan; i++) {
      if (rows[i] && isDataRow(rows[i])) {
        bestRowIdx = Math.max(0, i - 1);
        break;
      }
    }
  }

  if (bestRowIdx === -1) {
    return {
      headerRowIndex: 0,
      columns: [],
      rawColumns: [],
      confidence: 'low',
      titleRows: extractTitleText(rows, Math.min(3, rows.length)),
    };
  }

  const rawColumns = resolveHeaderMerges(
    rows[bestRowIdx] || [],
    sheet['!merges'],
    bestRowIdx,
    totalCols,
  );

  let finalRaw = [...rawColumns];
  let parentRowUsed = false;
  if (bestRowIdx > 0) {
    const rowAbove = rows[bestRowIdx - 1] || [];
    const aboveScore = scoreRow(rowAbove);
    const nonEmpty = (rowAbove as unknown[]).filter(
      c => c !== null && c !== undefined && String(c).trim() !== '',
    ).length;
    if (aboveScore >= 2 && nonEmpty >= 3) {
      const parentResolved = resolveHeaderMerges(
        rowAbove as unknown[], sheet['!merges'], bestRowIdx - 1, totalCols,
      );
      for (let c = 0; c < totalCols; c++) {
        const parent = (parentResolved[c] || '').trim();
        if (!parent) continue;
        if (!finalRaw[c]) {
          finalRaw[c] = parent;
        } else {
          finalRaw[c] = parent + ' ' + finalRaw[c];
        }
      }
      parentRowUsed = true;
    }
  }

  if (bestRowIdx + 1 < rows.length) {
    const rowBelow = rows[bestRowIdx + 1] || [];
    finalRaw = tryMergeAdjacentRow(finalRaw, rowBelow, totalCols);
    const emptyAfterFirst = finalRaw.filter(c => !c).length;
    if (emptyAfterFirst > 2 && bestRowIdx + 2 < rows.length) {
      const rowBelow2 = rows[bestRowIdx + 2] || [];
      finalRaw = tryMergeAdjacentRow(finalRaw, rowBelow2, totalCols);
    }
  }

  const rawClean = finalRaw.map(c => c.replace(/\s+/g, ' ').trim());
  const columns = rawClean.map(c => c.toLowerCase());

  let confidence: 'high' | 'medium' | 'low';
  if (bestScore >= 5) confidence = 'high';
  else if (bestScore >= 3) confidence = 'medium';
  else confidence = 'low';

  return {
    headerRowIndex: bestRowIdx,
    columns,
    rawColumns: rawClean,
    confidence,
    titleRows: extractTitleText(rows, parentRowUsed ? bestRowIdx - 1 : bestRowIdx),
  };
}
