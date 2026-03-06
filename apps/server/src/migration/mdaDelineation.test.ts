import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectMultiMda } from './mdaDelineation';

// Mock the mdaService
vi.mock('../services/mdaService', () => ({
  resolveMdaByName: vi.fn(async (input: string) => {
    const normalized = input.toUpperCase();

    // Simulate known MDAs
    if (['AGRICULTURE', 'MINISTRY OF AGRICULTURE'].includes(normalized)) {
      return { id: 'agric-id', code: 'AGRIC', name: 'Ministry of Agriculture', abbreviation: 'AGRIC', isActive: true, parentMdaId: null, parentMdaCode: null };
    }
    if (['CDU', 'COCOA DEVELOPMENT UNIT', 'OYO STATE COCOA DEVELOPMENT UNIT', 'COCOA', 'TCDU'].includes(normalized)) {
      return { id: 'cdu-id', code: 'CDU', name: 'Cocoa Development Unit', abbreviation: 'CDU', isActive: true, parentMdaId: 'agric-id', parentMdaCode: 'AGRIC' };
    }
    if (normalized === 'EDUCATION') {
      return { id: 'edu-id', code: 'EDU', name: 'Ministry of Education', abbreviation: 'EDU', isActive: true, parentMdaId: null, parentMdaCode: null };
    }

    return null;
  }),
}));

function makeRecord(mdaText: string | null, sourceRow: number) {
  return { mdaText, sourceRow };
}

describe('detectMultiMda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for empty records', async () => {
    const result = await detectMultiMda([]);
    expect(result.hasMultiMda).toBe(false);
    expect(result.boundaries).toHaveLength(0);
  });

  it('returns false for records with single MDA', async () => {
    const records = [
      makeRecord('Agriculture', 2),
      makeRecord('Agriculture', 3),
      makeRecord('Agriculture', 4),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(false);
    expect(result.boundaries).toHaveLength(0);
  });

  it('returns false for records with no MDA text', async () => {
    const records = [
      makeRecord(null, 2),
      makeRecord(null, 3),
      makeRecord('', 4),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(false);
  });

  it('detects CDU-in-Agriculture pattern', async () => {
    const records = [
      makeRecord('Agriculture', 2),
      makeRecord('Agriculture', 3),
      makeRecord('Agriculture', 4),
      makeRecord('COCOA DEVELOPMENT UNIT', 5),
      makeRecord('COCOA DEVELOPMENT UNIT', 6),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(true);
    expect(result.boundaries).toHaveLength(2);

    // First boundary: Agriculture
    expect(result.boundaries[0].detectedMda).toBe('Ministry of Agriculture');
    expect(result.boundaries[0].startRow).toBe(2);
    expect(result.boundaries[0].endRow).toBe(4);
    expect(result.boundaries[0].recordCount).toBe(3);

    // Second boundary: CDU
    expect(result.boundaries[1].detectedMda).toBe('Cocoa Development Unit');
    expect(result.boundaries[1].startRow).toBe(5);
    expect(result.boundaries[1].endRow).toBe(6);
    expect(result.boundaries[1].recordCount).toBe(2);
  });

  it('assigns high confidence for exact code matches', async () => {
    const records = [
      makeRecord('CDU', 2),
      makeRecord('CDU', 3),
      makeRecord('Agriculture', 4),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(true);
    // CDU exact code match → high confidence
    expect(result.boundaries[0].confidence).toBe('high');
  });

  it('assigns medium confidence for alias matches', async () => {
    const records = [
      makeRecord('COCOA DEVELOPMENT UNIT', 2),
      makeRecord('Agriculture', 4),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(true);
    // COCOA DEVELOPMENT UNIT resolves to CDU code, but input != code → medium
    expect(result.boundaries[0].confidence).toBe('medium');
  });

  it('assigns low confidence for unresolved MDA texts', async () => {
    const records = [
      makeRecord('UNKNOWN DEPARTMENT', 2),
      makeRecord('Agriculture', 4),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(true);
    // UNKNOWN DEPARTMENT returns null from resolveMdaByName → low
    expect(result.boundaries[0].confidence).toBe('low');
  });

  it('returns false when different text values resolve to same MDA code', async () => {
    const records = [
      makeRecord('CDU', 2),
      makeRecord('COCOA DEVELOPMENT UNIT', 3),
      makeRecord('Cocoa', 4),
    ];

    const result = await detectMultiMda(records);
    // All resolve to CDU code → not multi-MDA
    expect(result.hasMultiMda).toBe(false);
  });

  it('handles mixed null and valid MDA texts', async () => {
    const records = [
      makeRecord(null, 2),
      makeRecord('Agriculture', 3),
      makeRecord(null, 4),
      makeRecord('Agriculture', 5),
      makeRecord('COCOA DEVELOPMENT UNIT', 6),
    ];

    const result = await detectMultiMda(records);
    expect(result.hasMultiMda).toBe(true);
    expect(result.boundaries).toHaveLength(2);

    // Agriculture boundary: starts at row 3, includes null at row 4 (inherited MDA)
    expect(result.boundaries[0].startRow).toBe(3);
    expect(result.boundaries[0].endRow).toBe(5);
    expect(result.boundaries[0].recordCount).toBe(3); // rows 3, 4 (null=inherited), 5

    // CDU boundary
    expect(result.boundaries[1].startRow).toBe(6);
    expect(result.boundaries[1].endRow).toBe(6);
    expect(result.boundaries[1].recordCount).toBe(1);
  });
});
