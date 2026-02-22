// Eligibility & Loan Categories page content (/scheme/eligibility)
import { LOAN_TIERS } from './homepage';

export const ELIGIBILITY_PAGE = {
  title: 'Eligibility & Loan Categories',
  subtitle: 'Grade levels, loan amounts, and qualification requirements',
  meta: {
    title: 'Eligibility & Loan Categories | Vehicle Loan Scheme',
    description:
      'Loan tiers, eligibility conditions, and retirement provisions for the Oyo State Vehicle Loan Scheme.',
  },
};

export interface LoanTier {
  levels: string;
  amount: string;
  tenure: string;
  interest: string;
}

export const ELIGIBILITY_LOAN_TIERS: LoanTier[] = LOAN_TIERS.map((tier) => ({
  ...tier,
  interest: '13.33% p.a.',
}));

export const ELIGIBILITY_CONDITIONS = [
  'Active government service with a confirmed appointment in Oyo State civil service.',
  'Grade level qualification within one of the four designated loan tiers.',
  'No existing active vehicle loan under the scheme.',
  'Committee approval following formal review of the application.',
];

export const RETIREMENT_PROVISION_TEXT =
  'Staff within 24 months of retirement may be processed under gratuity settlement procedures where applicable.';

export const ELIGIBILITY_DISCLAIMER =
  'Eligibility is determined by scheme rules and committee decision. This page provides general information only.';
