import { FileText } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

export default function SourceSearchMatch({ match }) {
  if (!match) return null;
  const primary = match.eReceiptNumber
    ? `eReceipt ${match.eReceiptNumber}`
    : `${match.matchedField}: ${match.matchedValue}`;
  const context = match.subject || match.correspondent || (match.eReceiptNumber && match.matchedField !== 'eReceipt number' ? `${match.matchedField}: ${match.matchedValue}` : '');
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
      <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-700" aria-hidden="true" />
      <span className="max-w-full truncate font-semibold text-cyan-900" title={primary}>{primary}</span>
      {context && <><span className="text-slate-300">|</span><span className="max-w-[300px] truncate" title={context}>{context}</span></>}
      {match.date && <><span className="text-slate-300">|</span><span className="tabular-nums">{formatDisplayDate(match.date)}</span></>}
      {match.count > 1 && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-semibold text-cyan-800">+{match.count - 1} more</span>}
    </div>
  );
}
