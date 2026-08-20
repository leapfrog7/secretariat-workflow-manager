import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, FilePenLine, FileText, Search, Sparkles } from 'lucide-react';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import Badge from '../components/ui/Badge';
import { useAuth } from '../features/auth/AuthContext';
import { getAllIssues } from '../db/issueRepository';
import { getRecentCaseworkActivity } from '../features/casework/caseworkActivityRepository';
import { buildHomeDashboard, getIssueAttentionReason } from '../features/dashboard/homeDashboard';
import { formatDateTime, formatDisplayDate } from '../utils/dateUtils';

function recentCaseworkHref(item) {
  if (item.activityKind === 'draft' && item.latestDraft) return `/casework/${item.issue.id}?mode=drafting&draft=${encodeURIComponent(item.latestDraft.id)}`;
  if (item.latestNote) return `/casework/${item.issue.id}?mode=notes&note=${encodeURIComponent(item.latestNote.id)}`;
  if (item.latestDraft) return `/casework/${item.issue.id}?mode=drafting&draft=${encodeURIComponent(item.latestDraft.id)}`;
  return `/casework/${item.issue.id}`;
}

export default function DashboardPage() {
  const auth = useAuth();
  const { openCommandPalette = () => {} } = useOutletContext() || {};
  const [state, setState] = useState({ loading: true, error: '', issues: [], activity: [] });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const issues = await getAllIssues({ includeArchived: false, includeScheduled: false });
      const activity = await getRecentCaseworkActivity(issues, { limit: 4 });
      setState({ loading: false, error: '', issues, activity });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Unable to open your workspace overview.', issues: [], activity: [] });
    }
  }, []);

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('swm:workspace-synced', refresh);
    window.addEventListener('swm:issues-synced', refresh);
    return () => {
      window.removeEventListener('swm:workspace-synced', refresh);
      window.removeEventListener('swm:issues-synced', refresh);
    };
  }, [load]);

  const dashboard = useMemo(() => buildHomeDashboard(state.issues), [state.issues]);
  if (state.loading) return <LoadingState message="Preparing your workspace overview..." variant="dashboard" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  const displayName = auth.profile?.display_name?.trim() || auth.user?.name?.trim() || '';
  const role = auth.mode === 'local'
    ? 'Local workspace'
    : auth.isAdmin
      ? 'System administrator'
      : auth.isWorkspaceAdmin
        ? 'Workspace administrator'
        : auth.canEdit ? 'Officer' : 'Viewer';

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="surface relative overflow-hidden rounded-[var(--swm-radius-xl)] p-4 sm:p-6" aria-labelledby="home-title">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-teal-100/50 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Welcome to your dashboard</p>
            <h1 id="home-title" className="ui-page-title mt-1.5 tracking-[-0.018em] text-[var(--swm-ink)]">{displayName || 'Your workspace'}</h1>
            <p className="mt-1.5 text-sm text-[var(--swm-muted)]">
              <span className="font-semibold text-slate-700">{dashboard.active.length} active {dashboard.active.length === 1 ? 'matter' : 'matters'}</span>
              {role ? ` · ${role}` : ''}{auth.workspace?.name ? ` · ${auth.workspace.name}` : ''}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-4 text-[var(--swm-muted)] sm:hidden">Find a matter, eFile number, or workspace area.</p>
        <button type="button" onClick={openCommandPalette} className="group relative mt-2 flex min-h-12 w-full items-center gap-2.5 rounded-[var(--swm-radius-md)] border border-[var(--swm-border-strong)] bg-white px-3 text-left shadow-[var(--swm-shadow-xs)] transition-[border-color,background-color,box-shadow] hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-[var(--swm-shadow-sm)] sm:mt-5 sm:min-h-16 sm:gap-3 sm:rounded-[var(--swm-radius-lg)] sm:border-teal-200 sm:bg-teal-50/70 sm:px-4">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 sm:h-10 sm:w-10 sm:rounded-xl sm:bg-white sm:shadow-sm"><Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[var(--swm-ink)] sm:text-sm sm:font-bold">Search matters and workspace</span>
            <span className="mt-0.5 hidden truncate text-xs text-[var(--swm-muted)] sm:block">Find a title, eFile number or present position—or jump directly to any workspace area.</span>
          </span>
          <kbd className="hidden shrink-0 rounded-md border border-teal-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 sm:block">Ctrl K</kbd>
          <ArrowRight className="h-4 w-4 shrink-0 text-teal-600 transition-transform group-hover:translate-x-0.5 sm:hidden" aria-hidden="true" />
        </button>
      </section>

      <section className="surface rounded-[var(--swm-radius-lg)] p-3 sm:p-4" aria-labelledby="focus-title">
        <div className="flex items-end justify-between gap-3 px-1 pb-3">
          <div>
            <h2 id="focus-title" className="text-sm font-bold text-[var(--swm-ink)]">Focus your register</h2>
            <p className="mt-0.5 text-xs text-[var(--swm-muted)]">Open a ready-filtered view without rebuilding filters.</p>
          </div>
          <Link to="/issues" className="hidden items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 sm:inline-flex">All Issues <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <FocusView to="/issues?focus=pending" label="Pending" count={dashboard.pending.length} tone="info" />
          <FocusView to="/issues?focus=overdue" label="Overdue" count={dashboard.overdue.length} tone="danger" />
          <FocusView to="/issues?focus=due-soon" label="Due soon" count={dashboard.dueSoon.length} tone="warning" />
          <FocusView to="/issues?focus=awaiting" label="Awaiting" count={dashboard.awaiting.length} tone="violet" />
          <FocusView to="/issues?focus=high-priority" label="High priority" count={dashboard.highPriority.length} tone="teal" />
          <FocusView to="/issues?focus=stale" label="Needs update" count={dashboard.stale.length} tone="neutral" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
        <section className="surface overflow-hidden rounded-[var(--swm-radius-lg)]">
          <SectionHeader icon={Sparkles} title="Needs your attention" description="Ordered by deadline, priority and follow-up risk." action={<Link to="/issues" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">Open register <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          {dashboard.attention.length ? <div className="divide-y divide-[var(--swm-border)]">{dashboard.attention.map((issue) => <AttentionRow key={issue.id} issue={issue} />)}</div> : <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-600 sm:px-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span><div><p className="font-bold text-[var(--swm-ink)]">Nothing requires immediate attention</p><p className="mt-0.5 text-xs">Your active matters have no current deadline, priority or follow-up warning.</p></div></div>}
        </section>

        <aside className="surface overflow-hidden rounded-[var(--swm-radius-lg)]">
          <SectionHeader icon={Clock3} title="Continue working" description="Your newest saved Notes and Drafts." action={<Link to="/casework" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">Casework <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          {state.activity.length ? <div className="divide-y divide-[var(--swm-border)]">{state.activity.map((item) => <RecentWorkRow key={item.issue.id} item={item} />)}</div> : <div className="p-4"><EmptyState icon={FileText} title="No saved work yet" message="Recent Notes and Drafts will appear here." /></div>}
          <div className="border-t border-[var(--swm-border)] bg-[var(--swm-surface-subtle)] p-3"><Link to="/casework" className="flex min-h-10 items-center justify-center gap-2 rounded-[var(--swm-radius-md)] bg-[var(--swm-ink)] px-3 text-xs font-semibold text-white hover:bg-[#23444c]"><FilePenLine className="h-4 w-4 text-teal-200" />Continue Casework</Link></div>
        </aside>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description, action }) {
  return <header className="flex items-start justify-between gap-4 border-b border-[var(--swm-border)] px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-start gap-3"><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-[var(--swm-ink)]">{title}</h2><p className="mt-0.5 hidden text-xs leading-5 text-[var(--swm-muted)] sm:block">{description}</p></div></div><div className="shrink-0 pt-1">{action}</div></header>;
}

function AttentionRow({ issue }) {
  const reason = getIssueAttentionReason(issue);
  return <Link to={`/issues/${issue.id}`} className="group grid gap-2 px-4 py-3.5 hover:bg-[var(--swm-surface-subtle)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-sm font-bold text-slate-800 group-hover:text-teal-900">{issue.shortTitle}</h3><Badge tone={reason.tone} className="shrink-0 py-0.5 text-[10px]">{reason.label}</Badge></div><p className="mt-1 truncate text-xs text-[var(--swm-muted)]">{issue.currentPosition || issue.stage || 'No present position recorded'}</p></div><div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 sm:justify-end"><span>{issue.eFileNumber || 'No eFile number'}</span><span>{issue.nextDeadline ? formatDisplayDate(issue.nextDeadline) : 'No deadline'}</span><ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" /></div></Link>;
}

function FocusView({ to, label, count, tone }) {
  return <Link to={to} className={`group flex min-h-12 items-center justify-between gap-2 rounded-[var(--swm-radius-md)] border px-3 transition-[border-color,background-color,transform] hover:-translate-y-0.5 ${count ? 'border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/50' : 'border-[var(--swm-border)] bg-[var(--swm-surface-subtle)]'}`}><span className={`truncate text-xs font-semibold ${count ? 'text-slate-800' : 'text-slate-500'} group-hover:text-teal-900`}>{label}</span><Badge tone={count ? tone : 'neutral'} className="shrink-0 px-2 py-0.5">{count}</Badge></Link>;
}

function RecentWorkRow({ item }) {
  const isDraft = item.activityKind === 'draft';
  return <Link to={recentCaseworkHref(item)} className="group flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-[var(--swm-surface-subtle)]"><span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDraft ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>{isDraft ? <FilePenLine className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-800 group-hover:text-teal-900">{item.issue.shortTitle}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--swm-muted)]">{isDraft ? 'Draft' : 'Note'} · {formatDateTime(item.activityAt)}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" /></Link>;
}
