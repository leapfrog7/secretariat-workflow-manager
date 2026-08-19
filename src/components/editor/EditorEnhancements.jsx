import { useEffect, useMemo, useRef, useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  Bold,
  ChevronDown,
  Italic,
  List,
  ListOrdered,
  MoreHorizontal,
  Paintbrush,
  FileOutput,
  Redo2,
  Replace,
  Search,
  Underline,
  Undo2,
  X,
} from 'lucide-react';

export function EditorToolButton({ label, active = false, disabled = false, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'border-teal-300 bg-teal-50 text-teal-900'
          : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function increaseEditorIndent(editor) {
  return editor.isActive('listItem')
    ? editor.chain().focus().sinkListItem('listItem').run()
    : editor.chain().focus().increaseParagraphIndent().run();
}

export function decreaseEditorIndent(editor) {
  return editor.isActive('listItem')
    ? editor.chain().focus().liftListItem('listItem').run()
    : editor.chain().focus().decreaseParagraphIndent().run();
}

const RULER_WIDTH_CM = 21;

function rulerPercent(value) {
  return `${(Math.min(RULER_WIDTH_CM, Math.max(0, value)) / RULER_WIDTH_CM) * 100}%`;
}

export function DesktopDocumentRuler({ editor, marginPreset = 'standard', fixedMarginCm, indentUnitCm = 0.635, onMarginChange, fluid = false }) {
  const rulerRef = useRef(null);
  if (!editor) return null;
  const attrs = editor.getAttributes('paragraph');
  const marginCm = fixedMarginCm ?? (marginPreset === 'narrow' ? 1.27 : 2.54);
  const leftIndent = Math.max(0, Number(attrs.indent) || 0);
  const firstLineIndent = Number(attrs.firstLineIndent) || 0;
  const rightIndent = Math.max(0, Number(attrs.rightIndent) || 0);
  const leftPosition = marginCm + (leftIndent * indentUnitCm);
  const firstLinePosition = leftPosition + (firstLineIndent * 0.5);
  const rightPosition = RULER_WIDTH_CM - marginCm - (rightIndent * 0.5);

  const applyPointer = (kind, clientX) => {
    const bounds = rulerRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    const cm = Math.min(RULER_WIDTH_CM, Math.max(0, ((clientX - bounds.left) / bounds.width) * RULER_WIDTH_CM));
    if (kind === 'margin-left' || kind === 'margin-right') {
      const measured = kind === 'margin-left' ? cm : RULER_WIDTH_CM - cm;
      onMarginChange?.(measured < 1.9 ? 'narrow' : 'standard');
      return;
    }
    if (kind === 'left') {
      editor.commands.setParagraphRulerIndent({ indent: Math.round((cm - marginCm) / indentUnitCm) });
    } else if (kind === 'hanging') {
      const indent = Math.max(0, Math.min(6, Math.round((cm - marginCm) / indentUnitCm)));
      const previousFirstLinePosition = leftPosition + (firstLineIndent * 0.5);
      editor.commands.setParagraphRulerIndent({ indent, firstLineIndent: Math.round((previousFirstLinePosition - marginCm - (indent * indentUnitCm)) / 0.5) });
    } else if (kind === 'first') {
      editor.commands.setParagraphRulerIndent({ firstLineIndent: Math.round((cm - leftPosition) / 0.5) });
    } else if (kind === 'right') {
      editor.commands.setParagraphRulerIndent({ rightIndent: Math.round((RULER_WIDTH_CM - marginCm - cm) / 0.5) });
    }
  };

  const pointerHandlers = (kind) => ({
    onPointerDown: (event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      applyPointer(kind, event.clientX);
    },
    onPointerMove: (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) applyPointer(kind, event.clientX);
    },
    onPointerUp: (event) => event.currentTarget.releasePointerCapture(event.pointerId),
  });

  const keyboardAdjust = (kind, direction) => {
    if (kind === 'margin-left' || kind === 'margin-right') onMarginChange?.(marginPreset === 'narrow' ? 'standard' : 'narrow');
    if (kind === 'left') editor.commands.setParagraphRulerIndent({ indent: leftIndent + direction });
    if (kind === 'hanging') editor.commands.setParagraphRulerIndent({ indent: leftIndent + direction, firstLineIndent: firstLineIndent - direction });
    if (kind === 'first') editor.commands.setParagraphRulerIndent({ firstLineIndent: firstLineIndent + direction });
    if (kind === 'right') editor.commands.setParagraphRulerIndent({ rightIndent: rightIndent + direction });
  };

  const marker = (kind, label, position, shape, value) => (
    <button
      type="button"
      aria-label={label}
      aria-valuetext={value}
      title={`${label}: ${value}. Drag or use arrow keys.`}
      {...pointerHandlers(kind)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        keyboardAdjust(kind, event.key === 'ArrowRight' ? 1 : -1);
      }}
      className={`group absolute z-20 w-4 -translate-x-1/2 cursor-ew-resize touch-none rounded-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 ${shape === 'first' ? 'top-0 h-3.5' : shape === 'square' ? 'bottom-0 h-2.5' : shape === 'margin' ? 'top-1.5 h-4' : 'bottom-1.5 h-3.5'}`}
      style={{ left: rulerPercent(position) }}
    >
      <span className={`mx-auto block transition-colors ${shape === 'square' ? 'h-2 w-2 rounded-[2px] bg-slate-500 group-hover:bg-cyan-700' : shape === 'margin' ? 'h-4 w-px bg-slate-400 group-hover:w-0.5 group-hover:bg-cyan-600' : shape === 'first' ? 'h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-slate-500 group-hover:border-t-cyan-700' : 'h-0 w-0 border-b-[7px] border-l-[5px] border-r-[5px] border-b-slate-500 border-l-transparent border-r-transparent group-hover:border-b-cyan-700'}`} />
    </button>
  );

  return (
    <div className="hidden border-b border-slate-200 bg-white py-1 lg:block" aria-label="Document ruler">
      <div ref={rulerRef} className={`relative mx-auto h-7 w-full select-none overflow-visible border-y border-slate-200 bg-white ${fluid ? '' : 'max-w-[900px]'}`}>
        <div className="absolute inset-y-0 left-0 border-r border-slate-300 bg-slate-50/40" style={{ width: rulerPercent(marginCm) }} />
        <div className="absolute inset-y-0 right-0 border-l border-slate-300 bg-slate-50/40" style={{ width: rulerPercent(marginCm) }} />
        {Array.from({ length: 43 }, (_, index) => {
          const cm = index / 2;
          const whole = Number.isInteger(cm);
          return <span key={cm} className={`absolute bottom-0 -translate-x-1/2 border-l border-slate-300 ${whole ? 'h-2.5' : 'h-1'}`} style={{ left: rulerPercent(cm) }}>{whole && cm > 0 && cm < 21 ? <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 text-[7px] leading-none text-slate-400">{cm}</span> : null}</span>;
        })}
        {onMarginChange ? marker('margin-left', 'Left page margin', marginCm, 'margin', `${marginCm} cm`) : null}
        {onMarginChange ? marker('margin-right', 'Right page margin', RULER_WIDTH_CM - marginCm, 'margin', `${marginCm} cm`) : null}
        {marker('first', 'First-line indent', firstLinePosition, 'first', `${firstLineIndent * 0.5} cm`)}
        {marker('hanging', 'Hanging indent', leftPosition, 'hanging', `${leftIndent} levels`)}
        {marker('left', 'Left paragraph indent', leftPosition, 'square', `${leftIndent} levels`)}
        {marker('right', 'Right paragraph indent', rightPosition, 'hanging', `${rightIndent * 0.5} cm`)}
      </div>
    </div>
  );
}

export function FormatPainterControls({ editor, compact = false, value, onChange }) {
  const [internalFormat, setInternalFormat] = useState(null);
  const controlled = value !== undefined;
  const format = controlled ? value : internalFormat;
  const setFormat = (nextFormat) => {
    if (controlled) onChange?.(nextFormat);
    else setInternalFormat(nextFormat);
  };
  if (!editor) return null;

  const copyFormatting = () => {
    const paragraph = editor.getAttributes('paragraph');
    setFormat({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      fontSize: editor.schema.marks.fontSize ? editor.getAttributes('fontSize').size : null,
      paragraph: {
        textAlign: paragraph.textAlign || null,
        indent: Math.max(0, Number(paragraph.indent) || 0),
        firstLineIndent: Number(paragraph.firstLineIndent) || 0,
        rightIndent: Math.max(0, Number(paragraph.rightIndent) || 0),
        ...(editor.schema.nodes.paragraph.spec.attrs?.stylePreset
          ? { stylePreset: paragraph.stylePreset || 'normal' }
          : {}),
      },
    });
  };
  const applyFormatting = () => {
    if (!format) return;
    let chain = editor.chain().focus().unsetAllMarks().updateAttributes('paragraph', format.paragraph);
    if (format.bold) chain = chain.setBold();
    if (format.italic) chain = chain.setItalic();
    if (format.underline) chain = chain.setUnderline();
    if (format.fontSize && editor.schema.marks.fontSize) chain = chain.setFontSize(format.fontSize);
    chain.run();
    setFormat(null);
  };

  if (compact) {
    return <EditorToolButton label={format ? 'Apply copied formatting' : 'Copy formatting'} active={Boolean(format)} onClick={format ? applyFormatting : copyFormatting}><Paintbrush className="h-4 w-4" /></EditorToolButton>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={copyFormatting} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"><Paintbrush className="h-4 w-4" />Copy format</button>
      <button type="button" disabled={!format} onClick={applyFormatting} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-teal-300 bg-teal-50 px-3 text-xs font-semibold text-teal-900 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"><Paintbrush className="h-4 w-4" />Apply format</button>
    </div>
  );
}

export function PageBreakControl({ editor, compact = false }) {
  if (!editor) return null;
  const active = Boolean(editor.getAttributes('paragraph').pageBreakBefore);
  const toggle = () => editor.chain().focus().togglePageBreakBefore().run();
  if (compact) return <EditorToolButton label={active ? 'Remove page break before paragraph' : 'Start paragraph on new page'} active={active} onClick={toggle}><FileOutput className="h-4 w-4" /></EditorToolButton>;
  return (
    <button type="button" onClick={toggle} className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold ${active ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-700'}`}>
      <FileOutput className="h-4 w-4" />{active ? 'Remove page break' : 'Start on new page'}
    </button>
  );
}

function documentTextMap(editor) {
  let text = '';
  const positions = [];
  let previousParent = null;
  editor.state.doc.descendants((node, position, parent) => {
    if (!node.isText) return;
    if (text && parent !== previousParent && !/\s$/.test(text)) {
      text += '\n';
      positions.push(null);
    }
    for (let index = 0; index < node.text.length; index += 1) {
      text += node.text[index];
      positions.push(position + index);
    }
    previousParent = parent;
  });
  return { text, positions };
}

function findMatches(editor, query) {
  const needle = String(query || '').toLocaleLowerCase();
  if (!needle) return [];
  const { text, positions } = documentTextMap(editor);
  const haystack = text.toLocaleLowerCase();
  const matches = [];
  let offset = haystack.indexOf(needle);
  while (offset >= 0) {
    const from = positions[offset];
    const lastPosition = positions[offset + needle.length - 1];
    if (from != null && lastPosition != null) matches.push({ from, to: lastPosition + 1 });
    offset = haystack.indexOf(needle, offset + Math.max(1, needle.length));
  }
  return matches;
}

export function EditorFindReplace({ editor, open, onClose }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const currentDocument = editor?.state.doc;
  const matches = useMemo(() => editor ? findMatches(editor, query) : [], [currentDocument, editor, query]);

  useEffect(() => setActiveIndex(matches.length ? 0 : -1), [query, matches.length]);

  if (!open || !editor) return null;

  const selectMatch = (index) => {
    if (!matches.length) return;
    const normalizedIndex = (index + matches.length) % matches.length;
    const match = matches[normalizedIndex];
    setActiveIndex(normalizedIndex);
    editor.chain().focus().setTextSelection(match).scrollIntoView().run();
  };
  const replaceCurrent = () => {
    if (!matches.length) return;
    const match = matches[Math.max(0, activeIndex)];
    editor.chain().focus().insertContentAt(match, replacement).run();
  };
  const replaceAll = () => {
    [...matches].reverse().forEach((match) => editor.commands.insertContentAt(match, replacement));
    editor.commands.focus();
  };

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-3" role="search" aria-label="Find and replace in document">
      <div className="mx-auto grid max-w-4xl gap-2 sm:grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Find text</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm" />
        </label>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span className="min-w-12 text-center tabular-nums">{matches.length ? `${Math.max(0, activeIndex) + 1}/${matches.length}` : '0/0'}</span>
          <button type="button" disabled={!matches.length} onClick={() => selectMatch(activeIndex - 1)} className="h-9 rounded-md border border-slate-300 bg-white px-2 font-semibold disabled:opacity-40">Previous</button>
          <button type="button" disabled={!matches.length} onClick={() => selectMatch(activeIndex + 1)} className="h-9 rounded-md border border-slate-300 bg-white px-2 font-semibold disabled:opacity-40">Next</button>
        </div>
        <label className="relative block">
          <span className="sr-only">Replacement text</span>
          <Replace className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="Replace with" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm" />
        </label>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!matches.length} onClick={replaceCurrent} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40">Replace</button>
          <button type="button" disabled={!matches.length} onClick={replaceAll} className="h-9 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white disabled:opacity-40">All</button>
          <button type="button" onClick={onClose} aria-label="Close find and replace" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

export function SelectionFormattingMenu({ editor }) {
  if (!editor) return null;
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state }) => !state.selection.empty}
      options={{ placement: 'top', offset: 8 }}
      className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
    >
      <EditorToolButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></EditorToolButton>
      <EditorToolButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></EditorToolButton>
      <EditorToolButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></EditorToolButton>
      <span className="mx-0.5 h-5 border-l border-slate-200" />
      <EditorToolButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></EditorToolButton>
      <EditorToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></EditorToolButton>
    </BubbleMenu>
  );
}

export function MobileEditorToolbar({ editor, onOpenMore, onOpenFind }) {
  if (!editor) return null;
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-1.5 sm:hidden" aria-label="Editor formatting">
      <div className="flex items-center gap-0.5">
        <EditorToolButton label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></EditorToolButton>
        <EditorToolButton label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></EditorToolButton>
        <EditorToolButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></EditorToolButton>
        <EditorToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></EditorToolButton>
      </div>
      <div className="flex items-center gap-0.5">
        <EditorToolButton label="Find and replace" onClick={onOpenFind}><Search className="h-4 w-4" /></EditorToolButton>
        <button type="button" onClick={onOpenMore} className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-700 hover:bg-white" aria-haspopup="dialog">More <ChevronDown className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function MobileEditorMoreSheet({ open, onClose, title = 'Formatting', children }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <>
      <button type="button" aria-label="Close formatting tools" onClick={onClose} className="fixed inset-0 z-50 bg-slate-950/35 sm:hidden" />
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-editor-tools-title" className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:hidden">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" />
        <header className="flex items-center justify-between px-4 py-3">
          <h3 id="mobile-editor-tools-title" className="text-sm font-semibold text-slate-900">{title}</h3>
          <button type="button" autoFocus onClick={onClose} aria-label="Close formatting tools" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </header>
        <div className="max-h-[55vh] overflow-y-auto border-t border-slate-100 px-4 py-4">{children}</div>
      </section>
    </>
  );
}

export function EditorStatusBar({ editor, hint = 'Changes are saved with this record.' }) {
  const text = editor?.getText({ blockSeparator: ' ' }).trim() || '';
  const words = text ? text.split(/\s+/).length : 0;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
      <span className="truncate">{hint}</span>
      <span className="shrink-0 tabular-nums">{words.toLocaleString()} words · {text.length.toLocaleString()} characters</span>
    </div>
  );
}

export function MoreToolsLabel({ children }) {
  return <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><MoreHorizontal className="h-3.5 w-3.5" />{children}</div>;
}
