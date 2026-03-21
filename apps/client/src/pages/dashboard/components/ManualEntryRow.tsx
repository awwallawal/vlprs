import React, { useEffect } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon, Trash2 } from 'lucide-react';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EVENT_FLAG_VALUES, UI_COPY, type ManualSubmissionBody } from '@vlprs/shared';

/** Event flags that trigger the Cessation Reason field */
const CESSATION_FLAGS = ['DISMISSAL', 'ABSCONDED', 'DEATH'] as const;

interface ManualEntryRowProps {
  index: number;
  form: UseFormReturn<ManualSubmissionBody>;
  canRemove: boolean;
  onRemove: (index: number) => void;
  isReadOnlyMda: boolean;
}

export const ManualEntryRow = React.memo(function ManualEntryRow({
  index,
  form,
  canRemove,
  onRemove,
  isReadOnlyMda,
}: ManualEntryRowProps) {
  const eventFlag = useWatch({ control: form.control, name: `rows.${index}.eventFlag` });
  const amountStr = useWatch({ control: form.control, name: `rows.${index}.amountDeducted` });
  const cleanedAmount = (amountStr || '').replace(/,/g, '').trim();
  const amountIsZero = cleanedAmount !== '' && Number(cleanedAmount) === 0;

  const showEventDate = eventFlag != null && eventFlag !== 'NONE';
  const cessationRequired = amountIsZero && (eventFlag === 'NONE' || !eventFlag);
  const showCessationReason =
    CESSATION_FLAGS.includes(eventFlag as typeof CESSATION_FLAGS[number]) ||
    cessationRequired;

  // Clear hidden field values to prevent stale data
  useEffect(() => {
    if (!showEventDate) {
      const current = form.getValues(`rows.${index}.eventDate`);
      if (current != null) form.setValue(`rows.${index}.eventDate`, null);
    }
  }, [showEventDate, form, index]);

  useEffect(() => {
    if (!showCessationReason) {
      const current = form.getValues(`rows.${index}.cessationReason`);
      if (current != null) form.setValue(`rows.${index}.cessationReason`, null);
    }
  }, [showCessationReason, form, index]);

  return (
    <Card className="p-4" data-row={index}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Row {index + 1}</span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            aria-label={`Remove row ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Staff ID */}
        <FormField
          control={form.control}
          name={`rows.${index}.staffId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Staff ID <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. OYO-001" />
              </FormControl>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {/* Month */}
        <FormField
          control={form.control}
          name={`rows.${index}.month`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Month <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input {...field} placeholder="YYYY-MM" />
              </FormControl>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {/* Amount Deducted */}
        <FormField
          control={form.control}
          name={`rows.${index}.amountDeducted`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount Deducted <span className="text-destructive">*</span></FormLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">₦</span>
                <FormControl>
                  <Input {...field} className="pl-7" placeholder="0.00" />
                </FormControl>
              </div>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {/* Payroll Batch Reference */}
        <FormField
          control={form.control}
          name={`rows.${index}.payrollBatchReference`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payroll Batch Ref <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. BATCH-001" />
              </FormControl>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {/* MDA Code */}
        <FormField
          control={form.control}
          name={`rows.${index}.mdaCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>MDA Code <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input
                  {...field}
                  readOnly={isReadOnlyMda}
                  className={cn(isReadOnlyMda && 'bg-muted cursor-not-allowed')}
                  placeholder="e.g. MOF"
                />
              </FormControl>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {/* Event Flag */}
        <FormField
          control={form.control}
          name={`rows.${index}.eventFlag`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Flag</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EVENT_FLAG_VALUES.map((flag) => (
                    <SelectItem key={flag} value={flag}>
                      {UI_COPY.EVENT_FLAG_LABELS[flag] ?? flag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {/* Event Date — conditional */}
        {showEventDate && (
          <FormField
            control={form.control}
            name={`rows.${index}.eventDate`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event Date <span className="text-destructive">*</span></FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value ? format(new Date(field.value), 'PPP') : 'Select date'}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => {
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : null);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage className="text-[#D4A017]" />
              </FormItem>
            )}
          />
        )}

        {/* Cessation Reason — conditional */}
        {showCessationReason && (
          <FormField
            control={form.control}
            name={`rows.${index}.cessationReason`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cessation Reason {cessationRequired && <span className="text-destructive">*</span>}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} placeholder="Reason for zero deduction" />
                </FormControl>
                <FormMessage className="text-[#D4A017]" />
              </FormItem>
            )}
          />
        )}
      </div>
    </Card>
  );
});
