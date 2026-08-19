import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Note preparation uses a four-step guided workflow', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  assert.match(noting, /NOTE_AI_STEPS/);
  assert.match(noting, /\['Note setup', 'Type and structure'\]/);
  assert.match(noting, /\['Objective', 'Goal and analysis'\]/);
  assert.match(noting, /\['Sources', 'Material for AI'\]/);
  assert.match(noting, /\['Review', 'Check and prepare'\]/);
  assert.match(noting, /aria-current=\{active \? 'step'/);
  assert.match(noting, /goToNextAIStep/);
  assert.match(noting, />Back<\/button>/);
  assert.match(noting, />Continue<\/button>/);
});

test('guided source step includes Issue records, previous Notes and temporary documents', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  assert.match(noting, /Previous saved Notes/);
  assert.match(noting, /Latest running summary/);
  assert.match(noting, /title="Communications"/);
  assert.match(noting, /title="References"/);
  assert.match(noting, /Choose a file/);
  assert.match(noting, /Paste source text/);
  assert.match(noting, /Use this text/);
  assert.match(noting, /sourceType: 'pasted'/);
  assert.match(noting, /It remains temporary and is not saved with the Issue/);
  assert.match(noting, /Information that will be sent/);
  assert.match(noting, /sourceChips\.map/);
  assert.doesNotMatch(noting, /Appendix saved with the Note/);
  assert.match(noting, /SELECTED PREVIOUS SAVED NOTES/);
  assert.match(noting, /\.pdf,.doc,.docx,.txt,.md/);
  assert.doesNotMatch(noting, /const readPdf =/);
  assert.doesNotMatch(noting, /const readSourceDocument =/);
});

test('AI preparation dialog is wide and mobile-safe', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  assert.match(noting, /maxWidth="max-w-6xl"/);
  assert.match(noting, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(noting, />Stop<\/button>/);
  assert.match(noting, /Review before preparing/);
});

test('communication preparation mirrors the four-step guided workflow', () => {
  const drafting = source('src/features/drafting/DraftingWorkspace.jsx');
  assert.doesNotMatch(drafting, /setDraftDialogTab|draftDialogTab/);
  assert.match(drafting, /\[1, 'Setup', 'Format and parties'\]/);
  assert.match(drafting, /\[2, 'Objective', 'Outcome and details'\]/);
  assert.match(drafting, /\[3, 'Sources', `\$\{context\.selectedSourceCount\} selected`\]/);
  assert.match(drafting, /\[4, 'Review', 'Check and prepare'\]/);
  assert.match(drafting, /continueDraftPreparation/);
  assert.match(drafting, /aria-current=\{active \? 'step'/);
  assert.match(drafting, /CheckCircle2/);
  assert.match(drafting, />Back<\/button>/);
  assert.match(drafting, />Continue<\/button>/);
  assert.match(drafting, /Information sent to AI/);
  assert.match(drafting, /Final prompt preview/);
  assert.match(drafting, /Prepare communication/);
});

test('communication source step retains Issue records and child sources', () => {
  const drafting = source('src/features/drafting/DraftingWorkspace.jsx');
  assert.match(drafting, /Use selected Issue information/);
  assert.match(drafting, /Latest running summary/);
  assert.match(drafting, /\['Communications', 'References', 'Notes'\]/);
  assert.match(drafting, /Copy context/);
  assert.match(drafting, /SourceSelector/);
  assert.match(drafting, /line-clamp-4/);
  assert.match(drafting, /contextPreviewExpanded/);
  assert.match(drafting, /Show more/);
  assert.match(drafting, /Show less/);
});

test('Drafting starts from primary template cards with direct blank and AI actions', () => {
  const drafting = source('src/features/drafting/DraftingWorkspace.jsx');
  assert.match(drafting, /PRIMARY_DRAFT_TEMPLATES/);
  assert.match(drafting, /TemplateChoiceCard/);
  assert.match(drafting, /'Letter'/);
  assert.match(drafting, /'Office Memorandum'/);
  assert.match(drafting, /'Office Order'/);
  assert.match(drafting, /'D\.O\. Letter'/);
  assert.match(drafting, />Start blank<\/button>/);
  assert.match(drafting, />Prepare with AI<\/button>/);
  assert.match(drafting, /Other official formats/);
});

test('reviewed PDF continues directly into note preparation', () => {
  const noting = source('src/features/noting/NotingPanel.jsx');
  const pdf = source('src/features/noting/pdf/PdfContextDialog.jsx');
  assert.match(pdf, /Use and prepare note/);
  assert.match(pdf, /safe-area-inset-bottom/);
  assert.match(pdf, /min-h-11/);
  assert.match(noting, /onAttach=\{\(contextFile\) => \{[\s\S]*setAIAction\('prepare'\);[\s\S]*setAIDialogOpen\(true\);/);
});

test('OCR review exposes cleanup metrics and the original recognized text', () => {
  const pdf = source('src/features/noting/pdf/PdfContextDialog.jsx');
  assert.match(pdf, /OCR cleanup applied/);
  assert.match(pdf, /Show original OCR/);
  assert.match(pdf, /Restore cleaned OCR/);
  assert.match(pdf, /removedCharacterCount/);
  assert.match(pdf, /rawMarkdown/);
});

test('Note refinement composer cannot submit the outer Note form', () => {
  const conversation = source('src/features/noting/NoteAIConversation.jsx');
  assert.doesNotMatch(conversation, /<form\b/);
  assert.match(conversation, /type="button" onClick=\{onSend\}/);
  assert.match(conversation, /event\.preventDefault\(\)/);
});

test('Note refinement retains history and exposes editor-native suggestion decisions', () => {
  const conversation = source('src/features/noting/NoteAIConversation.jsx');
  const noting = source('src/features/noting/NotingPanel.jsx');
  assert.match(conversation, /Show changes in editor/);
  assert.match(conversation, /Conversation and revisions/);
  assert.match(conversation, /Suggestion status/);
  assert.match(conversation, /Reject all/);
  assert.match(conversation, /Accept all/);
  assert.match(conversation, /candidates\.map/);
  assert.match(noting, /setAICandidates\(\(current\) => \[\.\.\.current, candidate\]\)/);
  assert.match(noting, /setAIAppliedUndo/);
  assert.match(noting, /revisionPulse=\{aiEditorPulse\}/);
  assert.match(noting, /suggestionReview=/);
});
