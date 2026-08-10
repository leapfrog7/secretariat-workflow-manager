import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDraftAIRequest,
  generateDraftBody,
  insertDraftBodyText,
  mapRichBodySelectionToDocument,
  normalizeAITextResponse,
  regenerateDraftBodySelection,
  renderStructuredDraft,
} from '../src/features/drafting/ai/draftAIOrchestrator.js';

const officeProfile = {
  governmentName: 'Government of India',
  ministry: 'Ministry of Testing',
  department: 'Department of Verification',
  placeOfIssue: 'New Delhi',
  documentStyle: { fontFamily: 'Arial', fontSize: 11 },
};
const signatory = { id: 'officer-1', name: 'A. Officer', designation: 'Section Officer' };
const recipient = { organization: 'Department of Expenditure' };
const documentDetails = {
  subject: 'Monthly report',
  fileNumber: 'A-12/2026',
  issueDate: '2026-07-28',
};

function fakeProvider(text) {
  const calls = [];
  return {
    id: 'fake:test',
    calls,
    async generateText(request) {
      calls.push(request);
      return { text, model: 'fake-model', stats: { outputTokens: 12 } };
    },
  };
}

async function generatedDraft(body = 'The monthly report may be furnished by 31 July 2026.') {
  const provider = fakeProvider(body);
  const result = await generateDraftBody({
    provider,
    context: 'The monthly report is due by 31 July 2026.',
    communicationType: 'Office Memorandum',
    officeProfile,
    signatory,
    recipient,
    recipientRelationship: 'Another Ministry / Department',
    draftMode: 'detailed',
    documentDetails,
    instruction: 'Request the monthly report.',
  });
  return { provider, result };
}

test('one provider-independent contract produces only semantic body blocks', async () => {
  const provider = fakeProvider('```text\nSubject: Model supplied subject\n\nThe monthly report may be furnished by 31 July 2026.\n```');
  const result = await generateDraftBody({
    provider,
    context: 'The monthly report is due by 31 July 2026.',
    communicationType: 'Office Memorandum',
    officeProfile,
    signatory,
    recipient,
    recipientRelationship: 'Another Ministry / Department',
    draftMode: 'detailed',
    documentDetails,
    instruction: 'Request the monthly report.',
  });

  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].operation, 'draft');
  assert.match(provider.calls[0].instructions, /substantive body/);
  assert.match(provider.calls[0].instructions, /Letters and D\.O\. Letters.*first-person voice/);
  assert.match(provider.calls[0].instructions, /selected file Notes.*primary drafting direction/);
  assert.match(provider.calls[0].input, /third-person institutional voice/);
  assert.match(provider.calls[0].input, /DECISION BASIS/);
  assert.match(provider.calls[0].input, /COMMUNICATION GOAL \/ REQUESTED OUTCOME/);
  assert.equal(result.document.metadata.subject, 'Monthly report');
  assert.deepEqual(result.document.blocks.map((block) => block.role), ['bodyParagraph']);
  assert.deepEqual(result.document.blocks.map((block) => block.source), ['ai']);
  assert.doesNotMatch(result.body, /Model supplied subject/);
  assert.match(result.text, /Subject: Monthly report/);
  assert.match(result.text, /OFFICE MEMORANDUM/);
  assert.match(result.text, /\(A\. Officer\)/);
});

test('prompt preview contract matches the request sent to the provider', async () => {
  const provider = fakeProvider('The monthly report may kindly be furnished by 31 July 2026.');
  const request = {
    context: 'The monthly report is due by 31 July 2026.',
    communicationType: 'Office Memorandum',
    officeProfile,
    signatory,
    recipient,
    recipientRelationship: 'Another Ministry / Department',
    draftMode: 'detailed',
    instruction: 'Request the monthly report.',
    additionalInstruction: 'Keep the request courteous and put the deadline last.',
  };
  const preview = buildDraftAIRequest(request);

  await generateDraftBody({ provider, ...request, documentDetails });

  assert.equal(provider.calls[0].instructions, preview.instructions);
  assert.equal(provider.calls[0].input, preview.input);
  assert.match(preview.input, /OFFICER'S ADDITIONAL DRAFTING INSTRUCTION/);
  assert.match(preview.input, /Keep the request courteous and put the deadline last\./);
});

test('draft body extent controls guidance and output allowance without changing protected structure', async () => {
  const provider = fakeProvider('The background is recorded.\n\nThe reasons have been examined.\n\nThe requested action may be taken.');
  const result = await generateDraftBody({
    provider,
    context: 'Recorded background and reasons.',
    communicationType: 'Office Memorandum',
    officeProfile,
    signatory,
    recipient,
    recipientRelationship: 'Another Ministry / Department',
    draftMode: 'detailed',
    documentDetails,
    instruction: 'Communicate the reasoned decision.',
    contentLength: 'detailed',
    paragraphStyle: 'developed',
  });

  assert.match(provider.calls[0].input, /Detailed: 1–2 pages/);
  assert.match(provider.calls[0].input, /Developed reasoning/);
  assert.match(provider.calls[0].input, /Do not pad, repeat, or invent material/);
  assert.equal(provider.calls[0].maxOutputTokens, 3000);
  assert.deepEqual(result.document.blocks.map((block) => block.role), ['bodyParagraph', 'bodyParagraph', 'bodyParagraph']);
  assert.match(result.text, /OFFICE MEMORANDUM/);
});

test('AI normalization rejects unusable, excessive and structural responses', () => {
  assert.throws(() => normalizeAITextResponse('```text\n```'), /no draft text/i);
  assert.throws(() => normalizeAITextResponse('x'.repeat(24001)), /too long/i);
  assert.throws(() => normalizeAITextResponse('Government of India\n\nBody text.'), /document structure/i);
  assert.throws(() => normalizeAITextResponse('{"body":"Body text"}'), /structured data/i);
  assert.equal(
    normalizeAITextResponse('<think>Internal reasoning</think>\nHere is the draft body:\nThe report may be furnished.'),
    'The report may be furnished.',
  );
});

test('paragraph regeneration cannot target the subject or signature', async () => {
  const { result } = await generatedDraft();
  const provider = fakeProvider('Replacement text.');
  const subjectStart = result.text.indexOf('Monthly report');

  await assert.rejects(
    regenerateDraftBodySelection({
      provider,
      document: result.document,
      fullText: result.text,
      selectionStart: subjectStart,
      selectionEnd: subjectStart + 'Monthly report'.length,
      context: 'Source context',
      communicationType: 'Office Memorandum',
      instruction: 'Improve wording.',
    }),
    /only within the substantive body/i,
  );
  assert.equal(provider.calls.length, 0);
});

test('rich editor paragraph-boundary selections are clamped to the substantive body', async () => {
  const { result } = await generatedDraft('First body paragraph.\n\nSecond body paragraph.');
  const rendered = renderStructuredDraft(result.document);
  const body = rendered.layout.blocks.find((block) => block.role === 'body');
  const mapped = mapRichBodySelectionToDocument(result.document, {
    start: 0,
    end: body.content.length + 2,
  });

  assert.deepEqual(mapped, { start: body.start, end: body.end });
  assert.equal(result.text.slice(mapped.start, mapped.end), body.content);
});

test('body regeneration preserves deterministic document structure', async () => {
  const { result } = await generatedDraft();
  const rendered = renderStructuredDraft(result.document);
  const body = rendered.layout.blocks.find((block) => block.role === 'body');
  const provider = fakeProvider('The monthly report may kindly be furnished by 31 July 2026.');
  const rewritten = await regenerateDraftBodySelection({
    provider,
    document: result.document,
    fullText: result.text,
    selectionStart: body.start,
    selectionEnd: body.end,
    context: 'The monthly report is due by 31 July 2026.',
    communicationType: 'Office Memorandum',
    instruction: 'Improve wording without changing facts.',
  });

  assert.equal(provider.calls[0].operation, 'paragraph');
  assert.match(rewritten.text, /Subject: Monthly report/);
  assert.match(rewritten.text, /The monthly report may kindly be furnished/);
  assert.match(rewritten.text, /\(A\. Officer\)/);
  assert.ok(rewritten.document.blocks.every((block) => block.role === 'bodyParagraph'));
  assert.ok(rewritten.selection.start < rewritten.selection.end);
});

test('free-text changes are never silently overwritten by body orchestration', async () => {
  const { result } = await generatedDraft();
  const rendered = renderStructuredDraft(result.document);
  const body = rendered.layout.blocks.find((block) => block.role === 'body');
  await assert.rejects(
    regenerateDraftBodySelection({
      provider: fakeProvider('Replacement.'),
      document: result.document,
      fullText: `${result.text}\nManual addition`,
      selectionStart: body.start,
      selectionEnd: body.end,
      context: 'Context',
      communicationType: 'Office Memorandum',
    }),
    /free-text changes/i,
  );
});

test('Paragraph Bank insertion appends within the body and preserves source provenance', async () => {
  const { result } = await generatedDraft();
  const inserted = insertDraftBodyText({
    document: result.document,
    fullText: result.text,
    selectionStart: 0,
    selectionEnd: 0,
    content: 'This issues with the approval of the competent authority.',
    source: 'paragraph-bank',
  });

  assert.deepEqual(inserted.document.blocks.map((block) => block.source), ['ai', 'paragraph-bank']);
  assert.match(inserted.text, /Subject: Monthly report/);
  assert.match(inserted.text, /competent authority/);
  assert.match(inserted.text, /\(A\. Officer\)/);
});
