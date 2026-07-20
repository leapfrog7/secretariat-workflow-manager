import { differenceInCalendarDays, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { createExportFilename, exportDatabase, importDatabase } from './issueRepository';
import { getSettings, saveSettings } from './database';
import { APP_NAME, DB_NAME, DB_VERSION } from '../constants/issueConstants';

export { createExportFilename, exportDatabase, importDatabase };

const CURRENT_TABLES = ['issues', 'records', 'actions', 'communications', 'references', 'issueMilestones', 'issueSummaries', 'officers', 'chronology', 'settings'];

export async function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file.');
  if (!payload.metadata || typeof payload.metadata !== 'object') throw new Error('Backup metadata is missing.');
  if (payload.metadata.application && payload.metadata.application !== APP_NAME) {
    throw new Error('Backup does not belong to this application.');
  }
  if (!payload.metadata.schemaVersion) {
    throw new Error('Backup schema metadata is missing.');
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('Backup data is missing.');
  }
  const schemaVersion = Number(payload.metadata.schemaVersion);
  const requiredTables = CURRENT_TABLES.filter((table) => {
    if (schemaVersion < 7 && ['communications', 'references'].includes(table)) return false;
    if (schemaVersion < 8 && table === 'issueMilestones') return false;
    if (schemaVersion < 9 && table === 'issueSummaries') return false;
    return true;
  });
  for (const table of requiredTables) {
    if (!(table in payload.data)) {
      throw new Error(`Backup is missing the ${table} table.`);
    }
  }
  for (const table of requiredTables.filter((table) => table !== 'settings')) {
    if (!Array.isArray(payload.data[table])) {
      throw new Error(`Backup ${table} table must be an array.`);
    }
  }
  return true;
}

export async function buildBackupPayload() {
  const payload = await exportDatabase();
  return {
    ...payload,
    metadata: {
      ...payload.metadata,
      application: APP_NAME,
      databaseName: DB_NAME,
      schemaVersion: DB_VERSION,
      tables: CURRENT_TABLES,
      backupFormatVersion: 1,
    },
  };
}

export function downloadBackup(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = createExportFilename();
  link.click();
  URL.revokeObjectURL(url);
}

export async function saveBackupToLocalFile(payload) {
  if (typeof window === 'undefined' || !('showSaveFilePicker' in window)) {
    downloadBackup(payload);
    return { usedFallback: true };
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: createExportFilename(),
    types: [
      {
        description: 'JSON backup',
        accept: { 'application/json': ['.json'] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
  return { usedFallback: false };
}

export async function markBackupSuccessful() {
  const settings = await getSettings();
  const next = await saveSettings({ ...settings, lastBackupAt: new Date().toISOString() });
  return next.lastBackupAt;
}

export async function getBackupStatus() {
  const settings = await getSettings();
  const lastBackupAt = settings.lastBackupAt || '';
  const parsedLastBackup = lastBackupAt ? parseISO(lastBackupAt) : null;
  const hasValidBackupDate = parsedLastBackup && isValid(parsedLastBackup);
  const daysSinceBackup = hasValidBackupDate ? differenceInCalendarDays(new Date(), parsedLastBackup) : null;
  return {
    lastBackupAt,
    lastBackupText: hasValidBackupDate ? formatDistanceToNow(parsedLastBackup, { addSuffix: true }) : 'No successful backup recorded',
    backupWarning: !hasValidBackupDate || daysSinceBackup > 7,
  };
}

export async function getBrowserStorageStatus() {
  const storage = typeof navigator === 'undefined' ? null : navigator.storage;
  if (!storage) {
    return {
      supported: false,
      persisted: false,
      usage: null,
      quota: null,
    };
  }
  const [persisted, estimate] = await Promise.all([
    storage.persisted ? storage.persisted() : Promise.resolve(false),
    storage.estimate ? storage.estimate() : Promise.resolve({}),
  ]);
  return {
    supported: true,
    persisted,
    usage: estimate.usage ?? null,
    quota: estimate.quota ?? null,
  };
}

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export function formatBytes(value) {
  if (value == null) return 'Not available';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
