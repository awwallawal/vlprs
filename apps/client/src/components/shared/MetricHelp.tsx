import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { METRIC_GLOSSARY, type MetricDefinition } from '@vlprs/shared';

interface MetricHelpByKeyProps {
  metric: string;
  definition?: never;
}

interface MetricHelpByDefinitionProps {
  metric?: never;
  definition: MetricDefinition;
}

type MetricHelpProps = MetricHelpByKeyProps | MetricHelpByDefinitionProps;

export function MetricHelp({ metric, definition }: MetricHelpProps) {
  const entry = definition ?? (metric ? METRIC_GLOSSARY[metric] : undefined);

  if (!entry) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center align-middle ml-1 text-text-muted hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
            aria-label={`Help: ${entry.label}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1 p-3">
          <p className="font-medium text-sm">{entry.label}</p>
          <p className="text-xs text-popover-foreground/80">{entry.description}</p>
          <p className="text-xs text-text-muted">Based on: {entry.derivedFrom}</p>
          {entry.guidance && (
            <p className="text-xs text-text-muted italic">{entry.guidance}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
