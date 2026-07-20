import { db } from './database';
import { normalizeOfficer, validateOfficer } from '../utils/officerUtils';

function requireValidOfficer(input) {
  const officer = normalizeOfficer(input);
  const errors = validateOfficer(officer);
  if (Object.keys(errors).length) {
    const error = new Error('Officer validation failed.');
    error.validationErrors = errors;
    throw error;
  }
  return officer;
}

export async function getAllOfficers({ includeInactive = true } = {}) {
  const officers = (await db.officers.toArray()).map(normalizeOfficer);
  return officers
    .filter((officer) => includeInactive || officer.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOfficerById(id) {
  if (!id) return null;
  const officer = await db.officers.get(id);
  return officer ? normalizeOfficer(officer) : null;
}

export async function saveOfficer(input) {
  const now = new Date().toISOString();
  const officer = requireValidOfficer({
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || now,
    updatedAt: now,
  });
  await db.officers.put(officer);
  return officer;
}

export async function getOfficerStatistics() {
  const officers = await getAllOfficers();
  return {
    total: officers.length,
    active: officers.filter((officer) => officer.isActive).length,
    inactive: officers.filter((officer) => !officer.isActive).length,
  };
}
