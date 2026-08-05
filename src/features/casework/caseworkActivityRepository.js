import { db } from '../../db/database';
import { normalizeDraft } from '../../utils/draftUtils';
import { normalizeNote } from '../noting/noteUtils';
import { buildRecentCaseworkActivity } from './caseworkActivity';

export async function getRecentCaseworkActivity(issues, { limit = 5 } = {}) {
  if (!issues.length) return [];
  const [notes, drafts] = await Promise.all([
    db.notes.toArray(),
    db.drafts.toArray(),
  ]);
  return buildRecentCaseworkActivity(
    issues,
    notes.map(normalizeNote),
    drafts.map(normalizeDraft),
    limit,
  );
}
