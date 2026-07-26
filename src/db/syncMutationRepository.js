import { db } from './database';

function mutationId(entityType, itemId) {
  return `${entityType}:${itemId}`;
}

export async function rememberSyncMutation({
  entityType,
  itemId,
  issueId,
  operation = 'save',
}) {
  if (!entityType || !itemId) return null;
  const mutation = {
    id: mutationId(entityType, itemId),
    entityType,
    itemId,
    issueId: issueId || itemId,
    operation,
    createdAt: new Date().toISOString(),
  };
  await db.syncMutations.put(mutation);
  return mutation;
}

export async function clearSyncMutation(entityType, itemId) {
  await db.syncMutations.delete(mutationId(entityType, itemId));
}

export async function getSyncMutation(entityType, itemId) {
  return db.syncMutations.get(mutationId(entityType, itemId));
}

export async function getSyncMutationMap() {
  const mutations = await db.syncMutations.toArray();
  return new Map(mutations.map((mutation) => [mutation.id, mutation]));
}

export function syncMutationKey(entityType, itemId) {
  return mutationId(entityType, itemId);
}
