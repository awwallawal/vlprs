// Help & Support page content (/support)

export const SUPPORT_PAGE = {
  title: 'Help & Support',
  subtitle: 'Contact information, guidance, and useful resources',
  meta: {
    title: 'Help & Support | Vehicle Loan Scheme',
    description:
      'Contact the Car Loan Department, find guidance for MDA officers and beneficiaries, and access support resources for the Oyo State Vehicle Loan Scheme.',
  },
};

export const GUIDANCE_ITEMS = [
  {
    audience: 'MDA Officers',
    text: 'For submission instructions, CSV format, and deadlines',
    linkLabel: 'MDA Submission Guide',
    linkHref: '/resources/submission-guide',
  },
  {
    audience: 'Loan Enquiries',
    text: 'For balance enquiries, repayment questions, or Auto-Stop certificates',
    linkLabel: 'Car Loan Department',
    linkHref: '#contact',
  },
  {
    audience: 'Technical Issues',
    text: 'For portal access, login issues, or system errors',
    linkLabel: 'Email Support',
    linkHref: 'mailto:carloan@oyo.gov.ng',
  },
];

export const CONTACT_INFO = {
  address: {
    label: 'Visit Us',
    lines: ["Accountant-General's Office", 'Secretariat, Agodi', 'Ibadan, Oyo State'],
  },
  email: {
    label: 'Email',
    value: 'carloan@oyo.gov.ng',
  },
  phone: {
    label: 'Phone',
    value: '+234 (0) 2 XXX XXXX',
  },
  hours: 'Monday – Friday, 8:00 AM – 6:00 PM WAT',
};

export const USEFUL_LINKS = [
  { label: 'Frequently Asked Questions', href: '/resources/faq' },
  { label: 'MDA Submission Guide', href: '/resources/submission-guide' },
  { label: 'Programme Overview', href: '/scheme' },
];
