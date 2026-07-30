import { normalizeDraftRichText, richTextPlainText } from '../drafting/domain/draftRichText.js';

export const EMPTY_NOTE_RICH_TEXT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

function cleanIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
}

function normalizeRevision(revision = {}) {
  const richText = normalizeDraftRichText(revision.richText, []);
  return {
    version: Math.max(1, Number(revision.version) || 1),
    content: String(revision.content || richTextPlainText(richText)).trim(),
    richText,
    appendix: String(revision.appendix || '').trim(),
    linkedCommunicationIds: cleanIds(revision.linkedCommunicationIds),
    linkedReferenceIds: cleanIds(revision.linkedReferenceIds),
    editedAt: revision.editedAt || '',
    editedByUserId: revision.editedByUserId || '',
    editedByName: String(revision.editedByName || '').trim(),
  };
}

export function normalizeNote(input = {}) {
  const richText = normalizeDraftRichText(input.richText, []);
  return {
    id: input.id || '',
    issueId: input.issueId || '',
    sequence: Math.max(0, Number(input.sequence) || 0),
    version: Math.max(1, Number(input.version) || 1),
    content: String(input.content || richTextPlainText(richText)).trim(),
    richText,
    appendix: String(input.appendix || '').trim(),
    linkedCommunicationIds: cleanIds(input.linkedCommunicationIds),
    linkedReferenceIds: cleanIds(input.linkedReferenceIds),
    revisions: (Array.isArray(input.revisions) ? input.revisions : []).map(normalizeRevision),
    authorUserId: input.authorUserId || '',
    authorName: String(input.authorName || '').trim(),
    createdAt: input.createdAt || '',
    updatedAt: input.updatedAt || '',
    cloudRevision: Math.max(0, Number(input.cloudRevision) || 0),
    cloudUpdatedAt: input.cloudUpdatedAt || '',
    cloudUpdatedBy: input.cloudUpdatedBy || '',
  };
}

export function validateNote(input) {
  const note = normalizeNote(input);
  return note.content ? {} : { content: 'Enter the substance of the note.' };
}

export function noteRevisionSnapshot(note) {
  const current = normalizeNote(note);
  return normalizeRevision({
    version: current.version,
    content: current.content,
    richText: current.richText,
    appendix: current.appendix,
    linkedCommunicationIds: current.linkedCommunicationIds,
    linkedReferenceIds: current.linkedReferenceIds,
    editedAt: current.updatedAt || current.createdAt,
    editedByUserId: current.authorUserId,
    editedByName: current.authorName,
  });
}

export function plainTextToNoteRichText(value) {
  const lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
  const content = [];
  let activeList = null;
  const pushParagraph = (text) => {
    content.push({
      type: 'paragraph',
      ...(text ? { content: [{ type: 'text', text }] } : {}),
    });
  };
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const listType = bullet ? 'bulletList' : ordered ? 'orderedList' : '';
    if (listType) {
      if (!activeList || activeList.type !== listType) {
        activeList = { type: listType, content: [] };
        content.push(activeList);
      }
      activeList.content.push({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: bullet?.[1] || ordered?.[1] }],
        }],
      });
      return;
    }
    activeList = null;
    if (line || (content.length && content.at(-1)?.type !== 'paragraph')) pushParagraph(line);
  });
  return normalizeDraftRichText({
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  });
}
