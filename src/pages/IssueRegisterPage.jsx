import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarClock, CircleDashed, ClipboardList, MessageCircleQuestion, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchInput from '../components/common/SearchInput';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import FilterBar from '../components/issues/FilterBar';
import IssueTable from '../components/issues/IssueTable';
import IssueCard from '../components/issues/IssueCard';
import { archiveIssue, bringBackIssue, getAllIssues, permanentlyDeleteIssue, restoreIssue } from '../db/issueRepository';
import { getAllOfficers } from '../db/officerRepository';
import { issueMatchesSearch } from '../utils/issueUtils';
import { getDeadlineState } from '../utils/dateUtils';
import { useToast } from '../components/common/ToastProvider';
import { isScheduledIssue } from '../utils/scheduleUtils';
import { getAllCommunications } from '../db/communicationRepository';
import { getCommunicationSearchContext } from '../utils/communicationUtils';
import { useAuth } from '../features/auth/AuthContext';

const defaultFilters = {
  query: '',
  status: '',
  archiveMode: 'Current',
  sort: 'Recently updated',
};

export default function IssueRegisterPage() {
  const auth = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState({ loading: true, error: '', issues: [], officers: [], communications: [] });
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [issues, officers, communications] = await Promise.all([getAllIssues(), getAllOfficers(), getAllCommunications()]);
      setData({ loading: false, error: '', issues, officers, communications });
    } catch (error) {
      setData({ loading: false, error: error.message, issues: [], officers: [], communications: [] });
    }
  };

  useEffect(() => {
    load();
    const handleSync = () => load();
    window.addEventListener('swm:issues-synced', handleSync);
    return () => window.removeEventListener('swm:issues-synced', handleSync);
  }, []);

  const summary = useMemo(() => {
    const current = data.issues.filter((issue) => !issue.isArchived && !isScheduledIssue(issue));
    const scheduled = data.issues.filter(isScheduledIssue);
    return {
      total: current.length,
      pending: current.filter((issue) => issue.status === 'Pending').length,
      overdue: current.filter((issue) => getDeadlineState(issue) === 'overdue').length,
      inProgress: current.filter((issue) => issue.status === 'In Progress').length,
      awaitingDiscussion: current.filter((issue) => issue.status === 'Awaiting Discussion').length,
      archived: data.issues.filter((issue) => issue.isArchived).length,
      scheduled: scheduled.length,
    };
  }, [data.issues]);

  const communicationsByIssue = useMemo(() => {
    const grouped = new Map();
    data.communications.forEach((communication) => {
      const entries = grouped.get(communication.issueId) || [];
      entries.push(communication);
      grouped.set(communication.issueId, entries);
    });
    return grouped;
  }, [data.communications]);

  const restore = async (issue) => {
    try {
      setWorkingId(issue.id);
      await restoreIssue(issue.id);
      showToast('Issue restored to the current register.');
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to restore Issue.', 'error');
    } finally {
      setWorkingId('');
    }
  };

  const bringBack = async (issue) => {
    try {
      setWorkingId(issue.id);
      await bringBackIssue(issue.id);
      showToast('Issue returned to the current register.');
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to return Issue.', 'error');
    } finally {
      setWorkingId('');
    }
  };

  const archive = async (issue) => {
    try {
      setWorkingId(issue.id);
      await archiveIssue(issue.id);
      showToast('Issue moved to Archive.');
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to archive Issue.', 'error');
    } finally {
      setWorkingId('');
    }
  };

  const deleteIssue = async () => {
    if (!deleteTarget) return;
    try {
      setWorkingId(deleteTarget.id);
      await permanentlyDeleteIssue(deleteTarget.id);
      showToast('Issue permanently deleted.');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      showToast(error.message || 'Unable to delete Issue.', 'error');
    } finally {
      setWorkingId('');
    }
  };

  const filtered = useMemo(() => {
    const rows = data.issues.flatMap((issue) => {
      if (filters.archiveMode === 'Current' && issue.isArchived) return [];
      if (filters.archiveMode === 'Current' && isScheduledIssue(issue)) return [];
      if (filters.archiveMode === 'Scheduled' && !isScheduledIssue(issue)) return [];
      if (filters.archiveMode === 'Archived' && !issue.isArchived) return [];
      if (filters.status && issue.status !== filters.status) return [];
      const sourceMatch = getCommunicationSearchContext(communicationsByIssue.get(issue.id) || [], filters.query);
      if (filters.query && !issueMatchesSearch(issue, filters.query) && !sourceMatch) return [];
      return [{ ...issue, searchMatch: sourceMatch }];
    });
    return rows.sort((a, b) => {
      if (filters.sort === 'Recently updated') return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      if (filters.sort === 'Next appearance') return (a.nextAppearanceDate || '9999-12-31').localeCompare(b.nextAppearanceDate || '9999-12-31');
      if (filters.sort === 'Date opened') return (b.dateOpened || '').localeCompare(a.dateOpened || '');
      if (filters.sort === 'Title') return a.shortTitle.localeCompare(b.shortTitle);
      return 0;
    });
  }, [data.issues, communicationsByIssue, filters]);

  const sourceMatchCount = useMemo(() => filtered.reduce((total, issue) => total + (issue.searchMatch?.count || 0), 0), [filtered]);
  const expectedSort = filters.archiveMode === 'Scheduled' ? 'Next appearance' : 'Recently updated';
  const advancedFiltersActive = Boolean(filters.status || filters.sort !== expectedSort);

  if (data.loading) return <LoadingState message="Loading Issue register..." />;
  if (data.error) return <ErrorState message={data.error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Issues"
        description="Search the Issue register and monitor ownership, age and deadlines."
      />
      {!auth.canEdit && <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-950">You have viewing access. Editing, archiving and deletion are unavailable.</div>}
      <div className="space-y-4">
        <section className="surface grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-md sm:grid-cols-5 sm:divide-y-0" aria-label="Issue summary">
          <Metric label="Total Issues" value={summary.total} detail="Current register" icon={ClipboardList} tone="teal" />
          <Metric label="Pending" value={summary.pending} detail="Awaiting action" icon={CircleDashed} tone="slate" />
          <Metric label="Overdue" value={summary.overdue} detail="Past deadline" icon={AlertTriangle} tone="red" />
          <Metric label="In Progress" value={summary.inProgress} detail="Work underway" icon={Activity} tone="cyan" />
          <Metric label="Awaiting Discussion" value={summary.awaitingDiscussion} detail="Decision or consultation" icon={MessageCircleQuestion} tone="violet" />
        </section>

        <section className="surface rounded-md p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <ArchiveViewSwitch value={filters.archiveMode} currentCount={summary.total} archivedCount={summary.archived} scheduledCount={summary.scheduled} onChange={(archiveMode) => setFilters((current) => ({ ...current, archiveMode, sort: archiveMode === 'Scheduled' ? 'Next appearance' : current.sort === 'Next appearance' ? 'Recently updated' : current.sort }))} />
            <button type="button" title="Filter and sort" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)} className={`relative flex h-9 w-9 items-center justify-center rounded-md border ${showFilters || advancedFiltersActive ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}><SlidersHorizontal className="h-4 w-4" />{advancedFiltersActive && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-teal-700" />}</button>
          </div>
          <div className="mt-3">
            <SearchInput value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search Issues, eReceipts or source documents" />
            {showFilters && <div className="mt-3 border-t border-slate-200 pt-3"><FilterBar filters={filters} onChange={setFilters} onClear={() => setFilters((current) => ({ ...defaultFilters, archiveMode: current.archiveMode, sort: current.archiveMode === 'Scheduled' ? 'Next appearance' : defaultFilters.sort }))} /></div>}
          </div>
        </section>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{filtered.length} Issue{filtered.length === 1 ? '' : 's'}{filters.query && sourceMatchCount > 0 ? ` - ${sourceMatchCount} source match${sourceMatchCount === 1 ? '' : 'es'}` : ''}</div>
        </div>
        {!filtered.length ? (
          <EmptyState title={filters.archiveMode === 'Archived' ? 'No archived Issues' : filters.archiveMode === 'Scheduled' ? 'No scheduled Issues' : 'No matching Issues'} message={filters.archiveMode === 'Archived' ? 'Archived Issues will appear here and can be restored to the current register.' : filters.archiveMode === 'Scheduled' ? 'Completed Issues with a return date will wait here until they are due.' : 'Adjust the filters or create a new Issue.'} />
        ) : (
          <>
            <IssueTable issues={filtered} officers={data.officers} registerMode={filters.archiveMode} workingId={workingId} canEdit={auth.canEdit} onRestore={restore} onBringBack={bringBack} onArchive={archive} onDelete={setDeleteTarget} />
            <div className="space-y-3 md:hidden">
              {filtered.map((issue) => (
                <IssueCard key={issue.id} issue={issue} officers={data.officers} registerMode={filters.archiveMode} working={workingId === issue.id} canEdit={auth.canEdit} onRestore={restore} onBringBack={bringBack} onArchive={archive} onDelete={setDeleteTarget} />
              ))}
            </div>
          </>
        )}
      </div>
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete Issue permanently?" message={`"${deleteTarget?.shortTitle || 'This Issue'}" and its communications, references, milestones, summaries and drafts will be permanently removed. This cannot be undone.`} confirmLabel="Delete Issue" destructive onCancel={() => setDeleteTarget(null)} onConfirm={deleteIssue} />
    </>
  );
}

const metricTones = {
  teal: 'border-t-teal-600 bg-teal-50 text-teal-800',
  slate: 'border-t-slate-500 bg-slate-50 text-slate-700',
  red: 'border-t-red-600 bg-red-50 text-red-800',
  cyan: 'border-t-cyan-600 bg-cyan-50 text-cyan-800',
  violet: 'border-t-violet-600 bg-violet-50 text-violet-800',
};

function Metric({ label, value, detail, icon: Icon, tone }) {
  return (
    <div className={`min-h-20 border-t-4 p-3 sm:min-h-24 sm:p-3.5 ${metricTones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold tabular-nums text-[#17333b] sm:text-2xl">{value}</div>
          <div className="mt-1 text-xs font-semibold sm:text-sm">{label}</div>
          <div className="mt-1 hidden text-xs opacity-75 sm:block">{detail}</div>
        </div>
        <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden="true" />
      </div>
    </div>
  );
}

function ArchiveViewSwitch({ value, currentCount, scheduledCount, archivedCount, onChange }) {
  const options = [
    { label: 'Current', count: currentCount },
    { label: 'Scheduled', count: scheduledCount, icon: CalendarClock },
    { label: 'Archived', count: archivedCount },
  ];
  return (
      <div className="inline-flex max-w-full overflow-x-auto rounded-md bg-slate-100 p-1" role="group" aria-label="Register view">
        {options.map((option) => (
          <button key={option.label} type="button" onClick={() => onChange(option.label)} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded px-3 text-sm font-semibold transition-colors ${value === option.label ? 'bg-[#17333b] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {option.icon && <option.icon className="h-3.5 w-3.5" />}{option.label}<span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${value === option.label ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{option.count}</span>
          </button>
        ))}
      </div>
  );
}
