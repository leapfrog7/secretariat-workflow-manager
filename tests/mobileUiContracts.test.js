import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('mobile content clearance includes navigation height and device safe area', () => {
  const css = source('src/index.css');
  assert.match(css, /--app-mobile-nav-clearance:/);
  assert.match(css, /env\(safe-area-inset-bottom(?:,\s*0px)?\)/);
  assert.match(css, /\.app-main[\s\S]*padding-bottom:\s*var\(--app-mobile-nav-clearance\)/);
});

test('high-use workflow dialogs use the shared mobile-safe modal', () => {
  for (const path of [
    'src/features/noting/NotingPanel.jsx',
    'src/features/noting/pdf/PdfContextDialog.jsx',
    'src/features/drafting/DraftingWorkspace.jsx',
    'src/pages/AdminPage.jsx',
  ]) {
    assert.match(source(path), /ModalFrame/);
  }
  assert.match(source('src/components/common/ModalFrame.jsx'), /mobile-sheet-safe/);
  assert.match(source('src/components/common/ModalFrame.jsx'), /max-h-\[96dvh\]/);
});

test('mobile navigation keeps the five primary destinations in the intended order', () => {
  const navigation = source('src/components/layout/MobileNavigation.jsx');
  const issues = navigation.indexOf("label: 'Issues'");
  const casework = navigation.indexOf("label: 'Casework'");
  const create = navigation.indexOf("label: 'Create Issue'");
  const reports = navigation.indexOf("label: 'Reports'");
  assert.ok(issues >= 0 && issues < casework && casework < create && create < reports);
  assert.match(navigation, /<span>More<\/span>/);
  assert.match(navigation, /item\.to === '\/issues\/new'/);
  assert.match(navigation, /text-\[10px\]/);
});

test('mobile typography is compact without triggering form-field zoom', () => {
  const css = source('src/index.css');
  assert.match(css, /:root\[data-text-size="normal"\][\s\S]*font-size:\s*15px/);
  assert.match(css, /input,[\s\S]*select,[\s\S]*textarea[\s\S]*font-size:\s*16px/);
  assert.match(source('src/components/common/PageHeader.jsx'), /ui-page-title/);
});

test('Issue card actions keep proportional controls with extended tap areas', () => {
  const css = source('src/index.css');
  const card = source('src/components/issues/IssueCard.jsx');
  assert.match(css, /\.issue-register-cards \.issue-card-action[\s\S]*min-width:\s*32px[\s\S]*min-height:\s*32px/);
  assert.match(card, /issue-card-action[\s\S]*h-8 w-8/);
  assert.match(card, /after:-inset-1\.5/);
  assert.match(card, /justify-end gap-3/);
});

test('draft templates stay readable on desktop and use a non-flipping mobile layout', () => {
  const drafting = source('src/features/drafting/DraftingWorkspace.jsx');
  const css = source('src/index.css');
  assert.match(drafting, /grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(drafting, /template-choice-card-back[\s\S]*grid w-full gap-2/);
  assert.match(css, /@media \(hover: none\)[\s\S]*display: flex[\s\S]*flex-direction: column/);
  assert.match(css, /template-choice-card-front[\s\S]*border-radius: \.75rem \.75rem 0 0/);
  assert.match(drafting, /grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end/);
  assert.match(drafting, /min-h-11[\s\S]*Continue/);
});

test('noting AI refinement exposes mobile-sized controls without crowding actions', () => {
  const conversation = source('src/features/noting/NoteAIConversation.jsx');
  assert.match(conversation, /grid grid-cols-2 gap-2[\s\S]*min-h-11 w-full[\s\S]*Show changes in editor/);
  assert.match(conversation, /min-h-11 w-full[\s\S]*Refine note/);
  assert.match(conversation, /min-h-11[\s\S]*Reject all[\s\S]*min-h-11[\s\S]*Accept all/);
});

test('rich editors use compact mobile controls and progressively disclose advanced tools', () => {
  const shared = source('src/components/editor/EditorEnhancements.jsx');
  const noteEditor = source('src/features/noting/NoteEditor.jsx');
  const draftEditor = source('src/features/drafting/editor/DraftDocumentEditor.jsx');
  assert.match(shared, /function MobileEditorToolbar/);
  assert.match(shared, /sm:hidden/);
  assert.match(shared, /role="dialog" aria-modal="true"/);
  assert.match(shared, /Find and replace in document/);
  assert.match(shared, /words ·/);
  assert.match(shared, /function FormatPainterControls/);
  assert.match(shared, /function PageBreakControl/);
  assert.match(noteEditor, /SelectionFormattingMenu/);
  assert.match(noteEditor, /GOVERNMENT_NUMBERING_STYLES/);
  assert.match(draftEditor, /Only the substantive body is editable/);
  assert.match(draftEditor, /hidden overflow-x-auto[\s\S]*sm:block/);
});

test('document ruler is functional on desktop and absent from mobile', () => {
  const shared = source('src/components/editor/EditorEnhancements.jsx');
  const noteEditor = source('src/features/noting/NoteEditor.jsx');
  const draftEditor = source('src/features/drafting/editor/DraftDocumentEditor.jsx');
  assert.match(shared, /function DesktopDocumentRuler/);
  assert.match(shared, /hidden[\s\S]*lg:block/);
  assert.match(shared, /First-line indent/);
  assert.match(shared, /Hanging indent/);
  assert.match(shared, /Left paragraph indent/);
  assert.match(shared, /Right paragraph indent/);
  assert.match(shared, /onPointerMove/);
  assert.match(noteEditor, /fixedMarginCm=\{1\.9\}/);
  assert.match(noteEditor, /fluid/);
  assert.match(draftEditor, /onMarginChange=\{\(margins\)/);
  assert.match(draftEditor, /max-w-\[900px\]/);
  assert.match(shared, /h-7[\s\S]*bg-slate-50\/40/);
  assert.doesNotMatch(shared, /inset-y-0 left-0 bg-slate-200/);
});

test('Casework keeps its primary controls and work modes mobile-sized', () => {
  const page = source('src/pages/CaseworkPage.jsx');
  const module = source('src/features/casework/CaseworkModule.jsx');
  const picker = source('src/features/casework/CaseworkIssuePicker.jsx');
  assert.match(page, /min-h-11 w-full[\s\S]*Open full Issue/);
  assert.match(page, /min-h-10 shrink-0[\s\S]*New Issue/);
  assert.match(module, /grid grid-cols-2 gap-2[\s\S]*role="tablist" aria-label="Casework"/);
  assert.match(module, /min-h-14 min-w-0/);
  assert.match(picker, /h-11 w-full rounded-lg/);
});

test('mobile Casework queues use one calm row action while desktop retains explicit actions', () => {
  const page = source('src/pages/CaseworkPage.jsx');
  assert.match(page, /recentCaseworkHref/);
  assert.match(page, /aria-label=\{`Open \$\{item\.issue\.shortTitle\}`\}/);
  assert.match(page, /className="flex min-h-16[\s\S]*sm:hidden"/);
  assert.match(page, /hidden flex-wrap gap-2 sm:flex/);
  assert.match(page, /Draft available/);
  assert.match(page, /border-b-2[\s\S]*sm:border-b-0/);
});

test('header popovers and PWA installation remain mobile-safe', () => {
  const syncPanel = source('src/components/cloud/SyncStatusPanel.jsx');
  const shell = source('src/layouts/AppShell.jsx');
  const installer = source('src/components/pwa/InstallAppButton.jsx');
  assert.match(syncPanel, /fixed inset-x-3 top-16/);
  assert.match(syncPanel, /max-h-\[calc\(100dvh-5rem\)\]/);
  assert.match(shell, /<InstallAppButton \/>/);
  assert.match(installer, /beforeinstallprompt/);
  assert.match(installer, /Add to Home Screen/);
});

test('the application publishes an installable PWA shell', () => {
  assert.match(source('index.html'), /manifest\.webmanifest/);
  assert.match(source('src/main.jsx'), /serviceWorker\.register/);
  assert.match(source('public/manifest.webmanifest'), /"display": "standalone"/);
  assert.match(source('public/sw.js'), /self\.addEventListener\('fetch'/);
});
