import { db } from '../../../db/database';
import { queueParagraphBankDelete, queueParagraphBankUpsert } from './paragraphBankSync';
import { normalizeParagraphBankEntry, validateParagraphBankEntry } from './paragraphBankUtils';

export async function getParagraphBankEntries() {
  const entries = await db.paragraphBank.toArray();
  return entries.map((entry) => normalizeParagraphBankEntry(entry));
}

export async function saveParagraphBankEntry(input, ownerUserId = '') {
  const existing = input.id ? await db.paragraphBank.get(input.id) : null;
  const entry = normalizeParagraphBankEntry({
    ...existing,
    ...input,
    ownerUserId: input.scope === 'personal' ? (input.ownerUserId || ownerUserId) : (input.ownerUserId || ownerUserId),
    updatedAt: new Date().toISOString(),
    cloudPending: true,
  }, ownerUserId);
  const errors = validateParagraphBankEntry(entry);
  if (Object.keys(errors).length) {
    const error = new Error('Check the paragraph details.');
    error.validationErrors = errors;
    throw error;
  }
  await db.paragraphBank.put(entry);
  await queueParagraphBankUpsert(entry);
  return normalizeParagraphBankEntry(await db.paragraphBank.get(entry.id));
}

export async function deleteParagraphBankEntry(entry) {
  await db.paragraphBank.delete(entry.id);
  await queueParagraphBankDelete(entry);
}
