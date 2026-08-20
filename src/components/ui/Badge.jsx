const TONES = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700 before:bg-slate-400',
  info: 'border-sky-200 bg-sky-50 text-sky-800 before:bg-sky-500',
  teal: 'border-teal-200 bg-teal-50 text-teal-800 before:bg-teal-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 before:bg-amber-500',
  violet: 'border-violet-200 bg-violet-50 text-violet-800 before:bg-violet-500',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 before:bg-emerald-500',
  danger: 'border-rose-200 bg-rose-50 text-rose-800 before:bg-rose-500',
};

export default function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none ${dot ? 'before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full' : ''} ${TONES[tone] || TONES.neutral} ${className}`}>{children}</span>;
}
