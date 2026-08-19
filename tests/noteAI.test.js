import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNoteAIInput,
  buildNoteSelectionRewriteInput,
  buildNoteConversationInput,
  generateOrRefineNote,
  generateExaminationMap,
  noteModeTaskLevel,
  NOTE_ANALYTICAL_SYSTEM_PROMPT,
  NOTE_AI_SYSTEM_PROMPT,
  NOTE_SELECTION_REWRITE_SYSTEM_PROMPT,
  rewriteNoteSelection,
  refineNoteConversation,
  NOTE_CONVERSATION_SYSTEM_PROMPT,
} from '../src/features/noting/noteAI.js';

test('noting AI uses a separate Government note contract', () => {
  const input = buildNoteAIInput({
    operation: 'refine',
    issueContext: 'eReceipt 42 was received on 28 July 2026.',
    currentNote: 'Receipt may be examined.',
    instruction: 'Retain the date.',
    goal: 'Enable a decision on calling for comments.',
    proposedDirection: 'Comments may be requested within ten days.',
  });

  assert.match(NOTE_AI_SYSTEM_PROMPT, /Do not create a letter/);
  assert.match(NOTE_AI_SYSTEM_PROMPT, /never claim that consultation, discussion, approval or a decision occurred/i);
  assert.match(NOTE_AI_SYSTEM_PROMPT, /Markdown headings/);
  assert.match(input, /Refine the existing note/);
  assert.match(input, /eReceipt 42/);
  assert.match(input, /EXISTING NOTE/);
  assert.match(input, /DECISION OR OUTCOME THIS NOTE SHOULD ENABLE/);
  assert.match(input, /Comments may be requested within ten days/);
});

test('noting AI returns reviewable text without saving it', async () => {
  const calls = [];
  const result = await generateOrRefineNote({
    provider: {
      id: 'test-provider',
      async generateText(request) {
        calls.push(request);
        return { text: '```text\nThe receipt has been examined.\n```', model: 'test-model' };
      },
    },
    operation: 'generate',
    issueContext: 'Recorded facts.',
    goal: 'Enable examination of the receipt.',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, 'draft');
  assert.equal(result.text, 'The receipt has been examined.');
  assert.equal(result.model, 'test-model');
});

test('noting AI requires a decision goal before first-note generation', async () => {
  await assert.rejects(
    () => generateOrRefineNote({
      provider: { id: 'unused', generateText: async () => ({ text: 'Unused' }) },
      operation: 'generate',
      issueContext: 'Recorded facts.',
    }),
    /what decision or outcome this note should enable/,
  );
});

test('noting AI removes report-style headings from weak model output', async () => {
  const result = await generateOrRefineNote({
    provider: {
      id: 'test-provider',
      async generateText() {
        return {
          text: '# SUBJECT: Calling for comments\n\n**FACTS:** The reference was received.\n\nPROPOSAL\n\nIt is proposed that comments may be called for.',
        };
      },
    },
    operation: 'generate',
    issueContext: 'Recorded facts.',
    goal: 'Enable a decision on calling for comments.',
  });

  assert.equal(result.text, 'Subject: Calling for comments\n\nThe reference was received.\n\nIt is proposed that comments may be called for.');
});

test('routine noting remains concise and uses the light internal tier', async () => {
  const calls = [];
  await generateOrRefineNote({
    provider: { id: 'test', async generateText(request) { calls.push(request); return { text: 'Subject: Routine receipt\n\nThe receipt may be placed on file.' }; } },
    operation: 'generate', issueContext: 'A routine receipt was recorded.', goal: 'Enable filing of the receipt.', noteMode: 'routine',
  });
  assert.match(calls[0].instructions, /2–4 short, connected paragraphs/);
  assert.equal(calls[0].maxOutputTokens, 1000);
  assert.equal(noteModeTaskLevel('routine'), 'simple');
});

test('detailed noting carries analytical controls and missing-fact discipline', async () => {
  const calls = [];
  await generateOrRefineNote({
    provider: { id: 'test', async generateText(request) { calls.push(request); return { text: 'Subject: Detailed examination\n\nThe rule position may need verification.' }; } },
    operation: 'generate', issueContext: 'The applicable rule was not supplied.', goal: 'Enable a decision.',
    noteMode: 'detailed_examination', purpose: 'options', structurePreference: 'limited_headings', lengthExpectation: 'medium', analyticalEmphasis: ['chronology', 'rules', 'risk'],
  });
  assert.equal(calls[0].instructions, NOTE_ANALYTICAL_SYSTEM_PROMPT);
  assert.match(calls[0].instructions, /state that it may need verification/);
  assert.match(calls[0].input, /Detailed examination/);
  assert.match(calls[0].input, /Chronology; Rules \/ guidelines; Risk and alternatives/);
  assert.equal(calls[0].maxOutputTokens, 3000);
  assert.equal(noteModeTaskLevel('detailed_examination'), 'hard');
});

test('full background analysis permits a long structured examination', async () => {
  const calls = [];
  const result = await generateOrRefineNote({
    provider: { id: 'test', async generateText(request) { calls.push(request); return { text: 'BACKGROUND\n\nRecorded background.\n\nPROPOSAL\n\nA decision is requested.' }; } },
    operation: 'generate', issueContext: 'Recorded material.', goal: 'Enable final decision.', noteMode: 'full_background_analysis', structurePreference: 'full_structure', lengthExpectation: 'as_required',
  });
  assert.match(result.text, /BACKGROUND/);
  assert.match(calls[0].input, /As required by complexity/);
  assert.equal(calls[0].maxOutputTokens, 3000);
});

test('examination map is a separate editable working aid request', async () => {
  const calls = [];
  const result = await generateExaminationMap({
    provider: { id: 'test', async generateText(request) { calls.push(request); return { text: 'Material facts\nRecorded fact.\n\nGaps, uncertainties or contradictions\nRule position requires verification.' }; } },
    issueContext: 'Recorded fact.', goal: 'Enable a decision.', analyticalEmphasis: ['missing_information'],
  });
  assert.match(calls[0].instructions, /working examination map/);
  assert.match(result.text, /Gaps, uncertainties or contradictions/);
});

test('selected note text uses a bounded Government-noting rewrite contract', async () => {
  const calls = [];
  const input = buildNoteSelectionRewriteInput({
    selectedText: 'The matter needs quick action.',
    currentNote: 'Subject: Audit observations\n\nThe matter needs quick action.',
    issueContext: 'The reply is due on 10 August 2026.',
  });
  const result = await rewriteNoteSelection({
    provider: {
      id: 'test-provider',
      async generateText(request) {
        calls.push(request);
        return { text: '**EXAMINATION:** The matter may require expeditious action.', model: 'test-model' };
      },
    },
    selectedText: 'The matter needs quick action.',
    currentNote: 'Subject: Audit observations\n\nThe matter needs quick action.',
    issueContext: 'The reply is due on 10 August 2026.',
  });

  assert.match(NOTE_SELECTION_REWRITE_SYSTEM_PROMPT, /Rewrite only the selected passage/);
  assert.match(NOTE_SELECTION_REWRITE_SYSTEM_PROMPT, /Do not add facts or conclusions/);
  assert.match(input, /SELECTED PASSAGE TO REWRITE/);
  assert.match(input, /SURROUNDING NOTE FOR CONTEXT/);
  assert.equal(calls[0].operation, 'paragraph');
  assert.equal(result.text, 'The matter may require expeditious action.');
  assert.equal(result.model, 'test-model');
});

test('selected note rewrite requires a non-empty selection', async () => {
  await assert.rejects(
    () => rewriteNoteSelection({
      provider: { id: 'unused', generateText: async () => ({ text: 'Unused' }) },
      selectedText: '   ',
    }),
    /Select the passage/,
  );
});

test('conversational refinement returns a complete reviewable note with bounded instruction history', async () => {
  const calls = [];
  const earlierInstructions = Array.from({ length: 8 }, (_, index) => `Earlier instruction ${index + 1}`);
  const input = buildNoteConversationInput({
    currentNote: 'Subject: Audit reply\n\nThe reply is under examination.',
    instruction: 'Strengthen the reasoning and retain the conclusion.',
    previousInstructions: earlierInstructions,
    issueContext: 'The reply is due on 31 August 2026.',
  });
  const result = await refineNoteConversation({
    provider: { id: 'test', async generateText(request) { calls.push(request); return { text: 'Subject: Audit reply\n\nThe recorded position supports further examination.\n\nApproval is solicited.', model: 'test-model' }; } },
    currentNote: 'Subject: Audit reply\n\nThe reply is under examination.',
    instruction: 'Strengthen the reasoning and retain the conclusion.',
    previousInstructions: earlierInstructions,
    issueContext: 'The reply is due on 31 August 2026.',
  });

  assert.match(NOTE_CONVERSATION_SYSTEM_PROMPT, /complete revised note/i);
  assert.match(NOTE_CONVERSATION_SYSTEM_PROMPT, /Never invent facts/i);
  assert.doesNotMatch(input, /Earlier instruction 1\n/);
  assert.doesNotMatch(input, /Earlier instruction 2\n/);
  assert.match(input, /Earlier instruction 3/);
  assert.match(input, /LATEST OFFICER INSTRUCTION/);
  assert.match(input, /CURRENT WORKING NOTE TO REVISE/);
  assert.equal(calls[0].operation, 'draft');
  assert.equal(result.model, 'test-model');
  assert.match(result.text, /Approval is solicited/);
});

test('conversational refinement requires both a working note and an instruction', async () => {
  const provider = { id: 'unused', generateText: async () => ({ text: 'Unused' }) };
  await assert.rejects(() => refineNoteConversation({ provider, currentNote: '', instruction: 'Improve it.' }), /Prepare or enter a note/);
  await assert.rejects(() => refineNoteConversation({ provider, currentNote: 'Working note', instruction: '  ' }), /Enter a refinement instruction/);
});
