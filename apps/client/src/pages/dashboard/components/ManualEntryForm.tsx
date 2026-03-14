import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useManualSubmission } from '@/hooks/useSubmissionData';
import { apiClient } from '@/lib/apiClient';
import { ManualEntryRow } from './ManualEntryRow';
import {
  manualSubmissionBodySchema,
  VOCABULARY,
  UI_COPY,
  ROLES,
  type ManualSubmissionBody,
  type SubmissionRow,
  type SubmissionUploadResponse,
} from '@vlprs/shared';

interface MdaOption {
  id: string;
  name: string;
  code: string;
}

const MAX_ROWS = 50;

function createDefaultRow(mdaCode: string, currentPeriod: string): SubmissionRow {
  return {
    staffId: '',
    month: currentPeriod,
    amountDeducted: '',
    payrollBatchReference: '',
    mdaCode,
    eventFlag: 'NONE',
    eventDate: null,
    cessationReason: null,
  };
}

interface ManualEntryFormProps {
  disabled?: boolean;
  onSuccess?: (data: SubmissionUploadResponse) => void;
}

export function ManualEntryForm({ disabled, onSuccess }: ManualEntryFormProps) {
  const user = useAuthStore((s) => s.user);
  const isMdaOfficer = user?.role === ROLES.MDA_OFFICER;

  // Resolve MDA code from user.mdaId for MDA_OFFICER
  const { data: mdas } = useQuery<MdaOption[]>({
    queryKey: ['mdas'],
    queryFn: () => apiClient('/mdas'),
    staleTime: 5 * 60_000,
  });
  const resolvedMdaCode = isMdaOfficer && user?.mdaId
    ? mdas?.find((m) => m.id === user.mdaId)?.code ?? ''
    : '';

  const currentPeriod = format(new Date(), 'yyyy-MM');

  const form = useForm<ManualSubmissionBody>({
    resolver: zodResolver(manualSubmissionBodySchema),
    mode: 'onBlur',
    defaultValues: {
      rows: [createDefaultRow(resolvedMdaCode, currentPeriod)],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rows',
  });

  // H1 fix: Sync MDA code into existing rows when async MDA query resolves
  useEffect(() => {
    if (resolvedMdaCode) {
      const currentRows = form.getValues('rows');
      currentRows.forEach((_row, idx) => {
        if (!form.getValues(`rows.${idx}.mdaCode`)) {
          form.setValue(`rows.${idx}.mdaCode`, resolvedMdaCode);
        }
      });
    }
  }, [resolvedMdaCode, form]);

  const mutation = useManualSubmission();
  const [hasBusinessErrors, setHasBusinessErrors] = useState(false);

  const onSubmit = async (data: ManualSubmissionBody) => {
    setHasBusinessErrors(false);
    try {
      const result = await mutation.mutateAsync(data.rows as SubmissionRow[]);
      toast.success(VOCABULARY.SUBMISSION_CONFIRMED);
      // Reset form to single empty row
      form.reset({ rows: [createDefaultRow(resolvedMdaCode, currentPeriod)] });
      onSuccess?.(result);
    } catch (error: unknown) {
      const err = error as Error & { status?: number; details?: Array<{ row: number; field: string; message: string }> };

      if (err.status === 422 && err.details) {
        setHasBusinessErrors(true);
        // Business validation errors — map to inline form fields
        err.details.forEach((d) => {
          form.setError(`rows.${d.row}.${d.field}` as `rows.${number}.${keyof SubmissionRow}`, {
            type: 'server',
            message: d.message,
          });
        });
        // Scroll to first error row
        const firstErrorRow = err.details[0]?.row ?? 0;
        document.querySelector(`[data-row="${firstErrorRow}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast.info(VOCABULARY.SUBMISSION_ITEMS_NEED_ATTENTION.replace('{count}', String(err.details.length)));
      } else {
        // Generic error — use info toast (non-punitive, no red styling)
        toast.info(err.message || 'Submission needs attention');
      }
    }
  };

  // M2 fix: stable callback reference for React.memo effectiveness
  const handleRemoveRow = useCallback(
    (index: number) => remove(index),
    [remove],
  );

  const handleAddRow = () => {
    append(createDefaultRow(resolvedMdaCode, currentPeriod));
  };

  return (
    <div className="space-y-4">
      {/* Error banner for structural (400) errors */}
      {mutation.isError && !((mutation.error as Error & { status?: number }).status === 422) && (
        <div className="rounded-lg border border-gold/30 bg-gold-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-gold" aria-hidden="true" />
            <span className="text-sm font-medium text-text-primary">
              {VOCABULARY.VALIDATION_FAILED}
            </span>
          </div>
        </div>
      )}

      {/* M1 fix: "Upload needs attention" banner for business (422) validation errors */}
      {hasBusinessErrors && (
        <div className="rounded-lg border border-gold/30 bg-gold-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-gold" aria-hidden="true" />
            <span className="text-sm font-medium text-text-primary">
              {UI_COPY.UPLOAD_ERROR_HEADER}
            </span>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {fields.map((field, index) => (
            <ManualEntryRow
              key={field.id}
              index={index}
              form={form}
              canRemove={fields.length > 1}
              onRemove={handleRemoveRow}
              isReadOnlyMda={isMdaOfficer}
            />
          ))}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddRow}
              disabled={fields.length >= MAX_ROWS || disabled}
              title={fields.length >= MAX_ROWS ? VOCABULARY.SUBMISSION_MANUAL_MAX_ROWS : undefined}
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
              Add Row
            </Button>
            {fields.length >= MAX_ROWS && (
              <span className="text-sm text-muted-foreground">{VOCABULARY.SUBMISSION_MANUAL_MAX_ROWS}</span>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={mutation.isPending || disabled}
              className="min-w-[140px]"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Submitting...
                </>
              ) : (
                'Submit All'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
