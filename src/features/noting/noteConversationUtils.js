function paragraphs(value) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export function buildNoteParagraphDiff(editorText, candidateText) {
  const before = paragraphs(editorText);
  const after = paragraphs(candidateText);
  const rows = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));

  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      rows[left][right] = before[left] === after[right]
        ? rows[left + 1][right + 1] + 1
        : Math.max(rows[left + 1][right], rows[left][right + 1]);
    }
  }

  const changes = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      changes.push({ type: 'unchanged', text: before[left] });
      left += 1;
      right += 1;
    } else if (rows[left + 1][right] >= rows[left][right + 1]) {
      changes.push({ type: 'removed', text: before[left] });
      left += 1;
    } else {
      changes.push({ type: 'added', text: after[right] });
      right += 1;
    }
  }
  while (left < before.length) changes.push({ type: 'removed', text: before[left++] });
  while (right < after.length) changes.push({ type: 'added', text: after[right++] });

  return {
    changes,
    added: changes.filter((change) => change.type === 'added').length,
    removed: changes.filter((change) => change.type === 'removed').length,
    unchanged: changes.filter((change) => change.type === 'unchanged').length,
  };
}

export function buildNoteSuggestionReview(editorText, candidateText, decisions = {}) {
  const comparison = buildNoteParagraphDiff(editorText, candidateText);
  const groups = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  let currentGroup = null;

  comparison.changes.forEach((change) => {
    if (change.type === 'unchanged') {
      currentGroup = null;
      beforeIndex += 1;
      afterIndex += 1;
      return;
    }
    if (!currentGroup) {
      currentGroup = {
        id: `suggestion-${groups.length + 1}`,
        beforeStart: beforeIndex,
        afterStart: afterIndex,
        removed: [],
        added: [],
      };
      groups.push(currentGroup);
    }
    change.groupId = currentGroup.id;
    if (change.type === 'removed') {
      currentGroup.removed.push(change.text);
      beforeIndex += 1;
    } else {
      currentGroup.added.push(change.text);
      afterIndex += 1;
    }
  });

  const resolvedParagraphs = [];
  let pendingStart = 0;
  const resolvedGroups = new Set();
  comparison.changes.forEach((change) => {
    if (change.type === 'unchanged') {
      resolvedParagraphs.push(change.text);
      pendingStart += 1;
      return;
    }
    const group = groups.find((item) => item.id === change.groupId);
    if (!group || resolvedGroups.has(group.id)) return;
    resolvedGroups.add(group.id);
    const decision = decisions[group.id] || 'pending';
    const chosen = decision === 'accepted' ? group.added : group.removed;
    group.currentStart = pendingStart;
    group.status = decision;
    resolvedParagraphs.push(...chosen);
    pendingStart += chosen.length;
  });
  return {
    ...comparison,
    groups,
    resolvedText: resolvedParagraphs.join('\n\n'),
    pending: groups.filter((group) => group.status === 'pending').length,
    accepted: groups.filter((group) => group.status === 'accepted').length,
    rejected: groups.filter((group) => group.status === 'rejected').length,
  };
}
