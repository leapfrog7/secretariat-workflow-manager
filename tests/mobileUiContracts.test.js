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
