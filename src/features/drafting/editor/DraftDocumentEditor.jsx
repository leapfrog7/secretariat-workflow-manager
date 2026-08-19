import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  BookOpen,
  Bold,
  CheckCircle2,
  ClipboardCheck,
  CornerDownLeft,
  Eraser,
  FilePenLine,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  MapPin,
  PanelRightOpen,
  Redo2,
  Search,
  Table2,
  Rows3,
  Columns3,
  Trash2,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import { buildGovernmentCommunicationBlocks } from '../../../utils/governmentDraftUtils';
import { normalizeDraftDocument, validateDraftDocument } from '../domain/draftDocument';
import { normalizeDraftRichText } from '../domain/draftRichText';
import { COMMUNICATION_TYPES, getDraftTemplate } from '../templates/templateRegistry';
import {
  GOVERNMENT_NUMBERING_STYLES,
  GovernmentNumbering,
  PageBreakBefore,
  ParagraphIndent,
} from '../../../components/editor/RichTextFormatting';
import {
  EditorFindReplace,
  EditorStatusBar,
  DesktopDocumentRuler,
  FormatPainterControls,
  MobileEditorMoreSheet,
  MobileEditorToolbar,
  MoreToolsLabel,
  PageBreakControl,
  SelectionFormattingMenu,
  decreaseEditorIndent,
  increaseEditorIndent,
} from '../../../components/editor/EditorEnhancements';
import {
  PARAGRAPH_BANK_CATEGORIES,
  searchParagraphBank,
} from '../paragraphBank/paragraphBankUtils';

const FONT_OPTIONS = ['Arial', 'Aptos', 'Calibri', 'Georgia', 'Times New Roman', 'Verdana'];
const FONT_SIZES = [10, 11, 12, 13, 14];
const PARAGRAPH_SPACING = [0, 6, 8, 12];
const LINE_SPACING = [1, 1.15, 1.5, 2];
const RECIPIENT_INDENTS = [
  { value: 'none', label: 'No recipient indent' },
  { value: 'small', label: 'Small recipient indent' },
  { value: 'standard', label: 'Standard recipient indent' },
  { value: 'wide', label: 'Wide recipient indent' },
];
const MARGIN_OPTIONS = [
  { value: 'standard', label: 'Normal (2.54 cm)' },
  { value: 'narrow', label: 'Narrow (1.27 cm)' },
];

const recipientIndentCss = {
  none: '0',
  small: '1.5rem',
  standard: '3rem',
  wide: '4.5rem',
};

function bodyText(document) {
  return document.blocks.filter((block) => block.role === 'bodyParagraph').map((block) => block.content).join('\n\n');
}

function positionForTextOffset(doc, offset) {
  const target = Math.max(0, Number(offset) || 0);
  for (let position = 1; position <= doc.content.size; position += 1) {
    if (doc.textBetween(0, position, '\n\n').length >= target) return position;
  }
  return Math.max(1, doc.content.size - 1);
}

function alignmentClass(alignment) {
  if (alignment === 'center') return 'text-center';
  if (alignment === 'right') return 'text-right';
  if (alignment === 'justify') return 'text-justify';
  return 'text-left';
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

function ToolbarButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? 'border-teal-300 bg-teal-100 text-teal-900'
          : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function ParagraphBankRail({
  entries,
  communicationType,
  onInsert,
  onUseAddress,
  onManage,
  onClose,
  mobile = false,
  embedded = false,
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const filtered = useMemo(() => searchParagraphBank(entries, {
    query,
    category,
    communicationType,
  }), [category, communicationType, entries, query]);

  const useEntry = (entry) => {
    if (entry.category === 'Address / addressee') onUseAddress?.(entry);
    else onInsert?.(entry);
    if (mobile) onClose?.();
  };

  return (
    <aside className={`flex min-h-0 flex-col bg-white ${embedded ? 'flex-1' : mobile ? 'h-full' : 'max-h-[calc(100vh-6rem)] rounded-md border border-slate-200 shadow-sm'}`} aria-label="Paragraph Bank quick insert">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17333b]"><BookOpen className="h-4 w-4 text-teal-700" />Paragraph Bank</div>
          <p className="mt-1 text-xs leading-4 text-slate-500">Insert wording at the cursor or apply a saved address.</p>
        </div>
        {mobile && <button type="button" onClick={onClose} title="Close Paragraph Bank" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /><span className="sr-only">Close Paragraph Bank</span></button>}
      </div>
      <div className="space-y-2 border-b border-slate-200 bg-slate-50 px-3 py-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <span className="sr-only">Search Paragraph Bank</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wording or address" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800" />
        </label>
        <label className="block">
          <span className="sr-only">Paragraph category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700">
            <option value="">All categories</option>
            {PARAGRAPH_BANK_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.slice(0, 30).map((entry) => {
          const isAddress = entry.category === 'Address / addressee';
          return (
            <button key={entry.id} type="button" onClick={() => useEntry(entry)} className="group block w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800">{entry.title}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-teal-700">{entry.category}</span>
                </span>
                {isAddress ? <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-700" /> : <CornerDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-700" />}
              </span>
              <span className="mt-2 block whitespace-pre-line text-xs leading-5 text-slate-600 line-clamp-4">{entry.content}</span>
              <span className="mt-2 block text-[11px] font-semibold text-teal-700 opacity-70 group-hover:opacity-100">{isAddress ? 'Use address' : 'Insert at cursor'}</span>
            </button>
          );
        })}
        {!filtered.length && <div className="px-4 py-10 text-center"><BookOpen className="mx-auto h-5 w-5 text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-600">No matching entries</p></div>}
      </div>
      <div className="border-t border-slate-200 p-3">
        <button type="button" onClick={onManage} className="inline-flex h-9 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Manage Paragraph Bank</button>
      </div>
    </aside>
  );
}

function DocumentDetailsPanel({
  document,
  communicationType,
  signatories,
  signatoryId,
  onCommunicationTypeChange,
  onSignatoryChange,
  onDocumentDetailChange,
  onRecipientChange,
}) {
  const metadata = document.metadata || {};
  const recipient = metadata.recipient || {};
  const inputClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100';
  const textareaClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs leading-5 text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100';
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-slate-200 px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#17333b]"><FilePenLine className="h-4 w-4 text-teal-700" />Document details</div>
        <p className="mt-1 text-xs leading-4 text-slate-500">Changes appear on the page immediately.</p>
      </div>
      <div className="space-y-3 px-3 py-3">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Communication type</span><select value={communicationType} onChange={(event) => onCommunicationTypeChange?.(event.target.value)} className={inputClass}>{COMMUNICATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Authorized signatory</span><select value={signatoryId} onChange={(event) => onSignatoryChange?.(event.target.value)} className={inputClass}><option value="">Select signatory</option>{signatories.map((officer) => <option key={officer.id} value={officer.id}>{officer.designation ? `${officer.name} - ${officer.designation}` : officer.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Communication no.</span><input value={metadata.communicationNumber || ''} onChange={(event) => onDocumentDetailChange?.('fileNumber', event.target.value)} placeholder="Enter number" className={inputClass} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Date</span><input type="date" value={metadata.issueDate || ''} onChange={(event) => onDocumentDetailChange?.('issueDate', event.target.value)} className={inputClass} /></label>
        </div>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Subject</span><textarea rows={2} value={metadata.subject || ''} onChange={(event) => onDocumentDetailChange?.('subject', event.target.value)} placeholder="Enter communication subject" className={textareaClass} /></label>
        <div className="border-t border-slate-200 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Addressee</p>
          <div className="space-y-2">
            <input aria-label="Addressee name" value={recipient.name || ''} onChange={(event) => onRecipientChange?.('name', event.target.value)} placeholder="Name" className={inputClass} />
            <input aria-label="Addressee designation" value={recipient.designation || ''} onChange={(event) => onRecipientChange?.('designation', event.target.value)} placeholder="Designation" className={inputClass} />
            <input aria-label="Recipient organization" value={recipient.organization || ''} onChange={(event) => onRecipientChange?.('organization', event.target.value)} placeholder="Organization" className={inputClass} />
            <textarea aria-label="Recipient postal address" rows={4} value={recipient.address || ''} onChange={(event) => onRecipientChange?.('address', event.target.value)} placeholder="Postal address" className={textareaClass} />
          </div>
        </div>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Salutation</span><input value={metadata.salutation || ''} onChange={(event) => onDocumentDetailChange?.('salutation', event.target.value)} placeholder="Example: Sir/Madam" className={inputClass} /></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Copy / endorsement list</span><textarea rows={3} value={metadata.copyTo || ''} onChange={(event) => onDocumentDetailChange?.('copyTo', event.target.value)} placeholder="One recipient per line" className={textareaClass} /></label>
      </div>
    </div>
  );
}

function DraftReadinessPanel({ document, onEditDetails }) {
  const review = useMemo(() => validateDraftDocument(document), [document]);
  const findings = [...review.errors, ...review.warnings];
  const detailFields = new Set([
    'subject',
    'communicationNumber',
    'issueDate',
    'recipient',
    'signatoryId',
  ]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={`border-b px-3 py-4 ${findings.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="flex items-start gap-2.5">
          {findings.length
            ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />}
          <div>
            <p className={`text-sm font-semibold ${findings.length ? 'text-amber-950' : 'text-emerald-950'}`}>
              {findings.length ? `${findings.length} item${findings.length === 1 ? '' : 's'} to review` : 'Draft details complete'}
            </p>
            <p className={`mt-1 text-xs leading-5 ${findings.length ? 'text-amber-800' : 'text-emerald-800'}`}>
              {findings.length
                ? 'You may keep drafting. Complete these items before the communication is issued.'
                : 'No missing structured details or visible placeholders were found.'}
            </p>
          </div>
        </div>
      </div>
      {findings.length ? (
        <div className="divide-y divide-slate-100">
          {findings.map((finding, index) => {
            const canEditDetail = detailFields.has(finding.field);
            return (
              <button
                key={`${finding.field}-${index}`}
                type="button"
                onClick={canEditDetail ? onEditDetails : undefined}
                className={`flex w-full items-start gap-2.5 px-3 py-3 text-left ${canEditDetail ? 'hover:bg-teal-50' : 'cursor-default'}`}
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${review.errors.includes(finding) ? 'bg-red-600' : 'bg-amber-500'}`} />
                <span>
                  <span className="block text-xs font-semibold text-slate-800">{finding.message}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                    {canEditDetail ? 'Open Document details to complete it.' : 'Review the editable body and replace visible bracketed text.'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-10 text-center">
          <ClipboardCheck className="mx-auto h-7 w-7 text-emerald-600" />
          <p className="mt-3 text-xs leading-5 text-slate-600">Review facts, citations and approvals before saving the final version.</p>
        </div>
      )}
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-500">
        This checklist supports review; it does not certify factual or legal correctness.
      </div>
    </div>
  );
}

function DraftSideRail({
  document,
  communicationType,
  signatories,
  signatoryId,
  entries,
  onInsert,
  onUseAddress,
  onManage,
  onCommunicationTypeChange,
  onSignatoryChange,
  onDocumentDetailChange,
  onRecipientChange,
  onClose,
  mobile = false,
}) {
  const review = useMemo(() => validateDraftDocument(document), [document]);
  const reviewCount = review.errors.length + review.warnings.length;
  const missingDetails = !document.metadata?.communicationNumber
    || !document.metadata?.issueDate
    || !document.metadata?.subject;
  const [tab, setTab] = useState(missingDetails ? 'details' : 'bank');
  return (
    <aside className={`flex min-h-0 flex-col overflow-hidden bg-white ${mobile ? 'h-full' : 'max-h-[calc(100vh-6rem)] rounded-md border border-slate-200 shadow-sm'}`} aria-label="Draft tools">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 p-1.5">
        <button type="button" title="Document details" onClick={() => setTab('details')} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded text-xs font-semibold ${tab === 'details' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><FilePenLine className="h-3.5 w-3.5" />Details</button>
        <button type="button" title="Paragraph Bank" onClick={() => setTab('bank')} className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded text-xs font-semibold ${tab === 'bank' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><BookOpen className="h-3.5 w-3.5" />Bank</button>
        <button type="button" title="Review draft readiness" onClick={() => setTab('review')} className={`relative flex h-9 flex-1 items-center justify-center gap-1.5 rounded text-xs font-semibold ${tab === 'review' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><ClipboardCheck className="h-3.5 w-3.5" />Review{reviewCount > 0 && <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold text-amber-800">{reviewCount}</span>}</button>
        {mobile && <button type="button" onClick={onClose} title="Close draft tools" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-white"><X className="h-4 w-4" /><span className="sr-only">Close draft tools</span></button>}
      </div>
      {tab === 'details' ? (
        <DocumentDetailsPanel
          document={document}
          communicationType={communicationType}
          signatories={signatories}
          signatoryId={signatoryId}
          onCommunicationTypeChange={onCommunicationTypeChange}
          onSignatoryChange={onSignatoryChange}
          onDocumentDetailChange={onDocumentDetailChange}
          onRecipientChange={onRecipientChange}
        />
      ) : tab === 'bank' ? (
        <ParagraphBankRail
          embedded
          entries={entries}
          communicationType={communicationType}
          onInsert={onInsert}
          onUseAddress={onUseAddress}
          onManage={onManage}
        />
      ) : (
        <DraftReadinessPanel
          document={document}
          onEditDetails={() => setTab('details')}
        />
      )}
    </aside>
  );
}

const DraftDocumentEditor = forwardRef(function DraftDocumentEditor({
  document: input,
  readOnly = false,
  onChange,
  onSelectionChange,
  onStyleChange,
  paragraphBankEntries = [],
  communicationType = '',
  signatories = [],
  signatoryId = '',
  onUseAddress,
  onOpenParagraphBank,
  onCommunicationTypeChange,
  onSignatoryChange,
  onDocumentDetailChange,
  onRecipientChange,
}, ref) {
  const document = useMemo(() => normalizeDraftDocument(input), [input]);
  const [toolbarRevision, setToolbarRevision] = useState(0);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [mobileFormattingOpen, setMobileFormattingOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(null);
  const nextChangeSource = useRef('user');
  const richText = useMemo(
    () => normalizeDraftRichText(document.bodyRichText, document.blocks),
    [document.bodyRichText, document.blocks],
  );
  const richTextKey = JSON.stringify(richText);

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
        table: {
          resizable: true,
          HTMLAttributes: { class: 'draft-table' },
        },
      }),
      TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      ParagraphIndent,
      GovernmentNumbering,
      PageBreakBefore,
    ],
    content: richText,
    editorProps: {
      transformPastedHTML: (html) => html
        .replace(/<(meta|link|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/\s(?:class|style|lang|dir)=(?:"[^"]*"|'[^']*')/gi, ''),
    },
    onUpdate: ({ editor: current }) => {
      setToolbarRevision((value) => value + 1);
      onChange?.(current.getJSON(), nextChangeSource.current);
      nextChangeSource.current = 'user';
    },
    onSelectionUpdate: ({ editor: current }) => {
      setToolbarRevision((value) => value + 1);
      const { from, to } = current.state.selection;
      onSelectionChange?.({
        start: current.state.doc.textBetween(0, from, '\n\n').length,
        end: current.state.doc.textBetween(0, to, '\n\n').length,
      });
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(normalizeDraftRichText(editor.getJSON()));
    if (current !== richTextKey) editor.commands.setContent(richText, { emitUpdate: false });
  }, [editor, richText, richTextKey]);

  useEffect(() => {
    if (!editor || readOnly || bodyText(document) !== '[DRAFT BODY]') return;
    const timer = window.setTimeout(() => {
      editor.commands.focus();
      editor.commands.setTextSelection({ from: 1, to: Math.max(1, editor.state.doc.content.size - 1) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor, document, readOnly]);

  const insertEditorText = (content, source = 'user') => {
    if (!editor || readOnly) return;
    const paragraphs = String(content || '').split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
    if (!paragraphs.length) return;
    nextChangeSource.current = source;
    editor.chain().focus().insertContent(paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    }))).run();
  };

  useImperativeHandle(ref, () => ({
    focus() {
      editor?.commands.focus();
    },
    setBodySelection(start, end = start) {
      if (!editor) return;
      editor.commands.setTextSelection({
        from: positionForTextOffset(editor.state.doc, start),
        to: positionForTextOffset(editor.state.doc, end),
      });
      editor.commands.focus();
    },
    insertText(content, source = 'user') {
      insertEditorText(content, source);
    },
  }), [editor, readOnly]);

  if (!editor) return <div className="min-h-[420px] animate-pulse rounded-md bg-slate-100" />;

  const template = getDraftTemplate(document.templateId);
  const metadata = document.metadata;
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
    body: bodyText(document),
  });
  const style = document.styleProfileSnapshot;
  const disabled = readOnly;
  void toolbarRevision;

  return (
    <>
    <div className="rounded-md border border-slate-300 bg-slate-100 shadow-sm">
      {!readOnly && (
        <div className="rounded-t-md border-b border-slate-200 bg-white">
          <MobileEditorToolbar editor={editor} onOpenMore={() => setMobileFormattingOpen(true)} onOpenFind={() => setFindOpen((open) => !open)} />
          <div className="hidden overflow-x-auto px-2 py-2 sm:block">
            <div className="flex min-w-max items-center gap-0.5">
              <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5">
                <ToolbarButton label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="flex items-center gap-1 border-r border-slate-200 px-1.5">
                <label><span className="sr-only">Document font</span><select title="Document font" value={style.fontFamily} disabled={disabled} onChange={(event) => onStyleChange?.({ fontFamily: event.target.value })} className="h-9 w-36 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">{FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select></label>
                <label><span className="sr-only">Font size</span><select title="Font size" value={Number(style.fontSize)} disabled={disabled} onChange={(event) => onStyleChange?.({ fontSize: Number(event.target.value) })} className="h-9 w-[4.5rem] rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">{FONT_SIZES.map((size) => <option key={size} value={size}>{size} pt</option>)}</select></label>
              </div>
              <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5">
                <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5">
                <ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Decrease paragraph or list level (Shift+Tab)" disabled={!editor.isActive('listItem') && !Number(editor.getAttributes('paragraph').indent)} onClick={() => decreaseEditorIndent(editor)}><IndentDecrease className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Increase paragraph or list level (Tab)" onClick={() => increaseEditorIndent(editor)}><IndentIncrease className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5">
                <ToolbarButton label="Insert 3 by 3 table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Add table row" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Add table column" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Delete table" disabled={!editor.isActive('table')} onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5">
                <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolbarButton>
              </div>
              <div className="flex items-center gap-1 border-r border-slate-200 px-1.5">
                <label><span className="sr-only">Line spacing</span><select title="Line spacing" value={Number(style.lineSpacing)} disabled={disabled} onChange={(event) => onStyleChange?.({ lineSpacing: Number(event.target.value) })} className="h-9 w-24 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">{LINE_SPACING.map((spacing) => <option key={spacing} value={spacing}>{spacing} lines</option>)}</select></label>
                <label><span className="sr-only">Paragraph spacing</span><select title="Paragraph spacing" value={Number(style.paragraphSpacing)} disabled={disabled} onChange={(event) => onStyleChange?.({ paragraphSpacing: Number(event.target.value) })} className="h-9 w-24 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">{PARAGRAPH_SPACING.map((spacing) => <option key={spacing} value={spacing}>{spacing} pt after</option>)}</select></label>
                <label><span className="sr-only">Page margins</span><select title="Page margins" value={style.margins || 'standard'} disabled={disabled} onChange={(event) => onStyleChange?.({ margins: event.target.value })} className="h-9 w-32 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">{MARGIN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label><span className="sr-only">Recipient indentation</span><select title="Recipient indentation" value={style.recipientIndent || 'small'} disabled={disabled} onChange={(event) => onStyleChange?.({ recipientIndent: event.target.value })} className="h-9 w-40 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">{RECIPIENT_INDENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
              <div className="pl-1.5">
                <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></ToolbarButton>
                <ToolbarButton label="Find and replace" active={findOpen} onClick={() => setFindOpen((open) => !open)}><Search className="h-4 w-4" /></ToolbarButton>
                <FormatPainterControls editor={editor} compact value={copiedFormat} onChange={setCopiedFormat} />
                <PageBreakControl editor={editor} compact />
              </div>
            </div>
          </div>
        </div>
      )}
      {!readOnly && <EditorFindReplace editor={editor} open={findOpen} onClose={() => setFindOpen(false)} />}

      <div className={`p-0 sm:p-4 ${!readOnly ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_288px] lg:items-start lg:justify-center lg:gap-4 xl:grid-cols-[minmax(0,900px)_288px]' : ''}`}>
      <div className="mx-auto w-full max-w-[900px]">
      {!readOnly && <DesktopDocumentRuler editor={editor} marginPreset={style.margins || 'standard'} indentUnitCm={1.27} onMarginChange={(margins) => onStyleChange?.({ margins })} />}
      <div
        className={`draft-document-page min-h-[620px] w-full bg-white text-slate-950 sm:min-h-[1123px] sm:shadow-sm ${
          style.margins === 'narrow'
            ? 'px-4 py-6 sm:py-12'
            : 'px-5 py-8 sm:py-24'
        }`}
        style={{
          '--draft-page-margin': style.margins === 'narrow' ? '6.05%' : '12.1%',
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}pt`,
          lineHeight: Number(style.lineSpacing || 1.15),
        }}
      >
        {blocks.map((block, index) => {
          const blockStyle = template.blocks.find((candidate) => candidate.role === block.role);
          const addressBlock = splitAddressBlock(block);
          if (block.role === 'body') {
            return (
              <EditorContent
                key="editable-body"
                editor={editor}
                className={`official-rich-editor draft-rich-editor my-4 rounded-sm transition-shadow focus-within:ring-1 focus-within:ring-slate-200 ${readOnly ? 'pointer-events-none' : ''} [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-0 [&_.ProseMirror_p]:min-h-5 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-7 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-7 [&_.ProseMirror_li>p]:my-0 [&_.ProseMirror_table]:my-3 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:table-fixed [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-400 [&_.ProseMirror_td]:p-1.5 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-500 [&_.ProseMirror_th]:bg-slate-100 [&_.ProseMirror_th]:p-1.5 [&_.ProseMirror_th]:font-semibold`}
                style={{ marginBottom: `${style.paragraphSpacing || 0}pt` }}
              />
            );
          }
          return (
            <div
              key={`${block.role}-${index}`}
              className={`whitespace-pre-line ${alignmentClass(blockStyle?.alignment)} ${blockStyle?.bold ? 'font-bold' : ''}`}
              style={{
                marginTop: index && !isHeadingPair(blocks[index - 1], block) ? '1rem' : 0,
                marginBottom: isHeadingPair(block, blocks[index + 1]) ? 0 : `${style.paragraphSpacing || 0}pt`,
              }}
            >
              {addressBlock ? (
                <>
                  {addressBlock.label && <div>{addressBlock.label}</div>}
                  <div
                    className="whitespace-pre-line"
                    style={{ paddingLeft: recipientIndentCss[style.recipientIndent || 'small'] }}
                  >
                    {addressBlock.address}
                  </div>
                </>
              ) : block.content}
            </div>
          );
        })}
      </div>
      </div>
      {!readOnly && (
        <div className="sticky top-20 hidden self-start lg:block">
          <DraftSideRail
            document={document}
            signatories={signatories}
            signatoryId={signatoryId}
            entries={paragraphBankEntries}
            communicationType={communicationType}
            onInsert={(entry) => insertEditorText(entry.content, 'paragraph-bank')}
            onUseAddress={onUseAddress}
            onManage={onOpenParagraphBank}
            onCommunicationTypeChange={onCommunicationTypeChange}
            onSignatoryChange={onSignatoryChange}
            onDocumentDetailChange={onDocumentDetailChange}
            onRecipientChange={onRecipientChange}
          />
        </div>
      )}
      </div>
      <EditorStatusBar editor={editor} hint={readOnly ? 'Saved communication' : 'Only the substantive body is editable; official template fields remain protected.'} />
    </div>
    {!readOnly && <SelectionFormattingMenu editor={editor} />}
    {!readOnly && (
      <MobileEditorMoreSheet open={mobileFormattingOpen} onClose={() => setMobileFormattingOpen(false)} title="Draft formatting">
        <div>
          <MoreToolsLabel>Text</MoreToolsLabel>
          <div className="flex flex-wrap gap-1">
            <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Increase paragraph or list level" onClick={() => increaseEditorIndent(editor)}><IndentIncrease className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Decrease paragraph or list level" disabled={!editor.isActive('listItem') && !Number(editor.getAttributes('paragraph').indent)} onClick={() => decreaseEditorIndent(editor)}><IndentDecrease className="h-4 w-4" /></ToolbarButton>
          </div>
          {editor.isActive('orderedList') && <div className="mt-3 grid grid-cols-[1fr_6rem] gap-2"><label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Numbering format</span><select value={editor.getAttributes('orderedList').numberingStyle || 'decimal'} onChange={(event) => editor.chain().focus().setNumberingStyle(event.target.value).run()} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{GOVERNMENT_NUMBERING_STYLES.map((numbering) => <option key={numbering.value} value={numbering.value}>{numbering.label}</option>)}</select></label><label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Start at</span><input type="number" min="1" max="999" value={editor.getAttributes('orderedList').start || 1} onChange={(event) => editor.chain().focus().updateAttributes('orderedList', { start: Math.max(1, Number(event.target.value) || 1) }).run()} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm" /></label></div>}
        </div>
        <div className="mt-4">
          <MoreToolsLabel>Alignment</MoreToolsLabel>
          <div className="flex flex-wrap gap-1">
            <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarButton>
            <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolbarButton>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Font</span><select value={style.fontFamily} onChange={(event) => onStyleChange?.({ fontFamily: event.target.value })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs">{FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select></label>
          <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Size</span><select value={Number(style.fontSize)} onChange={(event) => onStyleChange?.({ fontSize: Number(event.target.value) })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs">{FONT_SIZES.map((size) => <option key={size} value={size}>{size} pt</option>)}</select></label>
          <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Line spacing</span><select value={Number(style.lineSpacing)} onChange={(event) => onStyleChange?.({ lineSpacing: Number(event.target.value) })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs">{LINE_SPACING.map((spacing) => <option key={spacing} value={spacing}>{spacing} lines</option>)}</select></label>
          <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Margins</span><select value={style.margins || 'standard'} onChange={(event) => onStyleChange?.({ margins: event.target.value })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs">{MARGIN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
        <div className="mt-4">
          <MoreToolsLabel>Document</MoreToolsLabel>
          <FormatPainterControls editor={editor} value={copiedFormat} onChange={setCopiedFormat} />
          <div className="mt-2"><PageBreakControl editor={editor} /></div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">The break applies only inside the editable body and is preserved in Word export.</p>
        </div>
      </MobileEditorMoreSheet>
    )}
    {!readOnly && (
      <button type="button" onClick={() => setMobileToolsOpen(true)} className="above-mobile-navigation fixed right-4 z-20 inline-flex h-11 items-center gap-2 rounded-full bg-[#17333b] px-4 text-xs font-semibold text-white shadow-lg transition active:scale-95 lg:hidden"><PanelRightOpen className="h-4 w-4" />Draft tools</button>
    )}
    {!readOnly && mobileToolsOpen && (
      <>
        <button type="button" aria-label="Close draft tools" onClick={() => setMobileToolsOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />
        <div className="fixed inset-x-2 bottom-20 top-20 z-50 overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl lg:hidden">
          <DraftSideRail
            mobile
            document={document}
            signatories={signatories}
            signatoryId={signatoryId}
            entries={paragraphBankEntries}
            communicationType={communicationType}
            onInsert={(entry) => insertEditorText(entry.content, 'paragraph-bank')}
            onUseAddress={onUseAddress}
            onManage={() => {
              setMobileToolsOpen(false);
              onOpenParagraphBank?.();
            }}
            onCommunicationTypeChange={onCommunicationTypeChange}
            onSignatoryChange={onSignatoryChange}
            onDocumentDetailChange={onDocumentDetailChange}
            onRecipientChange={onRecipientChange}
            onClose={() => setMobileToolsOpen(false)}
          />
        </div>
      </>
    )}
    </>
  );
});

export default DraftDocumentEditor;
