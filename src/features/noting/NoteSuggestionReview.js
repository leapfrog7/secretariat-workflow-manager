import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const noteSuggestionReviewKey = new PluginKey('noteSuggestionReview');

function textBlockRanges(doc) {
  const ranges = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) ranges.push({ from: pos + 1, to: pos + node.nodeSize - 1, pos, nodeSize: node.nodeSize });
  });
  return ranges;
}

function actionButton(label, tone, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = `note-ai-suggestion-action note-ai-suggestion-action--${tone}`;
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  });
  return button;
}

function suggestionWidget(group, index, review) {
  const wrapper = document.createElement('aside');
  wrapper.className = 'note-ai-suggestion';
  wrapper.contentEditable = 'false';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', `AI suggestion ${index + 1}`);

  const heading = document.createElement('div');
  heading.className = 'note-ai-suggestion__heading';
  heading.textContent = group.added.length ? `AI suggestion ${index + 1}` : `AI suggests removing this passage`;
  wrapper.appendChild(heading);

  if (group.added.length) {
    const wording = document.createElement('div');
    wording.className = 'note-ai-suggestion__wording';
    group.added.forEach((paragraph) => {
      const line = document.createElement('p');
      line.textContent = paragraph;
      wording.appendChild(line);
    });
    wrapper.appendChild(wording);
  }

  const actions = document.createElement('div');
  actions.className = 'note-ai-suggestion__actions';
  actions.append(
    actionButton('Reject', 'reject', () => review.onReject?.(group.id)),
    actionButton('Accept', 'accept', () => review.onAccept?.(group.id)),
  );
  wrapper.appendChild(actions);
  return wrapper;
}

function buildDecorations(doc, review) {
  if (!review?.groups?.length || typeof document === 'undefined') return DecorationSet.empty;
  const ranges = textBlockRanges(doc);
  const decorations = [];
  review.groups.filter((group) => group.status === 'pending').forEach((group, index) => {
    const removedRanges = ranges.slice(group.currentStart, group.currentStart + group.removed.length);
    removedRanges.forEach((range) => {
      if (range.to > range.from) decorations.push(Decoration.inline(range.from, range.to, { class: 'note-ai-suggestion-removed' }));
    });
    const anchorRange = removedRanges.at(-1);
    const nextRange = ranges[group.currentStart];
    const anchor = anchorRange ? anchorRange.pos + anchorRange.nodeSize : (nextRange?.pos ?? doc.content.size);
    decorations.push(Decoration.widget(anchor, () => suggestionWidget(group, index, review), {
      key: `${review.candidateId}-${group.id}`,
      side: 1,
    }));
  });
  return DecorationSet.create(doc, decorations);
}

export const NoteSuggestionReview = Extension.create({
  name: 'noteSuggestionReview',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: noteSuggestionReviewKey,
      state: {
        init: () => null,
        apply(transaction, current) {
          const next = transaction.getMeta(noteSuggestionReviewKey);
          return next === undefined ? current : next;
        },
      },
      props: {
        decorations(state) {
          return buildDecorations(state.doc, noteSuggestionReviewKey.getState(state));
        },
      },
    })];
  },
});
