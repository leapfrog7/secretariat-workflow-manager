import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_OCR_PAGES_PER_RUN,
  OCR_LANGUAGE_OPTIONS,
  mergeOcrWithSelectableText,
  ocrTextToMarkdown,
} from '../src/features/noting/pdf/pdfOcrService.js';

test('OCR text becomes page-labelled, editable Markdown', () => {
  const markdown = ocrTextToMarkdown(
    'GOVERNMENT OF INDIA\r\n\r\n1) The matter was examined.\n\u2022 Report may be called for.\n',
    4,
  );

  assert.equal(
    markdown,
    '## Page 4 (OCR)\n\nGOVERNMENT OF INDIA\n\n1. The matter was examined.\n- Report may be called for.',
  );
});

test('OCR does not create a page block when recognition returns no text', () => {
  assert.equal(ocrTextToMarkdown(' \n\n ', 2), '');
});

test('OCR offers English, Hindi and bilingual recognition with a bounded batch', () => {
  assert.deepEqual(OCR_LANGUAGE_OPTIONS.map((option) => option.value), ['eng', 'hin', 'eng+hin']);
  assert.equal(MAX_OCR_PAGES_PER_RUN, 40);
});

test('mixed pages retain useful selectable text that OCR did not recognize', () => {
  const merged = mergeOcrWithSelectableText(
    '## Page 2\n\nFile No. A-12011/4/2026-Admn.',
    '## Page 2 (OCR)\n\nThe matter was examined and the report may be called for.',
  );

  assert.match(merged, /The matter was examined/);
  assert.match(merged, /Selectable text retained/);
  assert.match(merged, /File No\. A-12011/);
});

test('selectable text is not repeated when OCR already contains it', () => {
  const merged = mergeOcrWithSelectableText(
    '## Page 2\n\nFile No. A-12011/4/2026-Admn.',
    '## Page 2 (OCR)\n\nFile No. A-12011/4/2026-Admn.\n\nThe matter was examined.',
  );

  assert.doesNotMatch(merged, /Selectable text retained/);
});
