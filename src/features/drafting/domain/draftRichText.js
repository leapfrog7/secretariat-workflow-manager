const INLINE_MARKS = new Set(['bold', 'italic', 'underline']);
const PARAGRAPH_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const FONT_SIZES = new Set([10, 11, 12, 13, 14, 16, 18]);
const MAX_INDENT_LEVEL = 6;
const PARAGRAPH_STYLES = new Set(['normal', 'heading', 'subheading', 'recommendation', 'conclusion', 'quotation']);
const NUMBERING_STYLES = new Set(['decimal', 'lowerRoman', 'lowerAlpha']);

function normalizeMarks(marks) {
  if (!Array.isArray(marks)) return [];
  const normalized = [...new Set(marks.map((mark) => mark?.type).filter((type) => INLINE_MARKS.has(type)))]
    .map((type) => ({ type }));
  const fontSize = marks.find((mark) => mark?.type === 'fontSize');
  if (FONT_SIZES.has(Number(fontSize?.attrs?.size))) {
    normalized.push({ type: 'fontSize', attrs: { size: Number(fontSize.attrs.size) } });
  }
  return normalized;
}

function normalizeInlineNode(node) {
  if (node?.type === 'hardBreak') return { type: 'hardBreak' };
  if (node?.type !== 'text' || !node.text) return null;
  const marks = normalizeMarks(node.marks);
  return {
    type: 'text',
    text: String(node.text),
    ...(marks.length ? { marks } : {}),
  };
}

function normalizeParagraph(node = {}) {
  const textAlign = PARAGRAPH_ALIGNMENTS.has(node.attrs?.textAlign) ? node.attrs.textAlign : null;
  const indent = Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(node.attrs?.indent) || 0));
  const firstLineIndent = Math.min(MAX_INDENT_LEVEL, Math.max(-MAX_INDENT_LEVEL, Number(node.attrs?.firstLineIndent) || 0));
  const rightIndent = Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(node.attrs?.rightIndent) || 0));
  const stylePreset = PARAGRAPH_STYLES.has(node.attrs?.stylePreset) ? node.attrs.stylePreset : 'normal';
  const pageBreakBefore = Boolean(node.attrs?.pageBreakBefore);
  const content = (Array.isArray(node.content) ? node.content : []).map(normalizeInlineNode).filter(Boolean);
  return {
    type: 'paragraph',
    ...(textAlign || indent || firstLineIndent || rightIndent || stylePreset !== 'normal' || pageBreakBefore ? { attrs: { ...(textAlign ? { textAlign } : {}), ...(indent ? { indent } : {}), ...(firstLineIndent ? { firstLineIndent } : {}), ...(rightIndent ? { rightIndent } : {}), ...(stylePreset !== 'normal' ? { stylePreset } : {}), ...(pageBreakBefore ? { pageBreakBefore: true } : {}) } } : {}),
    ...(content.length ? { content } : {}),
  };
}

function normalizeListItem(node = {}) {
  const content = (Array.isArray(node.content) ? node.content : [])
    .map((child) => child?.type === 'paragraph'
      ? normalizeParagraph(child)
      : child?.type === 'bulletList' || child?.type === 'orderedList'
        ? normalizeList(child)
        : null)
    .filter(Boolean);
  const validContent = content[0]?.type === 'paragraph' ? content : [{ type: 'paragraph' }, ...content];
  return {
    type: 'listItem',
    content: validContent,
  };
}

function normalizeList(node = {}) {
  const content = (Array.isArray(node.content) ? node.content : [])
    .filter((child) => child?.type === 'listItem')
    .map(normalizeListItem);
  return {
    type: node.type === 'bulletList' ? 'bulletList' : 'orderedList',
    ...(node.type === 'orderedList' ? { attrs: {
      start: Math.max(1, Number(node.attrs?.start) || 1),
      ...(NUMBERING_STYLES.has(node.attrs?.numberingStyle) && node.attrs.numberingStyle !== 'decimal'
        ? { numberingStyle: node.attrs.numberingStyle }
        : {}),
    } } : {}),
    content: content.length ? content : [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
  };
}

function normalizeTableCell(node = {}) {
  const content = (Array.isArray(node.content) ? node.content : [])
    .filter((child) => child?.type === 'paragraph')
    .map(normalizeParagraph);
  return {
    type: node.type === 'tableHeader' ? 'tableHeader' : 'tableCell',
    attrs: {
      colspan: Math.max(1, Number(node.attrs?.colspan) || 1),
      rowspan: Math.max(1, Number(node.attrs?.rowspan) || 1),
      colwidth: Array.isArray(node.attrs?.colwidth) ? node.attrs.colwidth : null,
    },
    content: content.length ? content : [{ type: 'paragraph' }],
  };
}

function normalizeTable(node = {}) {
  const rows = (Array.isArray(node.content) ? node.content : [])
    .filter((row) => row?.type === 'tableRow')
    .map((row) => ({
      type: 'tableRow',
      content: (Array.isArray(row.content) ? row.content : [])
        .filter((cell) => cell?.type === 'tableCell' || cell?.type === 'tableHeader')
        .map(normalizeTableCell),
    }))
    .filter((row) => row.content.length);
  if (!rows.length) return null;
  return { type: 'table', content: rows };
}

function normalizeBlockNode(node) {
  if (node?.type === 'paragraph') return normalizeParagraph(node);
  if (node?.type === 'bulletList' || node?.type === 'orderedList') {
    return normalizeList(node);
  }
  if (node?.type === 'table') return normalizeTable(node);
  return null;
}

function textNode(value) {
  const text = String(value || '');
  return text ? { type: 'text', text } : null;
}

export function bodyBlocksToRichText(blocks = []) {
  return mergeBodyBlocksWithRichText(blocks);
}

function plainParagraph(block) {
  const indent = Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(block.indentLevel) || 0));
  return {
    type: 'paragraph',
    ...((block.alignment && PARAGRAPH_ALIGNMENTS.has(block.alignment)) || indent
      ? { attrs: {
        ...(block.alignment && PARAGRAPH_ALIGNMENTS.has(block.alignment) ? { textAlign: block.alignment } : {}),
        ...(indent ? { indent } : {}),
      } }
      : {}),
    ...(block.content ? { content: [textNode(block.content)] } : {}),
  };
}

function reusableParagraphs(input) {
  const reusable = new Map();
  const richText = normalizeDraftRichText(input);
  const remember = (paragraph, listType = '') => {
    const key = `${listType}:${inlineText(paragraph.content)}`;
    const matches = reusable.get(key) || [];
    matches.push(paragraph);
    reusable.set(key, matches);
  };
  const visit = (node) => {
    if (node.type === 'paragraph') remember(node);
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const listType = node.type === 'bulletList' ? 'bullet' : 'ordered';
      node.content.forEach((item) => item.content.forEach((child) => {
        if (child.type === 'paragraph') remember(child, listType);
        else visit(child);
      }));
    }
  };
  richText.content.forEach(visit);
  return reusable;
}

export function mergeBodyBlocksWithRichText(blocks = [], previousRichText = null) {
  const reusable = previousRichText ? reusableParagraphs(previousRichText) : new Map();
  const bodyBlocks = blocks.filter((block) => block?.role === 'bodyParagraph');
  const content = [];
  let activeList = null;
  bodyBlocks.forEach((block) => {
    const listType = block.listType === 'bullet' || block.listType === 'ordered' ? block.listType : '';
    const key = `${listType}:${String(block.content || '')}`;
    const paragraph = reusable.get(key)?.shift() || plainParagraph(block);
    if (!listType) {
      activeList = null;
      content.push(paragraph);
      return;
    }
    if (!activeList || activeList.listType !== listType) {
      activeList = {
        listType,
        node: { type: listType === 'bullet' ? 'bulletList' : 'orderedList', content: [] },
      };
      content.push(activeList.node);
    }
    activeList.node.content.push({ type: 'listItem', content: [paragraph] });
  });
  return {
    type: 'doc',
    content: content.length ? content : [{
      type: 'paragraph',
    }],
  };
}

export function normalizeDraftRichText(input, fallbackBlocks = []) {
  if (!input || input.type !== 'doc' || !Array.isArray(input.content)) {
    return bodyBlocksToRichText(fallbackBlocks);
  }
  const content = input.content.map(normalizeBlockNode).filter(Boolean);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

function inlineText(content = []) {
  return content.map((node) => node.type === 'hardBreak' ? '\n' : String(node.text || '')).join('');
}

export function richTextToBodyBlocks(input, previousBlocks = [], source = 'user') {
  const richText = normalizeDraftRichText(input, previousBlocks);
  const reusable = previousBlocks.filter((block) => block.role === 'bodyParagraph');
  const blocks = [];
  const pushParagraph = (paragraph, listType = '', listLevel = 0) => {
    const content = inlineText(paragraph.content);
    const previous = reusable[blocks.length];
    blocks.push({
      id: previous?.id || `body-${crypto.randomUUID()}`,
      role: 'bodyParagraph',
      content,
      source: previous?.content === content ? previous.source : source,
      locked: false,
      alignment: PARAGRAPH_ALIGNMENTS.has(paragraph.attrs?.textAlign) ? paragraph.attrs.textAlign : '',
      indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(listLevel, Number(paragraph.attrs?.indent) || 0)),
      listType,
    });
  };

  const visit = (node, listLevel = 0) => {
    if (node.type === 'paragraph') pushParagraph(node);
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      node.content.forEach((item) => item.content.forEach((child) => {
        if (child.type === 'paragraph') pushParagraph(
          child,
          node.type === 'bulletList' ? 'bullet' : 'ordered',
          listLevel,
        );
        else visit(child, listLevel + 1);
      }));
    }
    if (node.type === 'table') {
      node.content.forEach((row) => {
        const content = row.content
          .map((cell) => cell.content.map((paragraph) => inlineText(paragraph.content)).join(' '))
          .join(' | ');
        const previous = reusable[blocks.length];
        blocks.push({
          id: previous?.id || `body-${crypto.randomUUID()}`,
          role: 'bodyParagraph',
          content,
          source: previous?.content === content ? previous.source : source,
          locked: false,
          alignment: '',
          listType: '',
        });
      });
    }
  };
  richText.content.forEach((node) => visit(node));
  return blocks;
}

function paragraphRuns(paragraph) {
  return (paragraph.content || []).map((node) => {
    if (node.type === 'hardBreak') return { text: '\n' };
    const marks = new Set((node.marks || []).map((mark) => mark.type));
    const fontSize = (node.marks || []).find((mark) => mark.type === 'fontSize');
    return {
      text: String(node.text || ''),
      bold: marks.has('bold'),
      italic: marks.has('italic'),
      underline: marks.has('underline'),
      fontSize: FONT_SIZES.has(Number(fontSize?.attrs?.size)) ? Number(fontSize.attrs.size) : null,
    };
  }).filter((run) => run.text);
}

export function richTextParagraphs(input, fallbackBlocks = []) {
  const richText = normalizeDraftRichText(input, fallbackBlocks);
  const paragraphs = [];
  const push = (paragraph, listType = '', listLevel = 0) => {
    paragraphs.push({
      alignment: PARAGRAPH_ALIGNMENTS.has(paragraph.attrs?.textAlign) ? paragraph.attrs.textAlign : '',
      indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(paragraph.attrs?.indent) || 0)),
      ...(paragraph.attrs?.firstLineIndent ? { firstLineIndent: Number(paragraph.attrs.firstLineIndent) } : {}),
      ...(paragraph.attrs?.rightIndent ? { rightIndent: Number(paragraph.attrs.rightIndent) } : {}),
      listType,
      listLevel,
      pageBreakBefore: Boolean(paragraph.attrs?.pageBreakBefore),
      runs: paragraphRuns(paragraph),
    });
  };
  const visit = (node, listLevel = 0) => {
    if (node.type === 'paragraph') push(node);
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      node.content.forEach((item) => item.content.forEach((child) => {
        if (child.type === 'paragraph') push(child, node.type === 'bulletList' ? 'bullet' : 'ordered', listLevel);
        else visit(child, listLevel + 1);
      }));
    }
  };
  richText.content.forEach((node) => visit(node));
  return paragraphs;
}

export function richTextDocumentNodes(input, fallbackBlocks = []) {
  const richText = normalizeDraftRichText(input, fallbackBlocks);
  let listSequence = 0;
  const flatten = (node, listLevel = 0) => {
    if (node.type === 'paragraph') {
      return [{
        type: 'paragraph',
        alignment: PARAGRAPH_ALIGNMENTS.has(node.attrs?.textAlign) ? node.attrs.textAlign : '',
        indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(node.attrs?.indent) || 0)),
        ...(node.attrs?.firstLineIndent ? { firstLineIndent: Number(node.attrs.firstLineIndent) } : {}),
        ...(node.attrs?.rightIndent ? { rightIndent: Number(node.attrs.rightIndent) } : {}),
        listType: '',
        listLevel: 0,
        pageBreakBefore: Boolean(node.attrs?.pageBreakBefore),
        runs: paragraphRuns(node),
      }];
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      listSequence += 1;
      const listId = `list-${listSequence}`;
      return node.content.flatMap((item, itemIndex) => item.content.flatMap((child) => (
        child.type === 'paragraph'
          ? [{
            type: 'paragraph',
            alignment: PARAGRAPH_ALIGNMENTS.has(child.attrs?.textAlign) ? child.attrs.textAlign : '',
            indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(child.attrs?.indent) || 0)),
            ...(child.attrs?.firstLineIndent ? { firstLineIndent: Number(child.attrs.firstLineIndent) } : {}),
            ...(child.attrs?.rightIndent ? { rightIndent: Number(child.attrs.rightIndent) } : {}),
            listType: node.type === 'bulletList' ? 'bullet' : 'ordered',
            listLevel,
            listId,
            listIndex: itemIndex,
            listStart: Math.max(1, Number(node.attrs?.start) || 1),
            numberingStyle: NUMBERING_STYLES.has(node.attrs?.numberingStyle) ? node.attrs.numberingStyle : 'decimal',
            pageBreakBefore: Boolean(child.attrs?.pageBreakBefore),
            runs: paragraphRuns(child),
          }]
          : flatten(child, listLevel + 1)
      )));
    }
    if (node.type === 'table') {
      return [{
        type: 'table',
        rows: node.content.map((row) => row.content.map((cell) => ({
          header: cell.type === 'tableHeader',
          colspan: cell.attrs?.colspan || 1,
          rowspan: cell.attrs?.rowspan || 1,
          paragraphs: cell.content.map((paragraph) => ({
            alignment: PARAGRAPH_ALIGNMENTS.has(paragraph.attrs?.textAlign) ? paragraph.attrs.textAlign : '',
            indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(paragraph.attrs?.indent) || 0)),
            ...(paragraph.attrs?.firstLineIndent ? { firstLineIndent: Number(paragraph.attrs.firstLineIndent) } : {}),
            ...(paragraph.attrs?.rightIndent ? { rightIndent: Number(paragraph.attrs.rightIndent) } : {}),
            runs: paragraphRuns(paragraph),
          })),
        }))),
      }];
    }
    return [];
  };
  return richText.content.flatMap((node) => flatten(node));
}

function romanNumeral(value) {
  const parts = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let remaining = Math.max(1, Number(value) || 1);
  return parts.map(([amount, symbol]) => {
    const count = Math.floor(remaining / amount);
    remaining %= amount;
    return symbol.repeat(count);
  }).join('');
}

function listLabel(node) {
  const value = Number(node.listStart || 1) + Number(node.listIndex || 0);
  if (node.numberingStyle === 'lowerRoman') return `(${romanNumeral(value)})`;
  if (node.numberingStyle === 'lowerAlpha') return `(${String.fromCharCode(96 + Math.min(26, value))})`;
  return `${value}.`;
}

export function richTextPlainText(input, fallbackBlocks = []) {
  return richTextDocumentNodes(input, fallbackBlocks).map((node) => {
    if (node.type === 'table') {
      return node.rows.map((row) => `| ${row.map((cell) => cell.paragraphs
        .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
        .join(' ')).join(' | ')} |`).join('\n');
    }
    const text = node.runs.map((run) => run.text).join('');
    const indent = '  '.repeat(Math.max(0, Number(node.listLevel) || 0));
    const prefix = node.pageBreakBefore ? '\f' : '';
    if (node.listType === 'bullet') return `${prefix}${indent}- ${text}`;
    if (node.listType === 'ordered') return `${prefix}${indent}${listLabel(node)} ${text}`;
    return `${prefix}${text}`;
  }).join('\n\n');
}
