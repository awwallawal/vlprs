import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { UI_COPY } from '@vlprs/shared';
import type { ValidatedMigrationRecord } from '@vlprs/shared';
import { formatNairaOrDash } from '@/lib/formatters';

const CATEGORY_STYLES: Record<string, string> = {
  clean: 'bg-teal/10 text-teal border-teal/20',
  minor_variance: 'bg-blue-50 text-blue-700 border-blue-200',
  significant_variance: 'bg-amber-50 text-amber-700 border-amber-200',
  structural_error: 'bg-amber-50 text-amber-700 border-amber-200',
  anomalous: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface ComputationTransparencyAccordionProps {
  record: ValidatedMigrationRecord;
}

export function ComputationTransparencyAccordion({ record }: ComputationTransparencyAccordionProps) {
  const category = record.varianceCategory || 'anomalous';
  const categoryLabel = UI_COPY.VARIANCE_CATEGORY_LABELS[category] || category;
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.anomalous;

  const hasSchemeExpected = record.schemeExpectedTotalLoan !== null;

  // Scheme formula intermediate values for display — computed directly from principal,
  // avoiding dependency on installmentCount which is null for rate-inferred tenure records
  const schemeStandardInterest = record.principal ? (Number(record.principal) * 0.1333).toFixed(2) : null;
  const schemeMonthlyInterest = record.principal ? (Number(record.principal) * 0.1333 / 60).toFixed(2) : null;
  // Derive tenure from stored scheme expected values: tenure = totalInterest / monthlyInterest
  const schemeInferredTenure = schemeMonthlyInterest && record.schemeExpectedTotalInterest && Number(schemeMonthlyInterest) > 0
    ? Math.round(Number(record.schemeExpectedTotalInterest) / Number(schemeMonthlyInterest))
    : null;
  // Rev. Engineered total interest = computedTotalLoan − principal (not available as a stored field)
  const revEngTotalInterest = record.computedTotalLoan && record.principal
    ? (Number(record.computedTotalLoan) - Number(record.principal)).toFixed(2)
    : null;

  const dataFields = [
    { label: 'Staff Name', available: !!record.staffName },
    { label: 'Principal', available: !!record.principal },
    { label: 'Total Loan', available: !!record.totalLoan },
    { label: 'Monthly Deduction', available: !!record.monthlyDeduction },
    { label: 'Outstanding Balance', available: !!record.outstandingBalance },
    { label: 'Employee No', available: !!record.employeeNo },
    { label: 'DOB', available: !!record.dateOfBirth },
    { label: 'First Appointment', available: !!record.dateOfFirstAppointment },
  ];
  const availableCount = dataFields.filter((f) => f.available).length;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="computation" className="border-0">
        <AccordionTrigger className="py-2 text-xs hover:no-underline">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${categoryStyle}`}>
              {categoryLabel}
            </Badge>
            {record.varianceAmount && Number(record.varianceAmount) > 0 && (
              <span className="text-text-muted">
                {formatNairaOrDash(record.varianceAmount)} variance
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-0 pb-3">
          <div className="space-y-3 text-xs">
            {/* Scheme Expected formula breakdown */}
            {record.principal && hasSchemeExpected && (
              <div className="bg-teal/5 rounded p-2 space-y-1 border border-teal/10">
                <p className="font-medium text-text-primary">Scheme Expected (Authoritative Formula)</p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Standard Interest = {formatNairaOrDash(record.principal)} &times; 13.33% = {formatNairaOrDash(schemeStandardInterest)}
                </p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Monthly Interest = {formatNairaOrDash(schemeStandardInterest)} &divide; 60 = {formatNairaOrDash(schemeMonthlyInterest)}
                </p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Total Interest = {formatNairaOrDash(schemeMonthlyInterest)} &times; {schemeInferredTenure ?? '?'} = {formatNairaOrDash(record.schemeExpectedTotalInterest)}
                </p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Total Loan = {formatNairaOrDash(record.principal)} + {formatNairaOrDash(record.schemeExpectedTotalInterest)} = {formatNairaOrDash(record.schemeExpectedTotalLoan)}
                </p>
              </div>
            )}

            {/* Reverse Engineered formula breakdown */}
            {record.principal && record.computedRate && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <p className="font-medium text-text-primary">Reverse Engineered</p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Detected Rate = (({formatNairaOrDash(record.totalLoan)} &minus; {formatNairaOrDash(record.principal)}) &divide; {formatNairaOrDash(record.principal)}) &times; 100 = {record.computedRate}%
                </p>
              </div>
            )}

            {/* Scheme expected not available */}
            {record.principal && !hasSchemeExpected && (
              <div className="bg-gray-50 rounded p-2 space-y-1">
                <p className="font-medium text-text-primary">Computation Formula</p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Total Loan = Principal + (Principal &times; Rate / 100)
                </p>
                <p className="text-text-secondary font-mono text-[11px]">
                  Monthly Deduction = Total Loan / Tenure Months
                </p>
                <p className="text-text-muted text-[10px] mt-1 italic">
                  Scheme expected values unavailable — tenure could not be determined
                </p>
              </div>
            )}

            {/* Three-vector comparison table */}
            <table className="w-full text-left">
              <thead>
                <tr className="text-text-muted">
                  <th className="py-1 pr-3 font-medium">Field</th>
                  {hasSchemeExpected && <th className="py-1 pr-3 font-medium text-right">Scheme Expected</th>}
                  <th className="py-1 pr-3 font-medium text-right">Rev. Engineered</th>
                  <th className="py-1 font-medium text-right">MDA Declared</th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr>
                  <td className="py-1 pr-3">Total Loan</td>
                  {hasSchemeExpected && <td className="py-1 pr-3 text-right">{formatNairaOrDash(record.schemeExpectedTotalLoan)}</td>}
                  <td className="py-1 pr-3 text-right">{formatNairaOrDash(record.computedTotalLoan)}</td>
                  <td className="py-1 text-right">{formatNairaOrDash(record.totalLoan)}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3">Monthly Deduction</td>
                  {hasSchemeExpected && <td className="py-1 pr-3 text-right">{formatNairaOrDash(record.schemeExpectedMonthlyDeduction)}</td>}
                  <td className="py-1 pr-3 text-right">{formatNairaOrDash(record.computedMonthlyDeduction)}</td>
                  <td className="py-1 text-right">{formatNairaOrDash(record.monthlyDeduction)}</td>
                </tr>
                {hasSchemeExpected && (
                  <tr>
                    <td className="py-1 pr-3">Total Interest</td>
                    <td className="py-1 pr-3 text-right">{formatNairaOrDash(record.schemeExpectedTotalInterest)}</td>
                    <td className="py-1 pr-3 text-right">{formatNairaOrDash(revEngTotalInterest)}</td>
                    <td className="py-1 text-right">{formatNairaOrDash(record.interestTotal)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-1 pr-3">Outstanding Balance</td>
                  {hasSchemeExpected && <td className="py-1 pr-3 text-right">{'\u2014'}</td>}
                  <td className="py-1 pr-3 text-right">{formatNairaOrDash(record.computedOutstandingBalance)}</td>
                  <td className="py-1 text-right">{formatNairaOrDash(record.outstandingBalance)}</td>
                </tr>
              </tbody>
            </table>

            {/* Non-punitive variance explanation */}
            {record.varianceAmount && Number(record.varianceAmount) > 0 && (
              <p className="text-text-secondary text-[11px] italic">
                {UI_COPY.VARIANCE_NEUTRAL_PREFIX} of {formatNairaOrDash(record.varianceAmount)} was observed between {hasSchemeExpected ? 'the authoritative scheme formula (13.33% \u00F7 60)' : 'the computed values'} and the declared values.
              </p>
            )}

            {/* Rate analysis */}
            {record.computedRate && (
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Detected Rate:</span>
                <span className="font-medium">{record.computedRate}%</span>
                {record.hasRateVariance && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    Rate differs from standard
                  </Badge>
                )}
              </div>
            )}

            {/* Data completeness */}
            <div>
              <p className="text-text-muted mb-1">
                Data Completeness: {availableCount}/{dataFields.length} fields
              </p>
              <div className="flex flex-wrap gap-1">
                {dataFields.map((f) => (
                  <span
                    key={f.label}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      f.available
                        ? 'bg-teal/10 text-teal'
                        : 'bg-gray-100 text-text-muted'
                    }`}
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
