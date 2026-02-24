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
    body: 'The Accountant-General\'s Office is pleased to announce the launch of the Vehicle Loan Processing & Receivables System (VLPRS). This digital platform replaces the previous manual processes with a secure, auditable system designed to serve beneficiaries across all participating MDAs.\n\nVLPRS provides a centralised portal where beneficiaries can view their loan balance, track monthly deductions, and download Auto-Stop certificates once repayment is complete. For MDA officers, the platform introduces structured CSV uploads with built-in validation, reducing the errors and delays that were common under the old spreadsheet-based workflow.\n\nThe system has been developed in close collaboration with the Car Loan Department and is hosted on secure government infrastructure. All data is encrypted in transit and at rest, and role-based access controls ensure that sensitive financial information is only visible to authorised personnel. Training sessions for MDA officers will be scheduled over the coming weeks.',
  },
  {
    id: '2',
    title: 'MDA Officers: Monthly Submission Portal Now Available',
    date: '2026-01-15',
    slug: 'mda-submission-portal',
    excerpt:
      'All MDA officers can now submit monthly deduction files through the VLPRS portal. The new CSV upload process includes automatic validation and comparison summaries.',
    body: 'The monthly submission portal is now available for all MDA officers. Officers can upload their 8-field CSV deduction files, view submission history, and receive automatic comparison summaries highlighting any variances from previous months.\n\nThe upload process validates each file against the required schema before acceptance. Common issues such as missing fields, duplicate staff numbers, or incorrect formatting are flagged immediately with clear error messages, allowing officers to correct and resubmit without delay. Once a file passes validation, a comparison summary is generated showing any changes from the previous month\'s submission.\n\nMDA officers are reminded that submissions are due by the 5th of each month. Late submissions may result in deductions not being processed in that pay cycle. For guidance on preparing your CSV file, please refer to the MDA Submission Guide available in the Resources section.',
  },
  {
    id: '3',
    title: 'Data Migration Progress: Phase 1 Complete',
    date: '2026-01-01',
    slug: 'data-migration-phase-1',
    excerpt:
      'Phase 1 of the legacy data migration is complete. Historical loan records from the previous system have been imported and validated for the first batch of MDAs.',
    body: 'The first phase of data migration has been successfully completed. Historical loan records, repayment schedules, and staff information from the previous spreadsheet-based system have been imported into VLPRS. Each record has been validated against the original data with variance reports generated for review.\n\nThis initial phase covered 15 MDAs representing approximately 2,400 active loan accounts. The migration team worked closely with each MDA to reconcile any discrepancies between the legacy records and the imported data. Where differences were identified, they were documented and resolved before the records were marked as verified in the new system.\n\nPhase 2 of the migration will cover the remaining MDAs and is expected to begin in March 2026. Beneficiaries whose records have already been migrated can log in to the VLPRS portal to confirm their loan details. Any queries about migrated data should be directed to the Car Loan Department.',
  },
];
