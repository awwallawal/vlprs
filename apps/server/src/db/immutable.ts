import { db } from './index';
import { ledgerEntries } from './schema';
import { eq, and, asc } from 'drizzle-orm';

/**
 * Constrained DB accessor for ledger_entries.
 * ONLY exposes insert and select — no update or delete.
 * This is Layer 2 of the 3-layer immutability defence.
 */
export const ledgerDb = {
  async insert(values: typeof ledgerEntries.$inferInsert) {
    const [entry] = await db.insert(ledgerEntries).values(values).returning();
    return entry;
  },

  async selectByLoan(loanId: string) {
    return db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.loanId, loanId))
      .orderBy(asc(ledgerEntries.createdAt));
  },

  async selectByMdaAndLoan(mdaId: string, loanId: string) {
    return db
      .select()
      .from(ledgerEntries)
      .where(
        and(eq(ledgerEntries.loanId, loanId), eq(ledgerEntries.mdaId, mdaId))
      )
      .orderBy(asc(ledgerEntries.createdAt));
  },
};
