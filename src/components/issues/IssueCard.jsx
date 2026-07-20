import { Link } from 'react-router-dom';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import DeadlineIndicator from '../common/DeadlineIndicator';
import { formatDisplayDate, getIssueAgeDays } from '../../utils/dateUtils';
import { isScheduledIssue } from '../../utils/scheduleUtils';
import SourceSearchMatch from './SourceSearchMatch';

export default function IssueCard({ issue, officers = [], registerMode = 'Current', working = false, onRestore, onBringBack }) {
  const officer = officers.find((item) => item.id === issue.assignedOfficerId);
  const ageDays = getIssueAgeDays(issue);
  const scheduled = isScheduledIssue(issue);
  const showAction = registerMode !== 'Current';
  return (
    <article className={`surface rounded-md border-l-4 p-4 ${issue.isArchived ? 'border-l-slate-400' : scheduled ? 'border-l-cyan-600' : 'border-l-teal-600'}`}>
      <div className="flex items-start justify-between gap-3">
        <Link to={`/issues/${issue.id}`} className="min-w-0 text-sm font-semibold text-[#17333b] hover:text-teal-800 hover:underline" title={issue.shortTitle}>
          <span className="block truncate">{issue.shortTitle}</span>
        </Link>
        {issue.isArchived && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Archived</span>}
        {scheduled && <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">Scheduled</span>}
      </div>
      <SourceSearchMatch match={issue.searchMatch} />
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={issue.status} />
        <DeadlineIndicator issue={issue} compact />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
        <div>
          <dt className="font-medium text-slate-500">eFile no.</dt>
          <dd className="truncate" title={issue.eFileNumber}>{issue.eFileNumber || 'Not set'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Subject type</dt>
          <dd className="truncate" title={issue.subjectType}>{issue.subjectType || 'Not specified'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Assigned to</dt>
          <dd className="truncate" title={officer?.name}>{officer?.name || 'Not assigned'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">Age</dt>
          <dd>{ageDays} day{ageDays === 1 ? '' : 's'}</dd>
        </div>
        {scheduled && <div><dt className="font-medium text-slate-500">Returns</dt><dd>{formatDisplayDate(issue.nextAppearanceDate)}</dd></div>}
      </dl>
      {showAction && (issue.isArchived || scheduled) && (
        <div className="mt-4 border-t border-[#e3ebe9] pt-3">
          <button type="button" disabled={working} onClick={() => issue.isArchived ? onRestore(issue) : onBringBack(issue)} className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold disabled:opacity-60 ${scheduled ? 'border-cyan-200 bg-cyan-50 text-cyan-900 hover:bg-cyan-100' : 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'}`}>
            {working ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {working ? (scheduled ? 'Returning...' : 'Restoring...') : scheduled ? 'Bring back now' : 'Restore to current Issues'}
          </button>
        </div>
      )}
    </article>
  );
}
