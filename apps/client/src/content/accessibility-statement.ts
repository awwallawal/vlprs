// Accessibility Statement page content (/accessibility)

export const ACCESSIBILITY_PAGE = {
  title: 'Accessibility Statement',
  subtitle: 'Our commitment to accessible digital services',
  meta: {
    title: 'Accessibility Statement | Vehicle Loan Scheme',
    description:
      'Accessibility statement for the Oyo State Vehicle Loan Processing & Receivables System, covering WCAG 2.1 AA compliance and accessibility features.',
  },
};

import type { LegalSection } from './types';

export const ACCESSIBILITY_SECTIONS: LegalSection[] = [
  {
    title: 'WCAG 2.1 AA Compliance',
    body: 'VLPRS is designed and developed to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. We are committed to ensuring that all users, including those with disabilities, can access, navigate, and interact with the platform effectively.',
  },
  {
    title: 'Accessibility Features',
    body: 'VLPRS includes the following accessibility features: full keyboard navigation support for all interactive elements; screen reader compatibility with semantic HTML and ARIA labels; colour contrast ratios meeting WCAG AA standards (minimum 4.5:1 for body text, 3:1 for large text); text resizing support up to 200% without loss of functionality; touch targets of minimum 44x44 pixels on mobile devices; visible focus indicators on all interactive elements; and consistent, predictable navigation throughout the platform.',
  },
  {
    title: 'Known Limitations',
    body: 'No accessibility issues have been identified at this time. We conduct regular accessibility reviews and address any issues promptly. If you encounter any barriers to access, please report them using the contact information below.',
  },
  {
    title: 'Report an Issue',
    body: "If you experience any difficulty accessing or using VLPRS, please contact us so we can assist you and improve the platform. You can reach us at carloan@oyo.gov.ng with the subject line 'Accessibility Issue', or contact the Accountant-General's Office directly at Secretariat, Agodi, Ibadan, Oyo State.",
  },
  {
    title: 'Continuous Improvement',
    body: 'We are committed to continually improving the accessibility of VLPRS. Our development process includes accessibility testing at every stage, and we regularly review our compliance with current standards. This statement is reviewed and updated as the platform evolves.',
  },
];
