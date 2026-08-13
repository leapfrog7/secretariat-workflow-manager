import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeIssueReferenceLink, normalizeWorkspaceReference, validateWorkspaceReference } from '../src/utils/referenceUtils.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('workspace references separate reusable content from Issue relevance', () => {
  const reference = normalizeWorkspaceReference({ title: 'General Financial Rules', retainedText: 'Rule text', extracts: [{ title: 'Rule 157', content: 'Purchase without quotation.' }] });
  const link = normalizeIssueReferenceLink({ issueId: 'issue-1', referenceId: reference.id, relevanceNote: 'Applies to this procurement.', extractIds: [reference.extracts[0].id] });
  assert.equal(reference.retainedText, 'Rule text');
  assert.equal(link.relevanceNote, 'Applies to this procurement.');
  assert.equal(link.referenceId, reference.id);
});

test('reference validation bounds retained document text', () => {
  assert.equal(validateWorkspaceReference(normalizeWorkspaceReference({ title: '' })).title, 'Title is required.');
  const oversized = normalizeWorkspaceReference({ title: 'Large', retainedText: 'a'.repeat(2 * 1024 * 1024 + 1) });
  assert.match(validateWorkspaceReference(oversized).retainedText, /below 2 MB/);
});

test('Reference Library is routable and Issue references attach rather than duplicate', () => {
  assert.match(source('src/routes/AppRoutes.jsx'), /path: 'references'/);
  assert.match(source('src/components/issues/ReferenceTab.jsx'), /Attach from Reference Library/);
  assert.match(source('src/pages/ReferencesPage.jsx'), /PdfContextDialog/);
  assert.match(source('db/migrations/028_workspace_reference_library.sql'), /issue_reference_links/);
  assert.match(source('db/migrations/028_workspace_reference_library.sql'), /can_read_issue/);
});

test('reviewed PDF and OCR text is synchronized into the active reference editor', () => {
  const page = source('src/pages/ReferencesPage.jsx');
  assert.match(page, /onAttach=\{\(source\) => \{ setEditing\(\(current\) => \(\{ \.\.\.current, sourceName: source\.originalName, sourceType: source\.sourceType, retainedText: source\.content \}\)\)/);
  assert.match(page, /useEffect\(\(\) => \{\s*setForm\(normalizeWorkspaceReference\(value\)\);\s*\}, \[value\]\)/);
});

test('Reference PDF review offers distinct full-preview and highlighted-passage retention', () => {
  const dialog = source('src/features/noting/pdf/PdfContextDialog.jsx');
  const page = source('src/pages/ReferencesPage.jsx');
  assert.match(page, /selectionActions/);
  assert.match(dialog, /Retain highlighted text/);
  assert.match(dialog, /Retain all preview text/);
  assert.match(dialog, /content\.slice\(start, end\)/);
});

test('Issue reference attach and detach update locally before cloud synchronization', () => {
  const repository = source('src/db/referenceRepository.js');
  const sync = source('src/features/cloud/referenceLibrarySync.js');
  assert.match(repository, /db\.issueReferenceLinks\.put\(link\);\s*synchronizeInBackground\(queueIssueReferenceLinkUpsert\(link\)\)/);
  assert.match(repository, /db\.issueReferenceLinks\.delete\(linkId\);\s*if \(existing\) synchronizeInBackground/);
  assert.match(sync, /entityType: 'reference-link'/);
  assert.match(sync, /flushReferenceLinkDeletes/);
});
