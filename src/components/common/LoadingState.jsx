import { LoaderCircle } from 'lucide-react';

function Skeleton({ className = '' }) {
  return <span className={`loading-shimmer block rounded-lg bg-[var(--swm-surface-muted)] ${className}`} aria-hidden="true" />;
}

function DashboardSkeleton() {
  return <><Skeleton className="h-28 w-full sm:h-32" /><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16" />)}</div><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div></>;
}

function RegisterSkeleton() {
  return <><div className="mobile-scroll-strip flex gap-2 overflow-hidden sm:grid sm:grid-cols-5 sm:gap-px">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-32 shrink-0 sm:w-auto" />)}</div><Skeleton className="h-24 w-full" /><div className="space-y-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div></>;
}

function CaseworkSkeleton() {
  return <><Skeleton className="h-24 w-full" /><div className="grid grid-cols-2 gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div><Skeleton className="h-44 w-full" /></>;
}

function SettingsSkeleton() {
  return <><div className="flex gap-2 overflow-hidden">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-28 shrink-0" />)}</div><Skeleton className="h-12 w-2/5" /><div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div></>;
}

function GenericSkeleton() {
  return <><Skeleton className="h-8 w-2/5" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-4/5" /></>;
}

const SKELETONS = { dashboard: DashboardSkeleton, register: RegisterSkeleton, casework: CaseworkSkeleton, settings: SettingsSkeleton };

export default function LoadingState({ message = 'Loading...', variant = 'generic' }) {
  const SkeletonLayout = SKELETONS[variant] || GenericSkeleton;
  return (
    <div className="min-h-52 overflow-hidden border-y border-[var(--swm-border)] bg-white px-4 py-5 shadow-[var(--swm-shadow-xs)] sm:rounded-[var(--swm-radius-lg)] sm:border sm:p-5" role="status" aria-live="polite" aria-busy="true" data-loading-variant={variant}>
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-teal-50" aria-hidden="true"><span className="route-progress block h-full bg-teal-600" /></div>
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--swm-ink)] sm:text-sm"><LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-teal-700" aria-hidden="true" /><span>{message}</span></div>
      <div className="mt-4 space-y-3" aria-hidden="true"><SkeletonLayout /></div>
    </div>
  );
}
