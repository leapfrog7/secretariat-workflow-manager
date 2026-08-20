import { getDeadlineState, isStaleIssue } from '../../utils/dateUtils.js';

const CLOSED_STATUSES = new Set(['Completed', 'Cancelled']);
const AWAITING_STATUSES = new Set(['Awaiting Input', 'Awaiting Discussion']);
const HIGH_PRIORITIES = new Set(['High', 'Critical']);

function attentionRank(issue) {
  const deadline = getDeadlineState(issue);
  if (deadline === 'overdue') return 0;
  if (deadline === 'today') return 1;
  if (deadline === 'upcoming') return 2;
  if (issue.priority === 'Critical') return 3;
  if (AWAITING_STATUSES.has(issue.status)) return 4;
  if (issue.priority === 'High') return 5;
  if (isStaleIssue(issue)) return 6;
  return 9;
}

export function getIssueAttentionReason(issue) {
  const deadline = getDeadlineState(issue);
  if (deadline === 'overdue') return { label: 'Overdue', tone: 'danger' };
  if (deadline === 'today') return { label: 'Due today', tone: 'warning' };
  if (deadline === 'upcoming') return { label: 'Due soon', tone: 'warning' };
  if (issue.priority === 'Critical') return { label: 'Critical priority', tone: 'danger' };
  if (AWAITING_STATUSES.has(issue.status)) return { label: issue.status, tone: 'violet' };
  if (issue.priority === 'High') return { label: 'High priority', tone: 'warning' };
  if (isStaleIssue(issue)) return { label: 'Needs an update', tone: 'neutral' };
  return { label: 'Active', tone: 'teal' };
}

export function buildHomeDashboard(issues, { attentionLimit = 6 } = {}) {
  const active = issues.filter((issue) => !issue.isArchived && !issue.isScheduled && !CLOSED_STATUSES.has(issue.status));
  const overdue = active.filter((issue) => getDeadlineState(issue) === 'overdue');
  const dueSoon = active.filter((issue) => ['today', 'upcoming'].includes(getDeadlineState(issue)));
  const pending = active.filter((issue) => issue.status === 'Pending');
  const awaiting = active.filter((issue) => AWAITING_STATUSES.has(issue.status));
  const highPriority = active.filter((issue) => HIGH_PRIORITIES.has(issue.priority));
  const stale = active.filter(isStaleIssue);
  const attention = active
    .filter((issue) => attentionRank(issue) < 9)
    .sort((left, right) => {
      const rankDifference = attentionRank(left) - attentionRank(right);
      if (rankDifference) return rankDifference;
      return (left.nextDeadline || '9999-12-31').localeCompare(right.nextDeadline || '9999-12-31');
    })
    .slice(0, Math.max(0, attentionLimit));

  return { active, pending, overdue, dueSoon, awaiting, highPriority, stale, attention };
}
