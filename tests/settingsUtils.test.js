import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsScopeChanges } from '../src/utils/settingsUtils.js';

const settings = {
  categories: ['Miscellaneous'],
  officeProfile: { ministry: 'Example Ministry' },
  localAI: { baseUrl: '/lmstudio', model: 'local-model' },
  aiPreferences: { mode: 'local', cloudProvider: 'gemini', geminiTaskLevel: 'moderate' },
  reminders: { inAppEnabled: true },
};

test('changing only AI provider preferences advances the user settings scope', () => {
  const next = {
    ...settings,
    aiPreferences: { ...settings.aiPreferences, mode: 'cloud', geminiTaskLevel: 'hard' },
  };
  assert.deepEqual(settingsScopeChanges(settings, next), {
    workspaceChanged: false,
    userChanged: true,
  });
});

test('workspace profile changes do not incorrectly advance personal settings', () => {
  const next = {
    ...settings,
    officeProfile: { ministry: 'Another Ministry' },
  };
  assert.deepEqual(settingsScopeChanges(settings, next), {
    workspaceChanged: true,
    userChanged: false,
  });
});
