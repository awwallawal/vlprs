// Programme Disclaimer page content (/disclaimer)

export const DISCLAIMER_PAGE = {
  title: 'Programme Disclaimer',
  subtitle: 'Important information about the scope and limitations of VLPRS',
  meta: {
    title: 'Programme Disclaimer | Vehicle Loan Scheme',
    description:
      'Disclaimer for the Oyo State Vehicle Loan Processing & Receivables System covering system scope, committee authority, and legal limitations.',
  },
};

import type { LegalSection } from './types';

export const DISCLAIMER_SECTIONS: LegalSection[] = [
  {
    title: 'System Scope',
    body: 'The Vehicle Loan Processing & Receivables System (VLPRS) is an administrative support system that provides general programme information and maintains digital records for the Oyo State Vehicle Loan Scheme. The system is designed for record-keeping, computation, and reporting purposes. Information presented on this platform is for general guidance and administrative reference only.',
  },
  {
    title: 'Committee Authority',
    body: 'All loan approvals, rejections, deferrals, and policy determinations remain the exclusive responsibility of the Vehicle Loan Committee and designated approval authorities. VLPRS records and administers decisions made by these authorities; it does not make, influence, or override any decisions. The system serves as a tool that supports the decision-making process through verified data and transparent reporting.',
  },
  {
    title: 'Expression of Interest',
    body: 'Submission of an Expression of Interest (EOI) through VLPRS does not constitute, imply, or guarantee loan approval. An EOI is a formal registration of interest that initiates administrative processing. Approval is subject to committee review, fund availability, eligibility verification, and applicable government regulations. No commitment of any kind is made upon EOI submission.',
  },
  {
    title: 'No Legal Commitment',
    body: 'Information provided through VLPRS is for general guidance and administrative reference only. It does not constitute financial advice, legal advice, or a binding commitment by the Oyo State Government. While every effort is made to ensure accuracy, the Accountant-General\'s Office does not accept liability for errors, omissions, or actions taken based on information provided through this platform. For specific enquiries, please consult the Car Loan Department directly.',
  },
  {
    title: 'Payroll & Gratuity Scope',
    body: 'VLPRS records and tracks loan repayment data submitted by MDAs. It computes outstanding balances, generates repayment schedules, and produces Auto-Stop certificates. However, VLPRS does not execute payroll deductions (this remains the responsibility of each MDA\'s payroll function) and does not process gratuity payments (this remains the responsibility of the designated administrative authorities). VLPRS provides computed data to support these processes but does not replace the authorities responsible for executing them.',
  },
];
