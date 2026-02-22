// Repayment & Settlement Rules page content (/scheme/repayment)

export const REPAYMENT_PAGE = {
  title: 'Repayment & Settlement Rules',
  subtitle: 'Understanding loan repayment paths and settlement options',
  meta: {
    title: 'Repayment & Settlement Rules | Vehicle Loan Scheme',
    description:
      'Standard repayment, accelerated repayment, early settlement, and retirement provisions under the Oyo State Vehicle Loan Scheme.',
  },
};

export const SETTLEMENT_PATHS = [
  {
    title: 'Standard Repayment',
    description:
      '60-month tenure with monthly principal plus interest at 13.33% per annum, deducted via payroll. A 2-month moratorium applies from the date of disbursement before deductions begin.',
    example:
      'A Level 9 officer with ₦600,000 principal over 60 months pays approximately ₦10,000 per month in principal plus monthly interest.',
  },
  {
    title: 'Accelerated Repayment',
    description:
      'Beneficiaries may request higher monthly deductions to shorten the effective loan tenure. Accelerated payments reduce total interest paid over the life of the loan.',
    example:
      'A beneficiary opting to double their monthly deduction could reduce their effective tenure from 60 months to approximately 30 months, significantly reducing total interest.',
  },
  {
    title: 'Early Principal Settlement',
    description:
      'A lump-sum payment can be made at any time to settle the remaining principal balance. The system computes the exact settlement figure and generates a clearance certificate upon completion.',
    example:
      'A beneficiary with ₦400,000 outstanding principal can pay the full amount in a single transaction. VLPRS automatically generates the Auto-Stop Certificate.',
  },
  {
    title: 'Retirement & Gratuity Settlement',
    description:
      'For staff retiring before loan completion, the outstanding balance is recovered from gratuity entitlements. VLPRS tracks retirement dates and computes gratuity-receivable amounts to ensure timely settlement.',
    example:
      'A retiring officer with ₦200,000 outstanding will have this amount factored into their gratuity settlement computation by the relevant administrative authority.',
  },
];

export const REPAYMENT_SIDEBAR = {
  title: 'Key Clarification',
  text: 'VLPRS supports record accuracy and reconciliation. It does not replace payroll authority or gratuity processing procedures. Adjustments follow administrative review and applicable regulations.',
  linkText: '→ See FAQ',
  linkHref: '/resources/faq',
};
