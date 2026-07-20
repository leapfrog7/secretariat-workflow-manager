import { addDays, differenceInCalendarDays, format, isValid, parseISO, subDays } from 'date-fns';
import { DEADLINE_THRESHOLDS } from '../constants/issueConstants';

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function tomorrowISO() {
  return format(addDays(new Date(), 1), 'yyyy-MM-dd');
}

export function toISODate(value) {
  if (!value) return '';
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? format(date, 'yyyy-MM-dd') : '';
}

export function formatDisplayDate(value, fallback = 'Not set') {
  if (!value) return fallback;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? format(date, 'dd MMM yyyy') : fallback;
}

export function formatDateTime(value, fallback = 'Not available') {
  if (!value) return fallback;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? format(date, 'dd MMM yyyy, h:mm a') : fallback;
}

export function getDeadlineState(issue) {
  if (!issue?.nextDeadline) return 'none';
  if (['Completed', 'Cancelled'].includes(issue.status) || issue.dateClosed) return 'closed';
  const days = differenceInCalendarDays(parseISO(issue.nextDeadline), new Date());
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= DEADLINE_THRESHOLDS.upcomingDays) return 'upcoming';
  return 'future';
}

export function getIssueAgeDays(issue) {
  const opened = issue?.dateOpened || issue?.createdAt;
  if (!opened) return 0;
  const date = parseISO(opened);
  if (!isValid(date)) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(), date));
}

export function getDeadlineDaysRemaining(issue) {
  if (!issue?.nextDeadline) return null;
  const deadline = parseISO(issue.nextDeadline);
  if (!isValid(deadline)) return null;
  return differenceInCalendarDays(deadline, new Date());
}

export function isStaleIssue(issue) {
  if (!issue?.updatedAt || ['Completed', 'Cancelled'].includes(issue.status) || issue.isArchived || issue.isScheduled) return false;
  return new Date(issue.updatedAt) <= subDays(new Date(), DEADLINE_THRESHOLDS.staleDays);
}

export function sortIssuesDefault(a, b) {
  const stateRank = { overdue: 0, today: 1, upcoming: 2, future: 3, none: 4, closed: 5 };
  const aRank = stateRank[getDeadlineState(a)] ?? 9;
  const bRank = stateRank[getDeadlineState(b)] ?? 9;
  if (aRank !== bRank) return aRank - bRank;

  const aDeadline = a.nextDeadline || '9999-12-31';
  const bDeadline = b.nextDeadline || '9999-12-31';
  if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);

  return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}
