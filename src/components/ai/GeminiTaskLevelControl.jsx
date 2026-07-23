import { Check } from 'lucide-react';
import { GEMINI_TASK_LEVELS, normalizeGeminiTaskLevel } from '../../../shared/cloudAIModels';

export default function GeminiTaskLevelControl({ value, onChange, disabled = false, label = 'Task complexity' }) {
  const selectedValue = normalizeGeminiTaskLevel(value);

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {GEMINI_TASK_LEVELS.map((level) => {
          const selected = selectedValue === level.id;
          return (
            <button
              key={level.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(level.id)}
              className={`flex min-h-16 items-start gap-2 rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50'
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-slate-300'}`}>
                {selected && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{level.label}{level.id === 'moderate' ? ' · Default' : ''}</span>
                <span className="mt-0.5 block text-xs leading-4 text-slate-500">{level.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
