// Downloads & Forms page content (/resources/downloads)

export const DOWNLOADS_PAGE = {
  title: 'Downloads & Forms',
  subtitle: 'Official templates, guides, and reference documents',
  meta: {
    title: 'Downloads & Forms | Vehicle Loan Scheme',
    description:
      'Download CSV submission templates, policy documents, and reference guides for the Oyo State Vehicle Loan Scheme.',
  },
};

export interface DownloadResource {
  name: string;
  format: 'CSV' | 'PDF';
  description: string;
  fileSize?: string;
  status: 'available' | 'coming-soon';
  downloadUrl?: string;
}

export const DOWNLOAD_RESOURCES: DownloadResource[] = [
  {
    name: 'CSV Submission Template',
    format: 'CSV',
    description:
      'Official 8-field CSV template for monthly deduction data submission. Includes correct headers and one example row.',
    fileSize: '~1 KB',
    status: 'available',
    downloadUrl: '/templates/submission-template.csv',
  },
  {
    name: 'Policy Summary',
    format: 'PDF',
    description:
      "Official policy document summarising the Vehicle Loan Scheme rules and regulations. To be provided by the AG's Office.",
    status: 'coming-soon',
  },
  {
    name: 'MDA Officer Quick Reference Guide',
    format: 'PDF',
    description:
      'A concise reference card for MDA officers covering submission deadlines, CSV format, and common procedures. To be created post-training.',
    status: 'coming-soon',
  },
  {
    name: 'Training Materials',
    format: 'PDF',
    description:
      'Comprehensive training materials for VLPRS rollout sessions. To be created for training phase.',
    status: 'coming-soon',
  },
];
