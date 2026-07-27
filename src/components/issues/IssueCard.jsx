import { Link, useNavigate } from 'react-router-dom';
import { Archive, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import DeadlineIndicator from '../common/DeadlineIndicator';
import { formatDisplayDate, getIssueAgeDays } from '../../utils/dateUtils';
import { isScheduledIssue } from '../../utils/scheduleUtils';
import SourceSearchMatch from './SourceSearchMatch';

export default function IssueCard({ issue, officers = [], working = false, canEdit = true, showDivision = false, onRestore, onBringBack, onArchive, onDelete }) {
  const navigate = useNavigate();
  const officer = officers.find((item) => item.id === issue.assignedOfficerId);
  const ageDays = getIssueAgeDays(issue);
  const scheduled = isScheduledIssue(issue);
  const openIssue = (event) => {
    if (event.target.closest?.('a, button, input, select, textarea')) return;
    navigate(`/issues/${issue.id}`);
  };
  const openIssueFromKeyboard = (event) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    navigate(`/issues/${issue.id}`);
  };
  return (
    <article tabIndex={0} aria-label={`Open Issue: ${issue.shortTitle}`} onClick={openIssue} onKeyDown={openIssueFromKeyboard} className={`surface cursor-pointer rounded-md border-l-[3px] p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${issue.isArchived ? 'border-l-slate-400' : scheduled ? 'border-l-cyan-600' : 'border-l-teal-600'}`}>
      <Link to={`/issues/${issue.id}`} className="line-clamp-2 text-sm font-semibold leading-5 text-[#17333b] hover:text-teal-800 hover:underline" title={issue.shortTitle}>
        {issue.shortTitle}
      </Link>
      <div className="mt-1.5 flex min-h-5 min-w-0 items-center justify-between gap-2">
        <div className="min-w-0 truncate text-xs font-medium tabular-nums text-slate-500" title={issue.eFileNumber ? `eFile no. ${issue.eFileNumber}` : 'No eFile number'}>
          {issue.eFileNumber ? `eFile ${issue.eFileNumber}` : 'eFile not set'}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showDivision && <span title={issue.divisionName ? `Owning division: ${issue.divisionName}` : 'No owning division assigned'} className={`inline-flex max-w-28 truncate rounded px-1.5 py-0.5 text-xs font-semibold ${issue.divisionName ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200' : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200'}`}>{issue.divisionName || 'Unassigned'}</span>}
          {issue.isArchived && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Archived</span>}
          {scheduled && <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">Scheduled</span>}
        </div>
      </div>
      <SourceSearchMatch match={issue.searchMatch} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={issue.status} />
        <DeadlineIndicator issue={issue} compact />
      </div>
      <div className="mt-2.5 flex min-h-10 items-center justify-between gap-2 border-t border-[#e3ebe9] pt-2">
        <div className="min-w-0 text-xs leading-4 text-slate-500">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium text-slate-700" title={officer?.name}>{officer?.name || 'Not assigned'}</span>
            <span className="shrink-0 border-l border-slate-300 pl-1.5 tabular-nums">{ageDays}d old</span>
          </div>
          {scheduled && <div className="truncate text-cyan-800">Returns {formatDisplayDate(issue.nextAppearanceDate)}</div>}
        </div>
        {canEdit && <div className="flex shrink-0 items-center justify-end gap-0.5">
          {working ? <span className="flex items-center gap-1 text-xs font-semibold text-cyan-800" role="status"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Updating</span> : <>
            {issue.isArchived && <CardAction label="Restore Issue" onClick={() => onRestore(issue)}><RotateCcw className="h-4 w-4" /></CardAction>}
            {scheduled && <CardAction label="Bring back now" onClick={() => onBringBack(issue)}><RotateCcw className="h-4 w-4" /></CardAction>}
            {!issue.isArchived && <CardAction label="Archive Issue" onClick={() => onArchive(issue)}><Archive className="h-4 w-4" /></CardAction>}
            <CardAction label="Delete Issue permanently" danger onClick={() => onDelete(issue)}><Trash2 className="h-4 w-4" /></CardAction>
          </>}
        </div>}
      </div>
    </article>
  );
}

function CardAction({ label, danger = false, onClick, children }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`flex h-9 w-9 items-center justify-center rounded-md border ${danger ? 'border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800'}`}>{children}</button>;
}
