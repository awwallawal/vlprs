/**
 * FileDelineationPreview — Displays MDA boundary detection results for a multi-MDA file.
 *
 * Shows detected sections with MDA name, row range, record count, and confidence indicator.
 * Allows admin to confirm boundaries, adjust ambiguous sections, or reject the file.
 *
 * Story 3.8: Multi-MDA File Delineation & Deduplication
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VOCABULARY } from '@vlprs/shared';
import type { DelineationResult, DelineationSection, DelineationBoundaryRecord, MdaListItem } from '@vlprs/shared';

interface FileDelineationPreviewProps {
  delineationResult: DelineationResult | null;
  mdaList: MdaListItem[];
  isLoading: boolean;
  isConfirming: boolean;
  onConfirm: (sections: Array<{ sectionIndex: number; mdaId: string }>) => void;
  onReject: () => void;
}

const confidenceBadgeVariant: Record<string, 'info' | 'review' | 'complete'> = {
  detected: 'info',
  ambiguous: 'review',
  confirmed: 'complete',
};

const confidenceLabel: Record<string, string> = {
  detected: 'Detected',
  ambiguous: 'Ambiguous',
  confirmed: 'Confirmed',
};

export function FileDelineationPreview({
  delineationResult,
  mdaList,
  isLoading,
  isConfirming,
  onConfirm,
  onReject,
}: FileDelineationPreviewProps) {
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-border p-6 space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!delineationResult || !delineationResult.delineated) {
    return null;
  }

  const { sections, targetMdaName, totalRecords } = delineationResult;
  const uniqueMdas = new Set(sections.map((s) => s.resolvedMdaName ?? s.mdaName));

  // Group sections by sheet name for multi-sheet files
  const sheetGroups = sections.reduce<Map<string, DelineationSection[]>>((map, section) => {
    const sheet = section.sheetName ?? 'Sheet 1';
    if (!map.has(sheet)) map.set(sheet, []);
    map.get(sheet)!.push(section);
    return map;
  }, new Map());
  const hasMultipleSheets = sheetGroups.size > 1;

  const handleMdaOverride = (sectionIndex: number, mdaId: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(sectionIndex, mdaId);
      return next;
    });
  };

  const handleConfirmAll = () => {
    const confirmed = sections.map((s) => ({
      sectionIndex: s.sectionIndex,
      mdaId: overrides.get(s.sectionIndex) ?? s.mdaId ?? '',
    })).filter((s) => s.mdaId);

    onConfirm(confirmed);
  };

  const hasUnresolved = sections.some(
    (s) => s.confidence === 'ambiguous' && !overrides.has(s.sectionIndex),
  );

  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-teal/5">
        <h3 className="text-sm font-semibold text-text-primary">
          {VOCABULARY.DELINEATION_DETECTED}
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          "{targetMdaName}" upload — {uniqueMdas.size} MDAs found
        </p>
      </div>

      {/* Sections List — grouped by sheet tab when multi-sheet */}
      <div className="divide-y divide-border/50">
        {[...sheetGroups.entries()].map(([sheetName, sheetSections]) => (
          <div key={sheetName}>
            {hasMultipleSheets && (
              <div className="px-4 py-2 bg-gray-50 border-b border-border/50">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{sheetName}</p>
              </div>
            )}
            {sheetSections.map((section) => (
              <SectionRow
                key={section.sectionIndex}
                section={section}
                mdaList={mdaList}
                overrideMdaId={overrides.get(section.sectionIndex)}
                onOverride={(mdaId) => handleMdaOverride(section.sectionIndex, mdaId)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-gray-50 border-t border-border">
        <p className="text-xs text-text-secondary">
          {totalRecords} records across {uniqueMdas.size} MDAs: {[...uniqueMdas].join(', ')}
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex items-center justify-between border-t border-border">
        <button
          type="button"
          onClick={onReject}
          disabled={isConfirming}
          className="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Reject File
        </button>
        <button
          type="button"
          onClick={handleConfirmAll}
          disabled={isConfirming || hasUnresolved}
          className="px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal-hover disabled:opacity-50"
        >
          {isConfirming ? 'Confirming...' : 'Confirm All Boundaries'}
        </button>
      </div>

      {hasUnresolved && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gold-dark">
            Some sections have ambiguous MDA boundaries. Please select the correct MDA for each ambiguous section.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Section Row ────────────────────────────────────────────────────

function SectionRow({
  section,
  mdaList,
  overrideMdaId,
  onOverride,
}: {
  section: DelineationSection;
  mdaList: MdaListItem[];
  overrideMdaId?: string;
  onOverride: (mdaId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = section.resolvedMdaName ?? section.mdaName;
  const variant = overrideMdaId
    ? 'complete'
    : confidenceBadgeVariant[section.confidence] ?? 'info';
  const label = overrideMdaId
    ? 'Confirmed'
    : confidenceLabel[section.confidence] ?? 'Unknown';

  const hasBoundary = section.boundaryRecords && section.boundaryRecords.length > 0;

  return (
    <div>
      <div className="px-4 py-3 flex items-center gap-3">
        <Badge variant={variant} className="text-[10px] min-w-[72px] justify-center">
          {label}
        </Badge>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {displayName}
          </p>
          <p className="text-xs text-text-muted">
            Rows {section.startRow}–{section.endRow} · {section.recordCount} records
            {hasBoundary && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-2 text-teal hover:underline"
              >
                {expanded ? 'Hide preview' : 'Preview rows'}
              </button>
            )}
          </p>
        </div>

        {section.confidence === 'ambiguous' && (
          <select
            value={overrideMdaId ?? ''}
            onChange={(e) => onOverride(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-white"
          >
            <option value="">Select MDA...</option>
            {mdaList.map((mda) => (
              <option key={mda.id} value={mda.id}>
                {mda.name} ({mda.code})
              </option>
            ))}
          </select>
        )}
      </div>

      {expanded && hasBoundary && (
        <BoundaryPreview records={section.boundaryRecords!} />
      )}
    </div>
  );
}

// ─── Boundary Preview ──────────────────────────────────────────────

function BoundaryPreview({ records }: { records: DelineationBoundaryRecord[] }) {
  const startRecords = records.filter((r) => r.position === 'start');
  const endRecords = records.filter((r) => r.position === 'end');

  return (
    <div className="mx-4 mb-3 rounded border border-border/50 bg-gray-50 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-gray-100">
            <th className="px-3 py-1.5 text-left text-text-muted font-medium w-16">Row</th>
            <th className="px-3 py-1.5 text-left text-text-muted font-medium">Staff Name</th>
            <th className="px-3 py-1.5 text-left text-text-muted font-medium">MDA Column</th>
          </tr>
        </thead>
        <tbody>
          {startRecords.map((r) => (
            <BoundaryRow key={`s-${r.sourceRow}`} record={r} />
          ))}
          {endRecords.length > 0 && startRecords.length > 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-1 text-center text-text-muted text-[10px]">···</td>
            </tr>
          )}
          {endRecords.map((r) => (
            <BoundaryRow key={`e-${r.sourceRow}`} record={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoundaryRow({ record }: { record: DelineationBoundaryRecord }) {
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="px-3 py-1.5 text-text-muted tabular-nums">{record.sourceRow}</td>
      <td className="px-3 py-1.5 text-text-primary">{record.staffName}</td>
      <td className="px-3 py-1.5 text-text-secondary">{record.mdaText ?? '—'}</td>
    </tr>
  );
}
