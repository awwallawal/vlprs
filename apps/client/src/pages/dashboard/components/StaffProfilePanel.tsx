import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { usePersonProfile, useConfirmMatch, useRejectMatch } from '@/hooks/useStaffProfile';
import { LoanTimeline } from './LoanTimeline';
import { ComputationTransparencyAccordion } from './ComputationTransparencyAccordion';
import { VOCABULARY } from '@vlprs/shared';
import type { ValidatedMigrationRecord } from '@vlprs/shared';

interface PersonMatchDisplay {
  id: string;
  personAName: string;
  personAMdaCode: string;
  personBName: string;
  personBMdaCode: string;
  matchType: string;
  confidence: string;
  status: string;
}

function formatNaira(value: string | null): string {
  if (!value) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface StaffProfilePanelProps {
  personKey: string;
  onBack?: () => void;
}

export function StaffProfilePanel({ personKey, onBack }: StaffProfilePanelProps) {
  const { data: profile, isLoading, error } = usePersonProfile(personKey);
  const confirmMutation = useConfirmMatch();
  const rejectMutation = useRejectMatch();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-teal hover:underline">
            Back to list
          </button>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">{error?.message || 'Profile not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-teal hover:underline">
          Back to Staff Profiles
        </button>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">{profile.staffName}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {profile.staffId && (
                <Badge variant="outline" className="text-xs">
                  ID: {profile.staffId}
                </Badge>
              )}
              {profile.mdas.map((mda) => (
                <Badge key={mda} className="text-xs bg-teal/10 text-teal border-teal/20">
                  {mda}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-text-primary">{profile.recordCount}</p>
              <p className="text-xs text-text-muted">Records</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-text-primary">{profile.varianceCount}</p>
              <p className="text-xs text-text-muted">Variances</p>
            </div>
          </div>
        </div>

        {/* Profile completeness */}
        <div className="mt-4">
          {profile.profileComplete ? (
            <Badge className="text-xs bg-teal/10 text-teal border-teal/20">
              {VOCABULARY.PROFILE_COMPLETE}
            </Badge>
          ) : (
            <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              {VOCABULARY.TEMPORAL_PROFILE_INCOMPLETE}
            </Badge>
          )}
          {profile.mdas.length > 1 && (
            <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 ml-2">
              {VOCABULARY.CROSS_MDA_DETECTED}
            </Badge>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Loan Timeline</h3>
        <LoanTimeline timelines={profile.timelines} cycles={profile.cycles} />
      </div>

      {/* Loan details by MDA */}
      <div className="bg-white rounded-lg border border-border p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Loan Details by MDA</h3>
        <Accordion type="multiple" className="w-full">
          {Object.entries(profile.recordsByMda).map(([mdaCode, records]) => (
            <AccordionItem key={mdaCode} value={mdaCode}>
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <span>{mdaCode}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {(records as ValidatedMigrationRecord[]).length} records
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {(records as ValidatedMigrationRecord[]).map((record) => (
                    <div key={record.id} className="border border-border/50 rounded p-3">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-text-secondary">
                          {record.sourceFile} — Row {record.sourceRow}
                        </span>
                        {record.periodYear && record.periodMonth && (
                          <span className="text-text-muted">
                            {record.periodYear}/{String(record.periodMonth).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                        <div>
                          <p className="text-text-muted">Principal</p>
                          <p className="font-medium">{formatNaira(record.principal)}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Total Loan</p>
                          <p className="font-medium">{formatNaira(record.totalLoan)}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Monthly Deduction</p>
                          <p className="font-medium">{formatNaira(record.monthlyDeduction)}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Outstanding</p>
                          <p className="font-medium">{formatNaira(record.outstandingBalance)}</p>
                        </div>
                      </div>
                      <ComputationTransparencyAccordion record={record} />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Cross-MDA matches */}
      {profile.matches.length > 0 && (
        <div className="bg-white rounded-lg border border-border p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Cross-MDA Matches</h3>
          <div className="space-y-2">
            {profile.matches.map((match: PersonMatchDisplay) => (
              <div key={match.id} className="flex items-center justify-between p-3 border border-border/50 rounded">
                <div className="text-xs space-y-1">
                  <p className="text-text-primary">
                    {match.personAName} ({match.personAMdaCode}) ↔ {match.personBName} ({match.personBMdaCode})
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {match.matchType.replace('_', ' ')}
                    </Badge>
                    <span className="text-text-muted">Confidence: {match.confidence}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        match.status === 'auto_confirmed' || match.status === 'confirmed'
                          ? 'bg-teal/10 text-teal border-teal/20'
                          : match.status === 'rejected'
                          ? 'bg-gray-100 text-text-muted'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {match.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                {match.status === 'pending_review' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmMutation.mutate(match.id)}
                      disabled={confirmMutation.isPending}
                      className="px-3 py-1 text-xs bg-teal text-white rounded hover:bg-teal-hover disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectMutation.mutate(match.id)}
                      disabled={rejectMutation.isPending}
                      className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
