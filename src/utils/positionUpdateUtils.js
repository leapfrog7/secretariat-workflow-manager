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
