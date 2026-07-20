import { formatDateTime } from '../../utils/dateUtils';

export default function ChronologyList({ events }) {
  if (!events.length) return <div className="surface rounded-md p-4 text-sm text-slate-500">No chronology events recorded yet.</div>;
  return (
    <div className="surface rounded-md p-4">
      <h2 className="text-sm font-semibold text-slate-950">Chronology</h2>
      <ol className="mt-3 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="border-l-2 border-slate-200 pl-3">
            <div className="text-sm font-medium text-slate-900">{event.eventType}: {event.title || 'Untitled event'}</div>
            <div className="text-xs text-slate-500">{formatDateTime(event.eventDate)}</div>
            {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
