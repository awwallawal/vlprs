export const HERO = {
  title: 'Vehicle Loan Scheme',
  subtitle: 'Oyo State Government',
  description:
    'A secure, transparent platform for managing vehicle loan processing, repayment tracking, and receivables. Administered by the Accountant-General\'s Office, Oyo State.',
  primaryCta: { label: 'Staff Login', href: '#login-modal' },
  secondaryCta: { label: 'Learn How It Works', href: '/how-it-works' },
  programmeNotice: {
    title: 'Official Programme Notice',
    items: [
      'The Vehicle Loan Scheme is administered exclusively by the Accountant-General\'s Office under the authority of the Oyo State Government.',
      'All loan applications are subject to committee review and approval in accordance with established public service regulations.',
      'Repayment is effected through payroll deduction as mandated by the scheme rules.',
    ],
    finePrint:
      'Personal data is handled in alignment with the Nigeria Data Protection Regulation (NDPR). See our Privacy Policy for details.',
  },
};

export const TRUST_STRIP = {
  text: 'Administered by the Accountant-General\'s Office',
  badges: [
    'NDPR-aligned handling',
    'Audit-ready reporting',
    'Committee approvals preserved',
  ],
};

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Expression of Interest',
    description:
      'Eligible staff submit an expression of interest through their MDA officer or directly via the portal.',
  },
  {
    step: 2,
    title: 'Administrative Review',
    description:
      'The Car Loan Department verifies eligibility, tenure, and grade level against scheme rules.',
  },
  {
    step: 3,
    title: 'Committee Decision',
    description:
      'The Loan Committee reviews and approves applications based on available funds and policy.',
  },
  {
    step: 4,
    title: 'Payroll Repayment',
    description:
      'Approved loans are disbursed and repayment is automatically deducted from monthly salary.',
  },
];

export const HOW_IT_WORKS_DISCLAIMER =
  'Expression of Interest submission does not constitute loan approval.';

export const LOAN_TIERS = [
  {
    levels: 'Levels 1-6',
    amount: '250,000',
    tenure: 'Standard tenure: 60 months',
  },
  {
    levels: 'Levels 7-8',
    amount: '450,000',
    tenure: 'Standard tenure: 60 months',
  },
  {
    levels: 'Levels 9-10',
    amount: '600,000',
    tenure: 'Standard tenure: 60 months',
  },
  {
    levels: 'Levels 12+',
    amount: '750,000',
    tenure: 'Standard tenure: 60 months',
  },
];

export const LOAN_TIERS_NOTE =
  'All tiers carry a flat interest rate of 13.33% per annum. Eligibility is subject to scheme rules, including tenure-to-retirement provisions.';

export const CAPABILITIES = [
  {
    icon: 'Lock' as const,
    title: 'Immutable Financial Ledger',
    description:
      'Every transaction is append-only and permanently recorded. No entries can be modified or deleted after creation.',
  },
  {
    icon: 'Calculator' as const,
    title: 'Computed Balances',
    description:
      'Outstanding balances are computed from the ledger in real-time, never stored or editable. The numbers are always correct.',
  },
  {
    icon: 'CheckCircle' as const,
    title: 'Auto-Stop Certificates',
    description:
      'When a loan reaches zero balance, the system automatically generates an auto-stop certificate and notifies all parties.',
  },
  {
    icon: 'LayoutDashboard' as const,
    title: 'Real-Time Executive Dashboard',
    description:
      'The Accountant General can view scheme-wide metrics, MDA compliance status, and attention items at a glance.',
  },
  {
    icon: 'Handshake' as const,
    title: 'Non-Punitive Design',
    description:
      'MDAs are supported, not shamed. The system uses collaborative language and never ranks or compares agencies against each other.',
  },
  {
    icon: 'ClipboardCheck' as const,
    title: 'Audit-Ready from Day One',
    description:
      'Complete audit trails, immutable records, and transparent computations ensure the scheme is always ready for review.',
  },
];

export const REPAYMENT_RULES = [
  {
    title: 'Standard Repayment',
    content:
      'Monthly deductions are computed based on the approved loan amount, tenure, and the scheme interest rate of 13.33% per annum. Deductions are made at source through payroll processing by the MDA officer each month.',
  },
  {
    title: 'Accelerated Repayment',
    content:
      'Beneficiaries may request increased monthly deductions to pay off their loan faster. Accelerated payments reduce the effective tenure without penalty.',
  },
  {
    title: 'Early Principal Settlement',
    content:
      'A lump-sum payment can be made to settle the remaining principal balance at any time. The system computes the exact settlement amount and generates a completion certificate.',
  },
  {
    title: 'Retirement & Gratuity Settlement',
    content:
      'For staff approaching retirement, outstanding balances can be settled from gratuity entitlements. The system tracks service dates and computes gratuity-receivable amounts.',
  },
];

export const REPAYMENT_DISCLAIMER = {
  title: 'Key Clarification',
  content:
    'The repayment rules outlined above are subject to the scheme\'s governing regulations. For specific questions about your repayment schedule or settlement options, please consult the Car Loan Department.',
  faqLink: { label: 'View Frequently Asked Questions', href: '/resources/faq' },
};

export const WHO_VLPRS_SERVES = [
  {
    icon: 'Building2' as const,
    title: 'Car Loan Department',
    description:
      'Operational hub for managing migration, exceptions, computations, and the full loan lifecycle.',
  },
  {
    icon: 'Users' as const,
    title: 'MDA Officers',
    description:
      'Monthly submission interface with pre-submission checkpoints, CSV upload, and submission history.',
  },
  {
    icon: 'UserCheck' as const,
    title: 'Beneficiaries',
    description:
      'Future portal access to view loan status, repayment schedules, and auto-stop certificates.',
  },
];

export const TRUST_PILLARS = [
  {
    icon: 'Shield' as const,
    title: 'NDPR Compliant',
    description:
      'Personal data handling aligned with the Nigeria Data Protection Regulation. Role-based access ensures data is visible only to authorised personnel.',
  },
  {
    icon: 'FileText' as const,
    title: 'Audit-Ready',
    description:
      'Every action is logged with timestamps, user identity, and context. The audit trail is immutable and exportable for regulatory review.',
  },
  {
    icon: 'Link2' as const,
    title: 'Immutable Ledger',
    description:
      'Financial records are append-only. No entry can be modified or deleted. Balances are computed, not stored, ensuring mathematical integrity.',
  },
];

export const ENDORSEMENT = {
  quote:
    '"The Vehicle Loan Scheme represents a commitment to transparent, technology-driven financial management in Oyo State public service."',
  attribution: 'Accountant General, Oyo State',
};

export const FINAL_CTA = {
  heading: 'Ready to access VLPRS?',
  description:
    'Authorised staff can log in to access the dashboard, submit monthly deductions, or view scheme reports.',
  primaryCta: { label: 'Staff Login', href: '/login' },
  secondaryCta: { label: 'Contact Support', href: '/support' },
};

export const PROGRAMME_DISCLAIMER =
  'The Vehicle Loan Processing & Receivables System (VLPRS) is an official digital platform of the Oyo State Government, administered by the Accountant-General\'s Office. All information presented is subject to the governing regulations of the Vehicle Loan Scheme. This platform does not constitute financial advice. For specific enquiries, contact the Car Loan Department.';
