/** Ledger entry shape required for balance computation */
export interface LedgerEntryForBalance {
  amount: string;
  principalComponent: string;
  interestComponent: string;
  entryType: string;
  periodMonth?: number | null;
  periodYear?: number | null;
}

/**
 * Date-basis disclosure for a computed money figure (Story 17f.2, D-a).
 * - 'live'     — at least one posted PAYROLL event feeds this figure
 * - 'baseline' — only migration-baseline / adjustment events feed it (frozen as at the latest period)
 * - 'declared' — derives from registered/declared loan terms, not ledger events
 * - 'none'     — no ledger events exist for this record
 * - 'unknown'  — basis not determinable on this computation path (no chip rendered)
 */
export interface BalanceProvenance {
  basis: 'live' | 'baseline' | 'declared' | 'none' | 'unknown';
  latestEntryPeriod: string | null;  // "YYYY-MM" of the newest contributing entry, when known
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
  provenance?: BalanceProvenance; // date-basis disclosure (17f.2); optional for fixture tolerance, always sent by the server
  derivation: {
    formula: string;              // "totalLoan - sum(entries.amount)"
    totalLoan: string;
    entriesSum: string;
    isAnomaly: boolean;           // true if computedBalance < 0 (entries exceed totalLoan)
  };
}
