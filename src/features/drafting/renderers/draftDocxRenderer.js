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
import { buildGovernmentCommunicationBlocks } from '../../../utils/governmentDraftUtils.js';
import { normalizeDraftDocument, renderDraftDocumentText } from '../domain/draftDocument.js';
import { getDraftTemplate } from '../templates/templateRegistry.js';
import { richTextDocumentNodes } from '../domain/draftRichText.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const alignments = {
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
  left: AlignmentType.LEFT,
};

const recipientIndentTwips = {
  none: 0,
  small: 360,
  standard: 720,
  wide: 1080,
};

function safeFilename(value) {
  return String(value || 'official-draft').trim().replace(/[<>:"/\\|?*]+/g, '-').replace(/\s+/g, '-').slice(0, 80) || 'official-draft';
}

function textRuns(content, options = {}) {
  const lines = String(content || '').split('\n');
  return lines.flatMap((line, index) => [
    ...(index ? [new TextRun({ break: 1 })] : []),
    new TextRun({
      text: line,
      bold: options.bold,
      italics: options.italic,
      underline: options.underline ? {} : undefined,
      font: options.fontFamily,
      size: Number(options.fontSize || 12) * 2,
    }),
  ]);
}

function richTextRuns(runs, styleProfile) {
  return runs.flatMap((run) => String(run.text || '').split('\n').flatMap((line, index) => [
    ...(index ? [new TextRun({ break: 1 })] : []),
    new TextRun({
      text: line,
      bold: run.bold,
      italics: run.italic,
      underline: run.underline ? {} : undefined,
      font: styleProfile.fontFamily,
      size: Number(run.fontSize || styleProfile.fontSize || 12) * 2,
    }),
  ]));
}

function documentParagraph(content, blockStyle, styleProfile, options = {}) {
  return new Paragraph({
    alignment: alignments[options.alignment || blockStyle?.alignment] || AlignmentType.LEFT,
    ...(options.listType === 'bullet' ? { bullet: { level: 0 } } : {}),
    ...(options.listType === 'ordered' ? { numbering: { reference: 'draft-numbering', level: 0 } } : {}),
    spacing: {
      after: Number(options.spacingAfter ?? styleProfile.paragraphSpacing ?? 0) * 20,
      line: Math.round(Number(styleProfile.lineSpacing || 1.15) * 240),
    },
    ...(options.indentLeft ? { indent: { left: options.indentLeft } } : {}),
    keepNext: ['officeHeading', 'communicationNumber', 'date', 'documentTitle', 'subject'].includes(options.role),
    children: options.runs
      ? richTextRuns(options.runs, styleProfile)
      : textRuns(content, {
        bold: Boolean(blockStyle?.bold),
        fontFamily: styleProfile.fontFamily,
        fontSize: styleProfile.fontSize,
      }),
  });
}

function documentTable(node, styleProfile) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: node.rows.map((row) => new TableRow({
      children: row.map((cell) => new TableCell({
        columnSpan: cell.colspan,
        rowSpan: cell.rowspan,
        children: cell.paragraphs.map((paragraph) => documentParagraph('', null, styleProfile, {
          alignment: paragraph.alignment,
          runs: paragraph.runs,
          spacingAfter: 0,
        })),
      })),
    })),
  });
}

function isHeadingPair(first, second) {
  const roles = new Set([first?.role, second?.role]);
  return roles.has('communicationNumber') && roles.has('officeHeading');
}

function splitAddressBlock(block) {
  if (!['recipient', 'copyList'].includes(block?.role)) return null;
  const lines = String(block.content || '').split('\n');
  const labelIndex = lines.findIndex((line) => /^(?:to|copy to|copy forwarded(?: for information\/necessary action)? to|list of papers forwarded)\s*:?-?$/i.test(line.trim()));
  return labelIndex >= 0 && labelIndex < lines.length - 1
    ? { label: lines.slice(0, labelIndex + 1).join('\n'), address: lines.slice(labelIndex + 1).join('\n') }
    : { label: '', address: lines.join('\n') };
}

function structuredChildren(document) {
  const template = getDraftTemplate(document.templateId);
  const metadata = document.metadata;
  const body = document.blocks
    .filter((item) => item.role === 'bodyParagraph')
    .map((item) => item.content)
    .join('\n\n');
  const blocks = buildGovernmentCommunicationBlocks({
    communicationType: template.label,
    officeProfile: metadata.officeProfile,
    signatory: metadata.signatory,
    recipient: metadata.recipient,
    subject: metadata.subject,
    fileNumber: metadata.communicationNumber,
    issueDate: metadata.issueDate,
    salutation: metadata.salutation,
    copyTo: metadata.copyTo,
    body,
  });

  return blocks.flatMap((item, index) => {
    const blockStyle = template.blocks.find((candidate) => candidate.role === item.role);
    if (item.role === 'body') {
      return richTextDocumentNodes(document.bodyRichText, document.blocks).map((node) => (
        node.type === 'table'
          ? documentTable(node, document.styleProfileSnapshot)
          : documentParagraph('', blockStyle, document.styleProfileSnapshot, {
            role: item.role,
            alignment: node.alignment,
            listType: node.listType,
            indentLeft: Number(node.indentLevel || 0) * 720,
            runs: node.runs,
          })
      ));
    }
    const addressBlock = splitAddressBlock(item);
    if (addressBlock) {
      const indentLeft = recipientIndentTwips[document.styleProfileSnapshot.recipientIndent || 'small'] || 0;
      return [
        ...(addressBlock.label ? [documentParagraph(addressBlock.label, blockStyle, document.styleProfileSnapshot, {
          role: item.role,
          spacingAfter: 0,
        })] : []),
        documentParagraph(addressBlock.address, blockStyle, document.styleProfileSnapshot, {
          role: item.role,
          indentLeft,
        }),
      ];
    }
    return [documentParagraph(item.content, blockStyle, document.styleProfileSnapshot, {
      role: item.role,
      spacingAfter: isHeadingPair(item, blocks[index + 1]) ? 0 : undefined,
    })];
  });
}

function legacyChildren(document, fallback) {
  const content = renderDraftDocumentText(document, fallback);
  return String(content || '').split(/\n\s*\n/).filter(Boolean).map((paragraph) =>
    documentParagraph(paragraph, { alignment: 'left' }, document.styleProfileSnapshot, { role: 'legacyDocument' }));
}

export function buildDraftDocxDocument(input, { fallbackContent = '' } = {}) {
  const document = normalizeDraftDocument(input, { content: fallbackContent });
  if (!document) throw new Error('There is no draft to export.');
  const isLegacy = document.blocks.some((item) => item.role === 'legacyDocument');
  const children = isLegacy ? legacyChildren(document, fallbackContent) : structuredChildren(document);
  if (!children.length) throw new Error('There is no draft to export.');

  return new Document({
    numbering: {
      config: [{
        reference: 'draft-numbering',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: {
          run: {
            font: document.styleProfileSnapshot.fontFamily,
            size: Number(document.styleProfileSnapshot.fontSize || 12) * 2,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: document.styleProfileSnapshot.margins === 'narrow'
            ? { top: 720, right: 720, bottom: 720, left: 720 }
            : { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

export async function buildDraftDocx(input, options) {
  return Packer.toBlob(buildDraftDocxDocument(input, options));
}

export async function downloadDraftAsDocx({ document: input, content, title, version }) {
  const blob = await buildDraftDocx(input, { fallbackContent: content });
  const url = URL.createObjectURL(new Blob([blob], { type: DOCX_MIME }));
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFilename(title)}${version ? `-v${version}` : ''}.docx`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
