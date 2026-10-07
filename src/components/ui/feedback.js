import {
  AlertCircle,
  CheckCircle2,
  Info,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';

export const FEEDBACK_TONES = {
  neutral: {
    label: 'Update',
    shell: 'border-slate-200 bg-slate-50 text-slate-900',
    icon: 'text-slate-500',
    timer: 'bg-slate-400',
    Icon: Info,
  },
  info: {
    label: 'Information',
    shell: 'border-sky-200 bg-sky-50 text-sky-950',
    icon: 'text-sky-700',
    timer: 'bg-sky-500',
    Icon: Info,
  },
  progress: {
    label: 'In progress',
    shell: 'border-teal-200 bg-teal-50 text-teal-950',
    icon: 'text-teal-700',
    timer: 'bg-teal-500',
    Icon: LoaderCircle,
    spin: true,
  },
  success: {
    label: 'Completed',
    shell: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    icon: 'text-emerald-700',
    timer: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  warning: {
    label: 'Attention',
    shell: 'border-amber-200 bg-amber-50 text-amber-950',
    icon: 'text-amber-700',
    timer: 'bg-amber-500',
    Icon: TriangleAlert,
  },
  danger: {
    label: 'Action failed',
    shell: 'border-red-200 bg-red-50 text-red-950',
    icon: 'text-red-700',
    timer: 'bg-red-500',
    Icon: AlertCircle,
  },
};

const TONE_ALIASES = {
  error: 'danger',
  loading: 'progress',
  syncing: 'progress',
};

export function normalizeFeedbackTone(tone = 'info') {
  const normalized = TONE_ALIASES[tone] || tone;
  return FEEDBACK_TONES[normalized] ? normalized : 'info';
}

export function getFeedbackTone(tone = 'info') {
  return FEEDBACK_TONES[normalizeFeedbackTone(tone)];
}
