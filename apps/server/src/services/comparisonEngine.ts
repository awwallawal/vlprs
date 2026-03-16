import Decimal from 'decimal.js';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { submissionRows, mdaSubmissions, loans } from '../db/schema';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import type { ComparisonSummary, ComparisonRow, ComparisonCategory } from '@vlprs/shared';

const MINOR_VARIANCE_THRESHOLD = new Decimal('500');

/**
 * Format a numeric string as Naira display for explanation text.
 * E.g., "14166.67" → "₦14,166.67"
 */
function formatNairaText(amount: string): string {
  const num = new Decimal(amount).abs();
  const [whole, frac = '00'] = num.toFixed(2).split('.');
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${formatted}.${frac}`;
}

/**
 * Compare a submission's declared deductions against expected loan amounts.
 *
 * For each submission row:
 * - Look up the matching loan(s) by staffId + mdaId
 * - Compare amountDeducted vs loans.monthlyDeductionAmount
 * - Categorise: aligned (diff === 0), minor_variance (|diff| < 500), variance (|diff| >= 500)
 *
 * Edge cases:
 * - Staff ID not found → category 'variance', explanation notes no matching record
 * - Multiple active loans → compare against sum of all active deductions
 * - Event flag ≠ NONE → skip comparison (event rows, not regular deductions)
 * - Amount = ₦0 with cessation reason → skip comparison (cessation row)
 */
export async function compareSubmission(
  submissionId: string,
  mdaScope: string | null,
): Promise<{ summary: ComparisonSummary; referenceNumber: string }> {
  // Load submission header to verify ownership and get mdaId
  const conditions = [eq(mdaSubmissions.id, submissionId)];
  const scopeCondition = withMdaScope(mdaSubmissions.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const submission = await db.select({
    id: mdaSubmissions.id,
    mdaId: mdaSubmissions.mdaId,
    referenceNumber: mdaSubmissions.referenceNumber,
  })
    .from(mdaSubmissions)
    .where(and(...conditions))
    .limit(1);

  if (submission.length === 0) {
    throw new AppError(404, 'NOT_FOUND', 'Submission not found');
  }

  const mdaId = submission[0].mdaId;

  // Load all rows for this submission
  const rows = await db.select({
    staffId: submissionRows.staffId,
    amountDeducted: submissionRows.amountDeducted,
    eventFlag: submissionRows.eventFlag,
    cessationReason: submissionRows.cessationReason,
  })
    .from(submissionRows)
    .where(eq(submissionRows.submissionId, submissionId));

  // Filter out rows that should be skipped
  const comparableRows = rows.filter((row) => {
    // Skip event rows (not regular deductions)
    if (row.eventFlag !== 'NONE') return false;
    // Skip cessation rows (₦0 with cessation reason)
    const amount = new Decimal(row.amountDeducted);
    if (amount.isZero() && row.cessationReason) return false;
    return true;
  });

  const skippedCount = rows.length - comparableRows.length;

  // Batch query: get all active loans for the staff IDs in this MDA
  const uniqueStaffIds = [...new Set(comparableRows.map((r) => r.staffId))];

  // Map: staffId → sum of monthlyDeductionAmount across active loans
  const expectedByStaff = new Map<string, Decimal>();

  if (uniqueStaffIds.length > 0) {
    const activeLoanRows = await db.select({
      staffId: loans.staffId,
      monthlyDeductionAmount: loans.monthlyDeductionAmount,
    })
      .from(loans)
      .where(and(
        inArray(loans.staffId, uniqueStaffIds),
        eq(loans.mdaId, mdaId),
        eq(loans.status, 'ACTIVE'),
      ));

    for (const loan of activeLoanRows) {
      const current = expectedByStaff.get(loan.staffId) ?? new Decimal(0);
      expectedByStaff.set(loan.staffId, current.plus(new Decimal(loan.monthlyDeductionAmount)));
    }
  }

  // Compare each row
  const comparisonRows: ComparisonRow[] = [];
  let alignedCount = 0;
  let minorVarianceCount = 0;
  let varianceCount = 0;

  for (const row of comparableRows) {
    const declared = new Decimal(row.amountDeducted);
    const expected = expectedByStaff.get(row.staffId);

    if (expected === undefined) {
      // Staff ID not found in active loans
      varianceCount++;
      comparisonRows.push({
        staffId: row.staffId,
        declaredAmount: declared.toFixed(2),
        expectedAmount: '0.00',
        difference: declared.toFixed(2),
        category: 'variance',
        explanation: `No matching loan record found for Staff ID ${row.staffId}`,
      });
      continue;
    }

    const difference = declared.minus(expected);
    const absDifference = difference.abs();

    let category: ComparisonCategory;
    if (difference.isZero()) {
      category = 'aligned';
      alignedCount++;
    } else if (absDifference.lessThan(MINOR_VARIANCE_THRESHOLD)) {
      category = 'minor_variance';
      minorVarianceCount++;
    } else {
      category = 'variance';
      varianceCount++;
    }

    const compRow: ComparisonRow = {
      staffId: row.staffId,
      declaredAmount: declared.toFixed(2),
      expectedAmount: expected.toFixed(2),
      difference: difference.toFixed(2),
      category,
      explanation: difference.isZero()
        ? 'Values match'
        : `Declared ${formatNairaText(declared.toFixed(2))} vs expected ${formatNairaText(expected.toFixed(2))} — difference of ${formatNairaText(absDifference.toFixed(2))}`,
    };

    // Only include non-aligned rows in the response rows array
    if (category !== 'aligned') {
      comparisonRows.push(compRow);
    }
  }

  // Design: skipped rows (event/cessation) count as aligned because they are not
  // variances — the officer's file is correct for these rows. This keeps
  // totalRecords = alignedCount + minorVarianceCount + varianceCount.
  alignedCount += skippedCount;

  return {
    referenceNumber: submission[0].referenceNumber,
    summary: {
      alignedCount,
      minorVarianceCount,
      varianceCount,
      totalRecords: rows.length,
      rows: comparisonRows,
    },
  };
}
