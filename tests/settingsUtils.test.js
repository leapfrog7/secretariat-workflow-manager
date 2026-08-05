import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsScopeChanges } from '../src/utils/settingsUtils.js';

const settings = {
  categories: ['Miscellaneous'],
  officeProfile: { ministry: 'Example Ministry' },
  localAI: { baseUrl: '/lmstudio', model: 'local-model' },
  aiPreferences: { mode: 'local', cloudProvider: 'gemini', geminiTaskLevel: 'moderate' },
  reminders: { inAppEnabled: true },
  appearance: { textSize: 'normal' },
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

test('changing text size advances the personal settings scope', () => {
  const next = {
    ...settings,
    appearance: { textSize: 'large' },
  };
  assert.deepEqual(settingsScopeChanges(settings, next), {
    workspaceChanged: false,
    userChanged: true,
  });
});

test('changing the device-specific Local AI connection does not advance cloud user settings', () => {
  const next = {
    ...settings,
    localAI: { baseUrl: 'http://127.0.0.1:1234', model: 'another-local-model' },
  };
  assert.deepEqual(settingsScopeChanges(settings, next), {
    workspaceChanged: false,
    userChanged: false,
  });
});
