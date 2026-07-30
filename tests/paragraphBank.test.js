import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canManageParagraphBankEntry,
  extractParagraphPlaceholders,
  normalizeParagraphBankEntry,
  searchParagraphBank,
  validateParagraphBankEntry,
} from '../src/features/drafting/paragraphBank/paragraphBankUtils.js';

test('paragraph placeholders, tags and scope are normalized deterministically', () => {
  const entry = normalizeParagraphBankEntry({
    id: 'paragraph-1',
    title: ' First reminder ',
    content: 'Kindly furnish the information by [DATE] to [ORGANIZATION]. Repeat [DATE].',
    tags: ' reminder, information, reminder ',
    communicationTypes: ['Letter', 'Letter'],
    scope: 'personal',
  }, 'user-1');

  assert.equal(entry.title, 'First reminder');
  assert.deepEqual(entry.tags, ['reminder', 'information']);
  assert.deepEqual(entry.communicationTypes, ['Letter']);
  assert.deepEqual(entry.placeholders, ['DATE', 'ORGANIZATION']);
  assert.equal(entry.ownerUserId, 'user-1');
  assert.deepEqual(extractParagraphPlaceholders('Use [FILE NO.] and [DATE].'), ['FILE NO.', 'DATE']);
});

test('paragraph bank validation protects required content and oversized text', () => {
  assert.deepEqual(validateParagraphBankEntry({ scope: 'personal' }), {
    title: 'Enter a short name for this paragraph.',
    content: 'Enter the reusable paragraph text.',
    scope: 'Personal paragraphs require a signed-in owner.',
  });
  assert.equal(validateParagraphBankEntry({
    title: 'Long paragraph',
    content: 'x'.repeat(6001),
    scope: 'workspace',
  }).content, 'Keep a reusable paragraph below 6,000 characters.');
});

test('search respects communication type while retaining paragraphs available to all types', () => {
  const entries = [
    normalizeParagraphBankEntry({ id: 'a', title: 'Letter reminder', content: 'Reminder wording', category: 'Reminder', communicationTypes: ['Letter'], scope: 'workspace' }, 'admin'),
    normalizeParagraphBankEntry({ id: 'b', title: 'General request', content: 'Furnish information', category: 'Information request', tags: ['details'], scope: 'personal' }, 'user'),
    normalizeParagraphBankEntry({ id: 'c', title: 'Retired', content: 'Old wording', status: 'retired' }, 'user'),
  ];

  assert.deepEqual(searchParagraphBank(entries, { communicationType: 'Office Memorandum' }).map((entry) => entry.id), ['b']);
  assert.deepEqual(searchParagraphBank(entries, { query: 'details' }).map((entry) => entry.id), ['b']);
  assert.deepEqual(searchParagraphBank(entries, { category: 'Reminder', communicationType: 'Letter' }).map((entry) => entry.id), ['a']);
});

test('common addresses remain searchable Paragraph Bank entries', () => {
  const address = normalizeParagraphBankEntry({
    id: 'address-1',
    title: 'Department of Expenditure',
    content: 'North Block\nNew Delhi - 110001',
    category: 'Address / addressee',
    scope: 'workspace',
  }, 'admin');

  assert.equal(address.category, 'Address / addressee');
  assert.deepEqual(searchParagraphBank([address], { query: 'North Block' }).map((entry) => entry.id), ['address-1']);
  assert.deepEqual(searchParagraphBank([address], { category: 'Address / addressee' }).map((entry) => entry.id), ['address-1']);
});

test('shared paragraph management is administrative while personal entries remain owner-managed', () => {
  const personal = { scope: 'personal', ownerUserId: 'user-1' };
  const shared = { scope: 'workspace', ownerUserId: 'admin' };
  assert.equal(canManageParagraphBankEntry(personal, { mode: 'cloud', userId: 'user-1', isWorkspaceAdmin: false }), true);
  assert.equal(canManageParagraphBankEntry(personal, { mode: 'cloud', userId: 'user-2', isWorkspaceAdmin: true }), false);
  assert.equal(canManageParagraphBankEntry(shared, { mode: 'cloud', userId: 'user-1', isWorkspaceAdmin: false }), false);
  assert.equal(canManageParagraphBankEntry(shared, { mode: 'cloud', userId: 'admin', isWorkspaceAdmin: true }), true);
});
