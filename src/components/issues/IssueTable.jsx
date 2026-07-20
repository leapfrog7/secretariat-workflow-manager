import { Link } from 'react-router-dom';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import DeadlineIndicator from '../common/DeadlineIndicator';
import { formatDisplayDate, getIssueAgeDays } from '../../utils/dateUtils';
import { isScheduledIssue } from '../../utils/scheduleUtils';
import SourceSearchMatch from './SourceSearchMatch';

export default function IssueTable({ issues, officers = [], registerMode = 'Current', workingId = '', onRestore, onBringBack }) {
  const showReturnDate = ['Scheduled', 'All'].includes(registerMode);
  const showAction = registerMode !== 'Current';
  return (
    <div className="surface hidden overflow-hidden rounded-md md:block">
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] divide-y divide-[#dce6e4] text-sm">
          <thead className="bg-[#edf4f2] text-left text-xs font-semibold uppercase tracking-wide text-[#526b70]">
            <tr>
              {['Issue', 'eFile no.', 'Subject type', 'Stage', 'Assigned officer', 'Age', 'Deadline', ...(showReturnDate ? ['Returns'] : []), ...(showAction ? ['Action'] : [])].map((header) => (
                <th key={header} scope="col" className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e3ebe9] bg-white">
            {issues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} officers={officers} showReturnDate={showReturnDate} showAction={showAction} working={workingId === issue.id} onRestore={onRestore} onBringBack={onBringBack} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueRow({ issue, officers, showReturnDate, showAction, working, onRestore, onBringBack }) {
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
                {showAction && (
                  <td className="px-4 py-3.5">
                    {issue.isArchived ? (
                      <button type="button" disabled={working} onClick={() => onRestore(issue)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-60">
                        {working ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        {working ? 'Restoring...' : 'Restore'}
                      </button>
                    ) : scheduled ? (
                      <button type="button" disabled={working} onClick={() => onBringBack(issue)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:opacity-60">
                        {working ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        {working ? 'Returning...' : 'Bring back'}
                      </button>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                )}
    </tr>
  );
}
