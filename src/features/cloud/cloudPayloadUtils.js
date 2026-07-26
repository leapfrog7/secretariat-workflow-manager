const LOCAL_METADATA_FIELDS = new Set([
  'accessLevel',
  'cloudRevision',
  'cloudUpdatedAt',
  'cloudUpdatedBy',
  'updatedAt',
]);

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !LOCAL_METADATA_FIELDS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, comparable(entry)]),
  );
}

export function cloudPayloadsMatch(left, right) {
  if (!left || !right) return false;
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}
