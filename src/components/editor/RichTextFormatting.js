import { Extension, Mark } from '@tiptap/react';

const MAX_INDENT_LEVEL = 6;
const FONT_SIZES = new Set([10, 11, 12, 13, 14, 16, 18]);
const PARAGRAPH_STYLES = new Set(['normal', 'heading', 'subheading', 'recommendation', 'conclusion', 'quotation']);
const NUMBERING_STYLES = new Set(['decimal', 'lowerRoman', 'lowerAlpha']);

function clampedIndent(value) {
  return Math.min(MAX_INDENT_LEVEL, Math.max(0, Number(value) || 0));
}

function clampedFirstLineIndent(value) {
  return Math.min(MAX_INDENT_LEVEL, Math.max(-MAX_INDENT_LEVEL, Number(value) || 0));
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
        firstLineIndent: {
          default: 0,
          parseHTML: (element) => clampedFirstLineIndent(element.getAttribute('data-first-line-indent')),
          renderHTML: (attributes) => {
            const firstLineIndent = clampedFirstLineIndent(attributes.firstLineIndent);
            return firstLineIndent
              ? { 'data-first-line-indent': firstLineIndent, style: `text-indent: ${firstLineIndent * 0.5}cm` }
              : {};
          },
        },
        rightIndent: {
          default: 0,
          parseHTML: (element) => clampedIndent(element.getAttribute('data-right-indent')),
          renderHTML: (attributes) => {
            const rightIndent = clampedIndent(attributes.rightIndent);
            return rightIndent
              ? { 'data-right-indent': rightIndent, style: `margin-right: ${rightIndent * 0.5}cm` }
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
      setParagraphRulerIndent: (attributes) => ({ commands }) => commands.updateAttributes('paragraph', {
        ...(attributes.indent !== undefined ? { indent: clampedIndent(attributes.indent) } : {}),
        ...(attributes.firstLineIndent !== undefined ? { firstLineIndent: clampedFirstLineIndent(attributes.firstLineIndent) } : {}),
        ...(attributes.rightIndent !== undefined ? { rightIndent: clampedIndent(attributes.rightIndent) } : {}),
      }),
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

export const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',

  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        stylePreset: {
          default: 'normal',
          parseHTML: (element) => PARAGRAPH_STYLES.has(element.getAttribute('data-paragraph-style'))
            ? element.getAttribute('data-paragraph-style')
            : 'normal',
          renderHTML: ({ stylePreset }) => PARAGRAPH_STYLES.has(stylePreset) && stylePreset !== 'normal'
            ? { 'data-paragraph-style': stylePreset }
            : {},
        },
      },
    }];
  },

  addCommands() {
    return {
      setParagraphStyle: (stylePreset) => ({ commands }) => (
        PARAGRAPH_STYLES.has(stylePreset)
          ? commands.updateAttributes('paragraph', { stylePreset })
          : false
      ),
    };
  },
});

export const GovernmentNumbering = Extension.create({
  name: 'governmentNumbering',

  addGlobalAttributes() {
    return [{
      types: ['orderedList'],
      attributes: {
        numberingStyle: {
          default: 'decimal',
          parseHTML: (element) => NUMBERING_STYLES.has(element.getAttribute('data-numbering-style'))
            ? element.getAttribute('data-numbering-style')
            : 'decimal',
          renderHTML: ({ numberingStyle }) => NUMBERING_STYLES.has(numberingStyle) && numberingStyle !== 'decimal'
            ? {
              'data-numbering-style': numberingStyle,
              style: `list-style-type: ${numberingStyle === 'lowerRoman' ? 'lower-roman' : 'lower-alpha'}`,
            }
            : {},
        },
      },
    }];
  },

  addCommands() {
    return {
      setNumberingStyle: (numberingStyle) => ({ commands }) => (
        NUMBERING_STYLES.has(numberingStyle)
          ? commands.updateAttributes('orderedList', { numberingStyle })
          : false
      ),
    };
  },
});

export const PageBreakBefore = Extension.create({
  name: 'pageBreakBefore',

  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        pageBreakBefore: {
          default: false,
          parseHTML: (element) => element.getAttribute('data-page-break-before') === 'true',
          renderHTML: ({ pageBreakBefore }) => pageBreakBefore
            ? { 'data-page-break-before': 'true' }
            : {},
        },
      },
    }];
  },

  addCommands() {
    return {
      togglePageBreakBefore: () => ({ commands, editor }) => commands.updateAttributes('paragraph', {
        pageBreakBefore: !Boolean(editor.getAttributes('paragraph').pageBreakBefore),
      }),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.togglePageBreakBefore() };
  },
});

export const NOTE_FONT_SIZES = [...FONT_SIZES];
export const NOTE_PARAGRAPH_STYLES = [
  { value: 'normal', label: 'Normal paragraph' },
  { value: 'heading', label: 'Heading' },
  { value: 'subheading', label: 'Subheading' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'conclusion', label: 'Conclusion' },
  { value: 'quotation', label: 'Quotation' },
];
export const GOVERNMENT_NUMBERING_STYLES = [
  { value: 'decimal', label: '1, 2, 3' },
  { value: 'lowerRoman', label: '(i), (ii), (iii)' },
  { value: 'lowerAlpha', label: '(a), (b), (c)' },
];
