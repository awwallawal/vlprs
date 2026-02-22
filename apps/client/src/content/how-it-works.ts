// How It Works page content (/how-it-works)
import { HOW_IT_WORKS } from './homepage';

export const HOW_IT_WORKS_PAGE = {
  title: 'How It Works',
  subtitle: 'From Expression of Interest to loan completion',
  meta: {
    title: 'How It Works | Vehicle Loan Scheme',
    description:
      'Step-by-step guide to the Oyo State Vehicle Loan Scheme process: Expression of Interest, Administrative Review, Committee Decision, and Payroll Repayment.',
  },
};

// Compact step data for the summary cards (reused from homepage)
export const STEP_SUMMARY = HOW_IT_WORKS;

// Expanded step details for the full-page sections
export const STEP_DETAILS = [
  {
    step: 1,
    title: 'Expression of Interest',
    description:
      'Submit your interest digitally and receive a reference number for administrative tracking.',
    detail:
      'Eligible staff express their interest in obtaining a vehicle loan through their MDA officer or directly via the VLPRS portal. Each submission receives a unique reference number that allows both the applicant and administrators to track the progress of the application through subsequent stages.',
  },
  {
    step: 2,
    title: 'Administrative Review',
    description:
      'Applications are screened and prepared for committee consideration under established procedures.',
    detail:
      'The Car Loan Department receives submitted expressions of interest and verifies eligibility against scheme rules, including grade level qualification, active service status, and absence of an existing active loan. Complete applications are compiled and presented to the Vehicle Loan Committee for consideration.',
  },
  {
    step: 3,
    title: 'Committee Decision',
    description:
      'Approvals are determined by the designated committee. The portal does not approve loans.',
    detail:
      'The Vehicle Loan Committee reviews eligible applications and makes approval decisions based on available funds, policy guidelines, and applicable regulations. VLPRS records the committee\'s decisions but plays no role in the decision-making process itself. All approvals, rejections, and deferrals are documented in the system for audit purposes.',
  },
  {
    step: 4,
    title: 'Payroll Repayment',
    description:
      'Approved loans are repaid through payroll deductions. Completion triggers clearance documentation and automatic deduction cessation.',
    detail:
      'Once a loan is approved and disbursed, repayment begins via monthly payroll deductions after an initial 2-month moratorium period. VLPRS computes each monthly deduction amount, tracks payments received, and maintains the running balance. When the loan balance reaches zero, the system automatically generates an Auto-Stop Certificate and notifies the beneficiary\'s MDA to cease deductions.',
  },
];

export const POST_COMPLETION = {
  heading: 'What Happens After Completion?',
  text: 'When your loan balance reaches zero, VLPRS automatically generates a Clearance Certificate and notifies your MDA to cease deductions. No manual intervention required.',
};

export const HOW_IT_WORKS_DISCLAIMER =
  'Expression of Interest submission does not constitute loan approval. All approvals remain subject to committee decision under existing government procedures.';
