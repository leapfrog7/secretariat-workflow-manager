import { Link } from 'react-router-dom';
import { Archive, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import DeadlineIndicator from '../common/DeadlineIndicator';
import { formatDisplayDate, getIssueAgeDays } from '../../utils/dateUtils';
import { isScheduledIssue } from '../../utils/scheduleUtils';
import SourceSearchMatch from './SourceSearchMatch';

export default function IssueTable({ issues, officers = [], registerMode = 'Current', workingId = '', canEdit = true, onRestore, onBringBack, onArchive, onDelete }) {
  const showReturnDate = ['Scheduled', 'All'].includes(registerMode);
  return (
    <div className="surface hidden overflow-hidden rounded-md md:block">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] divide-y divide-[#dce6e4] text-sm">
          <thead className="bg-[#edf4f2] text-left text-xs font-semibold uppercase tracking-wide text-[#526b70]">
            <tr>
              {['Issue', 'eFile no.', 'Subject type', 'Stage', 'Assigned officer', 'Age', 'Deadline', ...(showReturnDate ? ['Returns'] : []), ...(canEdit ? ['Actions'] : [])].map((header) => (
                <th key={header} scope="col" className={`px-4 py-3 ${header === 'Actions' ? 'text-right' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e3ebe9] bg-white">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} officers={officers} showReturnDate={showReturnDate} working={workingId === issue.id} canEdit={canEdit} onRestore={onRestore} onBringBack={onBringBack} onArchive={onArchive} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueRow({ issue, officers, showReturnDate, working, canEdit, onRestore, onBringBack, onArchive, onDelete }) {
  const officer = officers.find((item) => item.id === issue.assignedOfficerId);
  const ageDays = getIssueAgeDays(issue);
  const scheduled = isScheduledIssue(issue);
  return (
    <tr className="transition-colors hover:bg-[#f5faf8]">
                <td className="max-w-[520px] px-4 py-3.5">
                  <Link to={`/issues/${issue.id}`} className="font-semibold text-[#174f5b] hover:text-teal-800 hover:underline" title={issue.subject}>
                    <span className="block truncate">{issue.shortTitle}</span>
                  </Link>
                  {issue.isArchived && <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Archived</span>}
                  {scheduled && <span className="mt-1 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">Scheduled</span>}
                  <SourceSearchMatch match={issue.searchMatch} />
                </td>
                <td className="max-w-[150px] px-4 py-3.5 text-slate-700" title={issue.eFileNumber}>
                  <span className="block truncate font-medium">{issue.eFileNumber || '-'}</span>
                </td>
                <td className="max-w-[180px] px-4 py-3.5 text-slate-600" title={issue.subjectType}>
                  <span className="block truncate">{issue.subjectType || 'Not specified'}</span>
                </td>
                <td className="px-4 py-3.5"><StatusBadge status={issue.status} /></td>
                <td className="max-w-[200px] px-4 py-3.5 text-slate-700" title={officer?.name}>
                  <span className="block truncate">{officer?.name || 'Not assigned'}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="block font-semibold tabular-nums text-[#17333b]">{ageDays}</span>
                  <span className="block text-xs text-slate-500">day{ageDays === 1 ? '' : 's'}</span>
                </td>
                <td className="px-4 py-3.5"><DeadlineIndicator issue={issue} compact /></td>
                {showReturnDate && <td className="px-4 py-3.5"><span className="block font-semibold tabular-nums text-cyan-900">{scheduled ? formatDisplayDate(issue.nextAppearanceDate) : '-'}</span>{scheduled && <span className="block text-xs text-slate-500">{issue.recurrenceType}</span>}</td>}
                {canEdit && <td className="px-4 py-3.5"><div className="flex items-center justify-end gap-1">
                  {working ? <span className="flex h-8 items-center justify-center gap-2 px-1 text-xs font-semibold text-cyan-800" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /><span>Updating</span></span> : <>
                    {issue.isArchived && <ActionIcon label="Restore Issue" tone="teal" onClick={() => onRestore(issue)}><RotateCcw className="h-4 w-4" /></ActionIcon>}
                    {scheduled && <ActionIcon label="Bring back now" tone="cyan" onClick={() => onBringBack(issue)}><RotateCcw className="h-4 w-4" /></ActionIcon>}
                    {!issue.isArchived && <ActionIcon label="Archive Issue" onClick={() => onArchive(issue)}><Archive className="h-4 w-4" /></ActionIcon>}
                    <ActionIcon label="Delete Issue permanently" tone="red" onClick={() => onDelete(issue)}><Trash2 className="h-4 w-4" /></ActionIcon>
                  </>}
                </div></td>}
    </tr>
  );
}

function ActionIcon({ label, tone = 'slate', onClick, children }) {
  const tones = { slate: 'text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800', teal: 'text-teal-700 hover:border-teal-200 hover:bg-teal-50', cyan: 'text-cyan-700 hover:border-cyan-200 hover:bg-cyan-50', red: 'text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-700' };
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors ${tones[tone]}`}>{children}</button>;
}
