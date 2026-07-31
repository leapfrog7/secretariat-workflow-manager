const INLINE_MARKS = new Set(['bold', 'italic', 'underline']);
const PARAGRAPH_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const FONT_SIZES = new Set([10, 11, 12, 13, 14, 16, 18]);
const MAX_INDENT_LEVEL = 6;

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
  const content = (Array.isArray(node.content) ? node.content : []).map(normalizeInlineNode).filter(Boolean);
  return {
    type: 'paragraph',
    ...(textAlign || indent ? { attrs: { ...(textAlign ? { textAlign } : {}), ...(indent ? { indent } : {}) } } : {}),
    ...(content.length ? { content } : {}),
  };
}

function normalizeListItem(node = {}) {
  const content = (Array.isArray(node.content) ? node.content : [])
    .filter((child) => child?.type === 'paragraph')
    .map(normalizeParagraph);
  return {
    type: 'listItem',
    content: content.length ? content : [{ type: 'paragraph' }],
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
    const content = (Array.isArray(node.content) ? node.content : [])
      .filter((child) => child?.type === 'listItem')
      .map(normalizeListItem);
    return {
      type: node.type,
      content: content.length ? content : [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
    };
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
  richText.content.forEach((node) => {
    if (node.type === 'paragraph') remember(node);
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const listType = node.type === 'bulletList' ? 'bullet' : 'ordered';
      node.content.forEach((item) => item.content.forEach((paragraph) => remember(paragraph, listType)));
    }
  });
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
  const pushParagraph = (paragraph, listType = '') => {
    const content = inlineText(paragraph.content);
    const previous = reusable[blocks.length];
    blocks.push({
      id: previous?.id || `body-${crypto.randomUUID()}`,
      role: 'bodyParagraph',
      content,
      source: previous?.content === content ? previous.source : source,
      locked: false,
      alignment: PARAGRAPH_ALIGNMENTS.has(paragraph.attrs?.textAlign) ? paragraph.attrs.textAlign : '',
      indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(paragraph.attrs?.indent) || 0)),
      listType,
    });
  };

  richText.content.forEach((node) => {
    if (node.type === 'paragraph') pushParagraph(node);
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      node.content.forEach((item) => item.content.forEach((paragraph) => pushParagraph(
        paragraph,
        node.type === 'bulletList' ? 'bullet' : 'ordered',
      )));
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
  });
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
  const push = (paragraph, listType = '') => {
    paragraphs.push({
      alignment: PARAGRAPH_ALIGNMENTS.has(paragraph.attrs?.textAlign) ? paragraph.attrs.textAlign : '',
      indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(paragraph.attrs?.indent) || 0)),
      listType,
      runs: paragraphRuns(paragraph),
    });
  };
  richText.content.forEach((node) => {
    if (node.type === 'paragraph') push(node);
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      node.content.forEach((item) => item.content.forEach((paragraph) => push(
        paragraph,
        node.type === 'bulletList' ? 'bullet' : 'ordered',
      )));
    }
  });
  return paragraphs;
}

export function richTextDocumentNodes(input, fallbackBlocks = []) {
  const richText = normalizeDraftRichText(input, fallbackBlocks);
  return richText.content.flatMap((node) => {
    if (node.type === 'paragraph') {
      return [{
        type: 'paragraph',
        alignment: PARAGRAPH_ALIGNMENTS.has(node.attrs?.textAlign) ? node.attrs.textAlign : '',
        indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(node.attrs?.indent) || 0)),
        listType: '',
        runs: paragraphRuns(node),
      }];
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return node.content.flatMap((item) => item.content.map((paragraph) => ({
        type: 'paragraph',
        alignment: PARAGRAPH_ALIGNMENTS.has(paragraph.attrs?.textAlign) ? paragraph.attrs.textAlign : '',
        indentLevel: Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(paragraph.attrs?.indent) || 0)),
        listType: node.type === 'bulletList' ? 'bullet' : 'ordered',
        runs: paragraphRuns(paragraph),
      })));
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
            runs: paragraphRuns(paragraph),
          })),
        }))),
      }];
    }
    return [];
  });
}

export function richTextPlainText(input, fallbackBlocks = []) {
  let orderedIndex = 0;
  let previousListType = '';
  return richTextDocumentNodes(input, fallbackBlocks).map((node) => {
    if (node.type === 'table') {
      previousListType = '';
      orderedIndex = 0;
      return node.rows.map((row) => `| ${row.map((cell) => cell.paragraphs
        .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
        .join(' ')).join(' | ')} |`).join('\n');
    }
    if (node.listType !== 'ordered') orderedIndex = 0;
    if (node.listType === 'ordered') {
      orderedIndex = previousListType === 'ordered' ? orderedIndex + 1 : 1;
    }
    previousListType = node.listType;
    const text = node.runs.map((run) => run.text).join('');
    if (node.listType === 'bullet') return `- ${text}`;
    if (node.listType === 'ordered') return `${orderedIndex}. ${text}`;
    return text;
  }).join('\n\n');
}
