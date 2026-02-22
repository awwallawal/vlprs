// MDA Submission Guide page content (/resources/submission-guide)

export const MDA_GUIDE_PAGE = {
  title: 'MDA Submission Guide',
  subtitle: 'Step-by-step guide to monthly deduction data submission',
  meta: {
    title: 'MDA Submission Guide | Vehicle Loan Scheme',
    description:
      'Guide for MDA officers on how to submit monthly deduction data via the VLPRS portal, including CSV format, field definitions, and deadlines.',
  },
};

export interface CsvField {
  name: string;
  description: string;
  required: 'Required' | 'Conditional';
}

export const CSV_FIELDS: CsvField[] = [
  {
    name: 'Staff ID',
    description: 'Unique staff identifier (e.g., OYO/MDA/001)',
    required: 'Required',
  },
  {
    name: 'Month',
    description: 'Reporting month in YYYY-MM format (e.g., 2026-03)',
    required: 'Required',
  },
  {
    name: 'Amount Deducted',
    description: 'Deduction amount in Naira (e.g., 15000.00)',
    required: 'Required',
  },
  {
    name: 'Payroll Batch Reference',
    description: 'Unique payroll batch identifier (e.g., PB-2026-03-001)',
    required: 'Required',
  },
  {
    name: 'MDA Code',
    description: 'Three-letter MDA code (e.g., HLT for Health)',
    required: 'Required',
  },
  {
    name: 'Event Flag',
    description: 'Employment event: NONE, RETIREMENT, TRANSFER, TERMINATION, or DEATH',
    required: 'Required',
  },
  {
    name: 'Event Effective Date',
    description: 'Date of employment event in YYYY-MM-DD format',
    required: 'Conditional',
  },
  {
    name: 'Deduction Cessation Reason',
    description: 'Reason for stopping deductions (e.g., LOAN_COMPLETE, RETIREMENT)',
    required: 'Conditional',
  },
];

export const CONDITIONAL_RULES = [
  'Event Effective Date is required when Event Flag is not NONE.',
  'Deduction Cessation Reason is required when Amount Deducted is ₦0 and Event Flag is NONE.',
];

export const SUBMISSION_STEPS = [
  {
    step: 1,
    title: 'Download CSV Template',
    description: 'Download the official submission template from the Downloads page. The template includes all 8 required fields with correct headers.',
  },
  {
    step: 2,
    title: 'Fill in Staff Records',
    description: 'Enter one row per beneficiary with their deduction data for the reporting month. Ensure all required fields are populated correctly.',
  },
  {
    step: 3,
    title: 'Upload via VLPRS Portal',
    description: 'Log into the VLPRS portal, navigate to Submissions, and upload your completed CSV file. The system validates the file automatically.',
  },
  {
    step: 4,
    title: 'Review Confirmation & Comparison Summary',
    description: 'After successful upload, review the confirmation screen and comparison summary which highlights any variances from the previous month.',
  },
];

export const SIDEBAR_INFO = {
  deadline: '28th of each month',
  format: '.csv',
  encoding: 'UTF-8',
  templateUrl: '/templates/submission-template.csv',
};
