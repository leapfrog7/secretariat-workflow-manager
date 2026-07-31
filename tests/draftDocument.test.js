import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changeDraftDocumentTemplate,
  createDraftDocument,
  legacyDraftToDocument,
  normalizeDraftDocument,
  renderDraftClipboardText,
  renderDraftDocumentText,
  renderStructuredDraft,
  replaceDraftBodyRichText,
  validateDraftDocument,
} from '../src/features/drafting/domain/draftDocument.js';
import { COMMUNICATION_TYPES, getDraftTemplate } from '../src/features/drafting/templates/templateRegistry.js';
import { formatGovernmentCommunication, validateGovernmentCommunication } from '../src/utils/governmentDraftUtils.js';

test('every communication type has a versioned deterministic template', () => {
  assert.equal(COMMUNICATION_TYPES.length, 11);
  COMMUNICATION_TYPES.forEach((communicationType) => {
    const template = getDraftTemplate(communicationType);
    assert.equal(template.version, 1);
    assert.ok(template.bodyInstruction);
    assert.ok(template.blocks.some((block) => block.role === 'body'));
  });
  const memorandum = getDraftTemplate('Office Memorandum');
  assert.deepEqual(
    memorandum.blocks.find((block) => block.role === 'subject'),
    { role: 'subject', alignment: 'left', bold: true, uppercase: false, required: true },
  );
  assert.equal(memorandum.blocks.find((block) => block.role === 'documentTitle').alignment, 'center');
  assert.equal(memorandum.blocks.find((block) => block.role === 'communicationNumber').alignment, 'center');
  assert.equal(memorandum.blocks.find((block) => block.role === 'signature').alignment, 'right');
  assert.match(memorandum.bodyInstruction, /third-person institutional voice/);
  assert.match(memorandum.bodyInstruction, /undersigned is directed/);
  assert.match(getDraftTemplate('Letter').bodyInstruction, /first-person official voice/);
  assert.match(getDraftTemplate('D.O. Letter').bodyInstruction, /personal, friendly and professional/);
  assert.match(getDraftTemplate('Office Order').bodyInstruction, /third-person institutional voice/);

  COMMUNICATION_TYPES.forEach((communicationType) => {
    const numberBlock = getDraftTemplate(communicationType).blocks.find((block) => block.role === 'communicationNumber');
    if (numberBlock) assert.equal(numberBlock.alignment, 'center', communicationType);
  });
});

test('legacy drafts retain their complete original text', () => {
  const content = 'No. A-1\n\nOFFICE MEMORANDUM\n\nSubject: Test\n\nExisting body.';
  const document = legacyDraftToDocument(content, 'Office Memorandum');
  assert.equal(document.blocks[0].role, 'legacyDocument');
  assert.equal(renderDraftDocumentText(document), content);
  assert.deepEqual(normalizeDraftDocument(document), document);
});

test('new draft documents separate body paragraphs and retain a style snapshot', () => {
  const document = createDraftDocument({
    communicationType: 'Letter',
    metadata: { subject: 'Monthly return', communicationNumber: 'A-12', signatoryId: 'officer-1' },
    body: 'First paragraph.\n\nSecond paragraph.',
    bodySource: 'ai',
    styleProfile: { fontFamily: 'Arial', fontSize: 11 },
  });
  assert.deepEqual(document.blocks.map((block) => block.content), ['First paragraph.', 'Second paragraph.']);
  assert.ok(document.blocks.every((block) => block.source === 'ai'));
  assert.equal(document.styleProfileSnapshot.fontFamily, 'Arial');
  assert.equal(document.styleProfileSnapshot.fontSize, 11);
  assert.equal(renderDraftDocumentText(document), 'First paragraph.\n\nSecond paragraph.');
  assert.equal(validateDraftDocument(document).valid, true);
});

test('validation reports missing body and unresolved placeholders without inventing values', () => {
  const empty = createDraftDocument({ communicationType: 'Office Memorandum' });
  const emptyResult = validateDraftDocument(empty);
  assert.equal(emptyResult.valid, false);
  assert.match(emptyResult.errors[0].message, /body paragraph/);

  const draft = createDraftDocument({
    communicationType: 'Letter',
    body: 'Comments may be supplied by [DATE].',
  });
  const result = validateDraftDocument(draft);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((warning) => warning.field === 'placeholders'));
});

test('draft readiness identifies missing issue details and clears after completion', () => {
  const incomplete = createDraftDocument({
    communicationType: 'Letter',
    body: 'Comments may be supplied after examination.',
  });
  const incompleteResult = validateDraftDocument(incomplete);
  assert.deepEqual(
    incompleteResult.warnings.map((warning) => warning.field),
    ['subject', 'communicationNumber', 'issueDate', 'recipient', 'signatoryId'],
  );

  const complete = createDraftDocument({
    communicationType: 'Letter',
    metadata: {
      subject: 'Submission of comments',
      communicationNumber: 'A-12/2026',
      issueDate: '2026-07-29',
      recipient: { organization: 'Department of Examples' },
      signatoryId: 'officer-1',
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
    },
    body: 'Comments may be supplied after examination.',
  });
  const completeResult = validateDraftDocument(complete);
  assert.equal(completeResult.valid, true);
  assert.deepEqual(completeResult.warnings, []);
});

test('a blank manual draft opens the complete official structure without AI', () => {
  const document = createDraftDocument({
    communicationType: 'Office Memorandum',
    metadata: {
      subject: 'Review of pending matters',
      officeProfile: {
        governmentName: 'Government of India',
        ministry: 'Ministry of Testing',
        placeOfIssue: 'New Delhi',
      },
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      recipient: { organization: 'Department of Examples' },
    },
    body: '[DRAFT BODY]',
    bodySource: 'user',
  });

  const rendered = renderStructuredDraft(document);
  const body = rendered.layout.blocks.find((block) => block.role === 'body');

  assert.match(rendered.text, /OFFICE MEMORANDUM/);
  assert.match(rendered.text, /Subject: Review of pending matters/);
  assert.equal(body.content, '[DRAFT BODY]');
  assert.equal(rendered.text.slice(body.start, body.end), '[DRAFT BODY]');
  assert.equal(document.blocks[0].source, 'user');
});

test('changing draft type preserves the substantive body and document metadata', () => {
  const letter = createDraftDocument({
    communicationType: 'Letter',
    metadata: {
      subject: 'Submission of comments',
      communicationNumber: 'A-12/2026',
      recipient: { organization: 'Department of Examples' },
      signatoryId: 'officer-1',
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      officeProfile: { governmentName: 'Government of India' },
    },
    body: 'The substantive body must remain unchanged.',
    styleProfile: { fontFamily: 'Arial', fontSize: 11 },
  });

  const memorandum = changeDraftDocumentTemplate(letter, 'Office Memorandum');
  const rendered = renderStructuredDraft(memorandum);

  assert.equal(memorandum.templateId, 'office-memorandum');
  assert.deepEqual(memorandum.blocks, letter.blocks);
  assert.deepEqual(memorandum.bodyRichText, letter.bodyRichText);
  assert.deepEqual(memorandum.metadata, letter.metadata);
  assert.deepEqual(memorandum.styleProfileSnapshot, letter.styleProfileSnapshot);
  assert.match(rendered.text, /OFFICE MEMORANDUM/);
  assert.match(rendered.text, /The substantive body must remain unchanged/);
  assert.doesNotMatch(rendered.text, /Yours faithfully/);
});

test('protected document details can be completed after drafting without changing the body', () => {
  const document = createDraftDocument({
    communicationType: 'Letter',
    metadata: {
      subject: '',
      communicationNumber: '',
      recipient: {},
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      officeProfile: { governmentName: 'Government of India' },
    },
    body: 'The substantive draft remains unchanged.',
    bodySource: 'user',
  });
  const completed = {
    ...document,
    metadata: {
      ...document.metadata,
      subject: 'Submission of monthly return',
      communicationNumber: 'A-12/2026',
      recipient: {
        name: 'The Director',
        organization: 'Department of Examples',
        address: 'New Delhi',
      },
    },
  };
  const rendered = renderStructuredDraft(completed);

  assert.match(rendered.text, /A-12\/2026/);
  assert.match(rendered.text, /Subject: Submission of monthly return/);
  assert.match(rendered.text, /Department of Examples/);
  assert.match(rendered.text, /The substantive draft remains unchanged/);
  assert.equal(completed.blocks[0].content, 'The substantive draft remains unchanged.');
});

test('rich body formatting is normalized without storing arbitrary HTML', () => {
  const document = createDraftDocument({
    communicationType: 'Letter',
    body: 'Initial text.',
  });
  const formatted = replaceDraftBodyRichText(document, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center', unsafe: 'ignored' },
        content: [{
          type: 'text',
          text: 'Important direction.',
          marks: [{ type: 'bold' }, { type: 'underline' }, { type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }],
      },
      {
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First action.' }] }],
        }],
      },
    ],
  });

  assert.equal(formatted.blocks[0].content, 'Important direction.');
  assert.equal(formatted.blocks[0].alignment, 'center');
  assert.equal(formatted.blocks[1].content, 'First action.');
  assert.equal(formatted.blocks[1].listType, 'ordered');
  assert.deepEqual(formatted.bodyRichText.content[0].content[0].marks, [{ type: 'bold' }, { type: 'underline' }]);
  assert.doesNotMatch(JSON.stringify(formatted), /javascript:/);
  assert.match(renderDraftClipboardText(formatted), /1\. First action\./);
});

test('every deterministic communication formatter retains its required structural markers', () => {
  COMMUNICATION_TYPES.forEach((communicationType) => {
    const text = formatGovernmentCommunication({
      communicationType,
      officeProfile: {
        governmentName: 'Government of India',
        ministry: 'Ministry of Testing',
        department: 'Department of Verification',
        placeOfIssue: 'New Delhi',
      },
      signatory: { name: 'A. Officer', designation: 'Section Officer' },
      recipient: { organization: 'Department of Expenditure' },
      subject: 'Test communication',
      fileNumber: 'A-12/2026',
      issueDate: '2026-07-28',
      body: 'The supplied matter is under consideration.',
    });
    const validation = validateGovernmentCommunication({ communicationType, text });
    assert.equal(validation.valid, true, `${communicationType}: ${validation.missing.join(', ')}`);
  });
});
