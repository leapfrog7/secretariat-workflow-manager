export function resolvePositionUpdate(existing = {}, input = {}) {
  const usesPositionEntry = Object.prototype.hasOwnProperty.call(input, 'positionNote');
  if (!usesPositionEntry) {
    const currentPosition = String(input.currentPosition ?? existing.currentPosition ?? '');
    return {
      currentPosition,
      milestoneNote: currentPosition,
      hasPositionNote: currentPosition !== String(existing.currentPosition || ''),
    };
  }

  const positionNote = String(input.positionNote || '').trim();
  return {
    currentPosition: positionNote || String(existing.currentPosition || ''),
    milestoneNote: positionNote,
    hasPositionNote: Boolean(positionNote),
  };
}

export function positionRecordedAt(dateValue, now = new Date()) {
  const date = String(dateValue || '').trim();
  if (!date) return now.toISOString();

  const localDate = new Date(
    `${date}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
  );
  return Number.isNaN(localDate.getTime()) ? now.toISOString() : localDate.toISOString();
}

export function findCurrentPositionMilestone(milestones = [], currentPosition = '') {
  const normalizedPosition = String(currentPosition || '').trim();
  if (!normalizedPosition) return null;

  const ordered = [...milestones].sort(
    (left, right) =>
      new Date(right.recordedAt || right.createdAt || 0).getTime() -
      new Date(left.recordedAt || left.createdAt || 0).getTime(),
  );
  return (
    ordered.find((milestone) => String(milestone.note || '').trim() === normalizedPosition) ||
    null
  );
}
