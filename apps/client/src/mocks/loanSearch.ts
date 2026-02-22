// Target: GET /api/loans/search
// Wire: Sprint 2 (Epic 2: Loan Data Management)
import type { LoanSearchResult } from '@vlprs/shared';

export const MOCK_LOAN_SEARCH_RESULTS: LoanSearchResult[] = [
  {
    loanId: 'loan-001',
    borrowerName: 'Akinwale Babatunde',
    staffId: 'OY/MOH/2019/0451',
    mdaName: 'Ministry of Health',
    loanRef: 'VL-2024-00451',
    outstandingBalance: '1875000.00',
  },
  {
    loanId: 'loan-002',
    borrowerName: 'Funmilayo Adeyemi',
    staffId: 'OY/MOE/2017/0832',
    mdaName: 'Ministry of Education',
    loanRef: 'VL-2024-00832',
    outstandingBalance: '900000.00',
  },
  {
    loanId: 'loan-003',
    borrowerName: 'Oluwaseun Oladipo',
    staffId: 'OY/MOF/2020/1204',
    mdaName: 'Ministry of Finance',
    loanRef: 'VL-2023-01204',
    outstandingBalance: '0.00',
  },
  {
    loanId: 'loan-004',
    borrowerName: 'Akinwale Ogunbiyi',
    staffId: 'OY/MOW/2018/0623',
    mdaName: 'Ministry of Works and Transport',
    loanRef: 'VL-2024-00623',
    outstandingBalance: '2100000.00',
  },
  {
    loanId: 'loan-005',
    borrowerName: 'Temitope Akinwale-Johnson',
    staffId: 'OY/MOA/2016/0195',
    mdaName: 'Ministry of Agriculture and Rural Development',
    loanRef: 'VL-2023-00195',
    outstandingBalance: '450000.00',
  },
];
