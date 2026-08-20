import Badge from '../ui/Badge';

const tones = {
  Unset: 'neutral',
  Low: 'neutral',
  Normal: 'info',
  High: 'warning',
  Critical: 'danger',
};

export default function PriorityBadge({ priority }) {
  return (
    <Badge tone={tones[priority] || tones.Unset} className="py-0.5 font-medium">
      {priority || 'Not prioritised'}
    </Badge>
  );
}
