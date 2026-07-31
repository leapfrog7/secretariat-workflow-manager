import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLOUD_RUN_AI_API_BASE_URL,
  resolveCloudAIBaseUrl,
} from '../src/utils/cloudAIUrl.js';

test('Cloud AI defaults to the deployed Cloud Run service', () => {
  assert.equal(resolveCloudAIBaseUrl(''), CLOUD_RUN_AI_API_BASE_URL);
  assert.equal(resolveCloudAIBaseUrl('not a url'), CLOUD_RUN_AI_API_BASE_URL);
});

test('the retired Vercel AI origin is migrated to Cloud Run', () => {
  assert.equal(
    resolveCloudAIBaseUrl('https://secretariat-workflow-manager.vercel.app/'),
    CLOUD_RUN_AI_API_BASE_URL,
  );
});

test('local development and future custom API origins remain supported', () => {
  assert.equal(resolveCloudAIBaseUrl('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000');
  assert.equal(resolveCloudAIBaseUrl('https://api.example.gov.in/'), 'https://api.example.gov.in');
});
