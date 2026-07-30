import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { buildDraftDocx } from '../src/features/drafting/renderers/draftDocxRenderer.js';
import { createDraftDocument, legacyDraftToDocument, replaceDraftBodyRichText } from '../src/features/drafting/domain/draftDocument.js';

async function documentXml(blob) {
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 2)], [0x50, 0x4b]);
  const archive = await JSZip.loadAsync(bytes);
  return archive.file('word/document.xml').async('string');
}

test('structured Office Memorandum DOCX applies title, subject and alignment rules', async () => {
  const document = createDraftDocument({
    communicationType: 'Office Memorandum',
    metadata: {
      subject: 'Monthly progress report',
      communicationNumber: 'A-12/2026',
      issueDate: '2026-07-28',
      recipient: { organization: 'Department of Expenditure' },
      signatoryId: 'officer-1',
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      officeProfile: { governmentName: 'Government of India', ministry: 'Ministry of Testing', placeOfIssue: 'New Delhi' },
    },
    body: 'The undersigned is directed to request the monthly progress report.',
    bodySource: 'ai',
  });
  const xml = await documentXml(await buildDraftDocx(document));
  assert.match(xml, /OFFICE MEMORANDUM/);
  assert.match(xml, /Subject: Monthly progress report/);
  assert.match(xml, /Department of Expenditure/);
  assert.match(xml, /w:jc w:val="center"/);
  assert.match(xml, /w:jc w:val="right"/);
  assert.match(xml, /<w:b\/>/);
  const numberPosition = xml.indexOf('A-12/2026');
  const numberParagraph = xml.slice(
    xml.lastIndexOf('<w:p', numberPosition),
    xml.indexOf('</w:p>', numberPosition),
  );
  assert.match(numberParagraph, /w:jc w:val="center"/);
});

test('legacy draft DOCX preserves original content without unsafe structural inference', async () => {
  const legacy = legacyDraftToDocument('Legacy heading\n\nLegacy body.', 'Letter');
  const xml = await documentXml(await buildDraftDocx(legacy));
  assert.match(xml, /Legacy heading/);
  assert.match(xml, /Legacy body/);
});

test('DOCX export preserves rich body emphasis, alignment and numbering', async () => {
  const base = createDraftDocument({
    communicationType: 'Letter',
    metadata: {
      subject: 'Formatted draft',
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      officeProfile: { governmentName: 'Government of India' },
    },
    body: 'Initial body.',
  });
  const document = replaceDraftBodyRichText(base, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{
          type: 'text',
          text: 'Emphasised text',
          marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }],
        }],
      },
      {
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Numbered action' }] }],
        }],
      },
    ],
  });

  const xml = await documentXml(await buildDraftDocx(document));
  assert.match(xml, /Emphasised text/);
  assert.match(xml, /<w:b\/>/);
  assert.match(xml, /<w:i\/>/);
  assert.match(xml, /<w:u w:val="single"\/>/);
  assert.match(xml, /w:jc w:val="center"/);
  assert.match(xml, /<w:numPr>/);
});

test('DOCX export preserves body tables and recipient indentation', async () => {
  const base = createDraftDocument({
    communicationType: 'Letter',
    metadata: {
      subject: 'Tabulated position',
      recipient: { organization: 'Department of Examples' },
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      officeProfile: { governmentName: 'Government of India' },
    },
    styleProfile: { recipientIndent: 'standard' },
    body: 'Initial body.',
  });
  const document = replaceDraftBodyRichText(base, {
    type: 'doc',
    content: [{
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Position' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Monthly return' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pending' }] }] },
          ],
        },
      ],
    }],
  });
  const xml = await documentXml(await buildDraftDocx(document));
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /Monthly return/);
  assert.match(xml, /Pending/);
  const recipientPosition = xml.indexOf('Department of Examples');
  const recipientParagraph = xml.slice(xml.lastIndexOf('<w:p', recipientPosition), xml.indexOf('</w:p>', recipientPosition));
  assert.match(recipientParagraph, /w:left="720"/);
  const toPosition = xml.indexOf('>To<');
  const toParagraph = xml.slice(xml.lastIndexOf('<w:p', toPosition), xml.indexOf('</w:p>', toPosition));
  assert.doesNotMatch(toParagraph, /w:left=/);
  assert.match(xml, /<w:pgMar[^>]*w:top="1080"[^>]*w:right="1080"[^>]*w:bottom="1080"[^>]*w:left="1080"/);
});

test('new drafts use a small recipient indent and narrow margins when selected', async () => {
  const document = createDraftDocument({
    communicationType: 'Letter',
    metadata: {
      subject: 'Margin check',
      recipient: { organization: 'Department of Examples' },
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      officeProfile: { governmentName: 'Government of India' },
    },
    styleProfile: { margins: 'narrow' },
    body: 'Body text.',
  });
  const xml = await documentXml(await buildDraftDocx(document));
  const recipientPosition = xml.indexOf('Department of Examples');
  const recipientParagraph = xml.slice(xml.lastIndexOf('<w:p', recipientPosition), xml.indexOf('</w:p>', recipientPosition));
  assert.match(recipientParagraph, /w:left="360"/);
  assert.match(xml, /<w:pgMar[^>]*w:top="720"[^>]*w:right="720"[^>]*w:bottom="720"[^>]*w:left="720"/);
});
