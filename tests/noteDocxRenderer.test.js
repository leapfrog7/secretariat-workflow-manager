import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildNoteDocxDocument } from '../src/features/noting/renderers/noteDocxRenderer.js';
import { plainTextToNoteRichText } from '../src/features/noting/noteUtils.js';

test('Note DOCX preserves continuous numbered paragraphs and editable wording', async () => {
  const document = buildNoteDocxDocument({
    richText: plainTextToNoteRichText('1. First finding.\n\n2. Second finding.\n\n3. Proposed course.'),
  });
  const blob = await Packer.toBlob(document);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const archive = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml = await archive.file('word/document.xml').async('string');
  const numbering = await archive.file('word/numbering.xml').async('string');

  assert.match(xml, /First finding/);
  assert.match(xml, /Second finding/);
  assert.match(xml, /Proposed course/);
  assert.equal((xml.match(/w:numPr/g) || []).length, 6);
  assert.match(numbering, /%1\./);
});

test('Note DOCX preserves a selected government numbering sequence and format', async () => {
  const document = buildNoteDocxDocument({
    richText: {
      type: 'doc',
      content: [{
        type: 'orderedList',
        attrs: { start: 3, numberingStyle: 'lowerRoman' },
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Consideration' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Recommendation' }] }] },
        ],
      }],
    },
  });
  const blob = await Packer.toBlob(document);
  const archive = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const numbering = await archive.file('word/numbering.xml').async('string');

  assert.match(numbering, /w:val="lowerRoman"/);
  assert.match(numbering, /w:start w:val="3"/);
  assert.match(numbering, /\(%1\)/);
});

test('Note DOCX exports page boundaries and nested numbering', async () => {
  const document = buildNoteDocxDocument({
    richText: {
      type: 'doc',
      content: [{
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [
            { type: 'paragraph', attrs: { pageBreakBefore: true }, content: [{ type: 'text', text: 'Main point' }] },
            { type: 'orderedList', attrs: { numberingStyle: 'lowerAlpha' }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested point' }] }] }] },
          ],
        }],
      }],
    },
  });
  const blob = await Packer.toBlob(document);
  const archive = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml = await archive.file('word/document.xml').async('string');
  const numbering = await archive.file('word/numbering.xml').async('string');
  assert.match(xml, /w:pageBreakBefore/);
  assert.match(xml, /Nested point/);
  assert.match(numbering, /w:val="lowerLetter"/);
});

test('Note DOCX exports paragraph ruler indents', async () => {
  const document = buildNoteDocxDocument({
    richText: {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { indent: 2, firstLineIndent: -1, rightIndent: 2 }, content: [{ type: 'text', text: 'Ruler paragraph' }] }],
    },
  });
  const blob = await Packer.toBlob(document);
  const archive = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml = await archive.file('word/document.xml').async('string');
  const position = xml.indexOf('Ruler paragraph');
  const paragraph = xml.slice(xml.lastIndexOf('<w:p', position), xml.indexOf('</w:p>', position));
  assert.match(paragraph, /w:left="720"/);
  assert.match(paragraph, /w:hanging="284"/);
  assert.match(paragraph, /w:right="568"/);
});
