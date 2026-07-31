import { Extension, Mark } from '@tiptap/react';

const MAX_INDENT_LEVEL = 6;
const FONT_SIZES = new Set([10, 11, 12, 13, 14, 16, 18]);

function clampedIndent(value) {
  return Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(value) || 0));
}

function changeParagraphIndent({ state, tr, dispatch }, delta) {
  const { from, to } = state.selection;
  const changed = new Set();
  let paragraphFound = false;

  state.doc.nodesBetween(
    Math.max(0, from - 1),
    Math.min(state.doc.content.size, to + 1),
    (node, position) => {
      if (node.type.name !== 'paragraph' || changed.has(position)) return;
      paragraphFound = true;
      const indent = clampedIndent(node.attrs.indent + delta);
      if (indent === clampedIndent(node.attrs.indent)) return;
      tr.setNodeMarkup(position, undefined, { ...node.attrs, indent });
      changed.add(position);
    },
  );

  if (changed.size && dispatch) dispatch(tr.scrollIntoView());
  return paragraphFound;
}

export const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',

  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => clampedIndent(element.getAttribute('data-indent')),
          renderHTML: (attributes) => {
            const indent = clampedIndent(attributes.indent);
            return indent
              ? { 'data-indent': indent, style: `margin-left: ${indent * 2}rem` }
              : {};
          },
        },
      },
    }];
  },

  addCommands() {
    return {
      increaseParagraphIndent: () => (props) => changeParagraphIndent(props, 1),
      decreaseParagraphIndent: () => (props) => changeParagraphIndent(props, -1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('table')) return false;
        if (this.editor.isActive('listItem')) {
          return this.editor.commands.sinkListItem('listItem');
        }
        return this.editor.commands.increaseParagraphIndent();
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('table')) return false;
        if (this.editor.isActive('listItem')) {
          return this.editor.commands.liftListItem('listItem');
        }
        return this.editor.commands.decreaseParagraphIndent();
      },
    };
  },
});

export const FontSizeMark = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      size: {
        default: 12,
        parseHTML: (element) => Number(element.getAttribute('data-font-size')) || 12,
        renderHTML: ({ size }) => {
          const normalized = FONT_SIZES.has(Number(size)) ? Number(size) : 12;
          return { 'data-font-size': normalized, style: `font-size: ${normalized}pt` };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-font-size]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setFontSize: (size) => ({ commands }) => (
        FONT_SIZES.has(Number(size))
          ? commands.setMark(this.name, { size: Number(size) })
          : false
      ),
      unsetFontSize: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

export const NOTE_FONT_SIZES = [...FONT_SIZES];
