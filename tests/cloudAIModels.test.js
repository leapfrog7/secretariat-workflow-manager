import test from 'node:test';
import assert from 'node:assert/strict';
import { getGeminiTaskLevel, normalizeGeminiTaskLevel } from '../shared/cloudAIModels.js';

test('Gemini task routing uses supported generation models', () => {
  assert.deepEqual(
    ['simple', 'moderate', 'hard'].map((level) => getGeminiTaskLevel(level).model),
    ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.6-flash'],
  );
});

test('Gemini task routing scales reasoning effort with complexity', () => {
  assert.deepEqual(
    ['simple', 'moderate', 'hard'].map((level) => getGeminiTaskLevel(level).thinkingLevel),
    ['minimal', 'medium', 'high'],
  );
});

test('unknown Gemini task levels remain moderate by default', () => {
  assert.equal(normalizeGeminiTaskLevel('unknown'), 'moderate');
});
