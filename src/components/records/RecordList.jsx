import { Archive, ListTodo, Pencil } from 'lucide-react';
import { formatDisplayDate, formatDateTime } from '../../utils/dateUtils';

export default function RecordList({ records, actions, onEdit, onArchive, onCreateAction }) {
  if (!records.length) {
    return <div className="surface rounded-md p-4 text-sm text-slate-500">No Records have been added to this Issue.</div>;
  }
  return (
    <div className="space-y-3">
      {records.map((record) => {
        const linkedActions = actions.filter((action) => action.recordId === record.id && !action.isArchived);
        return (
          <article key={record.id} className="surface rounded-md p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">{record.direction}</span>
                  <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">{record.recordType}</span>
                  {record.recordNumber && <span className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">{record.recordNumber}</span>}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{record.subject}</h3>
                <p className="mt-1 text-sm text-slate-600">{record.summary || 'No summary recorded.'}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <button type="button" onClick={() => onCreateAction(record)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium hover:bg-slate-50">
                  <ListTodo className="h-3.5 w-3.5" aria-hidden="true" />
                  Action
                </button>
                <button type="button" onClick={() => onEdit(record)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Edit Record">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onArchive(record)} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Archive Record">
                  <Archive className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <Item label="Organisation" value={record.organisation || 'Not set'} />
              <Item label="Sender / recipient" value={record.senderReceiver || 'Not set'} />
              <Item label="Record date" value={formatDisplayDate(record.recordDate)} />
              <Item label="Received date" value={formatDisplayDate(record.receivedDate)} />
              <Item label="Updated" value={formatDateTime(record.updatedAt)} />
              <Item label="Linked Actions" value={linkedActions.length} />
            </dl>
            {linkedActions.length > 0 && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked Actions</h4>
                <ul className="mt-1 space-y-1 text-sm text-slate-700">
                  {linkedActions.map((action) => <li key={action.id}>{action.title} - {action.status}</li>)}
                </ul>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="truncate" title={String(value)}>{value}</dd>
    </div>
  );
}
