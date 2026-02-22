export interface NavLink {
  label: string;
  href: string;
  badge?: string;
}

export interface NavDropdown {
  label: string;
  items: NavLink[];
}

export type NavItem = NavLink | NavDropdown;

export function isDropdown(item: NavItem): item is NavDropdown {
  return 'items' in item;
}

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  {
    label: 'The Scheme',
    items: [
      { label: 'Programme Overview', href: '/scheme/overview' },
      { label: 'About VLPRS', href: '/scheme/about-vlprs' },
      { label: 'Eligibility & Loan Categories', href: '/scheme/eligibility' },
      { label: 'Repayment & Settlement Rules', href: '/scheme/repayment' },
    ],
  },
  { label: 'How It Works', href: '/how-it-works' },
  {
    label: 'Resources',
    items: [
      { label: 'Frequently Asked Questions', href: '/resources/faq' },
      { label: 'MDA Submission Guide', href: '/resources/submission-guide' },
      { label: 'Downloads & Forms', href: '/resources/downloads' },
      { label: 'News & Announcements', href: '/resources/news' },
      {
        label: 'Approved Beneficiary Lists',
        href: '/resources/beneficiary-lists',
        badge: 'Coming Soon',
      },
    ],
  },
  { label: 'Help & Support', href: '/support' },
];

export const FOOTER_LINKS = {
  aboutScheme: [
    { label: 'About VLPRS', href: '/scheme/about-vlprs' },
    { label: 'Programme Overview', href: '/scheme/overview' },
    { label: 'Eligibility & Loan Categories', href: '/scheme/eligibility' },
    { label: 'Repayment & Settlement Rules', href: '/scheme/repayment' },
    { label: 'How It Works', href: '/how-it-works' },
  ],
  resources: [
    { label: 'Frequently Asked Questions', href: '/resources/faq' },
    { label: 'MDA Submission Guide', href: '/resources/submission-guide' },
    { label: 'Downloads & Forms', href: '/resources/downloads' },
    { label: 'News & Announcements', href: '/resources/news' },
  ],
  contact: {
    office: "Accountant-General's Office",
    address: 'Secretariat, Agodi, Ibadan, Oyo State',
    email: 'carloan@oyo.gov.ng',
    phone: '+234 (0) 2 XXX XXXX',
    hours: 'Monday – Friday, 8:00 AM – 6:00 PM WAT',
  },
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Accessibility', href: '/accessibility' },
    { label: 'Disclaimer', href: '/disclaimer' },
  ],
};
