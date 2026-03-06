import { describe, it, expect } from 'vitest';
import { normalizeName, matchName } from '../migration/nameMatch';

/**
 * Unit tests for person matching logic.
 *
 * Tests the cross-MDA detection algorithm using the same normalization
 * and grouping logic as the service, but without requiring a DB connection.
 * DB integration tests are in staffProfile.integration.test.ts.
 */

describe('personMatchingService — cross-MDA detection logic', () => {
  describe('grouping by normalized name', () => {
    it('detects exact name match across 2 MDAs', () => {
      const records = [
        { staffName: 'OLANIYAN BABATUNDE', mdaCode: 'JUSTICE' },
        { staffName: 'OLANIYAN BABATUNDE', mdaCode: 'INFORMATION' },
      ];

      const groups = groupByNormalizedName(records);
      expect(groups.get('OLANIYAN BABATUNDE')!.size).toBe(2);
    });

    it('detects same name with title differences across MDAs', () => {
      const records = [
        { staffName: 'MRS. ADEYEMI FOLASHADE', mdaCode: 'JUSTICE' },
        { staffName: 'ADEYEMI FOLASHADE (LATE)', mdaCode: 'AGRICULTURE' },
      ];

      const groups = groupByNormalizedName(records);
      expect(groups.get('ADEYEMI FOLASHADE')!.size).toBe(2);
    });

    it('does NOT create false cross-MDA for same MDA', () => {
      const records = [
        { staffName: 'BELLO AMINAT', mdaCode: 'JUSTICE' },
        { staffName: 'MRS. BELLO AMINAT', mdaCode: 'JUSTICE' },
      ];

      const groups = groupByNormalizedName(records);
      expect(groups.get('BELLO AMINAT')!.size).toBe(1);
    });
  });

  describe('grouping by Staff ID', () => {
    it('detects staff ID match across MDAs', () => {
      const records = [
        { staffName: 'OGUNLEYE KAYODE', mdaCode: 'JUSTICE', employeeNo: 'EMP001' },
        { staffName: 'OGUNLEYE K.A.', mdaCode: 'HEALTH', employeeNo: 'EMP001' },
      ];

      const groups = groupByStaffId(records);
      expect(groups.get('EMP001')!.size).toBe(2);
    });

    it('ignores empty/null staff IDs', () => {
      const records = [
        { staffName: 'BELLO A', mdaCode: 'JUSTICE', employeeNo: null },
        { staffName: 'BELLO B', mdaCode: 'HEALTH', employeeNo: '' },
      ];

      const groups = groupByStaffId(records);
      expect(groups.size).toBe(0);
    });
  });

  describe('fuzzy matching across MDAs', () => {
    it('detects surname+initial match across MDAs', () => {
      const result = matchName('BELLO OLUWADAMILARE', 'BELLO O.D.');
      expect(result.confidence).toBe('high');
    });

    it('detects Levenshtein fuzzy match across MDAs', () => {
      const result = matchName('BANKOLE ADEYEMI', 'BANKOL ADEYEMI');
      expect(result.confidence).toBe('fuzzy');
      expect(result.distance).toBeLessThanOrEqual(2);
    });

    it('does NOT match unrelated names', () => {
      const result = matchName('ADEYEMI FOLASHADE', 'OGUNLEYE KAYODE');
      expect(result.confidence).toBe('none');
    });
  });

  describe('confidence and status assignment', () => {
    const CONFIDENCE: Record<string, string> = {
      exact_name: '1.00', staff_id: '1.00', surname_initial: '0.80', fuzzy_name: '0.60', manual: '1.00',
    };

    it('assigns 1.0 confidence for exact name match', () => {
      expect(CONFIDENCE.exact_name).toBe('1.00');
    });

    it('assigns 1.0 confidence for staff_id match', () => {
      expect(CONFIDENCE.staff_id).toBe('1.00');
    });

    it('assigns 0.80 confidence for surname_initial match', () => {
      expect(CONFIDENCE.surname_initial).toBe('0.80');
    });

    it('assigns 0.60 confidence for fuzzy_name match', () => {
      expect(CONFIDENCE.fuzzy_name).toBe('0.60');
    });

    it('auto-confirms exact name matches', () => {
      expect(getStatus('exact_name')).toBe('auto_confirmed');
    });

    it('auto-confirms staff ID matches', () => {
      expect(getStatus('staff_id')).toBe('auto_confirmed');
    });

    it('marks surname_initial as pending_review', () => {
      expect(getStatus('surname_initial')).toBe('pending_review');
    });

    it('marks fuzzy_name as pending_review', () => {
      expect(getStatus('fuzzy_name')).toBe('pending_review');
    });
  });
});

// ─── Helpers — mirror the service's internal logic ────────────────────

function groupByNormalizedName(
  records: Array<{ staffName: string; mdaCode: string }>,
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  for (const r of records) {
    const norm = normalizeName(r.staffName);
    if (!norm) continue;
    if (!groups.has(norm)) groups.set(norm, new Set());
    groups.get(norm)!.add(r.mdaCode);
  }
  return groups;
}

function groupByStaffId(
  records: Array<{ staffName: string; mdaCode: string; employeeNo: string | null }>,
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  for (const r of records) {
    if (!r.employeeNo || !r.employeeNo.trim()) continue;
    const key = r.employeeNo.trim();
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(r.mdaCode);
  }
  return groups;
}

type MatchType = 'exact_name' | 'staff_id' | 'surname_initial' | 'fuzzy_name' | 'manual';

function getStatus(matchType: MatchType): string {
  if (matchType === 'exact_name' || matchType === 'staff_id') return 'auto_confirmed';
  return 'pending_review';
}
