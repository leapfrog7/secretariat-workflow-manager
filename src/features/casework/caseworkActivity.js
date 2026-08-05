function timestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function buildRecentCaseworkActivity(issues, notes, drafts, limit = 5) {
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const activityByIssue = new Map();

  const ensureActivity = (issueId) => {
    if (!issueById.has(issueId)) return null;
    if (!activityByIssue.has(issueId)) {
      activityByIssue.set(issueId, {
        issue: issueById.get(issueId),
        latestNote: null,
        latestDraft: null,
        activityAt: '',
        activityKind: '',
      });
    }
    return activityByIssue.get(issueId);
  };

  notes.forEach((note) => {
    const activity = ensureActivity(note.issueId);
    if (!activity) return;
    if (!activity.latestNote || timestamp(note.updatedAt || note.createdAt) > timestamp(activity.latestNote.updatedAt || activity.latestNote.createdAt)) {
      activity.latestNote = note;
    }
    const occurredAt = note.updatedAt || note.createdAt || '';
    if (timestamp(occurredAt) >= timestamp(activity.activityAt)) {
      activity.activityAt = occurredAt;
      activity.activityKind = 'note';
    }
  });

  drafts.forEach((draft) => {
    const activity = ensureActivity(draft.issueId);
    if (!activity) return;
    if (!activity.latestDraft || timestamp(draft.updatedAt || draft.createdAt) > timestamp(activity.latestDraft.updatedAt || activity.latestDraft.createdAt)) {
      activity.latestDraft = draft;
    }
    const occurredAt = draft.updatedAt || draft.createdAt || '';
    if (timestamp(occurredAt) >= timestamp(activity.activityAt)) {
      activity.activityAt = occurredAt;
      activity.activityKind = 'draft';
    }
  });

  return [...activityByIssue.values()]
    .sort((left, right) => timestamp(right.activityAt) - timestamp(left.activityAt))
    .slice(0, Math.max(0, limit));
}
