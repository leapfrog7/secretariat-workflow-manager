import { Bot, Cloud } from 'lucide-react';

export default function AIModeControl({ value, onChange, cloudDisabled = false, disabled = false, compact = false }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-1" role="group" aria-label="AI processing location">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('local')}
        className={`inline-flex items-center justify-center gap-2 rounded px-3 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${compact ? 'h-8' : 'h-9'} ${value === 'local' ? 'bg-[#17333b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        <Bot className="h-4 w-4" />
        Local LLM
      </button>
      <button
        type="button"
        disabled={disabled || cloudDisabled}
        onClick={() => onChange('cloud')}
        className={`inline-flex items-center justify-center gap-2 rounded px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${compact ? 'h-8' : 'h-9'} ${value === 'cloud' ? 'bg-[#17333b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        <Cloud className="h-4 w-4" />
        Cloud API
      </button>
    </div>
  );
}
