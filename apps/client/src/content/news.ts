export interface NewsItem {
  id: string;
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  body: string;
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: '1',
    title: 'VLPRS Digital Platform Launches for Oyo State',
    date: '2026-02-01',
    slug: 'vlprs-platform-launch',
    excerpt:
      'The Accountant-General\'s Office is pleased to announce the launch of the Vehicle Loan Processing & Receivables System, a modern, transparent platform for managing the state vehicle loan scheme.',
    body: 'The Accountant-General\'s Office is pleased to announce the launch of the Vehicle Loan Processing & Receivables System (VLPRS). This digital platform replaces the previous manual processes with a secure, auditable system designed to serve beneficiaries across all participating MDAs.',
  },
  {
    id: '2',
    title: 'MDA Officers: Monthly Submission Portal Now Available',
    date: '2026-01-15',
    slug: 'mda-submission-portal',
    excerpt:
      'All MDA officers can now submit monthly deduction files through the VLPRS portal. The new CSV upload process includes automatic validation and comparison summaries.',
    body: 'The monthly submission portal is now available for all MDA officers. Officers can upload their 8-field CSV deduction files, view submission history, and receive automatic comparison summaries highlighting any variances from previous months.',
  },
  {
    id: '3',
    title: 'Data Migration Progress: Phase 1 Complete',
    date: '2026-01-01',
    slug: 'data-migration-phase-1',
    excerpt:
      'Phase 1 of the legacy data migration is complete. Historical loan records from the previous system have been imported and validated for the first batch of MDAs.',
    body: 'The first phase of data migration has been successfully completed. Historical loan records, repayment schedules, and staff information from the previous spreadsheet-based system have been imported into VLPRS. Each record has been validated against the original data with variance reports generated for review.',
  },
];
