import Decimal from 'decimal.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { loans } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { ledgerDb } from '../db/immutable';
import * as loanService from './loanService';
import { computeBalanceFromEntries, computeGratuityProjection } from './computationEngine';
import type { GratuityProjectionResult } from '@vlprs/shared';

/**
 * Get gratuity projection for a single loan.
 * Thin orchestration: fetches data from existing services, delegates computation
 * to the pure function in computationEngine. Same pattern as balanceService.
 *
 * Returns null if temporal profile is incomplete (no retirement date).
 */
export async function getGratuityProjection(
  loanId: string,
  mdaScope?: string | null,
): Promise<GratuityProjectionResult | null> {
  const loan = await loanService.getLoanById(loanId, mdaScope);

  // If temporal profile is incomplete, cannot compute projection
  if (loan.temporalProfile.profileStatus !== 'complete' || !loan.temporalProfile.computedRetirementDate) {
    return null;
  }

  // Fetch entries and compute balance directly (avoids double loan fetch via balanceService)
  const entries = await ledgerDb.selectByLoan(loanId);
  const balance = computeBalanceFromEntries(
    loan.principalAmount,
    loan.interestRate,
    loan.tenureMonths,
    entries.map((e) => ({
      amount: e.amount,
      principalComponent: e.principalComponent,
      interestComponent: e.interestComponent,
      entryType: e.entryType,
    })),
    null,
  );

  return computeGratuityProjection({
    computedRetirementDate: new Date(loan.temporalProfile.computedRetirementDate),
    firstDeductionDate: new Date(loan.firstDeductionDate),
    tenureMonths: loan.tenureMonths,
    monthlyDeductionAmount: loan.monthlyDeductionAmount,
    principalAmount: loan.principalAmount,
    interestRate: loan.interestRate,
    installmentsCompleted: balance.installmentsCompleted,
  });
}

/**
 * Aggregate gratuity receivable exposure across all active loans.
 * MVP approach: iterate and compute per-loan.
 *
 * TODO: If dashboard latency > 1s at scale, consider:
 * - Materialized view with periodic refresh
 * - Redis cache with stale-while-revalidate
 * - Pre-computed aggregate table updated on ledger entry insert
 * (Deferred per architecture — Redis not yet in stack)
 */
export async function getAggregateGratuityExposure(
  mdaScope?: string | null,
): Promise<string> {
  // Query active loans with computed retirement dates
  const conditions = [
    eq(loans.status, 'ACTIVE'),
    isNotNull(loans.computedRetirementDate),
  ];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const activeLoanRows = await db.select({ id: loans.id })
    .from(loans)
    .where(and(...conditions));

  // Compute projections in parallel (reduces sequential DB round-trips)
  const projections = await Promise.all(
    activeLoanRows.map((row) => getGratuityProjection(row.id, mdaScope)),
  );

  let totalExposure = new Decimal('0');
  for (const projection of projections) {
    if (projection?.hasGratuityExposure) {
      totalExposure = totalExposure.plus(new Decimal(projection.projectedGratuityReceivableAmount));
    }
  }

  return totalExposure.toFixed(2);
}
