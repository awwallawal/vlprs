/**
 * periodExtract.ts — Extract month/year periods from sheet names, title rows, filenames.
 * Ported from scripts/legacy-report/utils/period-extract.ts (SQ-1).
 */

export interface Period {
  year: number;
  month: number; // 1-12, 0 = year-only
}

export interface PeriodResult {
  periods: Period[];
  confidence: 'high' | 'medium' | 'low';
  source: 'sheet' | 'title' | 'filename';
  raw: string;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 1, JANUARY: 1,
  FEB: 2, FEBRUARY: 2,
  MAR: 3, MARCH: 3,
  APR: 4, APRIL: 4,
  MAY: 5,
  JUN: 6, JUNE: 6,
  JUL: 7, JULY: 7,
  AUG: 8, AUGUST: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9,
  OCT: 10, OCTOBER: 10,
  NOV: 11, NOVEMBER: 11,
  DEC: 12, DECEMBER: 12,
};

const MONTH_NAMES = Object.keys(MONTH_MAP);
const MONTH_PATTERN = MONTH_NAMES.sort((a, b) => b.length - a.length).join('|');
const YEAR_PATTERN = '(20[12]\\d)';

function extractSinglePeriod(text: string): Period | null {
  const upper = text.toUpperCase().replace(/[.,;]+/g, ' ').replace(/\s+/g, ' ').trim();

  const monthYearRe = new RegExp(`(${MONTH_PATTERN})\\.?\\s*,?\\s*${YEAR_PATTERN}`, 'i');
  const match = upper.match(monthYearRe);
  if (match) {
    const monthKey = match[1].toUpperCase().replace('.', '');
    const month = MONTH_MAP[monthKey];
    const year = parseInt(match[2], 10);
    if (month && year >= 2010 && year <= 2029) {
      return { year, month };
    }
  }

  const yearMonthRe = new RegExp(`${YEAR_PATTERN}\\s+(${MONTH_PATTERN})`, 'i');
  const match2 = upper.match(yearMonthRe);
  if (match2) {
    const year = parseInt(match2[1], 10);
    const monthKey = match2[2].toUpperCase();
    const month = MONTH_MAP[monthKey];
    if (month && year >= 2010 && year <= 2029) {
      return { year, month };
    }
  }

  return null;
}

function extractMonthRange(text: string): Period[] | null {
  const upper = text.toUpperCase().replace(/[.,;]+/g, ' ').replace(/\s+/g, ' ').trim();

  const rangeRe = new RegExp(
    `(${MONTH_PATTERN})\\.?\\s*[-–—]\\s*(${MONTH_PATTERN})\\.?\\s*,?\\s*${YEAR_PATTERN}`,
    'i',
  );
  const match = upper.match(rangeRe);
  if (match) {
    const startMonth = MONTH_MAP[match[1].toUpperCase()];
    const endMonth = MONTH_MAP[match[2].toUpperCase()];
    const year = parseInt(match[3], 10);
    if (startMonth && endMonth && year >= 2010 && year <= 2029) {
      const periods: Period[] = [];
      for (let m = startMonth; m <= endMonth; m++) {
        periods.push({ year, month: m });
      }
      return periods.length > 0 ? periods : null;
    }
  }

  return null;
}

function extractCommaSeparatedMonths(text: string): Period[] | null {
  const upper = text.toUpperCase().replace(/[.,;]+/g, ' ').replace(/\s+/g, ' ').trim();

  const yearMatch = upper.match(new RegExp(YEAR_PATTERN));
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);

  const monthRe = new RegExp(`(${MONTH_PATTERN})`, 'gi');
  const months: number[] = [];
  let m;
  while ((m = monthRe.exec(upper)) !== null) {
    const month = MONTH_MAP[m[1].toUpperCase()];
    if (month && !months.includes(month)) {
      months.push(month);
    }
  }

  if (months.length >= 2) {
    return months.sort((a, b) => a - b).map(month => ({ year, month }));
  }
  return null;
}

function extractYearOnly(text: string): number | null {
  const match = text.match(/\b(20[12]\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

function extractPeriodFromSheet(sheetName: string): PeriodResult | null {
  // Try range first (e.g. "JAN-DEC 2019") to avoid single matching "DEC 2019"
  const range = extractMonthRange(sheetName);
  if (range) {
    return { periods: range, confidence: 'high', source: 'sheet', raw: sheetName };
  }
  const single = extractSinglePeriod(sheetName);
  if (single) {
    return { periods: [single], confidence: 'high', source: 'sheet', raw: sheetName };
  }
  return null;
}

function extractPeriodFromTitle(titleText: string): PeriodResult | null {
  const range = extractMonthRange(titleText);
  if (range) {
    return { periods: range, confidence: 'medium', source: 'title', raw: titleText };
  }
  const single = extractSinglePeriod(titleText);
  if (single) {
    return { periods: [single], confidence: 'high', source: 'title', raw: titleText };
  }
  return null;
}

function extractPeriodFromFilename(filename: string): PeriodResult | null {
  const name = filename.replace(/\.(xlsx?|csv)$/i, '').replace(/.*[\\/]/, '');

  const range = extractMonthRange(name);
  if (range) {
    return { periods: range, confidence: 'medium', source: 'filename', raw: name };
  }
  const commaMonths = extractCommaSeparatedMonths(name);
  if (commaMonths) {
    return { periods: commaMonths, confidence: 'medium', source: 'filename', raw: name };
  }
  const single = extractSinglePeriod(name);
  if (single) {
    return { periods: [single], confidence: 'medium', source: 'filename', raw: name };
  }
  const year = extractYearOnly(name);
  if (year) {
    return { periods: [{ year, month: 0 }], confidence: 'low', source: 'filename', raw: name };
  }
  return null;
}

export function extractPeriod(
  sheetName: string,
  titleRows: string[],
  filename: string,
): PeriodResult {
  const fromSheet = extractPeriodFromSheet(sheetName);
  if (fromSheet && fromSheet.confidence === 'high') return fromSheet;

  for (const title of titleRows) {
    if (!title) continue;
    const fromTitle = extractPeriodFromTitle(title);
    if (fromTitle) return fromTitle;
  }

  if (fromSheet) return fromSheet;

  const fromFilename = extractPeriodFromFilename(filename);
  if (fromFilename) return fromFilename;

  return {
    periods: [],
    confidence: 'low',
    source: 'filename',
    raw: `${sheetName} | ${filename}`,
  };
}
