import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeNote,
  noteRevisionSnapshot,
  validateNote,
} from '../src/features/noting/noteUtils.js';

test('notes retain safe rich text, tables and linked source identifiers', () => {
  const note = normalizeNote({
    issueId: 'issue-1',
    sequence: 2,
    linkedCommunicationIds: ['c-1', 'c-1'],
    linkedReferenceIds: ['r-1'],
    richText: {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Position' }] }] },
          ],
        }],
      }],
    },
  });
  assert.equal(note.content, '| Point | Position |');
  assert.deepEqual(note.linkedCommunicationIds, ['c-1']);
  assert.deepEqual(note.linkedReferenceIds, ['r-1']);
  assert.equal(note.richText.content[0].type, 'table');
  assert.deepEqual(validateNote(note), {});
});

test('note revision snapshots preserve the earlier wording and attribution', () => {
  const note = normalizeNote({
    issueId: 'issue-1',
    version: 3,
    authorUserId: 'user-1',
    authorName: 'Section Officer',
    updatedAt: '2026-07-29T10:00:00.000Z',
    richText: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Earlier examination.' }] }],
    },
  });
  const revision = noteRevisionSnapshot(note);
  assert.equal(revision.version, 3);
  assert.equal(revision.content, 'Earlier examination.');
  assert.equal(revision.editedByUserId, 'user-1');
  assert.equal(revision.editedByName, 'Section Officer');
});

test('notes retain bounded paragraph indentation and font size marks', () => {
  const note = normalizeNote({
    richText: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { indent: 3 },
        content: [{
          type: 'text',
          text: 'Indented examination.',
          marks: [{ type: 'fontSize', attrs: { size: 14 } }],
        }],
      }],
    },
  });

  assert.equal(note.richText.content[0].attrs.indent, 3);
  assert.deepEqual(note.richText.content[0].content[0].marks, [{
    type: 'fontSize',
    attrs: { size: 14 },
  }]);
});
