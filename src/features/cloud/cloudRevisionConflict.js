export class CloudRevisionConflict extends Error {
  constructor({ entityType, itemId, issueId, localPayload, cloudResult, operation = 'save' }) {
    super('Another device or user saved a newer version while you were working. Review both versions before continuing.');
    this.name = 'CloudRevisionConflict';
    this.conflict = {
      entityType,
      itemId,
      issueId,
      operation,
      localPayload,
      cloudPayload: cloudResult?.payload || null,
      cloudRevision: Number(cloudResult?.revision || 0),
      cloudUpdatedAt: cloudResult?.updated_at || '',
      cloudUpdatedBy: cloudResult?.updated_by || '',
    };
  }
}

export function isCloudRevisionConflict(error) {
  return error?.name === 'CloudRevisionConflict' && Boolean(error.conflict);
}
