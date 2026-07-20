import { Link } from 'react-router-dom';
import { AlertCircle, Bell, CalendarClock, FilePlus2, Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import DeadlineIndicator from '../components/common/DeadlineIndicator';
import PriorityBadge from '../components/common/PriorityBadge';
import StatusBadge from '../components/common/StatusBadge';
import DisclosureSection from '../components/common/DisclosureSection';
import { getAllIssues, getIssueStatistics } from '../db/issueRepository';
import { getActionStatistics } from '../db/actionRepository';
import { getAllOfficers } from '../db/officerRepository';
import { formatDisplayDate } from '../utils/dateUtils';
import { ActionDueIndicator } from '../components/actions/ActionIndicators';

export default function DashboardPage() {
  const [state, setState] = useState({ loading: true, error: '', issues: [], officers: [], issueStats: null, actionStats: null });

  const load = async () => {
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));
      const [issues, issueStats, actionStats, officers] = await Promise.all([
        getAllIssues({ includeArchived: false, includeScheduled: false }),
        getIssueStatistics(),
        getActionStatistics(),
        getAllOfficers(),
      ]);
      setState({ loading: false, error: '', issues, officers, issueStats, actionStats });
    } catch (error) {
      setState({ loading: false, error: error.message, issues: [], officers: [], issueStats: null, actionStats: null });
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState message="Loading dashboard..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  const issueStats = state.issueStats;
  const actionStats = state.actionStats;
  const officerPendency = state.officers
    .map((officer) => ({
      officer,
      count: actionStats.allOpen?.filter((action) => action.assignedOfficerId === officer.id).length || 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const recent = [...state.issues].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operational view of active Issues, Actions, deadlines and follow-up."
        actions={
          <Link to="/issues/new" className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            New Issue
          </Link>
        }
      />
      {!state.issues.length ? (
        <EmptyState
          title="No Issues yet"
          message="Create an Issue or load demo data from Settings to start using the dashboard."
          action={<Link to="/settings" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium">Open Settings</Link>}
        />
      ) : (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Open Actions" value={actionStats.open} />
            <Summary label="Overdue Actions" value={actionStats.overdue.length} />
            <Summary label="Awaiting Input" value={actionStats.awaitingInput} />
            <Summary label="Submitted for review" value={actionStats.submittedForApproval} />
          </section>

          <DisclosureSection title="Action attention" description="Expand to see due, overdue, follow-up and review lists.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ActionAttentionCard title="Actions due today" icon={CalendarClock} actions={actionStats.dueToday} />
              <ActionAttentionCard title="Assigned today" icon={CalendarClock} actions={actionStats.assignedToday} />
              <ActionAttentionCard title="Overdue Actions" icon={AlertCircle} actions={actionStats.overdue} />
              <ActionAttentionCard title="Due within 7 days" icon={CalendarClock} actions={actionStats.dueSoon} />
              <ActionAttentionCard title="Follow-ups due" icon={Bell} actions={actionStats.followUpsDue} />
              <ActionAttentionCard title="Escalations due" icon={Megaphone} actions={actionStats.escalationsDue} />
              <ActionAttentionCard title="Recently completed" icon={CalendarClock} actions={actionStats.recentlyCompleted} />
              <ActionAttentionCard title="No progress update" icon={AlertCircle} actions={actionStats.inactiveTasks} />
              <ActionAttentionCard title="Submitted for review" icon={CalendarClock} actions={actionStats.submittedForReview} />
              <ActionAttentionCard title="Returned for revision" icon={AlertCircle} actions={actionStats.returnedForRevision} />
            </div>
          </DisclosureSection>
          <DisclosureSection title="Officer-wise pendency" description="Expand to see open assigned Actions by officer.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {officerPendency.slice(0, 8).map((item) => (
                  <Link key={item.officer.id} to="/issues" className="rounded border border-slate-200 p-2 text-sm hover:bg-slate-50">
                    <span className="block truncate font-medium text-blue-800">{item.officer.name}</span>
                    <span className="text-xs text-slate-500">{item.count} open assigned Action{item.count === 1 ? '' : 's'}</span>
                  </Link>
                ))}
                {!officerPendency.length && <p className="text-sm text-slate-500">No assigned open Actions.</p>}
            </div>
          </DisclosureSection>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Summary label="Open Issues" value={issueStats.openIssues} />
            <Summary label="Pending" value={issueStats.pending} />
            <Summary label="In Progress" value={issueStats.inProgress} />
            <Summary label="Awaiting Input" value={issueStats.awaitingInput} />
            <Summary label="High or Critical priority" value={issueStats.highPriority} />
          </section>

          <DisclosureSection title="Issue attention" description="Expand to see Issue deadline and stale-work lists.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <IssueAttentionCard title="Overdue Issues" icon={AlertCircle} items={issueStats.overdue} />
              <IssueAttentionCard title="Issues due within 7 days" icon={CalendarClock} items={issueStats.dueSoon} />
              <IssueAttentionCard title="No next action" icon={AlertCircle} items={issueStats.withoutNextAction} />
              <IssueAttentionCard title="No update for 10 days" icon={CalendarClock} items={issueStats.stale} />
            </div>
          </DisclosureSection>

          <section className="surface rounded-md">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-950">Recent Issues</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {recent.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Summary({ label, value }) {
  return (
    <div className="surface rounded-md p-4">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  );
}

function ActionAttentionCard({ title, icon: Icon, actions }) {
  return (
    <div className="surface rounded-md p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold">{actions.length}</span>
      </div>
      <div className="space-y-2">
        {actions.slice(0, 4).map((action) => (
          <Link key={action.id} to={`/issues/${action.issueId}`} className="block rounded border border-slate-200 p-2 text-sm hover:bg-slate-50">
            <span className="block truncate font-medium text-slate-800">{action.title}</span>
            <span className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
              <ActionDueIndicator action={action} compact />
              <span className="truncate">{action.pendingWith || action.assignedTo || 'No authority set'}</span>
            </span>
          </Link>
        ))}
        {!actions.length && <p className="text-sm text-slate-500">No Actions in this list.</p>}
      </div>
    </div>
  );
}

function IssueAttentionCard({ title, icon: Icon, items }) {
  return (
    <div className="surface rounded-md p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 3).map((issue) => (
          <Link key={issue.id} to={`/issues/${issue.id}`} className="block rounded border border-slate-200 p-2 text-sm hover:bg-slate-50">
            <span className="block truncate font-medium text-slate-800">{issue.shortTitle}</span>
            <span className="block truncate text-xs text-slate-500">{issue.pendingWith || issue.organisation || 'No pending authority'}</span>
          </Link>
        ))}
        {!items.length && <p className="text-sm text-slate-500">Nothing requires attention.</p>}
      </div>
    </div>
  );
}

function IssueRow({ issue }) {
  return (
    <Link to={`/issues/${issue.id}`} className="grid gap-2 px-4 py-3 text-sm hover:bg-slate-50 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_100px] md:items-center">
      <div className="min-w-0">
        <div className="truncate font-medium text-blue-800" title={issue.shortTitle}>{issue.shortTitle}</div>
        <div className="truncate text-xs text-slate-500" title={issue.subject}>{issue.subject}</div>
      </div>
      <div className="truncate text-slate-600" title={issue.organisation}>{issue.organisation || 'Not set'}</div>
      <StatusBadge status={issue.status} />
      <PriorityBadge priority={issue.priority} />
      <div className="truncate text-slate-600" title={issue.pendingWith}>{issue.pendingWith || 'Not set'}</div>
      <DeadlineIndicator issue={issue} compact />
      <div className="text-xs text-slate-500">{formatDisplayDate(issue.updatedAt)}</div>
    </Link>
  );
}
