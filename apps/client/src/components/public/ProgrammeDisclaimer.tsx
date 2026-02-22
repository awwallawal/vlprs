import { PROGRAMME_DISCLAIMER } from '@/content/homepage';

export function ProgrammeDisclaimer() {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-xs text-slate-400 leading-relaxed">
        {PROGRAMME_DISCLAIMER}
      </p>
    </div>
  );
}
