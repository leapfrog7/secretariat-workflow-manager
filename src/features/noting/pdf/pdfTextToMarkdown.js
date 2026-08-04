const LINE_Y_TOLERANCE = 2.5;
const MIN_REPEATED_MARGIN_PAGES = 3;

function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeListMarker(value) {
  return value
    .replace(/^[\u2022\u25cf\u25e6\u25aa\uf0b7]\s*/, '- ')
    .replace(/^(\d+)[.)]\s+/, '$1. ');
}

function beginsNewBlock(text) {
  return /^(- |\d+\. |\([a-z0-9ivx]+\)\s+)/i.test(text)
    || /^[A-Z][A-Z\s/&().-]{5,}:?$/.test(text);
}

function endsSentence(text) {
  return /[.!?:;\])}]$/.test(text);
}

function joinItems(items) {
  let text = '';
  let rightEdge = null;
  items.forEach((item) => {
    const averageCharacterWidth = item.text.length ? item.width / item.text.length : 0;
    const gap = rightEdge === null ? 0 : item.x - rightEdge;
    const needsSpace = text && !text.endsWith(' ') && gap > Math.max(1.5, averageCharacterWidth * 0.35);
    text += `${needsSpace ? ' ' : ''}${item.text}`;
    rightEdge = Math.max(rightEdge ?? item.x, item.x + item.width);
  });
  return normalizeListMarker(cleanText(text));
}

function segmentItems(items) {
  const segments = [];
  let current = [];
  let rightEdge = null;
  items.forEach((item) => {
    const averageCharacterWidth = item.text.length ? item.width / item.text.length : 0;
    const gap = rightEdge === null ? 0 : item.x - rightEdge;
    if (current.length && gap > Math.max(18, averageCharacterWidth * 3.5)) {
      segments.push(current);
      current = [];
    }
    current.push(item);
    rightEdge = Math.max(rightEdge ?? item.x, item.x + item.width);
  });
  if (current.length) segments.push(current);
  return segments.map((segment) => ({
    text: cleanText(joinItems(segment)),
    x: segment[0].x,
    right: Math.max(...segment.map((item) => item.x + item.width)),
  })).filter((segment) => segment.text);
}

export function pdfItemsToLines(items = [], styles = {}) {
  const positioned = items
    .filter((item) => cleanText(item?.str))
    .map((item, index) => {
      const fontName = String(item.fontName || '');
      const fontFamily = String(styles?.[fontName]?.fontFamily || '');
      return {
        text: cleanText(item.str),
        x: Number(item.transform?.[4]) || 0,
        y: Number(item.transform?.[5]) || 0,
        height: Math.abs(Number(item.height) || Number(item.transform?.[3]) || 10),
        width: Math.abs(Number(item.width) || 0),
        isBold: /bold|semibold|demibold|black/i.test(`${fontName} ${fontFamily}`),
        index,
      };
    });

  const rows = [];
  positioned.forEach((item) => {
    let row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_Y_TOLERANCE);
    if (!row) {
      row = { y: item.y, height: item.height, items: [] };
      rows.push(row);
    }
    row.items.push(item);
    row.height = Math.max(row.height, item.height);
  });

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x || a.index - b.index);
      const segments = segmentItems(sorted);
      const left = Math.min(...sorted.map((item) => item.x));
      const right = Math.max(...sorted.map((item) => item.x + item.width));
      return {
        text: joinItems(sorted),
        y: row.y,
        x: left,
        right,
        width: right - left,
        height: row.height,
        isBold: sorted.some((item) => item.isBold),
        segments,
      };
    })
    .filter((line) => line.text);
}

function isHeading(line, typicalHeight, pageWidth) {
  const text = line.text.trim();
  if (!text || text.length > 120 || /^(- |\d+\. |\([a-z0-9ivx]+\)\s+)/i.test(text)) return false;
  const uppercase = text.length >= 5 && text === text.toUpperCase() && /[A-Z]/.test(text);
  const larger = line.height >= typicalHeight * 1.25;
  const centered = pageWidth && Math.abs(((line.x || 0) + (line.right || 0)) / 2 - pageWidth / 2) <= pageWidth * 0.15;
  return larger || (line.isBold && text.length <= 80) || (uppercase && centered);
}

function alignedTableRows(first, second, pageWidth) {
  const firstSegments = first?.segments;
  const secondSegments = second?.segments;
  if (!Array.isArray(firstSegments) || !Array.isArray(secondSegments)) return false;
  if (firstSegments.length < 2 || firstSegments.length > 6 || firstSegments.length !== secondSegments.length) return false;
  const tolerance = Math.max(18, (pageWidth || 600) * 0.035);
  return firstSegments.every((segment, index) => Math.abs(segment.x - secondSegments[index].x) <= tolerance);
}

function escapeTableCell(value) {
  return cleanText(value).replace(/\|/g, '\\|');
}

function tableMarkdown(lines) {
  const columnCount = lines[0].segments.length;
  const firstLooksLikeHeader = lines[0].isBold
    || lines[0].segments.every((segment) => segment.text.length <= 40 && /^[A-Z][^.!?]*$/.test(segment.text));
  const header = firstLooksLikeHeader
    ? lines[0].segments.map((segment) => escapeTableCell(segment.text))
    : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const rows = firstLooksLikeHeader ? lines.slice(1) : lines;
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((line) => `| ${line.segments.map((segment) => escapeTableCell(segment.text)).join(' | ')} |`),
  ].join('\n');
}

function findTables(lines, typicalHeight, pageWidth) {
  const tables = new Map();
  let index = 0;
  while (index < lines.length - 1) {
    if (!alignedTableRows(lines[index], lines[index + 1], pageWidth)) {
      index += 1;
      continue;
    }
    const group = [lines[index], lines[index + 1]];
    let cursor = index + 2;
    while (
      cursor < lines.length
      && alignedTableRows(group[0], lines[cursor], pageWidth)
      && lines[cursor - 1].y - lines[cursor].y <= typicalHeight * 2.4
    ) {
      group.push(lines[cursor]);
      cursor += 1;
    }
    tables.set(index, { end: cursor - 1, markdown: tableMarkdown(group) });
    index = cursor;
  }
  return tables;
}

function pageBodyMarkdown(lines, { pageWidth = 600 } = {}) {
  if (!lines.length) return { markdown: '', headingCount: 0, tableCount: 0 };
  const typicalHeight = median(lines.map((line) => line.height).filter(Boolean)) || 10;
  const tables = findTables(lines, typicalHeight, pageWidth);
  const blocks = [];
  let paragraph = '';
  let previous = null;
  let headingCount = 0;

  const flushParagraph = () => {
    if (paragraph) blocks.push(paragraph);
    paragraph = '';
  };

  for (let index = 0; index < lines.length; index += 1) {
    const table = tables.get(index);
    if (table) {
      flushParagraph();
      blocks.push(table.markdown);
      previous = lines[table.end];
      index = table.end;
      continue;
    }

    const line = lines[index];
    if (isHeading(line, typicalHeight, pageWidth)) {
      flushParagraph();
      blocks.push(`### ${line.text}`);
      headingCount += 1;
      previous = line;
      continue;
    }

    const verticalGap = previous ? previous.y - line.y : 0;
    const startsBlock = beginsNewBlock(line.text);
    const largeGap = previous && verticalGap > typicalHeight * 1.75;
    const shouldBreak = !paragraph || startsBlock || largeGap || endsSentence(previous?.text || '');
    if (shouldBreak) {
      flushParagraph();
      paragraph = line.text;
    } else {
      paragraph = paragraph.endsWith('-')
        ? `${paragraph.slice(0, -1)}${line.text}`
        : `${paragraph} ${line.text}`;
    }
    previous = line;
  }
  flushParagraph();
  return { markdown: blocks.join('\n\n'), headingCount, tableCount: tables.size };
}

function normalizedMarginKey(text) {
  const normalized = cleanText(text)
    .toLowerCase()
    .replace(/\b(?:page\s*)?\d+(?:\s*of\s*\d+)?\b/g, '#')
    .replace(/\s+/g, ' ');
  return normalized.length <= 140 ? normalized : '';
}

function marginZone(line, pageHeight) {
  if (!pageHeight) return '';
  if (line.y >= pageHeight * 0.88) return 'header';
  if (line.y <= pageHeight * 0.12) return 'footer';
  return '';
}

export function repeatedMarginKeys(pages = []) {
  if (pages.length < MIN_REPEATED_MARGIN_PAGES) return new Set();
  const occurrences = new Map();
  pages.forEach((page) => {
    const pageKeys = new Set();
    page.lines.forEach((line) => {
      const zone = marginZone(line, page.height);
      const textKey = normalizedMarginKey(line.text);
      if (zone && textKey) pageKeys.add(`${zone}:${textKey}`);
    });
    pageKeys.forEach((key) => occurrences.set(key, (occurrences.get(key) || 0) + 1));
  });
  const threshold = Math.max(MIN_REPEATED_MARGIN_PAGES, Math.ceil(pages.length * 0.5));
  return new Set([...occurrences.entries()].filter(([, count]) => count >= threshold).map(([key]) => key));
}

export function reconstructPdfPages(rawPages = [], { removeRepeatedMargins = true } = {}) {
  const repeatedKeys = removeRepeatedMargins ? repeatedMarginKeys(rawPages) : new Set();
  let removedRepeatedLineCount = 0;
  let tableCount = 0;
  let headingCount = 0;
  const pages = rawPages.map((page) => {
    const lines = page.lines.filter((line) => {
      const zone = marginZone(line, page.height);
      const textKey = zone ? normalizedMarginKey(line.text) : '';
      const key = zone && textKey ? `${zone}:${textKey}` : '';
      const remove = key && repeatedKeys.has(key);
      if (remove) removedRepeatedLineCount += 1;
      return !remove;
    });
    const body = pageBodyMarkdown(lines, { pageWidth: page.width });
    tableCount += body.tableCount;
    headingCount += body.headingCount;
    const markdown = body.markdown ? `## Page ${page.pageNumber}\n\n${body.markdown}` : '';
    return { pageNumber: page.pageNumber, markdown, characterCount: markdown.length };
  });
  return {
    pages,
    metrics: {
      removedRepeatedLineCount,
      repeatedPatternCount: repeatedKeys.size,
      tableCount,
      headingCount,
    },
  };
}

export function pdfLinesToMarkdown(lines = [], pageNumber = 1, options = {}) {
  const body = pageBodyMarkdown(lines, options);
  return body.markdown ? `## Page ${pageNumber}\n\n${body.markdown}` : '';
}

export function composePdfMarkdown(pages = [], selectedPageNumbers) {
  const selected = selectedPageNumbers instanceof Set
    ? selectedPageNumbers
    : new Set(selectedPageNumbers || pages.map((page) => page.pageNumber));
  return pages
    .filter((page) => selected.has(page.pageNumber) && page.markdown.trim())
    .map((page) => page.markdown.trim())
    .join('\n\n---\n\n')
    .trim();
}

export function isLikelyScannedPage(markdown, selectableLineCount = 0) {
  const body = String(markdown || '').replace(/^## Page \d+(?: \(OCR\))?\s*/i, '').trim();
  if (body.length < 12) return true;
  return body.length < 180 && selectableLineCount <= 5;
}

export function byteLength(value) {
  return new TextEncoder().encode(String(value || '')).byteLength;
}
