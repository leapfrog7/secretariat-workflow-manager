import assert from 'node:assert/strict';
import test from 'node:test';
import {
  byteLength,
  composePdfMarkdown,
  isLikelyScannedPage,
  pdfItemsToLines,
  pdfLinesToMarkdown,
  reconstructPdfPages,
} from '../src/features/noting/pdf/pdfTextToMarkdown.js';

function item(str, x, y, width = str.length * 5, height = 10) {
  return { str, transform: [1, 0, 0, height, x, y], width, height };
}

test('PDF text items become ordered lines with readable spacing', () => {
  const lines = pdfItemsToLines([
    item('India', 75, 700),
    item('Government of', 10, 700, 60),
    item('1. First action', 10, 680),
    item('\u2022 Second action', 10, 660),
  ]);

  assert.deepEqual(lines.map((line) => line.text), [
    'Government of India',
    '1. First action',
    '- Second action',
  ]);
});

test('wrapped PDF lines become conservative Markdown paragraphs', () => {
  const markdown = pdfLinesToMarkdown([
    { text: 'The report may be fur-', y: 700, height: 10 },
    { text: 'nished by 31 July 2026.', y: 688, height: 10 },
    { text: '2. The details may be verified.', y: 660, height: 10 },
  ], 3);

  assert.equal(markdown, '## Page 3\n\nThe report may be furnished by 31 July 2026.\n\n2. The details may be verified.');
});

test('selected PDF pages compose into traceable Markdown context', () => {
  const pages = [
    { pageNumber: 1, markdown: '## Page 1\n\nFirst page.' },
    { pageNumber: 2, markdown: '' },
    { pageNumber: 3, markdown: '## Page 3\n\nThird page.' },
  ];

  assert.equal(
    composePdfMarkdown(pages, new Set([1, 3])),
    '## Page 1\n\nFirst page.\n\n---\n\n## Page 3\n\nThird page.',
  );
  assert.equal(byteLength('\u0938\u0930\u0915\u093e\u0930'), 15);
});

test('reconstruction removes repeated headers and footers across pages', () => {
  const pages = [1, 2, 3].map((pageNumber) => ({
    pageNumber,
    width: 600,
    height: 800,
    lines: [
      { text: 'Ministry of Example - Confidential', x: 80, right: 350, y: 775, width: 270, height: 10, isBold: false, segments: [] },
      { text: `The substantive text for page ${pageNumber}.`, x: 60, right: 300, y: 650, width: 240, height: 10, isBold: false, segments: [] },
      { text: String(pageNumber), x: 295, right: 305, y: 25, width: 10, height: 10, isBold: false, segments: [] },
    ],
  }));

  const result = reconstructPdfPages(pages);

  assert.equal(result.metrics.removedRepeatedLineCount, 6);
  assert.match(result.pages[0].markdown, /substantive text for page 1/i);
  assert.doesNotMatch(result.pages[0].markdown, /Confidential/);
});

test('reconstruction recognizes a visually prominent heading', () => {
  const result = reconstructPdfPages([{
    pageNumber: 1,
    width: 600,
    height: 800,
    lines: [
      { text: 'Background', x: 235, right: 365, y: 700, width: 130, height: 16, isBold: true, segments: [] },
      { text: 'The matter was examined in consultation with the division.', x: 60, right: 430, y: 670, width: 370, height: 10, isBold: false, segments: [] },
    ],
  }]);

  assert.match(result.pages[0].markdown, /### Background/);
  assert.equal(result.metrics.headingCount, 1);
});

test('reconstruction converts aligned multi-row text into a Markdown table', () => {
  const lines = pdfItemsToLines([
    item('Item', 40, 700, 30), item('Status', 240, 700, 40),
    item('Audit reply', 40, 680, 70), item('Pending', 240, 680, 50),
    item('RTI return', 40, 660, 60), item('Sent', 240, 660, 30),
  ]);
  const result = reconstructPdfPages([{ pageNumber: 1, width: 600, height: 800, lines }]);

  assert.match(result.pages[0].markdown, /\| Item \| Status \|/);
  assert.match(result.pages[0].markdown, /\| Audit reply \| Pending \|/);
  assert.equal(result.metrics.tableCount, 1);
});

test('a single split line is retained as prose rather than inferred as a table', () => {
  const lines = pdfItemsToLines([
    item('Reference', 40, 700, 60), item('DoPT OM dated 1 July 2026', 240, 700, 150),
    item('The proposal may be approved.', 40, 670, 170),
  ]);
  const result = reconstructPdfPages([{ pageNumber: 1, width: 600, height: 800, lines }]);

  assert.equal(result.metrics.tableCount, 0);
  assert.doesNotMatch(result.pages[0].markdown, /\| --- \|/);
});

test('a page with only a selectable file number remains an OCR candidate', () => {
  assert.equal(isLikelyScannedPage('## Page 1\n\nFile No. A-12011/4/2026-Admn.', 1), true);
  assert.equal(isLikelyScannedPage('## Page 1\n\nA complete searchable paragraph containing sufficient substantive details for examination. '.repeat(3), 8), false);
});
