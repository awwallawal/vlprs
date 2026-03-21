import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';

import {
  createEmploymentEventSchema,
  EMPLOYMENT_EVENT_TYPES,
  REFERENCE_REQUIRED_TYPES,
  UI_COPY,
  type EmploymentEventType,
  type CreateEmploymentEventRequest,
} from '@vlprs/shared';
import { useStaffLookup, useCreateEmploymentEvent } from '@/hooks/useEmploymentEvent';
import { cn } from '@/lib/utils';

export function EmploymentEventForm() {
  const [staffIdInput, setStaffIdInput] = useState('');
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<CreateEmploymentEventRequest | null>(null);

  const form = useForm<CreateEmploymentEventRequest>({
    resolver: zodResolver(createEmploymentEventSchema),
    defaultValues: {
      staffId: '',
      eventType: undefined,
      effectiveDate: '',
      referenceNumber: '',
      notes: '',
      newRetirementDate: '',
    },
  });

  const staffLookup = useStaffLookup(staffIdInput);
  const createEvent = useCreateEmploymentEvent();

  const eventType = useWatch({ control: form.control, name: 'eventType' });

  const isReferenceRequired = eventType
    ? REFERENCE_REQUIRED_TYPES.includes(eventType)
    : false;

  const isServiceExtension = eventType === 'SERVICE_EXTENSION';

  // Clear conditional fields when event type changes
  useEffect(() => {
    if (!isReferenceRequired) {
      form.setValue('referenceNumber', '');
    }
    if (!isServiceExtension) {
      form.setValue('newRetirementDate', '');
    }
  }, [eventType, isReferenceRequired, isServiceExtension, form]);

  // Sync staff ID input to form
  useEffect(() => {
    form.setValue('staffId', staffIdInput);
  }, [staffIdInput, form]);

  async function onSubmit(data: CreateEmploymentEventRequest) {
    try {
      await createEvent.mutateAsync(data);
      toast.success(UI_COPY.EMPLOYMENT_EVENT_SUCCESS);
      form.reset();
      setStaffIdInput('');
      setShowDuplicateConfirm(false);
      setPendingData(null);
    } catch (error: unknown) {
      const err = error as Error & { code?: string; status?: number; details?: unknown[] };

      if (err.status === 422 && err.code === 'DUPLICATE_EVENT') {
        setPendingData(data);
        setShowDuplicateConfirm(true);
        return;
      }

      if (err.status === 403) {
        toast.info(UI_COPY.EMPLOYMENT_EVENT_MDA_DENIED);
        return;
      }

      toast.info(err.message || 'Please check your input and try again');
    }
  }

  async function handleDuplicateConfirm() {
    if (!pendingData) return;
    try {
      await createEvent.mutateAsync({ ...pendingData, confirmDuplicate: true });
      toast.success(UI_COPY.EMPLOYMENT_EVENT_SUCCESS);
      form.reset();
      setStaffIdInput('');
      setShowDuplicateConfirm(false);
      setPendingData(null);
    } catch (error: unknown) {
      const err = error as Error & { message?: string };
      toast.info(err.message || 'Please check your input and try again');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{UI_COPY.EMPLOYMENT_EVENT_FORM_TITLE}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Staff ID with lookup */}
          <div className="space-y-2">
            <Label htmlFor="staffId">{UI_COPY.EMPLOYMENT_EVENT_STAFF_LOOKUP_PLACEHOLDER}</Label>
            <Input
              id="staffId"
              value={staffIdInput}
              onChange={(e) => setStaffIdInput(e.target.value)}
              placeholder="Enter Staff ID"
            />
            {form.formState.errors.staffId && (
              <p className="text-sm text-red-600">{form.formState.errors.staffId.message}</p>
            )}

            {/* Teal confirmation panel */}
            {staffLookup.data && (
              <div className="flex items-center gap-2 rounded-md border border-[#0D7377] bg-[#E0F5F5] p-3">
                <CheckCircle2 className="h-4 w-4 text-[#0D7377]" />
                <span className="text-sm text-[#0D7377]">
                  {staffLookup.data.staffName} — {staffLookup.data.mdaName}
                </span>
              </div>
            )}

            {staffLookup.isError && staffIdInput.length >= 3 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">{UI_COPY.EMPLOYMENT_EVENT_STAFF_NOT_FOUND_UI}</span>
              </div>
            )}
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="eventType">Event Type</Label>
            <Select
              value={eventType ?? ''}
              onValueChange={(val) => form.setValue('eventType', val as EmploymentEventType, { shouldValidate: true })}
            >
              <SelectTrigger id="eventType">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {(UI_COPY.EVENT_TYPE_LABELS as Record<string, string>)[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.eventType && (
              <p className="text-sm text-red-600">{form.formState.errors.eventType.message}</p>
            )}
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label>Effective Date</Label>
            <EffectiveDatePicker
              value={form.getValues('effectiveDate')}
              onChange={(date) => form.setValue('effectiveDate', date, { shouldValidate: true })}
            />
            {form.formState.errors.effectiveDate && (
              <p className="text-sm text-red-600">{form.formState.errors.effectiveDate.message}</p>
            )}
          </div>

          {/* Reference Number — conditional required */}
          <div className="space-y-2">
            <Label htmlFor="referenceNumber">
              Reference Number{isReferenceRequired && <span className="text-red-500"> *</span>}
            </Label>
            <Input
              id="referenceNumber"
              {...form.register('referenceNumber')}
              aria-required={isReferenceRequired}
              placeholder={isReferenceRequired ? 'Required for this event type' : 'Optional'}
            />
            {form.formState.errors.referenceNumber && (
              <p className="text-sm text-red-600">{form.formState.errors.referenceNumber.message}</p>
            )}
          </div>

          {/* New Retirement Date — conditional for Service Extension */}
          {isServiceExtension && (
            <div className="space-y-2">
              <Label>
                New Retirement Date <span className="text-red-500">*</span>
              </Label>
              <EffectiveDatePicker
                value={form.getValues('newRetirementDate') ?? ''}
                onChange={(date) => form.setValue('newRetirementDate', date, { shouldValidate: true })}
              />
              {form.formState.errors.newRetirementDate && (
                <p className="text-sm text-red-600">{form.formState.errors.newRetirementDate.message}</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Optional notes"
              rows={3}
            />
          </div>

          {/* Duplicate confirmation dialog */}
          {showDuplicateConfirm && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-700">{UI_COPY.EMPLOYMENT_EVENT_DUPLICATE_CONFIRM}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDuplicateConfirm(false);
                    setPendingData(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDuplicateConfirm}
                  disabled={createEvent.isPending}
                >
                  Proceed Anyway
                </Button>
              </div>
            </div>
          )}

          <Button type="submit" disabled={createEvent.isPending} className="w-full">
            {createEvent.isPending ? 'Submitting...' : 'Submit Event'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Reusable date picker — follows ManualEntryRow Popover + Calendar pattern. */
function EffectiveDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const selected = value ? new Date(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, 'PPP') : 'Select date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              onChange(format(day, 'yyyy-MM-dd'));
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
