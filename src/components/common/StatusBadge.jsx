import Badge from '../ui/Badge';

const tones = {
  Pending: 'neutral',
  'In Progress': 'info',
  'Awaiting Input': 'warning',
  'Awaiting Discussion': 'violet',
  Deferred: 'violet',
  Completed: 'success',
  Cancelled: 'danger',
};

export default function StatusBadge({ status }) {
  return (
    <Badge tone={tones[status] || tones.Pending} dot>
      <span className="truncate">{status || 'Not set'}</span>
    </Badge>
  );
}
