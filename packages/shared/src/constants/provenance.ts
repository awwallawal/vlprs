/**
 * Ledger-derived date-basis values (Story 17f.2).
 * Single source for the TS union AND the Zod enums — the three-way
 * type/interface/schema drift this replaces was a review finding.
 */
export const LEDGER_BASIS_VALUES = ['live', 'baseline', 'none'] as const;
export type LedgerBasis = (typeof LEDGER_BASIS_VALUES)[number];
