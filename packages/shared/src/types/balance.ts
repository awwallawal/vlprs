/** Ledger entry shape required for balance computation */
export interface LedgerEntryForBalance {
  amount: string;
  principalComponent: string;
  interestComponent: string;
  entryType: string;
}

/** Result of an outstanding balance computation */
export interface BalanceResult {
  computedBalance: string;        // totalLoan - sum(amounts), NUMERIC as string
  totalPrincipalPaid: string;     // sum(principal_component)
  totalInterestPaid: string;      // sum(interest_component)
  totalAmountPaid: string;        // sum(amount)
  principalRemaining: string;     // principal - totalPrincipalPaid
  interestRemaining: string;      // totalInterest - totalInterestPaid
  installmentsCompleted: number;  // count of PAYROLL entries
  installmentsRemaining: number;  // tenureMonths - installmentsCompleted
  entryCount: number;             // total ledger entries used in computation
  asOfDate: string | null;        // null = current, ISO date string = historical
  derivation: {
    formula: string;              // "totalLoan - sum(entries.amount)"
    totalLoan: string;
    entriesSum: string;
    isAnomaly: boolean;           // true if computedBalance < 0 (entries exceed totalLoan)
  };
}
