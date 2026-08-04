import assert from 'node:assert/strict';
import test from 'node:test';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { extractSourceDocument } from '../src/features/noting/document/documentTextExtraction.js';

function textFile(name, content) {
  return {
    name,
    size: new TextEncoder().encode(content).byteLength,
    text: async () => content,
  };
}

test('plain text and Markdown files become temporary source context', async () => {
  const text = await extractSourceDocument(textFile('facts.txt', 'First fact.\r\n\r\nSecond fact.'));
  const markdown = await extractSourceDocument(textFile('brief.md', '# Subject\n\nMaterial facts.'));

  assert.equal(text.sourceType, 'text');
  assert.equal(text.content, 'First fact.\n\nSecond fact.');
  assert.equal(markdown.sourceType, 'markdown');
  assert.match(markdown.content, /^# Subject/);
});

test('Word docx files are read locally into paragraph text', async () => {
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun('Background of the case')] }),
        new Paragraph({ children: [new TextRun('The proposal may be considered.')] }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(document);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const result = await extractSourceDocument({
    name: 'case-note.docx',
    size: buffer.byteLength,
    arrayBuffer: async () => arrayBuffer,
  });

  assert.equal(result.sourceType, 'word');
  assert.match(result.content, /Background of the case/);
  assert.match(result.content, /proposal may be considered/);
});

test('legacy Word doc files receive a clear conversion instruction', async () => {
  await assert.rejects(
    extractSourceDocument({ name: 'old-letter.doc', size: 100 }),
    /save it as \.docx/i,
  );
});
