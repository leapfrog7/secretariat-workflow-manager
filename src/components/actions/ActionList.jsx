import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw, Archive, Pencil } from 'lucide-react';
import PriorityBadge from '../common/PriorityBadge';
import StatusBadge from '../common/StatusBadge';
import { formatDisplayDate, formatDateTime } from '../../utils/dateUtils';
import { ActionDueIndicator, FollowUpIndicators } from './ActionIndicators';

export default function ActionList({ actions, officers = [], onEdit, onComplete, onReopen, onArchive, readOnly = false }) {
  if (!actions.length) {
    return <div className="surface rounded-md p-4 text-sm text-slate-500">No Actions match the current view.</div>;
  }

  return (
    <>
      <div className="surface hidden overflow-hidden rounded-md lg:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              {['Action', 'Status', 'Priority', 'Assigned', 'Pending', 'Record', 'Due', 'Follow-up', 'Updated', readOnly ? 'Issue' : ''].map((header) => (
                <th key={header} className="px-3 py-2">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {actions.map((action) => (
              <ActionRow key={action.id} action={action} officers={officers} onEdit={onEdit} onComplete={onComplete} onReopen={onReopen} onArchive={onArchive} readOnly={readOnly} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {actions.map((action) => (
          <ActionCard key={action.id} action={action} officers={officers} onEdit={onEdit} onComplete={onComplete} onReopen={onReopen} onArchive={onArchive} readOnly={readOnly} />
        ))}
      </div>
    </>
  );
}

function ActionRow({ action, officers, onEdit, onComplete, onReopen, onArchive, readOnly }) {
  const officer = officers.find((item) => item.id === action.assignedOfficerId);
  return (
    <tr className="hover:bg-slate-50">
      <td className="max-w-[260px] px-3 py-2">
        <div className="truncate font-medium text-slate-950" title={action.title}>{action.title}</div>
        {action.dependency && <div className="truncate text-xs text-slate-500" title={action.dependency}>Depends on: {action.dependency}</div>}
        {action.outcome && <div className="truncate text-xs text-slate-500" title={action.outcome}>Outcome: {action.outcome}</div>}
        {action.assignmentInstructions && <div className="truncate text-xs text-slate-500" title={action.assignmentInstructions}>Instructions: {action.assignmentInstructions}</div>}
      </td>
      <td className="px-3 py-2"><StatusBadge status={action.status} /></td>
      <td className="px-3 py-2"><PriorityBadge priority={action.priority} /></td>
      <td className="max-w-[130px] px-3 py-2 text-slate-700" title={officer?.name || action.assignedTo}><span className="block truncate">{officer?.name || action.assignedTo || 'Not set'} ({action.progressPercent || 0}%)</span></td>
      <td className="max-w-[130px] px-3 py-2 text-slate-700" title={action.pendingWith}><span className="block truncate">{action.pendingWith || 'Not set'}</span></td>
      <td className="max-w-[110px] px-3 py-2 text-slate-600" title={action.recordId}><span className="block truncate">{action.recordId || 'None'}</span></td>
      <td className="px-3 py-2"><ActionDueIndicator action={action} compact /></td>
      <td className="px-3 py-2"><FollowUpIndicators action={action} /></td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDisplayDate(action.updatedAt)}</td>
      <td className="px-3 py-2">{readOnly ? <IssueLink action={action} /> : <ActionButtons action={action} onEdit={onEdit} onComplete={onComplete} onReopen={onReopen} onArchive={onArchive} />}</td>
    </tr>
  );
}

function ActionCard({ action, officers, onEdit, onComplete, onReopen, onArchive, readOnly }) {
  const officer = officers.find((item) => item.id === action.assignedOfficerId);
  return (
    <div className="surface rounded-md p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-950">{action.title}</h3>
          <p className="mt-1 text-xs text-slate-500">Updated {formatDateTime(action.updatedAt)}</p>
        </div>
        <PriorityBadge priority={action.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge status={action.status} />
        <ActionDueIndicator action={action} compact />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <Item label="Assigned to" value={officer?.name || action.assignedTo || 'Not set'} />
        <Item label="Pending with" value={action.pendingWith || 'Not set'} />
        <Item label="Record" value={action.recordId || 'None'} />
        <Item label="Due" value={formatDisplayDate(action.dueDate)} />
        <Item label="Progress" value={`${action.progressPercent || 0}%`} />
        <Item label="Review" value={action.reviewStatus || 'Not Submitted'} />
      </dl>
      {action.assignmentInstructions && <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Instructions:</span> {action.assignmentInstructions}</p>}
      {(action.dependency || action.outcome) && (
        <div className="mt-3 space-y-1 text-xs text-slate-600">
          {action.dependency && <p><span className="font-medium">Dependency:</span> {action.dependency}</p>}
          {action.outcome && <p><span className="font-medium">Outcome:</span> {action.outcome}</p>}
        </div>
      )}
      <div className="mt-3"><FollowUpIndicators action={action} /></div>
      <div className="mt-3 flex justify-end">{readOnly ? <IssueLink action={action} /> : <ActionButtons action={action} onEdit={onEdit} onComplete={onComplete} onReopen={onReopen} onArchive={onArchive} />}</div>
    </div>
  );
}

function IssueLink({ action }) {
  return (
    <Link to={`/issues/${action.issueId}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50">
      Open Issue
    </Link>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="truncate" title={value}>{value}</dd>
    </div>
  );
}

function ActionButtons({ action, onEdit, onComplete, onReopen, onArchive }) {
  const isCompleted = action.status === 'Completed';
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button type="button" onClick={() => onEdit(action)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Edit Action">
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
      {isCompleted ? (
        <button type="button" onClick={() => onReopen(action)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Reopen Action">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={() => onComplete(action)} className="rounded-md border border-slate-300 p-1.5 text-green-700 hover:bg-green-50" title="Mark complete">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <button type="button" onClick={() => onArchive(action)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Archive Action">
        <Archive className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
