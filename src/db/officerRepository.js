import { db } from './database';
import { normalizeOfficer, validateOfficer } from '../utils/officerUtils';
import { getOfficerIdentityKey } from '../utils/officerIdentity';
import { queueCloudOfficerUpsert } from '../features/cloud/cloudOfficerSync';
import { consolidateDuplicateOfficers } from './officerDeduplication';

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
  const { officers } = await consolidateDuplicateOfficers();
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
  let reusedExisting = false;
  const officer = await db.transaction('rw', db.officers, async () => {
    const now = new Date().toISOString();
    const candidate = requireValidOfficer({
      ...input,
      id: input.id || crypto.randomUUID(),
      createdAt: input.createdAt || now,
      updatedAt: now,
    });
    const equivalent = (await db.officers.toArray())
      .map(normalizeOfficer)
      .find((item) => item.id !== input.id && getOfficerIdentityKey(item) === getOfficerIdentityKey(candidate));
    if (equivalent) {
      if (input.id) throw new Error('An identical officer entry already exists.');
      reusedExisting = true;
      return equivalent;
    }
    await db.officers.put(candidate);
    return candidate;
  });
  if (!reusedExisting) queueCloudOfficerUpsert(officer);
  return reusedExisting ? { ...officer, reusedExisting: true } : officer;
}

export async function getOfficerStatistics() {
  const officers = await getAllOfficers();
  return {
    total: officers.length,
    active: officers.filter((officer) => officer.isActive).length,
    inactive: officers.filter((officer) => !officer.isActive).length,
  };
}
