import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('source-first note preparation is visible before the editor', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  const entry = noting.indexOf('Start from source material');
  const editor = noting.indexOf('<NoteEditor');
  assert.ok(entry >= 0 && editor > entry);
  assert.match(noting, /Choose a file/);
  assert.match(noting, /Paste source text/);
  assert.match(noting, /Add source/);
  assert.match(noting, /Use Issue records/);
  assert.match(noting, /Use this text/);
  assert.match(noting, /sourceType: 'pasted'/);
  assert.match(noting, /It remains temporary and is not saved with the Issue/);
  assert.match(noting, /Prepare note from source/);
  assert.match(noting, /More guidance/);
  assert.match(noting, /\.pdf,.doc,.docx,.txt,.md/);
  assert.doesNotMatch(noting, /const readPdf =/);
  assert.doesNotMatch(noting, /const readSourceDocument =/);
});

test('AI preparation dialog is wide and mobile-safe', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  assert.match(noting, /maxWidth="max-w-6xl"/);
  assert.match(noting, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(noting, /min-h-11 w-full[\s\S]*sm:w-auto/);
  assert.match(noting, />Stop<\/button>/);
  assert.match(noting, /Change document/);
});

test('reviewed PDF continues directly into note preparation', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  const pdf = source('src/features/noting/pdf/PdfContextDialog.jsx');
  assert.match(pdf, /Use and prepare note/);
  assert.match(pdf, /safe-area-inset-bottom/);
  assert.match(pdf, /min-h-11/);
  assert.match(noting, /onAttach=\{\(contextFile\) => \{[\s\S]*setAIAction\('prepare'\);[\s\S]*setAIDialogOpen\(true\);/);
});

test('OCR review exposes cleanup metrics and the original recognized text', () => {
  const pdf = source('src/features/noting/pdf/PdfContextDialog.jsx');
  assert.match(pdf, /OCR cleanup applied/);
  assert.match(pdf, /Show original OCR/);
  assert.match(pdf, /Restore cleaned OCR/);
  assert.match(pdf, /removedCharacterCount/);
  assert.match(pdf, /rawMarkdown/);
});
