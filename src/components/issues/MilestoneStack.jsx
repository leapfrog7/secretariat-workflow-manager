import { ChevronDown, ChevronUp, History, LoaderCircle } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { formatDateTime } from '../../utils/dateUtils';

export default function MilestoneStack({ milestones, total, expanded, loading, onLoadAll, onCollapse }) {
  const hiddenCount = Math.max(0, total - milestones.length);
  return (
    <section className="surface overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce6e4] bg-[#f7faf9] px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-[#17333b]">Position history</h2>
          <p className="mt-0.5 text-xs text-slate-500">A dated record of how this Issue has progressed.</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-[#dce6e4]">{total} milestone{total === 1 ? '' : 's'}</span>
      </div>

      {milestones.length ? (
        <ol className="px-4 py-2 sm:px-5">
          {milestones.map((milestone, index) => (
            <li key={milestone.id} className="relative grid gap-2 border-l-2 border-[#d7e3e1] py-4 pl-7 last:border-transparent sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
              <span className={`absolute -left-[7px] top-5 h-3 w-3 rounded-full ring-4 ring-white ${index === 0 ? 'bg-teal-600' : 'bg-slate-300'}`} aria-hidden="true" />
              <div>
                <div className="text-xs font-semibold tabular-nums text-slate-600">{formatDateTime(milestone.recordedAt)}</div>
                {index === 0 && <span className="mt-2 inline-flex rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200">Current</span>}
              </div>
              <div className={`rounded-md border p-3 ${index === 0 ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={milestone.status} />
                  <span className="text-xs font-medium text-slate-500">{milestone.assignedOfficerName ? `Assigned to ${milestone.assignedOfficerName}` : 'Not assigned'}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{milestone.note || 'No position note was recorded for this update.'}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-4 py-8 text-center"><History className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm text-slate-500">No position history recorded.</p></div>
      )}

      {(hiddenCount > 0 || expanded) && (
        <div className="border-t border-[#dce6e4] bg-[#fbfcfc] px-4 py-3 text-center">
          {hiddenCount > 0 ? (
            <button type="button" onClick={onLoadAll} disabled={loading} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60">
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
              {loading ? 'Loading history...' : `Show ${hiddenCount} earlier update${hiddenCount === 1 ? '' : 's'}`}
            </button>
          ) : (
            <button type="button" onClick={onCollapse} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ChevronUp className="h-4 w-4" />Show latest five</button>
          )}
        </div>
      )}
    </section>
  );
}
