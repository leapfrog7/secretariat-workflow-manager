import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCompleteCloudCollection, IncompleteCloudCollectionError } from '../src/features/cloud/cloudPagination.js';

test('cloud pagination returns a collection only after every counted page arrives', async () => {
  const source = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));
  const calls = [];
  const result = await fetchCompleteCloudCollection(async ({ from, to, includeCount }) => {
    calls.push({ from, to, includeCount });
    return { data: source.slice(from, to + 1), count: includeCount ? source.length : null, error: null };
  }, { pageSize: 3 });

  assert.deepEqual(result, source);
  assert.deepEqual(calls, [
    { from: 0, to: 2, includeCount: true },
    { from: 3, to: 5, includeCount: false },
    { from: 6, to: 8, includeCount: false },
  ]);
});

test('cloud pagination rejects a partial response before it can become authoritative', async () => {
  await assert.rejects(
    fetchCompleteCloudCollection(async ({ from, includeCount }) => ({
      data: from === 0 ? [{ id: 1 }, { id: 2 }] : [],
      count: includeCount ? 5 : null,
      error: null,
    }), { pageSize: 3 }),
    (error) => error instanceof IncompleteCloudCollectionError
      && error.expectedCount === 5
      && error.receivedCount === 2,
  );
});

test('cloud pagination fails closed when the server does not provide an exact count', async () => {
  await assert.rejects(
    fetchCompleteCloudCollection(async () => ({ data: [], count: null, error: null })),
    /could not verify the collection size/i,
  );
});
