import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { UI_COPY, getTierForGradeLevel } from '@vlprs/shared';
import type { MigrationRecordDetail, VarianceCategory } from '@vlprs/shared';
import { formatNairaOrDash } from '@/lib/formatters';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { useMigrationRecordDetail, useCorrectMigrationRecord, useCreateBaseline, useSubmitReview, useMarkReviewed } from '@/hooks/useMigration';

// ─── Financial Comparison Utilities ──────────────────────────────────
// Convert monetary strings to integer cents to avoid floating-point precision issues.
// All API values use numeric(15,2) columns → at most 2 decimal places.
function centsOf(v: string): number {
  const [whole, frac = ''] = v.split('.');
  return parseInt(whole + (frac + '00').slice(0, 2), 10);
}

function moneyGt(a: string, b: string): boolean {
  return centsOf(a) > centsOf(b);
}

function moneyDiff(a: string | null, b: string | null): string {
  if (a === null || b === null) return '0.00';
  const diff = Math.abs(centsOf(a) - centsOf(b));
  return (diff / 100).toFixed(2);
}

interface RecordDetailDrawerProps {
  uploadId: string;
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BADGE_STYLES: Record<VarianceCategory, string> = {
  clean: 'bg-teal/10 text-teal border-teal/20',
  minor_variance: 'bg-gold/10 text-gold border-gold/20',
  significant_variance: 'bg-gold/20 text-gold border-gold/30',
  structural_error: 'bg-amber-50 text-amber-600 border-amber-200',
  anomalous: 'bg-gray-100 text-gray-500 border-gray-200',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/50 pb-4 mb-4">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value ?? '\u2014'}</span>
    </div>
  );
}

/**
 * Parse a numeric grade from a string like "GL 08", "08", "Level 10", etc.
 */
function parseGradeNumber(grade: string | null): number | null {
  if (!grade) return null;
  const match = grade.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function InferredGradeRow({
  declaredGrade,
  inferredTier,
  principal,
}: {
  declaredGrade: string | null;
  inferredTier: { tier: number; gradeLevels: string; maxPrincipal: string };
  principal: string | null;
}) {
  const declaredNum = parseGradeNumber(declaredGrade);

  // Determine match status using shared tier configuration
  let status: 'match' | 'above_entitlement' | 'info' = 'info';
  if (declaredNum !== null) {
    const declaredTier = getTierForGradeLevel(declaredNum);
    if (principal && declaredTier) {
      if (moneyGt(principal, declaredTier.maxPrincipal)) {
        status = 'above_entitlement';
      } else {
        status = 'match';
      }
    } else if (declaredNum >= inferredTier.tier) {
      status = 'match';
    }
  }

  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-text-secondary">Inferred Grade</span>
      <span className="text-sm font-medium flex items-center gap-1.5">
        <span className="text-text-primary">{inferredTier.gradeLevels}</span>
        {status === 'match' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-teal/10 text-teal border border-teal/20">
            Consistent
          </span>
        )}
        {status === 'above_entitlement' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
            Above grade entitlement
          </span>
        )}
      </span>
    </div>
  );
}

function ThreeVectorTable({ detail }: { detail: MigrationRecordDetail }) {
  const hasSchemeExpected = detail.schemeExpectedValues.totalLoan !== null;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="py-1 px-2 text-left text-xs text-text-secondary font-normal" />
          <th className="py-1 px-2 text-right text-xs text-text-secondary font-normal">
            Scheme <MetricHelp metric="migration.schemeExpected" />
          </th>
          <th className="py-1 px-2 text-right text-xs text-text-secondary font-normal">
            Rev. Eng. <MetricHelp metric="migration.reverseEngineered" />
          </th>
          <th className="py-1 px-2 text-right text-xs text-text-secondary font-normal">
            Declared <MetricHelp metric="migration.mdaDeclared" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-border/30">
          <td className="py-2 px-2 text-text-secondary">Total Loan</td>
          <td className="py-2 px-2 text-right">{hasSchemeExpected ? formatNairaOrDash(detail.schemeExpectedValues.totalLoan) : <span className="text-text-tertiary italic text-xs">N/A</span>}</td>
          <td className="py-2 px-2 text-right">{formatNairaOrDash(detail.computedValues.totalLoan)}</td>
          <td className="py-2 px-2 text-right">{formatNairaOrDash(detail.declaredValues.totalLoan)}</td>
        </tr>
        <tr className="border-b border-border/30">
          <td className="py-2 px-2 text-text-secondary">Monthly Ded.</td>
          <td className="py-2 px-2 text-right">{hasSchemeExpected ? formatNairaOrDash(detail.schemeExpectedValues.monthlyDeduction) : <span className="text-text-tertiary italic text-xs">N/A</span>}</td>
          <td className="py-2 px-2 text-right">{formatNairaOrDash(detail.computedValues.monthlyDeduction)}</td>
          <td className="py-2 px-2 text-right">{formatNairaOrDash(detail.declaredValues.monthlyDeduction)}</td>
        </tr>
        <tr>
          <td className="py-2 px-2 text-text-secondary">Total Interest</td>
          <td className="py-2 px-2 text-right">{hasSchemeExpected ? formatNairaOrDash(detail.schemeExpectedValues.totalInterest) : <span className="text-text-tertiary italic text-xs">N/A</span>}</td>
          <td className="py-2 px-2 text-right">{'\u2014'}</td>
          <td className="py-2 px-2 text-right">{formatNairaOrDash(detail.declaredValues.interestTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

interface FieldVariance {
  field: string;
  declared: string | null;
  reference: string | null;
  referenceSource: 'Scheme Expected' | 'Rev. Eng.';
  diff: string; // monetary diff as "0.00" string (cents-safe)
}

function VarianceBreakdown({ detail }: { detail: MigrationRecordDetail }) {
  const hasSchemeExpected = detail.schemeExpectedValues.totalLoan !== null;
  const fieldVariances: FieldVariance[] = [];

  // Total Loan variance
  const tlDeclared = detail.declaredValues.totalLoan;
  const tlReference = hasSchemeExpected ? detail.schemeExpectedValues.totalLoan : detail.computedValues.totalLoan;
  if (tlDeclared && tlReference) {
    fieldVariances.push({
      field: 'Total Loan',
      declared: tlDeclared,
      reference: tlReference,
      referenceSource: hasSchemeExpected ? 'Scheme Expected' : 'Rev. Eng.',
      diff: moneyDiff(tlDeclared, tlReference),
    });
  }

  // Monthly Deduction variance
  const mdDeclared = detail.declaredValues.monthlyDeduction;
  const mdReference = hasSchemeExpected ? detail.schemeExpectedValues.monthlyDeduction : detail.computedValues.monthlyDeduction;
  if (mdDeclared && mdReference) {
    fieldVariances.push({
      field: 'Monthly Ded.',
      declared: mdDeclared,
      reference: mdReference,
      referenceSource: hasSchemeExpected ? 'Scheme Expected' : 'Rev. Eng.',
      diff: moneyDiff(mdDeclared, mdReference),
    });
  }

  // Outstanding Balance variance (always Rev. Eng. — no scheme expected for outstanding)
  const obDeclared = detail.declaredValues.outstandingBalance;
  const obReference = detail.computedValues.outstandingBalance;
  if (obDeclared && obReference) {
    fieldVariances.push({
      field: 'Outstanding Bal.',
      declared: obDeclared,
      reference: obReference,
      referenceSource: 'Rev. Eng.',
      diff: moneyDiff(obDeclared, obReference),
    });
  }

  if (fieldVariances.length === 0) return null;

  // Find the largest contributor (compare as cents for precision)
  const maxDiffCents = Math.max(...fieldVariances.map(fv => centsOf(fv.diff)));

  return (
    <div className="space-y-2">
      {fieldVariances.map((fv) => {
        const isLargest = centsOf(fv.diff) === maxDiffCents && centsOf(fv.diff) > 0;
        return (
          <div key={fv.field} className={`rounded-lg p-2.5 ${isLargest ? 'bg-amber-50/60 border border-amber-200/60' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">{fv.field}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-semibold ${isLargest ? 'text-amber-700' : 'text-text-primary'}`}>
                  {formatNairaOrDash(fv.diff)}
                </span>
                {isLargest && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">
                    Largest
                  </span>
                )}
              </div>
            </div>
            <div className="text-[11px] text-text-tertiary mt-1">
              |{formatNairaOrDash(fv.declared)} - {formatNairaOrDash(fv.reference)}|
              <span className="ml-1 italic">({fv.referenceSource})</span>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-text-tertiary">
        Overall variance is the largest field difference above.
      </p>
    </div>
  );
}

function OutstandingBalanceComparison({ detail }: { detail: MigrationRecordDetail }) {
  const declared = detail.declaredValues.outstandingBalance;
  const computed = detail.computedValues.outstandingBalance;
  const corrected = detail.correctedValues?.outstandingBalance;

  // Compute variance between declared and computed (cents-safe)
  let variance: string | null = null;
  if (declared && computed) {
    const diff = moneyDiff(declared, computed);
    if (centsOf(diff) >= 1) variance = diff;
  }

  return (
    <div className="space-y-1 mb-3">
      <InfoRow
        label="Computed (Rev. Eng.)"
        value={formatNairaOrDash(computed)}
      />
      <div className="flex justify-between py-1">
        <span className="text-sm text-text-secondary">MDA Declared</span>
        <span className="text-sm text-text-primary font-medium">
          {formatNairaOrDash(declared)}
          {declared && computed && moneyGt(declared, computed) && centsOf(moneyDiff(declared, computed)) > 100 && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
              Above computed
            </span>
          )}
        </span>
      </div>
      {variance && (
        <InfoRow label="Variance" value={formatNairaOrDash(variance)} />
      )}
      {corrected != null && (
        <div className="flex justify-between py-1">
          <span className="text-sm text-teal font-medium">Corrected</span>
          <span className="text-sm text-teal font-medium">{formatNairaOrDash(corrected)}</span>
        </div>
      )}
      <InfoRow label="Installments" value={`${detail.declaredValues.installmentsPaid ?? '\u2014'} paid / ${detail.declaredValues.installmentCount ?? '\u2014'} total`} />
    </div>
  );
}

function OutstandingBalanceWarning({ detail }: { detail: MigrationRecordDetail }) {
  const effectiveOutstanding = detail.correctedValues?.outstandingBalance ?? detail.declaredValues.outstandingBalance;
  const referenceTotalLoan = detail.schemeExpectedValues.totalLoan ?? detail.computedValues.totalLoan ?? detail.declaredValues.totalLoan;

  if (!effectiveOutstanding || !referenceTotalLoan) return null;
  if (!moneyGt(effectiveOutstanding, referenceTotalLoan)) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
      <p className="text-sm text-amber-700 font-medium">Outstanding balance exceeds total loan</p>
      <p className="text-xs text-amber-600 mt-1" title="The declared outstanding balance exceeds the total loan amount. This would create a negative baseline entry affecting all downstream metrics.">
        {formatNairaOrDash(effectiveOutstanding)} outstanding vs {formatNairaOrDash(referenceTotalLoan)} total loan. Please review and correct this value before establishing the baseline.
      </p>
    </div>
  );
}

function CorrectionForm({ detail, uploadId }: { detail: MigrationRecordDetail; uploadId: string }) {
  const [editing, setEditing] = useState(false);
  const [outstandingBalance, setOutstandingBalance] = useState('');
  const [totalLoan, setTotalLoan] = useState('');
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [installmentsPaid, setInstallmentsPaid] = useState('');
  const [installmentsOutstanding, setInstallmentsOutstanding] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const isFlagged = !!detail.flaggedForReviewAt;
  const correctMutation = useCorrectMigrationRecord(uploadId);
  const reviewMutation = useSubmitReview(uploadId);

  // Auto-recompute outstanding balance preview when installmentsOutstanding changes
  const effectiveMonthly = monthlyDeduction || detail.correctedValues?.monthlyDeduction || detail.declaredValues.monthlyDeduction;
  const autoOutstanding = installmentsOutstanding && effectiveMonthly
    ? (Number(effectiveMonthly) * Number(installmentsOutstanding)).toFixed(2)
    : null;

  const handleStartEdit = () => {
    setOutstandingBalance(detail.correctedValues?.outstandingBalance ?? detail.declaredValues.outstandingBalance ?? '');
    setTotalLoan(detail.correctedValues?.totalLoan ?? detail.declaredValues.totalLoan ?? '');
    setMonthlyDeduction(detail.correctedValues?.monthlyDeduction ?? detail.declaredValues.monthlyDeduction ?? '');
    setInstallmentCount(String(detail.correctedValues?.installmentCount ?? detail.declaredValues.installmentCount ?? ''));
    setInstallmentsPaid(String(detail.correctedValues?.installmentsPaid ?? detail.declaredValues.installmentsPaid ?? ''));
    setInstallmentsOutstanding(String(detail.correctedValues?.installmentsOutstanding ?? detail.declaredValues.installmentsOutstanding ?? ''));
    setCorrectionReason('');
    setEditing(true);
  };

  const handleSave = () => {
    const corrections: Record<string, unknown> = {};
    const currentOB = detail.correctedValues?.outstandingBalance ?? detail.declaredValues.outstandingBalance ?? '';
    const currentTL = detail.correctedValues?.totalLoan ?? detail.declaredValues.totalLoan ?? '';
    const currentMD = detail.correctedValues?.monthlyDeduction ?? detail.declaredValues.monthlyDeduction ?? '';
    const currentIC = String(detail.correctedValues?.installmentCount ?? detail.declaredValues.installmentCount ?? '');
    const currentIP = String(detail.correctedValues?.installmentsPaid ?? detail.declaredValues.installmentsPaid ?? '');
    const currentIO = String(detail.correctedValues?.installmentsOutstanding ?? detail.declaredValues.installmentsOutstanding ?? '');

    if (outstandingBalance && outstandingBalance !== currentOB) corrections.outstandingBalance = outstandingBalance;
    if (totalLoan && totalLoan !== currentTL) corrections.totalLoan = totalLoan;
    if (monthlyDeduction && monthlyDeduction !== currentMD) corrections.monthlyDeduction = monthlyDeduction;
    if (installmentCount && installmentCount !== currentIC) corrections.installmentCount = Number(installmentCount);
    if (installmentsPaid && installmentsPaid !== currentIP) corrections.installmentsPaid = Number(installmentsPaid);
    if (installmentsOutstanding && installmentsOutstanding !== currentIO) corrections.installmentsOutstanding = Number(installmentsOutstanding);

    // correctionReason is mandatory for ALL corrections (Story 15.0n) —
    // flagged or not, every change leaves an audit trail.
    if (correctionReason.length < 10) return;

    if (isFlagged) {
      reviewMutation.mutate(
        { recordId: detail.recordId, corrections, correctionReason },
        { onSuccess: () => setEditing(false) },
      );
    } else {
      if (Object.keys(corrections).length === 0) {
        setEditing(false);
        return;
      }
      correctMutation.mutate(
        { recordId: detail.recordId, corrections: { ...corrections, correctionReason } },
        { onSuccess: () => setEditing(false) },
      );
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={handleStartEdit}
        className="text-xs text-teal hover:text-teal/80 underline"
      >
        Edit values before baseline
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-gray-50 rounded-lg p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary block mb-1">Outstanding Balance</label>
          <input
            type="text"
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            value={outstandingBalance}
            onChange={(e) => setOutstandingBalance(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Total Loan</label>
          <input
            type="text"
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            value={totalLoan}
            onChange={(e) => setTotalLoan(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Monthly Deduction</label>
          <input
            type="text"
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            value={monthlyDeduction}
            onChange={(e) => setMonthlyDeduction(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Installment Count</label>
          <input
            type="number"
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
            min={1}
            max={120}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Installments Paid</label>
          <input
            type="number"
            value={installmentsPaid}
            onChange={(e) => setInstallmentsPaid(e.target.value)}
            min={0}
            max={120}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">Installments Outstanding</label>
          <input
            type="number"
            value={installmentsOutstanding}
            onChange={(e) => setInstallmentsOutstanding(e.target.value)}
            min={0}
            max={120}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal"
          />
        </div>
      </div>

      {/* Auto-recompute preview: when installments outstanding changes, show what outstanding balance will be */}
      {autoOutstanding && autoOutstanding !== outstandingBalance && (
        <div className="bg-teal/5 border border-teal/20 rounded-lg p-2.5">
          <p className="text-xs text-teal font-medium">Computed outstanding balance</p>
          <p className="text-sm text-text-primary mt-0.5">
            {formatNairaOrDash(effectiveMonthly)} x {installmentsOutstanding} months = <strong>{formatNairaOrDash(autoOutstanding)}</strong>
          </p>
          <p className="text-[11px] text-text-tertiary mt-1">
            This value will be applied automatically on save unless you enter a different outstanding balance.
          </p>
          <button
            type="button"
            onClick={() => setOutstandingBalance(autoOutstanding)}
            className="mt-1.5 text-xs text-teal hover:text-teal/80 underline"
          >
            Apply to field now
          </button>
        </div>
      )}

      {/* Correction reason — required for ALL corrections (Story 15.0n) */}
      <div>
        <label className="text-xs text-text-secondary block mb-1">
          Correction reason <span className="text-amber-600">(required, min 10 characters)</span>
        </label>
        <textarea
          value={correctionReason}
          onChange={(e) => setCorrectionReason(e.target.value)}
          placeholder="Explain why these values are being corrected..."
          rows={2}
          className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal resize-none"
        />
        {correctionReason.length > 0 && correctionReason.length < 10 && (
          <p className="text-[11px] text-amber-600 mt-0.5">{10 - correctionReason.length} more character{10 - correctionReason.length !== 1 ? 's' : ''} needed</p>
        )}
      </div>

      {(correctMutation.isError || reviewMutation.isError) && (
        <p className="text-xs text-amber-600">{(correctMutation.error ?? reviewMutation.error)?.message ?? 'Correction could not be saved. Please check values and try again.'}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={correctMutation.isPending || reviewMutation.isPending || correctionReason.length < 10}
          className="px-3 py-1.5 text-xs bg-teal text-white rounded hover:bg-teal/90 disabled:opacity-50"
        >
          {(correctMutation.isPending || reviewMutation.isPending) ? 'Saving...' : 'Save Correction'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 text-xs border border-border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CorrectionHistory({ detail }: { detail: MigrationRecordDetail }) {
  if (!detail.originalValuesSnapshot || !detail.correctedValues) return null;

  const snapshot = detail.originalValuesSnapshot as Record<string, string | number | null>;

  return (
    <Section title="Correction History">
      {detail.correctedValues.outstandingBalance != null && (
        <div className="text-sm">
          <span className="text-text-secondary">Outstanding Balance:</span>{' '}
          <span className="text-text-tertiary">{formatNairaOrDash(snapshot.outstandingBalance as string | null)}</span>
          {' \u2192 '}
          <span className="text-text-primary font-medium">{formatNairaOrDash(detail.correctedValues.outstandingBalance)}</span>
        </div>
      )}
      {detail.correctedValues.totalLoan != null && (
        <div className="text-sm">
          <span className="text-text-secondary">Total Loan:</span>{' '}
          <span className="text-text-tertiary">{formatNairaOrDash(snapshot.totalLoan as string | null)}</span>
          {' \u2192 '}
          <span className="text-text-primary font-medium">{formatNairaOrDash(detail.correctedValues.totalLoan)}</span>
        </div>
      )}
      {detail.correctedValues.monthlyDeduction != null && (
        <div className="text-sm">
          <span className="text-text-secondary">Monthly Deduction:</span>{' '}
          <span className="text-text-tertiary">{formatNairaOrDash(snapshot.monthlyDeduction as string | null)}</span>
          {' \u2192 '}
          <span className="text-text-primary font-medium">{formatNairaOrDash(detail.correctedValues.monthlyDeduction)}</span>
        </div>
      )}
      {detail.correctedValues.installmentCount != null && (
        <div className="text-sm">
          <span className="text-text-secondary">Installment Count:</span>{' '}
          <span className="text-text-tertiary">{snapshot.installmentCount ?? '\u2014'}</span>
          {' \u2192 '}
          <span className="text-text-primary font-medium">{detail.correctedValues.installmentCount}</span>
        </div>
      )}
      {detail.correctedValues.installmentsPaid != null && (
        <div className="text-sm">
          <span className="text-text-secondary">Installments Paid:</span>{' '}
          <span className="text-text-tertiary">{snapshot.installmentsPaid ?? '\u2014'}</span>
          {' \u2192 '}
          <span className="text-text-primary font-medium">{detail.correctedValues.installmentsPaid}</span>
        </div>
      )}
      {detail.correctedValues.installmentsOutstanding != null && (
        <div className="text-sm">
          <span className="text-text-secondary">Installments Outstanding:</span>{' '}
          <span className="text-text-tertiary">{snapshot.installmentsOutstanding ?? '\u2014'}</span>
          {' \u2192 '}
          <span className="text-text-primary font-medium">{detail.correctedValues.installmentsOutstanding}</span>
        </div>
      )}
      {detail.correctedAt && (
        <p className="text-xs text-text-tertiary mt-2">
          Corrected on {new Date(detail.correctedAt).toLocaleString()}
        </p>
      )}
    </Section>
  );
}

function MarkReviewedButton({ detail, uploadId }: { detail: MigrationRecordDetail; uploadId: string }) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const markReviewedMutation = useMarkReviewed(uploadId);

  // Only show for flagged records that haven't been reviewed yet
  if (!detail.flaggedForReviewAt || detail.correctedBy) return null;

  if (!showReason) {
    return (
      <button
        type="button"
        onClick={() => setShowReason(true)}
        className="w-full mt-2 px-3 py-2 text-xs border border-teal/30 text-teal rounded-lg hover:bg-teal/5"
      >
        Mark Reviewed — Values Correct
      </button>
    );
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg p-3 space-y-2">
      <p className="text-xs text-text-secondary">
        Confirm these values are correct. Provide context for this determination:
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Values verified against source documents — no correction needed"
        rows={2}
        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal resize-none"
      />
      {reason.length > 0 && reason.length < 10 && (
        <p className="text-[11px] text-amber-600">{10 - reason.length} more character{10 - reason.length !== 1 ? 's' : ''} needed</p>
      )}
      {markReviewedMutation.isError && (
        <p className="text-xs text-amber-600">{markReviewedMutation.error?.message}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => markReviewedMutation.mutate(
            { recordId: detail.recordId, correctionReason: reason },
            { onSuccess: () => setShowReason(false) },
          )}
          disabled={markReviewedMutation.isPending || reason.length < 10}
          className="px-3 py-1.5 text-xs bg-teal text-white rounded hover:bg-teal/90 disabled:opacity-50"
        >
          {markReviewedMutation.isPending ? 'Submitting...' : 'Confirm — Values Correct'}
        </button>
        <button
          type="button"
          onClick={() => setShowReason(false)}
          className="px-3 py-1.5 text-xs border border-border rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReviewMetadata({ detail }: { detail: MigrationRecordDetail }) {
  if (!detail.flaggedForReviewAt) return null;

  return (
    <Section title="Review Status">
      {detail.correctedBy ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal/10 text-teal border border-teal/20">
              Reviewed
            </span>
          </div>
          {detail.correctionReason && (
            <div className="text-sm">
              <span className="text-text-secondary">Context:</span>{' '}
              <span className="text-text-primary">{detail.correctionReason}</span>
            </div>
          )}
          {detail.correctedValues ? (
            <p className="text-xs text-text-tertiary">Corrections applied</p>
          ) : (
            <p className="text-xs text-text-tertiary">No corrections — values confirmed correct</p>
          )}
          {detail.correctedAt && (
            <p className="text-xs text-text-tertiary">
              Reviewed on {new Date(detail.correctedAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-200">
              Pending Review
            </span>
          </div>
          <p className="text-xs text-text-tertiary">
            Flagged on {new Date(detail.flaggedForReviewAt).toLocaleDateString()}
            {detail.reviewWindowDeadline && ` — Deadline: ${new Date(detail.reviewWindowDeadline).toLocaleDateString()}`}
          </p>
        </div>
      )}
    </Section>
  );
}

function BaselineSection({ detail, uploadId }: { detail: MigrationRecordDetail; uploadId: string }) {
  const baselineMutation = useCreateBaseline(uploadId);

  if (detail.isBaselineCreated) {
    return (
      <Section title="Baseline Details">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal/10 text-teal border border-teal/20">
            Baseline Established
          </span>
        </div>
        {detail.loanId && <InfoRow label="Loan ID" value={detail.loanId.slice(0, 12) + '...'} />}
      </Section>
    );
  }

  // Check if baseline is blocked
  const effectiveOutstanding = detail.correctedValues?.outstandingBalance ?? detail.declaredValues.outstandingBalance;
  const referenceTotalLoan = detail.schemeExpectedValues.totalLoan ?? detail.computedValues.totalLoan ?? detail.declaredValues.totalLoan;
  const isBlocked = !effectiveOutstanding || (referenceTotalLoan && moneyGt(effectiveOutstanding, referenceTotalLoan));

  return (
    <div className="mt-4">
      {baselineMutation.isError && (
        <p className="text-xs text-amber-600 mb-2">{baselineMutation.error?.message ?? 'Baseline could not be established. Please try again.'}</p>
      )}
      <button
        type="button"
        onClick={() => baselineMutation.mutate({ recordId: detail.recordId })}
        disabled={baselineMutation.isPending || !!isBlocked}
        className="w-full px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed"
        title={isBlocked ? 'Correct the outstanding balance before establishing baseline' : undefined}
      >
        {baselineMutation.isPending ? 'Establishing...' : 'Establish Baseline'}
      </button>
    </div>
  );
}

export function RecordDetailDrawer({ uploadId, recordId, open, onOpenChange }: RecordDetailDrawerProps) {
  const { data: detail, isLoading, isError } = useMigrationRecordDetail(uploadId, open ? recordId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-text-secondary">Loading record detail...</p>
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-amber-600">Unable to load record detail. Please close and try again.</p>
          </div>
        )}

        {detail && (
          <>
            <SheetHeader>
              <SheetTitle className="text-lg">Record Detail — {detail.staffName}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${BADGE_STYLES[detail.varianceCategory]}`}>
                  {UI_COPY.VARIANCE_CATEGORY_LABELS[detail.varianceCategory] ?? detail.varianceCategory}
                </span>
                {detail.varianceAmount && Number(detail.varianceAmount) > 0 && (
                  <span className="text-xs text-text-tertiary">{formatNairaOrDash(detail.varianceAmount)} variance</span>
                )}
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-0">
              {/* Personnel Info */}
              <Section title="Personnel Info">
                <InfoRow label="Staff Name" value={detail.staffName} />
                <InfoRow label="Staff ID" value={detail.staffId} />
                <InfoRow label="Grade" value={detail.gradeLevel} />
                {detail.inferredGrade && (
                  <InferredGradeRow
                    declaredGrade={detail.gradeLevel}
                    inferredTier={detail.inferredGrade}
                    principal={detail.declaredValues.principal}
                  />
                )}
                <InfoRow label="Station" value={detail.station} />
                <InfoRow label="MDA" value={detail.mdaText} />
                <InfoRow label="Sheet" value={`${detail.sheetName} (row ${detail.sourceRow})`} />
              </Section>

              {/* Financial Comparison (Three-Vector) */}
              <Section title="Financial Comparison (Three-Vector)">
                <ThreeVectorTable detail={detail} />
                {detail.computedRate && (
                  <div className="mt-2 text-xs text-text-secondary">
                    Computed Rate: {detail.computedRate}%
                    {detail.apparentRate && ` (apparent: ${detail.apparentRate}%)`}
                    {detail.hasRateVariance && (
                      <span className="ml-1 text-amber-600">{UI_COPY.RATE_VARIANCE_DESCRIPTION}</span>
                    )}
                  </div>
                )}
              </Section>

              {/* Variance Breakdown */}
              {detail.varianceAmount && Number(detail.varianceAmount) > 0 && (
                <Section title="Variance Breakdown">
                  <VarianceBreakdown detail={detail} />
                </Section>
              )}

              {/* Outstanding Balance — mini comparison */}
              <Section title="Outstanding Balance">
                <OutstandingBalanceComparison detail={detail} />

                <OutstandingBalanceWarning detail={detail} />

                {/* Correction form — only when not yet baselined */}
                {!detail.isBaselineCreated && (
                  <CorrectionForm detail={detail} uploadId={uploadId} />
                )}
              </Section>

              {/* Review Status (Story 8.0j) — visible for flagged records */}
              <ReviewMetadata detail={detail} />

              {/* Correction History */}
              <CorrectionHistory detail={detail} />

              {/* Mark Reviewed — Values Correct (Story 8.0j) */}
              {!detail.isBaselineCreated && (
                <MarkReviewedButton detail={detail} uploadId={uploadId} />
              )}

              {/* Baseline */}
              <BaselineSection detail={detail} uploadId={uploadId} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
