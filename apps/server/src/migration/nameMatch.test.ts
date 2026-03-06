import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  matchName,
  levenshtein,
  surnameAndInitial,
  buildNameIndex,
  searchName,
} from './nameMatch';

describe('normalizeName', () => {
  it('uppercases and trims', () => {
    expect(normalizeName('  adeyemi folashade  ')).toBe('ADEYEMI FOLASHADE');
  });

  it('removes parenthetical notes', () => {
    expect(normalizeName('ADEYEMI FOLASHADE (LATE)')).toBe('ADEYEMI FOLASHADE');
    expect(normalizeName('BELLO AMINAT (Mrs)')).toBe('BELLO AMINAT');
  });

  it('collapses whitespace', () => {
    expect(normalizeName('BELLO   OLUWADAMILARE')).toBe('BELLO OLUWADAMILARE');
  });

  it('strips title prefixes', () => {
    expect(normalizeName('MRS. ADEYEMI FOLASHADE')).toBe('ADEYEMI FOLASHADE');
    expect(normalizeName('DR. BELLO AMINAT')).toBe('BELLO AMINAT');
    expect(normalizeName('CHIEF OGUNLEYE KAYODE')).toBe('OGUNLEYE KAYODE');
    expect(normalizeName('ALHAJI MUSTAPHA ISMAIL')).toBe('MUSTAPHA ISMAIL');
    expect(normalizeName('ALHAJA FATIMAH BELLO')).toBe('FATIMAH BELLO');
    expect(normalizeName('ALH. IBRAHIM MUSA')).toBe('IBRAHIM MUSA');
    expect(normalizeName('ENGR. ADEWALE TAIWO')).toBe('ADEWALE TAIWO');
    expect(normalizeName('PROF. OLADIPO JAMES')).toBe('OLADIPO JAMES');
    expect(normalizeName('PASTOR AKINOLA SAMUEL')).toBe('AKINOLA SAMUEL');
    expect(normalizeName('DEACONESS OLAYINKA SHADE')).toBe('OLAYINKA SHADE');
    expect(normalizeName('OTUNBA ADEBAYO KUNLE')).toBe('ADEBAYO KUNLE');
    expect(normalizeName('BAALE OGUNWALE SEGUN')).toBe('OGUNWALE SEGUN');
  });

  it('strips chained titles (e.g., MRS. DR.)', () => {
    expect(normalizeName('MRS. DR. ADEYEMI SHADE')).toBe('ADEYEMI SHADE');
  });

  it('strips trailing periods and commas', () => {
    expect(normalizeName('BELLO AMINAT.')).toBe('BELLO AMINAT');
    expect(normalizeName('BELLO AMINAT,')).toBe('BELLO AMINAT');
  });

  it('returns empty string for empty/whitespace input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });

  it('handles single-word name', () => {
    expect(normalizeName('ADEYEMI')).toBe('ADEYEMI');
  });
});

describe('surnameAndInitial', () => {
  it('extracts surname and first initial', () => {
    expect(surnameAndInitial('BELLO OLUWADAMILARE')).toBe('BELLO O');
    expect(surnameAndInitial('ADEYEMI FOLASHADE')).toBe('ADEYEMI F');
  });

  it('returns null for single-word name', () => {
    expect(surnameAndInitial('ADEYEMI')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(surnameAndInitial('')).toBeNull();
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('AKINWALE JOSEPH', 'AKINWALE JOSEPH')).toBe(0);
  });

  it('returns correct distance for small edits', () => {
    expect(levenshtein('AKINWALE JOSEPH', 'AKINWALE JOSPH')).toBe(1);
    expect(levenshtein('BELLO', 'BELO')).toBe(1);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'ABC')).toBe(3);
    expect(levenshtein('ABC', '')).toBe(3);
  });

  it('early exits when length difference > 3', () => {
    expect(levenshtein('AB', 'ABCDEFGH')).toBe(6);
  });
});

describe('matchName', () => {
  it('returns exact match for identical normalized names', () => {
    const result = matchName('MRS. ADEYEMI FOLASHADE', 'ADEYEMI FOLASHADE (LATE)');
    expect(result.confidence).toBe('exact');
    expect(result.distance).toBe(0);
  });

  it('returns high confidence for surname+initial match', () => {
    const result = matchName('BELLO OLUWADAMILARE', 'BELLO O.D.');
    expect(result.confidence).toBe('high');
  });

  it('returns fuzzy for Levenshtein <= 2', () => {
    // Surnames differ slightly so L2 (surname+initial) won't match
    const result = matchName('BANKOLE ADEYEMI', 'BANKOL ADEYEMI');
    expect(result.confidence).toBe('fuzzy');
    expect(result.distance).toBeLessThanOrEqual(2);
  });

  it('prefers surname+initial over fuzzy when both could match', () => {
    // AKINWALE J matches at L2 (surname+initial) before fuzzy
    const result = matchName('AKINWALE JOSEPH', 'AKINWALE JOSPH');
    expect(result.confidence).toBe('high');
  });

  it('returns none for no match', () => {
    const result = matchName('ADEYEMI FOLASHADE', 'OGUNLEYE KAYODE');
    expect(result.confidence).toBe('none');
  });

  it('returns none for empty input', () => {
    const result = matchName('', 'BELLO AMINAT');
    expect(result.confidence).toBe('none');
  });
});

describe('buildNameIndex / searchName', () => {
  const records = [
    { name: 'MRS. ADEYEMI FOLASHADE', mdaCode: 'JUSTICE' },
    { name: 'BELLO OLUWADAMILARE', mdaCode: 'JUSTICE' },
    { name: 'ADEYEMI FOLASHADE', mdaCode: 'INFORMATION' },
    { name: 'OGUNLEYE KAYODE', mdaCode: 'AGRICULTURE' },
  ];

  it('builds index grouped by MDA', () => {
    const index = buildNameIndex(records);
    expect(index.byMda.size).toBe(3);
    expect(index.byMda.get('JUSTICE')!.length).toBe(2);
    expect(index.byMda.get('INFORMATION')!.length).toBe(1);
  });

  it('deduplicates same normalized name within MDA', () => {
    const dupeRecords = [
      { name: 'ADEYEMI FOLASHADE', mdaCode: 'JUSTICE' },
      { name: 'MRS. ADEYEMI FOLASHADE', mdaCode: 'JUSTICE' },
    ];
    const index = buildNameIndex(dupeRecords);
    const justiceEntries = index.byMda.get('JUSTICE')!;
    expect(justiceEntries.length).toBe(1);
    expect(justiceEntries[0].indices).toEqual([0, 1]);
  });

  it('searchName finds exact match within MDA', () => {
    const index = buildNameIndex(records);
    const result = searchName('ADEYEMI FOLASHADE', 'JUSTICE', index);
    expect(result.confidence).toBe('exact');
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it('searchName returns none for non-existent MDA', () => {
    const index = buildNameIndex(records);
    const result = searchName('ADEYEMI FOLASHADE', 'HEALTH', index);
    expect(result.confidence).toBe('none');
  });

  it('searchName finds fuzzy match', () => {
    const fuzzRecords = [
      { name: 'BANKOL ADEYEMI', mdaCode: 'JUSTICE' },
    ];
    const index = buildNameIndex(fuzzRecords);
    const result = searchName('BANKOLE ADEYEMI', 'JUSTICE', index);
    expect(result.confidence).toBe('fuzzy');
    expect(result.distance).toBeLessThanOrEqual(2);
  });
});
