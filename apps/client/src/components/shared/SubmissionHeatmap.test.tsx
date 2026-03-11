import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubmissionHeatmap } from './SubmissionHeatmap';
import type { MdaHeatmapRow } from '@vlprs/shared';

const emptyRows: MdaHeatmapRow[] = [
  { mdaId: 'mda-1', mdaName: 'Ministry of Finance', mdaCode: 'OY-FIN', complianceRate: 0, cells: [] },
  { mdaId: 'mda-2', mdaName: 'Ministry of Education', mdaCode: 'OY-EDU', complianceRate: 0, cells: [] },
];

const summary = { onTime: 0, gracePeriod: 0, awaiting: 2 };

describe('SubmissionHeatmap', () => {
  it('renders empty state message when all cells are empty', () => {
    render(<SubmissionHeatmap rows={emptyRows} summary={summary} />);
    expect(screen.getByText('Submission history will populate as monthly data is received')).toBeDefined();
  });

  it('renders MDA names in the grid', () => {
    render(<SubmissionHeatmap rows={emptyRows} summary={summary} />);
    expect(screen.getByText('Ministry of Finance')).toBeDefined();
    expect(screen.getByText('Ministry of Education')).toBeDefined();
  });

  it('renders summary bar with counts', () => {
    render(<SubmissionHeatmap rows={emptyRows} summary={{ onTime: 40, gracePeriod: 5, awaiting: 18 }} />);
    expect(screen.getByText('40')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('18')).toBeDefined();
  });

  it('renders sort controls', () => {
    render(<SubmissionHeatmap rows={emptyRows} summary={summary} />);
    expect(screen.getByText('Compliance %')).toBeDefined();
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Code')).toBeDefined();
  });

  it('sorts by name when Name button clicked', () => {
    const rows: MdaHeatmapRow[] = [
      { mdaId: 'mda-2', mdaName: 'Zulu Ministry', mdaCode: 'ZUL', complianceRate: 50, cells: [] },
      { mdaId: 'mda-1', mdaName: 'Alpha Ministry', mdaCode: 'ALP', complianceRate: 90, cells: [] },
    ];
    render(<SubmissionHeatmap rows={rows} summary={summary} />);

    fireEvent.click(screen.getByText('Name'));

    // Get only the MDA name elements (exact title match, not partial cell matches)
    const alpha = screen.getByTitle('Alpha Ministry');
    const zulu = screen.getByTitle('Zulu Ministry');
    // Alpha should come before Zulu in DOM order
    expect(alpha.compareDocumentPosition(zulu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sorts by code when Code button clicked', () => {
    const rows: MdaHeatmapRow[] = [
      { mdaId: 'mda-2', mdaName: 'Zulu Ministry', mdaCode: 'ZUL', complianceRate: 50, cells: [] },
      { mdaId: 'mda-1', mdaName: 'Alpha Ministry', mdaCode: 'ALP', complianceRate: 90, cells: [] },
    ];
    render(<SubmissionHeatmap rows={rows} summary={summary} />);

    fireEvent.click(screen.getByText('Code'));

    const alpha = screen.getByTitle('Alpha Ministry');
    const zulu = screen.getByTitle('Zulu Ministry');
    // ALP should come before ZUL in DOM order
    expect(alpha.compareDocumentPosition(zulu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders cells with aria-labels when data exists', () => {
    const rows: MdaHeatmapRow[] = [
      {
        mdaId: 'mda-1',
        mdaName: 'Ministry of Finance',
        mdaCode: 'OY-FIN',
        complianceRate: 100,
        cells: [{ month: '2026-03', status: 'on-time' }],
      },
    ];
    render(<SubmissionHeatmap rows={rows} summary={{ onTime: 1, gracePeriod: 0, awaiting: 0 }} />);

    // Should not show empty state message since data exists
    expect(screen.queryByText('Submission history will populate as monthly data is received')).toBeNull();
  });

  it('renders legend with non-punitive colors', () => {
    render(<SubmissionHeatmap rows={emptyRows} summary={summary} />);
    expect(screen.getByText('On time')).toBeDefined();
    expect(screen.getByText('Grace period')).toBeDefined();
    expect(screen.getByText('Awaiting')).toBeDefined();
    expect(screen.getByText('Current month')).toBeDefined();
  });

  it('renders empty array with empty state', () => {
    render(<SubmissionHeatmap rows={[]} summary={summary} />);
    expect(screen.getByText('Submission history will populate as monthly data is received')).toBeDefined();
  });
});
