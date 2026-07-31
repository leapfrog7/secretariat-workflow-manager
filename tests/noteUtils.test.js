import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeNote,
  noteRevisionSnapshot,
  plainTextToNoteRichText,
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

test('AI note Markdown markers become clean rich-text formatting', () => {
  const richText = plainTextToNoteRichText([
    '# Examination',
    '**Facts:** The reference was received on 30 July 2026.',
    '---',
    '- **Action:** Obtain the missing report.',
  ].join('\n'));

  assert.equal(richText.content.length, 3);
  assert.equal(richText.content[0].content[0].text, 'Examination');
  assert.deepEqual(richText.content[0].content[0].marks, [{ type: 'bold' }]);
  assert.equal(richText.content[1].content[0].text, 'Facts:');
  assert.deepEqual(richText.content[1].content[0].marks, [{ type: 'bold' }]);
  assert.equal(richText.content[2].type, 'bulletList');
  assert.equal(richText.content[2].content[0].content[0].content[0].text, 'Action:');
});

test('AI note subject is normalized as one bold sentence-case label', () => {
  const richText = plainTextToNoteRichText('SUBJECT: Examination of the pending reference\n\nThe matter may be examined.');

  assert.equal(richText.content[0].content[0].text, 'Subject: Examination of the pending reference');
  assert.deepEqual(richText.content[0].content[0].marks, [{ type: 'bold' }]);
  assert.equal(richText.content[1].content[0].text, 'The matter may be examined.');
});
