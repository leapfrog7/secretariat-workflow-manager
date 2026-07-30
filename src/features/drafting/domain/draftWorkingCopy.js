export const EMPTY_DRAFT_WORKING_COPY = Object.freeze({
  mode: 'empty',
  baseDraftId: '',
  baseVersion: 0,
  dirty: false,
  configurationDirty: false,
});

export function createGeneratedWorkingCopy() {
  return {
    mode: 'working',
    baseDraftId: '',
    baseVersion: 0,
    dirty: true,
    configurationDirty: false,
  };
}

export function createSavedWorkingCopy(draft) {
  return {
    mode: 'working',
    baseDraftId: draft?.id || '',
    baseVersion: Number(draft?.version || 0),
    dirty: false,
    configurationDirty: false,
  };
}

export function markWorkingCopyChanged(workingCopy, { configuration = false } = {}) {
  if (workingCopy?.mode !== 'working') return workingCopy;
  return {
    ...workingCopy,
    dirty: true,
    configurationDirty: Boolean(workingCopy.configurationDirty || configuration),
  };
}

export function hasUnsavedWorkingCopy(workingCopy) {
  return workingCopy?.mode === 'working' && Boolean(workingCopy.dirty);
}
