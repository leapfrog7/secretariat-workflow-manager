import { Link, useNavigate } from 'react-router-dom';
import { Archive, ListChecks, LoaderCircle, LockKeyhole, PencilLine, RotateCcw, Trash2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import DeadlineIndicator from '../common/DeadlineIndicator';
import { formatDisplayDate, getIssueAgeDays } from '../../utils/dateUtils';
import { isScheduledIssue } from '../../utils/scheduleUtils';
import SourceSearchMatch from './SourceSearchMatch';
import { getIssuePositionPreview } from '../../utils/issueUtils';

export default function IssueTable({ issues, officers = [], registerMode = 'Current', workingId = '', canEdit = true, showDivision = false, onQuickPosition, onQuickStage, onRestore, onBringBack, onArchive, onDelete }) {
  const showReturnDate = ['Scheduled', 'All'].includes(registerMode);
  return (
    <div className="issue-register-table surface overflow-hidden rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] table-fixed divide-y divide-[#dce6e4] text-sm">
          <thead className="bg-[#edf4f2] text-left text-xs font-semibold uppercase tracking-wide text-[#526b70]">
            <tr>
              <th scope="col" className="w-[25%] px-4 py-3">Issue</th>
              <th scope="col" className="w-[23%] px-4 py-3">Present position</th>
              <th scope="col" className="w-[12%] px-4 py-3">Stage</th>
              <th scope="col" className="w-[14%] px-4 py-3">Assigned officer</th>
              <th scope="col" className="w-[16%] px-4 py-3">Age &amp; deadline</th>
              {showReturnDate && <th scope="col" className="w-[10%] px-4 py-3">Returns</th>}
              {canEdit && <th scope="col" className="w-28 px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e3ebe9] bg-white">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} officers={officers} showReturnDate={showReturnDate} showDivision={showDivision} working={workingId === issue.id} showActions={canEdit} canEdit={canEdit && issue.accessLevel !== 'viewer'} onQuickPosition={onQuickPosition} onQuickStage={onQuickStage} onRestore={onRestore} onBringBack={onBringBack} onArchive={onArchive} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueRow({ issue, officers, showReturnDate, showDivision, working, showActions, canEdit, onQuickPosition, onQuickStage, onRestore, onBringBack, onArchive, onDelete }) {
  const navigate = useNavigate();
  const officer = officers.find((item) => item.id === issue.assignedOfficerId);
  const ageDays = getIssueAgeDays(issue);
  const scheduled = isScheduledIssue(issue);
  const canQuickUpdate = canEdit && !issue.isArchived && !scheduled;
  const positionPreview = getIssuePositionPreview(issue.currentPosition);
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
    <tr tabIndex={0} aria-label={`Open Issue: ${issue.shortTitle}`} onClick={openIssue} onKeyDown={openIssueFromKeyboard} className="cursor-pointer transition-colors hover:bg-[#f7faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-600">
                <td className="max-w-[520px] px-4 py-3.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Link to={`/issues/${issue.id}`} className="min-w-0 max-w-full font-semibold text-[#174f5b] hover:text-teal-800 hover:underline" title={issue.subject}>
                      <span className="block truncate">{issue.shortTitle}</span>
                    </Link>
                    {showDivision && <DivisionTag name={issue.divisionName} />}
                  </div>
                  {issue.eFileNumber && <div className="mt-1 truncate text-xs font-medium tabular-nums text-slate-500" title={`eFile no. ${issue.eFileNumber}`}>eFile {issue.eFileNumber}</div>}
                  {issue.isArchived && <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Archived</span>}
                  {scheduled && <span className="mt-1 inline-flex rounded-md bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">Scheduled</span>}
                  <SourceSearchMatch match={issue.searchMatch} />
                </td>
                <td className="px-4 py-3.5 align-top">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {positionPreview ? <p className="line-clamp-2 text-xs leading-5 text-slate-600" title={issue.currentPosition}>{positionPreview}</p> : <span className="text-xs italic text-slate-400">No position recorded</span>}
                    </div>
                    {canQuickUpdate && <ActionIcon label="Quick position update" tone="teal" onClick={() => onQuickPosition(issue)}><PencilLine className="h-4 w-4" /></ActionIcon>}
                  </div>
                </td>
                <td className="px-4 py-3.5 align-top">
                  <div className="flex items-start gap-1">
                    <StatusBadge status={issue.status} />
                    {canQuickUpdate && <ActionIcon label="Update stage" tone="teal" onClick={() => onQuickStage(issue)}><ListChecks className="h-4 w-4" /></ActionIcon>}
                  </div>
                </td>
                <td className="max-w-[200px] px-4 py-3.5 text-slate-700" title={officer?.name}>
                  <span className="block truncate">{officer?.name || 'Not assigned'}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="mb-1.5 text-xs text-slate-500">
                    <span className="font-semibold tabular-nums text-[#17333b]">{ageDays}</span> day{ageDays === 1 ? '' : 's'} old
                  </div>
                  <DeadlineIndicator issue={issue} compact />
                </td>
                {showReturnDate && <td className="px-4 py-3.5"><span className="block font-semibold tabular-nums text-cyan-900">{scheduled ? formatDisplayDate(issue.nextAppearanceDate) : '-'}</span>{scheduled && <span className="block text-xs text-slate-500">{issue.recurrenceType}</span>}</td>}
                {showActions && <td className="px-4 py-3.5"><div className="flex items-center justify-end gap-1">
                  {!canEdit ? <span title="View-only access" aria-label="View-only access" className="inline-flex h-8 w-8 items-center justify-center text-slate-400"><LockKeyhole className="h-4 w-4" /></span> :
                  working ? <span className="flex h-8 items-center justify-center gap-2 px-1 text-xs font-semibold text-cyan-800" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /><span>Updating</span></span> : <>
                    {issue.isArchived && <ActionIcon label="Restore Issue" tone="teal" onClick={() => onRestore(issue)}><RotateCcw className="h-4 w-4" /></ActionIcon>}
                    {scheduled && <ActionIcon label="Bring back now" tone="cyan" onClick={() => onBringBack(issue)}><RotateCcw className="h-4 w-4" /></ActionIcon>}
                    {!issue.isArchived && <ActionIcon label="Archive Issue" onClick={() => onArchive(issue)}><Archive className="h-4 w-4" /></ActionIcon>}
                    <ActionIcon label="Delete Issue permanently" tone="red" onClick={() => onDelete(issue)}><Trash2 className="h-4 w-4" /></ActionIcon>
                  </>}
                </div></td>}
    </tr>
  );
}

function DivisionTag({ name }) {
  return <span title={name ? `Owning division: ${name}` : 'No owning division assigned'} className={`inline-flex max-w-44 shrink-0 truncate rounded px-1.5 py-0.5 text-xs font-semibold ${name ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200' : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200'}`}>{name || 'Unassigned'}</span>;
}

function ActionIcon({ label, tone = 'slate', onClick, children }) {
  const tones = { slate: 'text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800', teal: 'text-teal-700 hover:border-teal-200 hover:bg-teal-50', cyan: 'text-cyan-700 hover:border-cyan-200 hover:bg-cyan-50', red: 'text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700' };
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors ${tones[tone]}`}>{children}</button>;
}
