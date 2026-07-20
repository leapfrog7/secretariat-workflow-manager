import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import ActionList from '../components/actions/ActionList';
import { getAllActions } from '../db/actionRepository';
import { getAllIssues } from '../db/issueRepository';
import { ACTION_STATUSES, PRIORITIES } from '../constants/issueConstants';
import {
  isActionDueToday,
  isActionDueWithinSevenDays,
  isActionOpen,
  isActionOverdue,
  isEscalationDue,
  isRecentlyCompleted,
  isReminderDue,
  sortActionsOperational,
} from '../utils/actionUtils';
import { isStaleIssue } from '../utils/dateUtils';

const reviewModes = [
  'Due today',
  'Overdue',
  'Upcoming seven days',
  'Awaiting Input',
  'Submitted for review',
  'Pending with external authority',
  'Completed recently',
];

export default function ReviewPage() {
  const [state, setState] = useState({ loading: true, error: '', actions: [], issues: [] });
  const [filters, setFilters] = useState({
    mode: 'Overdue',
    issueId: '',
    organisation: '',
    status: '',
    priority: '',
    assignedTo: '',
    pendingWith: '',
    from: '',
    to: '',
  });

  const load = async () => {
    try {
      const [actions, issues] = await Promise.all([getAllActions({ includeArchived: false }), getAllIssues({ includeArchived: false, includeScheduled: false })]);
      setState({ loading: false, error: '', actions, issues });
    } catch (error) {
      setState({ loading: false, error: error.message, actions: [], issues: [] });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const issueById = useMemo(() => new Map(state.issues.map((issue) => [issue.id, issue])), [state.issues]);
  const organisations = [...new Set(state.issues.map((issue) => issue.organisation).filter(Boolean))].sort();
  const assignees = [...new Set(state.actions.map((action) => action.assignedTo).filter(Boolean))].sort();
  const pendingAuthorities = [...new Set(state.actions.map((action) => action.pendingWith).filter(Boolean))].sort();

  const filteredActions = useMemo(() => {
    return state.actions
      .filter((action) => {
        const issue = issueById.get(action.issueId);
        if (filters.mode === 'Due today' && !isActionDueToday(action)) return false;
        if (filters.mode === 'Overdue' && !isActionOverdue(action)) return false;
        if (filters.mode === 'Upcoming seven days' && !isActionDueWithinSevenDays(action)) return false;
        if (filters.mode === 'Awaiting Input' && action.status !== 'Awaiting Input') return false;
        if (filters.mode === 'Submitted for review' && action.reviewStatus !== 'Submitted') return false;
        if (filters.mode === 'Pending with external authority' && !action.pendingWith) return false;
        if (filters.mode === 'Completed recently' && !isRecentlyCompleted(action)) return false;
        if (filters.issueId && action.issueId !== filters.issueId) return false;
        if (filters.organisation && issue?.organisation !== filters.organisation) return false;
        if (filters.status && action.status !== filters.status) return false;
        if (filters.priority && action.priority !== filters.priority) return false;
        if (filters.assignedTo && action.assignedTo !== filters.assignedTo) return false;
        if (filters.pendingWith && action.pendingWith !== filters.pendingWith) return false;
        if (filters.from && action.dueDate && action.dueDate < filters.from) return false;
        if (filters.to && action.dueDate && action.dueDate > filters.to) return false;
        return true;
      })
      .sort(sortActionsOperational);
  }, [state.actions, issueById, filters]);

  const issuesWithNoOpenAction = state.issues.filter((issue) => !state.actions.some((action) => action.issueId === issue.id && isActionOpen(action)));
  const staleIssues = state.issues.filter(isStaleIssue);

  if (state.loading) return <LoadingState message="Loading review screen..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <>
      <PageHeader title="Review" description="Work-control view for Actions, follow-ups, escalations and dormant Issues." />
      <div className="space-y-4">
        <section className="surface rounded-md p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Review list" value={filters.mode} onChange={(value) => setFilters({ ...filters, mode: value })} options={reviewModes} />
            <Select label="Issue" value={filters.issueId} onChange={(value) => setFilters({ ...filters, issueId: value })} options={state.issues.map((issue) => ({ label: issue.shortTitle, value: issue.id }))} includeAll />
            <Select label="Organisation" value={filters.organisation} onChange={(value) => setFilters({ ...filters, organisation: value })} options={organisations} includeAll />
            <Select label="Action status" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={ACTION_STATUSES} includeAll />
            <Select label="Priority" value={filters.priority} onChange={(value) => setFilters({ ...filters, priority: value })} options={PRIORITIES} includeAll />
            <Select label="Assigned to" value={filters.assignedTo} onChange={(value) => setFilters({ ...filters, assignedTo: value })} options={assignees} includeAll />
            <Select label="Pending with" value={filters.pendingWith} onChange={(value) => setFilters({ ...filters, pendingWith: value })} options={pendingAuthorities} includeAll />
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Due from</span><input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">Due to</span><input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" /></label>
          </div>
          <div className="mt-3 text-sm text-slate-600">{filteredActions.length} Action{filteredActions.length === 1 ? '' : 's'} in this review list.</div>
        </section>

        <ActionList actions={filteredActions} readOnly />

        <section className="grid gap-4 lg:grid-cols-2">
          <IssueList title="Issues with no open Action" issues={issuesWithNoOpenAction} />
          <IssueList title="Issues with no activity for ten days" issues={staleIssues} />
        </section>
      </div>
    </>
  );
}

function Select({ label, value, onChange, options, includeAll = false }) {
  const items = options.map((option) => (typeof option === 'string' ? { label: option, value: option } : option));
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
        {includeAll && <option value="">All</option>}
        {items.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function IssueList({ title, issues }) {
  return (
    <section className="surface rounded-md p-4">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 space-y-2">
        {issues.slice(0, 8).map((issue) => (
          <Link key={issue.id} to={`/issues/${issue.id}`} className="block rounded border border-slate-200 p-2 text-sm hover:bg-slate-50">
            <span className="block truncate font-medium text-blue-800">{issue.shortTitle}</span>
            <span className="block truncate text-xs text-slate-500">{issue.organisation || 'No organisation set'}</span>
          </Link>
        ))}
        {!issues.length && <p className="text-sm text-slate-500">No Issues in this list.</p>}
      </div>
    </section>
  );
}
