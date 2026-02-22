export type ExceptionPriority = 'high' | 'medium' | 'low';
export type ExceptionCategory = 'over_deduction' | 'under_deduction' | 'inactive' | 'data_mismatch' | 'post_retirement' | 'duplicate_staff_id';

export interface ExceptionItem {
  id: string;
  priority: ExceptionPriority;
  category: ExceptionCategory;
  staffId: string | null;
  staffName: string;
  mdaName: string;
  description: string;
  createdAt: string;
  status: 'open' | 'resolved';
  resolvedAt: string | null;
}
