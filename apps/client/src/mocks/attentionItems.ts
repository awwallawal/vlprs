// Target: GET /api/dashboard/attention
// Wire: Sprint 5 (Epic 4: Executive Dashboard)
import type { AttentionItem } from '@vlprs/shared';

export const MOCK_ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: 'att-001',
    description: 'Submission pending, 3 days past due',
    mdaName: 'Ministry of Works and Transport',
    category: 'review',
    timestamp: '2026-02-18T10:00:00Z',
  },
  {
    id: 'att-002',
    description: 'Variance identified in February submission',
    mdaName: 'Ministry of Agriculture and Rural Development',
    category: 'info',
    timestamp: '2026-02-17T14:30:00Z',
  },
  {
    id: 'att-003',
    description: '2 loans approaching zero balance — auto-stop certificates pending',
    mdaName: 'Ministry of Health',
    category: 'review',
    timestamp: '2026-02-16T09:15:00Z',
  },
  {
    id: 'att-004',
    description: '3 staff approaching retirement within 12 months',
    mdaName: 'Ministry of Health',
    category: 'info',
    timestamp: '2026-02-15T16:45:00Z',
  },
  {
    id: 'att-005',
    description: 'Staff ID coverage at 90.9% — 283 records pending',
    mdaName: 'All MDAs',
    category: 'info',
    timestamp: '2026-02-15T08:00:00Z',
  },
];
