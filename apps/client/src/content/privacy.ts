// Privacy & Data Protection page content (/privacy)

export const PRIVACY_PAGE = {
  title: 'Privacy & Data Protection',
  subtitle: 'How VLPRS handles your personal data',
  meta: {
    title: 'Privacy & Data Protection | Vehicle Loan Scheme',
    description:
      'Privacy policy for the Oyo State Vehicle Loan Processing & Receivables System, aligned with the Nigeria Data Protection Regulation (NDPR).',
  },
};

import type { LegalSection } from './types';

export type { LegalSection };

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'What Personal Data Is Collected',
    body: 'VLPRS collects the minimum personal data necessary for loan administration: staff identification details (name, Staff ID, grade level, MDA), employment information (appointment date, retirement date), and financial records (loan amounts, repayment history, outstanding balances). Data collection follows the principle of data minimisation; only information directly required for scheme administration is captured.',
  },
  {
    title: 'How Data Is Processed',
    body: 'Personal data is processed exclusively for the purposes of vehicle loan administration: computing repayment schedules, tracking outstanding balances, generating Auto-Stop certificates, producing compliance reports, and maintaining audit trails. Data is not processed for marketing, profiling, or any purpose outside the scope of the Vehicle Loan Scheme.',
  },
  {
    title: 'Who Has Access',
    body: 'Access to personal data is controlled through role-based access control (RBAC). Each user is assigned a specific role that determines which data they can view and what actions they can perform. MDA officers can only access records for beneficiaries within their MDA. Executive roles have broader visibility as required for oversight. All access is logged in the audit trail.',
  },
  {
    title: 'Data Retention',
    body: 'Financial records are retained for a minimum of 7 years in accordance with government financial regulations and audit requirements. Active loan records are maintained throughout the loan lifecycle. Completed loan records are retained for the regulatory minimum period. Personal data associated with inactive or settled loans is retained only as required for audit and regulatory compliance.',
  },
  {
    title: 'Right of Access',
    body: 'Beneficiaries have the right to view their own personal data held within VLPRS. This includes loan details, repayment history, outstanding balance, and Auto-Stop certificate status. Access to personal records will be available through the Beneficiary Portal in Phase 2. Until then, requests can be directed to the Car Loan Department.',
  },
  {
    title: 'Consent Practices',
    body: 'Participation in the Vehicle Loan Scheme constitutes consent for the processing of personal data as described in this policy. Consent is captured at the point of Expression of Interest submission and covers the full loan lifecycle. Beneficiaries are informed of data processing practices through this policy and scheme documentation.',
  },
  {
    title: 'Data Security',
    body: 'VLPRS implements comprehensive security measures to protect personal data: encryption at rest using AES-256, encryption in transit using TLS 1.2+, role-based access control (RBAC), comprehensive audit logging of all data access and modifications, session management with automatic timeout, and CSRF protection on all state-changing operations.',
  },
  {
    title: 'Data Protection Enquiries',
    body: "For enquiries about personal data held by VLPRS, requests for data access, or concerns about data handling, please contact the Data Protection Officer at the Accountant-General's Office, Secretariat, Agodi, Ibadan, Oyo State, or email carloan@oyo.gov.ng with the subject line 'Data Protection Enquiry'.",
  },
];
