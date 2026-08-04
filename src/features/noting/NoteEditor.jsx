import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Fragment, Slice } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import {
  Bold,
  Columns3,
  Italic,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  Redo2,
  Rows3,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { normalizeDraftRichText } from '../drafting/domain/draftRichText';
import { plainTextToNoteRichText } from './noteUtils';
import {
  FontSizeMark,
  NOTE_FONT_SIZES,
  ParagraphIndent,
} from '../../components/editor/RichTextFormatting';

function Tool({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-35 ${
        active ? 'border-indigo-300 bg-indigo-100 text-indigo-900' : 'border-transparent text-slate-600 hover:border-indigo-200 hover:bg-white hover:text-indigo-800'
      }`}
    >
      {children}
    </button>
  );
}

const NoteEditor = forwardRef(function NoteEditor({ value, onChange, onSelectionChange, readOnly = false }, ref) {
  const normalized = normalizeDraftRichText(value);
  const key = JSON.stringify(normalized);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
      }),
      TableKit.configure({
        table: { resizable: true, HTMLAttributes: { class: 'note-table' } },
      }),
      ParagraphIndent,
      FontSizeMark,
    ],
    content: normalized,
    onUpdate: ({ editor: current }) => onChange?.(current.getJSON()),
    onSelectionUpdate: ({ editor: current }) => {
      const { from, to } = current.state.selection;
      onSelectionChange?.({
        from,
        to,
        text: current.state.doc.textBetween(from, to, '\n\n'),
      });
    },
  });

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus(),
    getSelection: () => {
      if (!editor) return { from: 0, to: 0, text: '' };
      const { from, to } = editor.state.selection;
      return { from, to, text: editor.state.doc.textBetween(from, to, '\n\n') };
    },
    replaceSelection: ({ from, to }, replacement) => {
      if (!editor || from >= to || from < 0 || to > editor.state.doc.content.size) return false;
      const richText = plainTextToNoteRichText(replacement);
      const nodes = richText.content.map((node) => editor.schema.nodeFromJSON(node));
      const slice = Slice.maxOpen(Fragment.fromArray(nodes));
      editor.view.dispatch(editor.state.tr.replaceRange(from, to, slice));
      editor.commands.focus();
      return true;
    },
  }), [editor]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(normalizeDraftRichText(editor.getJSON())) !== key) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [editor, key]);

  if (!editor) return <div className="min-h-52 animate-pulse rounded-md bg-slate-100" />;

  return (
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm transition-shadow focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200">
      {!readOnly && (
        <div className="overflow-x-auto border-b border-indigo-100 bg-indigo-50/60 px-2 py-1.5">
          <div className="flex min-w-max items-center gap-0.5">
            <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></Tool>
            <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <Tool label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Tool>
            <Tool label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
            <Tool label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <label className="mr-1">
              <span className="sr-only">Font size</span>
              <select
                title="Font size"
                aria-label="Font size"
                value={Number(editor.getAttributes('fontSize').size) || 12}
                onChange={(event) => editor.chain().focus().setFontSize(Number(event.target.value)).run()}
                className="h-9 w-[4.75rem] rounded border border-slate-300 bg-white px-2 text-xs text-slate-700"
              >
                {NOTE_FONT_SIZES.map((size) => <option key={size} value={size}>{size} pt</option>)}
              </select>
            </label>
            <Tool label="Decrease paragraph indent (Shift+Tab)" disabled={!Number(editor.getAttributes('paragraph').indent)} onClick={() => editor.chain().focus().decreaseParagraphIndent().run()}><IndentDecrease className="h-4 w-4" /></Tool>
            <Tool label="Increase paragraph indent (Tab)" onClick={() => editor.chain().focus().increaseParagraphIndent().run()}><IndentIncrease className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
            <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <Tool label="Insert 3 by 3 table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></Tool>
            <Tool label="Add row" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="h-4 w-4" /></Tool>
            <Tool label="Add column" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></Tool>
            <Tool label="Delete table" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-4 w-4" /></Tool>
          </div>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="note-rich-editor bg-white px-5 py-5 font-serif text-[12pt] leading-7 text-slate-900 sm:px-8 sm:py-7 [&_.ProseMirror]:min-h-72 [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-7 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-7 [&_.ProseMirror_table]:my-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:table-fixed [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-400 [&_.ProseMirror_td]:p-1.5 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-500 [&_.ProseMirror_th]:bg-slate-100 [&_.ProseMirror_th]:p-1.5"
      />
    </div>
  );
});

export default NoteEditor;
