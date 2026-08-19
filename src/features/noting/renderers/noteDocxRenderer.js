import {
  AlignmentType,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { normalizeDraftRichText } from '../../drafting/domain/draftRichText.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function safeFilename(value) {
  return String(value || 'file-note').trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'file-note';
}

function textRuns(paragraph, stylePreset = 'normal') {
  const headingSize = stylePreset === 'heading' ? 32 : stylePreset === 'subheading' ? 26 : 0;
  return (paragraph.content || []).flatMap((node) => {
    if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
    const marks = new Map((node.marks || []).map((mark) => [mark.type, mark]));
    return node.text ? [new TextRun({
      text: node.text,
      bold: marks.has('bold') || Boolean(headingSize),
      italics: marks.has('italic'),
      underline: marks.has('underline') ? {} : undefined,
      font: 'Arial',
      size: headingSize || Number(marks.get('fontSize')?.attrs?.size || 12) * 2,
    })] : [];
  });
}

function noteParagraph(paragraph, list = {}) {
  const alignment = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[paragraph.attrs?.textAlign] || AlignmentType.LEFT;
  const stylePreset = paragraph.attrs?.stylePreset || 'normal';
  return new Paragraph({
    children: textRuns(paragraph, stylePreset),
    alignment,
    pageBreakBefore: Boolean(paragraph.attrs?.pageBreakBefore),
    indent: stylePreset === 'quotation'
      ? { left: 720 }
      : paragraph.attrs?.indent || paragraph.attrs?.firstLineIndent || paragraph.attrs?.rightIndent ? {
        ...(paragraph.attrs?.indent ? { left: Number(paragraph.attrs.indent) * 360 } : {}),
        ...(Number(paragraph.attrs?.firstLineIndent) > 0 ? { firstLine: Number(paragraph.attrs.firstLineIndent) * 284 } : {}),
        ...(Number(paragraph.attrs?.firstLineIndent) < 0 ? { hanging: Math.abs(Number(paragraph.attrs.firstLineIndent)) * 284 } : {}),
        ...(paragraph.attrs?.rightIndent ? { right: Number(paragraph.attrs.rightIndent) * 284 } : {}),
      } : undefined,
    bullet: list.type === 'bullet' ? { level: Math.min(8, Number(list.level) || 0) } : undefined,
    numbering: list.type === 'ordered' ? { reference: list.reference, level: 0 } : undefined,
    spacing: { after: 120, line: 276 },
  });
}

function noteTable(node) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: node.content.map((row) => new TableRow({
      children: row.content.map((cell) => new TableCell({
        columnSpan: Number(cell.attrs?.colspan) || 1,
        rowSpan: Number(cell.attrs?.rowspan) || 1,
        children: cell.content.map((paragraph) => noteParagraph(paragraph)),
      })),
    })),
  });
}

export function buildNoteDocxDocument({ richText, appendix = '' }) {
  const normalized = normalizeDraftRichText(richText);
  const children = [];
  const numberingConfig = [];
  const appendList = (node, depth = 0) => {
    const list = node.type === 'orderedList'
      ? { type: 'ordered', level: depth, reference: `note-numbering-${numberingConfig.length + 1}` }
      : { type: 'bullet', level: depth };
    if (list.type === 'ordered') {
      const numberingStyle = node.attrs?.numberingStyle || 'decimal';
      numberingConfig.push({
        reference: list.reference,
        levels: [{
          level: 0,
          format: { lowerRoman: LevelFormat.LOWER_ROMAN, lowerAlpha: LevelFormat.LOWER_LETTER }[numberingStyle] || LevelFormat.DECIMAL,
          text: numberingStyle === 'decimal' ? '%1.' : '(%1)',
          start: Math.max(1, Number(node.attrs?.start) || 1),
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720 + (depth * 360), hanging: 360 } } },
        }],
      });
    }
    node.content.forEach((item) => item.content.forEach((child) => {
      if (child.type === 'paragraph') children.push(noteParagraph(child, list));
      else appendList(child, depth + 1);
    }));
  };
  normalized.content.forEach((node) => {
    if (node.type === 'paragraph') children.push(noteParagraph(node));
    if (node.type === 'bulletList' || node.type === 'orderedList') appendList(node);
    if (node.type === 'table') children.push(noteTable(node));
  });
  if (appendix.trim()) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Appendix', bold: true, font: 'Arial', size: 24 })], spacing: { before: 240, after: 120 } }));
    appendix.trim().split(/\n{2,}/).forEach((text) => children.push(new Paragraph({ children: [new TextRun({ text, font: 'Arial', size: 24 })], spacing: { after: 120, line: 276 } })));
  }
  return new Document({
    numbering: { config: numberingConfig },
    styles: { default: { document: { run: { font: 'Arial', size: 24 }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } }, children }],
  });
}

export async function downloadNoteAsDocx({ richText, appendix, title, sequence }) {
  const blob = await Packer.toBlob(buildNoteDocxDocument({ richText, appendix }));
  const url = URL.createObjectURL(new Blob([blob], { type: DOCX_MIME }));
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(title)}${sequence ? `-note-${sequence}` : '-note'}.docx`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
