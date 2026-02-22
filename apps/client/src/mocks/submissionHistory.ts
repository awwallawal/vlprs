// Target: GET /api/submissions?mdaId=
// Wire: Sprint 7 (Epic 5: MDA Monthly Submission)
import type { SubmissionRecord } from '@vlprs/shared';

export const MOCK_SUBMISSION_HISTORY: Record<string, SubmissionRecord[]> = {
  'mda-001': [
    {
      id: 'sub-mof-001',
      referenceNumber: 'MOF-2026-02-0001',
      submissionDate: '2026-02-15T09:30:00Z',
      recordCount: 142,
      alignedCount: 140,
      varianceCount: 2,
      status: 'confirmed',
    },
    {
      id: 'sub-mof-002',
      referenceNumber: 'MOF-2026-01-0001',
      submissionDate: '2026-01-15T10:00:00Z',
      recordCount: 140,
      alignedCount: 138,
      varianceCount: 2,
      status: 'confirmed',
    },
    {
      id: 'sub-mof-003',
      referenceNumber: 'MOF-2025-12-0001',
      submissionDate: '2025-12-14T11:15:00Z',
      recordCount: 138,
      alignedCount: 136,
      varianceCount: 2,
      status: 'confirmed',
    },
  ],
  'mda-002': [
    {
      id: 'sub-moe-001',
      referenceNumber: 'MOE-2026-02-0001',
      submissionDate: '2026-02-14T08:45:00Z',
      recordCount: 210,
      alignedCount: 205,
      varianceCount: 5,
      status: 'confirmed',
    },
    {
      id: 'sub-moe-002',
      referenceNumber: 'MOE-2026-01-0001',
      submissionDate: '2026-01-14T09:30:00Z',
      recordCount: 208,
      alignedCount: 204,
      varianceCount: 4,
      status: 'confirmed',
    },
    {
      id: 'sub-moe-003',
      referenceNumber: 'MOE-2025-12-0001',
      submissionDate: '2025-12-13T10:15:00Z',
      recordCount: 205,
      alignedCount: 202,
      varianceCount: 3,
      status: 'confirmed',
    },
  ],
  'mda-003': [
    {
      id: 'sub-moh-001',
      referenceNumber: 'MOH-2026-02-0001',
      submissionDate: '2026-02-15T14:20:00Z',
      recordCount: 178,
      alignedCount: 175,
      varianceCount: 3,
      status: 'confirmed',
    },
    {
      id: 'sub-moh-002',
      referenceNumber: 'MOH-2026-01-0001',
      submissionDate: '2026-01-14T10:30:00Z',
      recordCount: 176,
      alignedCount: 174,
      varianceCount: 2,
      status: 'confirmed',
    },
    {
      id: 'sub-moh-003',
      referenceNumber: 'MOH-2025-12-0001',
      submissionDate: '2025-12-15T09:00:00Z',
      recordCount: 174,
      alignedCount: 172,
      varianceCount: 2,
      status: 'confirmed',
    },
  ],
};
