// About the Programme page content (/about)

export const ABOUT_PAGE = {
  title: 'About the Programme',
  subtitle: 'Leadership, mission, and governance of the Oyo State Vehicle Loan Scheme',
  meta: {
    title: 'About the Programme | Vehicle Loan Scheme',
    description:
      'Mission, vision, leadership, and governance of the Oyo State Vehicle Loan Scheme administered by the Accountant-General\'s Office.',
  },
};

export const MISSION =
  'The Vehicle Loan Scheme exists to provide Oyo State civil servants with structured, transparent access to vehicle financing, administered with integrity and supported by technology that ensures accuracy, accountability, and fairness at every stage.';

export const VISION =
  'A public service where every vehicle loan is processed, tracked, and completed through a system that civil servants trust: where records are immutable, computations are transparent, and every stakeholder has confidence in the integrity of the process.';

export const CORE_VALUES = [
  'Transparency',
  'Accountability',
  'Accuracy',
  'Fairness',
  'Institutional Trust',
];

export interface Leader {
  role: string;
  name: string;
  description: string;
  image?: string;
}

export const PROGRAMME_LEADERS: Leader[] = [
  {
    role: 'Accountant-General',
    name: 'Mrs. K. A. Adegoke (FCA)',
    description:
      'Strategic oversight of the Vehicle Loan Scheme, ensuring alignment with government financial policy and regulatory requirements across all MDAs.',
    image: '/images/team/adegoke.jpeg',
  },
  {
    role: 'Director, Finance and Accounts',
    name: 'Mr. O. O. Kilanko',
    description:
      'Financial governance and accounting oversight for the scheme, ensuring accurate fund management and regulatory compliance.',
    image: '/images/team/kilanko.jpeg',
  },
  {
    role: 'Director, Inspectorate and Management Service',
    name: 'Mr. R. A. Adewole',
    description:
      'Inspectorate oversight and management service coordination, ensuring scheme operations meet established standards and procedures.',
    image: '/images/team/adewole.jpeg',
  },
  {
    role: 'Director, Treasury',
    name: 'Mr. T. G. Adebayo',
    description:
      'Treasury management and fund disbursement oversight for the Vehicle Loan Scheme.',
    image: '/images/team/adebayo.jpeg',
  },
  {
    role: 'Director, Administration and Supplies',
    name: 'Mrs. A. O. Adebiyi',
    description:
      'Administrative coordination and resource management supporting scheme operations across all MDAs.',
    image: '/images/team/adebiyi.jpeg',
  },
  {
    role: 'Head, Project Financial Management Unit (PFMU)',
    name: 'Mrs. C. F. Fadipe',
    description:
      'Project financial management and monitoring, ensuring scheme expenditures align with approved budgets and project milestones.',
    image: '/images/team/fadipe.jpeg',
  },
];

export const PROGRAMME_GOVERNANCE = {
  committee: {
    heading: 'Vehicle Loan Committee',
    text: 'The Vehicle Loan Committee is the designated approval authority for all loan applications. The committee comprises senior officials appointed under public service regulations. VLPRS supports the committee by providing verified data, computed eligibility, and documented records, but all approval decisions rest exclusively with the committee.',
  },
  agOffice: {
    heading: "AG's Office Role",
    text: 'The Accountant-General\'s Office provides scheme oversight, financial reporting, fund management, and compliance monitoring. As the administering authority, the AG\'s Office ensures that the scheme operates within established regulations and that all financial transactions are accurately recorded and auditable.',
  },
};

export const INSTITUTIONAL_STORY =
  'The Oyo State Vehicle Loan Scheme serves beneficiaries across all participating MDAs. As the scheme transitions to digital administration, VLPRS provides the technological foundation for accurate record-keeping, transparent computation, and real-time visibility, enabling the Accountant-General\'s Office to fulfil its mandate with greater efficiency and accountability.';

export const ABOUT_QUICK_LINKS = [
  { label: 'Eligibility & Loan Categories', href: '/scheme/eligibility' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Frequently Asked Questions', href: '/resources/faq' },
  { label: 'Help & Support', href: '/support' },
];

export const AUTHORITY_CALLOUT =
  "The AG's Office is the authority. VLPRS is the tool that serves that authority.";
