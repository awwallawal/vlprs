import type { MdaBoundary } from '@vlprs/shared';
import { resolveMdaByName } from '../services/mdaService';

interface MigrationRecordForDelineation {
  mdaText: string | null;
  sourceRow: number;
  [key: string]: unknown;
}

interface MultiMdaResult {
  hasMultiMda: boolean;
  boundaries: MdaBoundary[];
}

/**
 * Detect whether records from a single upload contain data for multiple MDAs.
 * Scans the mdaText field for boundary changes (e.g., CDU-in-Agriculture pattern).
 *
 * Records must be ordered by sourceRow ascending.
 */
export async function detectMultiMda(
  records: MigrationRecordForDelineation[],
): Promise<MultiMdaResult> {
  if (records.length === 0) {
    return { hasMultiMda: false, boundaries: [] };
  }

  // Collect unique MDA text values (non-empty, non-null)
  const mdaTexts = new Set<string>();
  for (const r of records) {
    if (r.mdaText && r.mdaText.trim()) {
      mdaTexts.add(r.mdaText.trim().toUpperCase());
    }
  }

  // If 0 or 1 unique MDA text values, no multi-MDA
  if (mdaTexts.size <= 1) {
    return { hasMultiMda: false, boundaries: [] };
  }

  // Resolve each unique MDA text to an actual MDA
  const resolvedMap = new Map<string, { code: string; name: string; confidence: 'high' | 'medium' | 'low' }>();

  for (const text of mdaTexts) {
    const resolved = await resolveMdaByName(text);
    if (resolved) {
      // Exact code match = high, otherwise medium
      const confidence: 'high' | 'medium' | 'low' =
        resolved.code === text ? 'high' : 'medium';
      resolvedMap.set(text, { code: resolved.code, name: resolved.name, confidence });
    } else {
      // Unresolved = low confidence
      resolvedMap.set(text, { code: text, name: text, confidence: 'low' });
    }
  }

  // Check if all texts resolve to the same MDA code
  const resolvedCodes = new Set([...resolvedMap.values()].map((v) => v.code));
  if (resolvedCodes.size <= 1) {
    return { hasMultiMda: false, boundaries: [] };
  }

  // Build boundaries — track boundary changes by walking records in source_row order
  const boundaries: MdaBoundary[] = [];
  let currentMdaText: string | null = null;
  let boundaryStart = 0;
  let boundaryCount = 0;

  for (const r of records) {
    const mdaText = r.mdaText?.trim().toUpperCase() ?? null;

    if (mdaText && mdaText !== currentMdaText) {
      // Close previous boundary if exists
      if (currentMdaText !== null && boundaryCount > 0) {
        const resolved = resolvedMap.get(currentMdaText)!;
        boundaries.push({
          startRow: boundaryStart,
          endRow: r.sourceRow - 1,
          detectedMda: resolved.name,
          recordCount: boundaryCount,
          confidence: resolved.confidence,
        });
      }

      // Start new boundary
      currentMdaText = mdaText;
      boundaryStart = r.sourceRow;
      boundaryCount = 1;
    } else {
      boundaryCount++;
    }
  }

  // Close final boundary
  if (currentMdaText !== null && boundaryCount > 0) {
    const resolved = resolvedMap.get(currentMdaText)!;
    const lastRecord = records[records.length - 1];
    boundaries.push({
      startRow: boundaryStart,
      endRow: lastRecord.sourceRow,
      detectedMda: resolved.name,
      recordCount: boundaryCount,
      confidence: resolved.confidence,
    });
  }

  return {
    hasMultiMda: boundaries.length > 1,
    boundaries: boundaries.length > 1 ? boundaries : [],
  };
}
