import { addMonths, addWeeks, getDate, getDaysInMonth, parseISO, setDate, startOfMonth } from 'date-fns';
import { todayISO, toISODate } from './dateUtils';

export function isScheduledIssue(issue) {
  return Boolean(issue?.isScheduled) && !issue?.isArchived;
}

export function calculateNextAppearance(issue, referenceDate = todayISO()) {
  if (!issue?.recurrenceType || !issue.nextAppearanceDate) return '';
  if (issue.nextAppearanceDate > referenceDate) return issue.nextAppearanceDate;
  if (issue.recurrenceType === 'One-time') return '';

  let candidate = parseISO(issue.nextAppearanceDate);
  const anchorDay = Number(issue.recurrenceAnchorDay) || getDate(candidate);
  do {
    if (issue.recurrenceType === 'Weekly') {
      candidate = addWeeks(candidate, 1);
    } else {
      const nextMonth = startOfMonth(addMonths(candidate, 1));
      candidate = setDate(nextMonth, Math.min(anchorDay, getDaysInMonth(nextMonth)));
    }
  } while (toISODate(candidate) <= referenceDate);
  return toISODate(candidate);
}
