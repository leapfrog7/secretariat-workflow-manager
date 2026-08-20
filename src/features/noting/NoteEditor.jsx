import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Fragment, Slice } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Italic,
  IndentDecrease,
  IndentIncrease,
  List,
  ListOrdered,
  Search,
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
  GOVERNMENT_NUMBERING_STYLES,
  GovernmentNumbering,
  NOTE_FONT_SIZES,
  NOTE_PARAGRAPH_STYLES,
  ParagraphIndent,
  ParagraphStyle,
  PageBreakBefore,
} from '../../components/editor/RichTextFormatting';
import {
  EditorFindReplace,
  EditorStatusBar,
  DesktopDocumentRuler,
  EditorToolButton as Tool,
  FormatPainterControls,
  MobileEditorMoreSheet,
  MobileEditorToolbar,
  MoreToolsLabel,
  PageBreakControl,
  SelectionFormattingMenu,
  decreaseEditorIndent,
  increaseEditorIndent,
} from '../../components/editor/EditorEnhancements';
import { NoteSuggestionReview, noteSuggestionReviewKey } from './NoteSuggestionReview';

const NoteEditor = forwardRef(function NoteEditor({ value, onChange, onSelectionChange, readOnly = false, revisionPulse = 0, suggestionReview = null }, ref) {
  const editorShellRef = useRef(null);
  const [toolbarRevision, setToolbarRevision] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(null);
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
      ParagraphStyle,
      GovernmentNumbering,
      PageBreakBefore,
      NoteSuggestionReview,
      TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    ],
    content: normalized,
    editorProps: {
      transformPastedHTML: (html) => html
        .replace(/<(meta|link|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/\s(?:class|style|lang|dir)=(?:"[^"]*"|'[^']*')/gi, ''),
    },
    onUpdate: ({ editor: current }) => {
      setToolbarRevision((currentRevision) => currentRevision + 1);
      onChange?.(current.getJSON());
    },
    onSelectionUpdate: ({ editor: current }) => {
      setToolbarRevision((currentRevision) => currentRevision + 1);
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

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(noteSuggestionReviewKey, suggestionReview));
  }, [editor, suggestionReview]);

  useEffect(() => {
    if (!revisionPulse || !editorShellRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    editorShellRef.current.animate([
      { boxShadow: '0 0 0 0 rgba(8, 145, 178, 0)', backgroundColor: '#ecfeff' },
      { boxShadow: '0 0 0 5px rgba(8, 145, 178, 0.16)', backgroundColor: '#cffafe', offset: 0.35 },
      { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff' },
    ], { duration: 720, easing: 'ease-out' });
  }, [revisionPulse]);

  if (!editor) return <div className="min-h-52 animate-pulse rounded-md bg-slate-100" />;
  void toolbarRevision;

  const paragraphStyle = editor.getAttributes('paragraph').stylePreset || 'normal';
  const formattingTools = (
    <>
      <div>
        <MoreToolsLabel>Paragraph style</MoreToolsLabel>
        <select value={paragraphStyle} onChange={(event) => editor.chain().focus().setParagraphStyle(event.target.value).run()} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
          {NOTE_PARAGRAPH_STYLES.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
        </select>
      </div>
      <div className="mt-4">
        <MoreToolsLabel>Text and paragraph</MoreToolsLabel>
        <div className="flex flex-wrap gap-1">
          <Tool label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Tool>
          <Tool label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></Tool>
          <Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
          <Tool label="Decrease paragraph or list level" disabled={!editor.isActive('listItem') && !Number(editor.getAttributes('paragraph').indent)} onClick={() => decreaseEditorIndent(editor)}><IndentDecrease className="h-4 w-4" /></Tool>
          <Tool label="Increase paragraph or list level" onClick={() => increaseEditorIndent(editor)}><IndentIncrease className="h-4 w-4" /></Tool>
          <Tool label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Tool>
          <Tool label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Tool>
          <Tool label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Tool>
          <Tool label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></Tool>
        </div>
        {editor.isActive('orderedList') && <div className="mt-3 grid grid-cols-[1fr_6rem] gap-2"><label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Numbering format</span><select value={editor.getAttributes('orderedList').numberingStyle || 'decimal'} onChange={(event) => editor.chain().focus().setNumberingStyle(event.target.value).run()} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{GOVERNMENT_NUMBERING_STYLES.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}</select></label><label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Start at</span><input type="number" min="1" max="999" value={editor.getAttributes('orderedList').start || 1} onChange={(event) => editor.chain().focus().updateAttributes('orderedList', { start: Math.max(1, Number(event.target.value) || 1) }).run()} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label></div>}
      </div>
      <div className="mt-4">
        <MoreToolsLabel>Document</MoreToolsLabel>
        <FormatPainterControls editor={editor} value={copiedFormat} onChange={setCopiedFormat} />
        <div className="mt-2"><PageBreakControl editor={editor} /></div>
        <p className="mt-2 text-[11px] leading-4 text-slate-500">A page break is preserved in Word export. Shortcut: Ctrl/Cmd + Enter.</p>
      </div>
      <div className="mt-4">
        <MoreToolsLabel>Table</MoreToolsLabel>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="h-10 rounded-md border border-slate-300 font-semibold">Insert table</button>
          <button type="button" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="h-10 rounded-md border border-slate-300 font-semibold disabled:opacity-40">Toggle header</button>
          <button type="button" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()} className="h-10 rounded-md border border-slate-300 font-semibold disabled:opacity-40">Merge cells</button>
          <button type="button" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()} className="h-10 rounded-md border border-slate-300 font-semibold disabled:opacity-40">Split cell</button>
        </div>
      </div>
    </>
  );

  return (
    <div ref={editorShellRef} className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm transition-shadow focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200">
      {!readOnly && (
        <div className="border-b border-slate-200 bg-slate-50/80">
          <MobileEditorToolbar editor={editor} onOpenMore={() => setMobileMoreOpen(true)} onOpenFind={() => setFindOpen((open) => !open)} />
          <div className="hidden overflow-x-auto px-2 py-1.5 sm:block">
          <div className="flex min-w-max items-center gap-0.5">
            <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></Tool>
            <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <label className="mr-1"><span className="sr-only">Paragraph style</span><select title="Paragraph style" value={paragraphStyle} onChange={(event) => editor.chain().focus().setParagraphStyle(event.target.value).run()} className="h-9 w-36 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700">{NOTE_PARAGRAPH_STYLES.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}</select></label>
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
            <Tool label="Decrease paragraph or list level (Shift+Tab)" disabled={!editor.isActive('listItem') && !Number(editor.getAttributes('paragraph').indent)} onClick={() => decreaseEditorIndent(editor)}><IndentDecrease className="h-4 w-4" /></Tool>
            <Tool label="Increase paragraph or list level (Tab)" onClick={() => increaseEditorIndent(editor)}><IndentIncrease className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Tool>
            <Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <Tool label="Insert 3 by 3 table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></Tool>
            <Tool label="Add row" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="h-4 w-4" /></Tool>
            <Tool label="Add column" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></Tool>
            <Tool label="Delete table" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-4 w-4" /></Tool>
            <span className="mx-1 h-6 border-l border-slate-200" />
            <Tool label="Find and replace" active={findOpen} onClick={() => setFindOpen((open) => !open)}><Search className="h-4 w-4" /></Tool>
            <FormatPainterControls editor={editor} compact value={copiedFormat} onChange={setCopiedFormat} />
            <PageBreakControl editor={editor} compact />
          </div>
          </div>
        </div>
      )}
      {!readOnly && <EditorFindReplace editor={editor} open={findOpen} onClose={() => setFindOpen(false)} />}
      {!readOnly && <DesktopDocumentRuler editor={editor} fixedMarginCm={1.9} indentUnitCm={0.635} fluid />}
      <div className="group relative w-full">
        {!readOnly && editor.isEmpty && <div className="note-editor-placeholder pointer-events-none absolute left-5 top-5 font-serif text-[12pt] text-slate-400 group-focus-within:hidden sm:left-8 sm:top-7">Record the examination, reasoning and proposed course…</div>}
        <EditorContent
          editor={editor}
          className="official-rich-editor note-rich-editor bg-white px-5 py-5 font-serif text-[12pt] leading-7 text-slate-900 sm:px-8 sm:py-7 [&_.ProseMirror]:min-h-72 [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_p[data-paragraph-style=heading]]:mb-3 [&_.ProseMirror_p[data-paragraph-style=heading]]:mt-5 [&_.ProseMirror_p[data-paragraph-style=heading]]:text-[16pt] [&_.ProseMirror_p[data-paragraph-style=heading]]:font-bold [&_.ProseMirror_p[data-paragraph-style=subheading]]:mt-4 [&_.ProseMirror_p[data-paragraph-style=subheading]]:text-[13pt] [&_.ProseMirror_p[data-paragraph-style=subheading]]:font-bold [&_.ProseMirror_p[data-paragraph-style=recommendation]]:border-l-4 [&_.ProseMirror_p[data-paragraph-style=recommendation]]:border-teal-500 [&_.ProseMirror_p[data-paragraph-style=recommendation]]:bg-teal-50 [&_.ProseMirror_p[data-paragraph-style=recommendation]]:px-3 [&_.ProseMirror_p[data-paragraph-style=conclusion]]:border-l-4 [&_.ProseMirror_p[data-paragraph-style=conclusion]]:border-indigo-400 [&_.ProseMirror_p[data-paragraph-style=conclusion]]:bg-indigo-50 [&_.ProseMirror_p[data-paragraph-style=conclusion]]:px-3 [&_.ProseMirror_p[data-paragraph-style=quotation]]:border-l-2 [&_.ProseMirror_p[data-paragraph-style=quotation]]:border-slate-300 [&_.ProseMirror_p[data-paragraph-style=quotation]]:pl-4 [&_.ProseMirror_p[data-paragraph-style=quotation]]:italic [&_.ProseMirror_p[data-paragraph-style=quotation]]:text-slate-600 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-7 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-7 [&_.ProseMirror_table]:my-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:table-fixed [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-400 [&_.ProseMirror_td]:p-1.5 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-500 [&_.ProseMirror_th]:bg-slate-100 [&_.ProseMirror_th]:p-1.5"
        />
      </div>
      {!readOnly && <SelectionFormattingMenu editor={editor} />}
      <EditorStatusBar editor={editor} hint={readOnly ? 'Saved note' : 'Formatting and structure are retained with this note.'} />
      {!readOnly && <MobileEditorMoreSheet open={mobileMoreOpen} onClose={() => setMobileMoreOpen(false)} title="Note formatting">{formattingTools}</MobileEditorMoreSheet>}
    </div>
  );
});

export default NoteEditor;
