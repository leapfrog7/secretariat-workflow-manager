export const CLOUD_PAGE_SIZE = 250;

export class IncompleteCloudCollectionError extends Error {
  constructor({ expectedCount, receivedCount }) {
    super(`Cloud synchronization returned ${receivedCount} of ${expectedCount} records.`);
    this.name = 'IncompleteCloudCollectionError';
    this.expectedCount = expectedCount;
    this.receivedCount = receivedCount;
  }
}

export async function fetchCompleteCloudCollection(fetchPage, { pageSize = CLOUD_PAGE_SIZE } = {}) {
  const rows = [];
  let expectedCount = null;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetchPage({
      from: offset,
      to: offset + pageSize - 1,
      includeCount: offset === 0,
    });
    if (response.error) throw response.error;
    const page = Array.isArray(response.data) ? response.data : [];
    if (offset === 0) {
      expectedCount = response.count === null || response.count === undefined
        ? Number.NaN
        : Number(response.count);
      if (!Number.isSafeInteger(expectedCount) || expectedCount < 0) {
        throw new Error('Cloud synchronization could not verify the collection size.');
      }
    }
    rows.push(...page);

    if (rows.length >= expectedCount || page.length < pageSize) break;
  }

  if (rows.length !== expectedCount) {
    throw new IncompleteCloudCollectionError({ expectedCount, receivedCount: rows.length });
  }
  return rows;
}
