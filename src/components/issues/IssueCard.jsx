import { Link } from 'react-router-dom';
import { Archive, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import DeadlineIndicator from '../common/DeadlineIndicator';
import { formatDisplayDate, getIssueAgeDays } from '../../utils/dateUtils';
import { isScheduledIssue } from '../../utils/scheduleUtils';
import SourceSearchMatch from './SourceSearchMatch';

export default function IssueCard({ issue, officers = [], working = false, onRestore, onBringBack, onArchive, onDelete }) {
  const officer = officers.find((item) => item.id === issue.assignedOfficerId);
  const ageDays = getIssueAgeDays(issue);
  const scheduled = isScheduledIssue(issue);
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
      <div className="mt-4 flex min-h-10 items-center justify-end gap-1 border-t border-[#e3ebe9] pt-3">
        {working ? <span className="flex items-center gap-2 text-xs font-semibold text-cyan-800" role="status"><LoaderCircle className="h-4 w-4 animate-spin" />Updating Issue...</span> : <>
          {issue.isArchived && <CardAction label="Restore Issue" onClick={() => onRestore(issue)}><RotateCcw className="h-4 w-4" /></CardAction>}
          {scheduled && <CardAction label="Bring back now" onClick={() => onBringBack(issue)}><RotateCcw className="h-4 w-4" /></CardAction>}
          {!issue.isArchived && <CardAction label="Archive Issue" onClick={() => onArchive(issue)}><Archive className="h-4 w-4" /></CardAction>}
          <CardAction label="Delete Issue permanently" danger onClick={() => onDelete(issue)}><Trash2 className="h-4 w-4" /></CardAction>
        </>}
      </div>
    </article>
  );
}

function CardAction({ label, danger = false, onClick, children }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-md border ${danger ? 'border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'}`}>{children}</button>;
}
