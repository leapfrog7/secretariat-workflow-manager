import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileText, LoaderCircle, ScanText, Square, X } from 'lucide-react';
import { byteLength, composePdfMarkdown } from './pdfTextToMarkdown';
import { extractPdfAsMarkdown } from './pdfExtractionService';
import { MAX_OCR_PAGES_PER_RUN, OCR_LANGUAGE_OPTIONS, mergeOcrWithSelectableText, recognizePdfPages } from './pdfOcrService';
import ModalFrame from '../../../components/common/ModalFrame';

function markdownName(fileName) {
  return String(fileName || 'source.pdf').replace(/\.pdf$/i, '') + '.md';
}

export default function PdfContextDialog({ file, maxBytes, modeLabel, onAttach, onClose }) {
  const [status, setStatus] = useState('extracting');
  const [progress, setProgress] = useState({ pageNumber: 0, totalPages: 0 });
  const [result, setResult] = useState(null);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [ocrSelection, setOcrSelection] = useState(new Set());
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [selectingOcrPages, setSelectingOcrPages] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('extracting');
    setError('');
    extractPdfAsMarkdown(file, {
      signal: controller.signal,
      onProgress: setProgress,
    }).then((extracted) => {
      const usablePages = new Set(extracted.pages.filter((page) => page.markdown.replace(/^## Page \d+\s*/i, '').trim().length >= 12).map((page) => page.pageNumber));
      const scannedPages = new Set(extracted.ocrCandidatePageNumbers.slice(0, MAX_OCR_PAGES_PER_RUN));
      setResult(extracted);
      setSelectedPages(usablePages);
      setOcrSelection(scannedPages);
      setContent(composePdfMarkdown(extracted.pages, usablePages));
      setStatus('ready');
    }).catch((extractionError) => {
      if (extractionError.name === 'AbortError') return;
      setError(extractionError.message || 'Unable to extract text from this PDF.');
      setStatus('error');
    });
    return () => controller.abort();
  }, [file]);

  const extractedBytes = useMemo(() => byteLength(content), [content]);
  const estimatedTokens = Math.max(1, Math.ceil(content.length / 4));
  const overLimit = extractedBytes > maxBytes;
  const lowConfidencePages = result?.pages.filter((page) => page.ocrConfidence > 0 && page.ocrConfidence < 60).map((page) => page.pageNumber) || [];
  const reconstructionItems = result ? [
    result.reconstruction?.removedRepeatedLineCount > 0 && `${result.reconstruction.removedRepeatedLineCount} repeated header/footer line${result.reconstruction.removedRepeatedLineCount === 1 ? '' : 's'} removed`,
    result.reconstruction?.headingCount > 0 && `${result.reconstruction.headingCount} heading${result.reconstruction.headingCount === 1 ? '' : 's'} recognized`,
    result.reconstruction?.tableCount > 0 && `${result.reconstruction.tableCount} table${result.reconstruction.tableCount === 1 ? '' : 's'} reconstructed`,
  ].filter(Boolean) : [];

  const updateSelection = (next) => {
    setSelectedPages(next);
    setContent(composePdfMarkdown(result.pages, next));
  };

  const togglePage = (pageNumber, checked) => {
    const next = new Set(selectedPages);
    if (checked) next.add(pageNumber);
    else next.delete(pageNumber);
    updateSelection(next);
  };

  const toggleOcrPage = (pageNumber, checked) => {
    const next = new Set(ocrSelection);
    if (checked) {
      if (next.size >= MAX_OCR_PAGES_PER_RUN) {
        setError(`Read no more than ${MAX_OCR_PAGES_PER_RUN} scanned pages at a time.`);
        return;
      }
      next.add(pageNumber);
    } else {
      next.delete(pageNumber);
    }
    setError('');
    setOcrSelection(next);
  };

  const runOcr = async () => {
    if (!ocrSelection.size) {
      setError('Select at least one scanned page to read.');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setError('');
    setStatus('ocr');
    setProgress({ phase: 'loading-engine', pageNumber: 0, totalPages: ocrSelection.size, progress: 0 });
    try {
      const recognized = await recognizePdfPages(file, [...ocrSelection], {
        language: ocrLanguage,
        signal: controller.signal,
        onProgress: setProgress,
      });
      const recognizedByPage = new Map(recognized.pages.map((page) => [page.pageNumber, page]));
      const pages = result.pages.map((page) => {
        const recognizedPage = recognizedByPage.get(page.pageNumber);
        return recognizedPage?.markdown
          ? { ...page, ...recognizedPage, markdown: mergeOcrWithSelectableText(page.markdown, recognizedPage.markdown), ocrConfidence: recognizedPage.confidence }
          : page;
      });
      const emptyPageNumbers = pages
        .filter((page) => page.markdown.replace(/^## Page \d+(?: \(OCR\))?\s*/i, '').trim().length < 12)
        .map((page) => page.pageNumber);
      const successfulPages = recognized.pages
        .filter((page) => page.markdown.replace(/^## Page \d+(?: \(OCR\))?\s*/i, '').trim().length >= 12)
        .map((page) => page.pageNumber);
      const successfulPageSet = new Set(successfulPages);
      const ocrCandidatePageNumbers = (result.ocrCandidatePageNumbers || [])
        .filter((pageNumber) => !successfulPageSet.has(pageNumber));
      const nextSelectedPages = new Set([...selectedPages, ...successfulPages]);
      const nextResult = { ...result, pages, emptyPageNumbers, ocrCandidatePageNumbers, needsOcr: ocrCandidatePageNumbers.length > 0, fullyScanned: emptyPageNumbers.length === pages.length };
      setResult(nextResult);
      setSelectedPages(nextSelectedPages);
      setOcrSelection(new Set(ocrCandidatePageNumbers.slice(0, MAX_OCR_PAGES_PER_RUN)));
      setSelectingOcrPages(false);
      setContent(composePdfMarkdown(pages, nextSelectedPages));
      if (!successfulPages.length) setError('OCR completed, but no readable text was found. Try the other language option or use a clearer scan.');
      setStatus('ready');
    } catch (ocrError) {
      if (ocrError.name !== 'AbortError') setError(ocrError.message || 'Unable to read the scanned pages.');
      setStatus('ready');
    }
  };

  const close = () => {
    controllerRef.current?.abort();
    onClose();
  };

  return (
    <ModalFrame open labelledBy="pdf-context-title" busy={['extracting', 'ocr'].includes(status)} onClose={close} maxWidth="max-w-5xl" className="flex flex-col overflow-hidden border border-slate-200">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><ScanText className="h-5 w-5 shrink-0 text-cyan-700" /><h3 id="pdf-context-title" className="text-base font-semibold text-[#17333b]">Extract PDF text</h3></div>
            <p className="mt-1 truncate text-xs text-slate-500">{file.name}</p>
          </div>
          <button type="button" data-autofocus onClick={close} title="Close" aria-label="Close PDF import" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </header>

        {status === 'extracting' && (
          <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-5 py-10 text-center" role="status" aria-live="polite">
            <LoaderCircle className="h-8 w-8 animate-spin text-cyan-700" />
            <p className="mt-4 text-sm font-semibold text-slate-800">{progress.phase === 'reconstructing' ? 'Improving document structure' : 'Extracting text in this browser'}</p>
            <p className="mt-1 text-xs text-slate-500">{progress.phase === 'reconstructing' ? 'Removing repeated page text and rebuilding headings and tables...' : progress.totalPages ? `Reading page ${progress.pageNumber} of ${progress.totalPages}` : 'Opening PDF...'}</p>
            {progress.totalPages > 0 && <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-cyan-600 transition-[width]" style={{ width: `${Math.round((progress.pageNumber / progress.totalPages) * 100)}%` }} /></div>}
            <p className="mt-5 max-w-md text-xs leading-5 text-slate-500">The PDF is processed in memory and is not uploaded or saved.</p>
            <button type="button" onClick={close} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"><Square className="h-3.5 w-3.5" />Cancel extraction</button>
          </div>
        )}

        {status === 'ocr' && (
          <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-5 py-10 text-center" role="status" aria-live="polite">
            <LoaderCircle className="h-8 w-8 animate-spin text-cyan-700" />
            <p className="mt-4 text-sm font-semibold text-slate-800">Reading scanned pages in this browser</p>
            <p className="mt-1 text-xs text-slate-500">{progress.phase === 'loading-engine' ? 'Preparing the OCR language files...' : progress.pageNumber ? `Reading page ${progress.pageNumber} (${progress.pageIndex || 1} of ${progress.totalPages})` : 'Preparing scanned pages...'}</p>
            <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-cyan-600 transition-[width]" style={{ width: `${Math.max(4, Math.round((((progress.pageIndex || 1) - 1 + (progress.progress || 0)) / Math.max(1, progress.totalPages)) * 100))}%` }} /></div>
            <p className="mt-3 max-w-md text-xs leading-5 text-slate-500">The first run may take longer while the selected language is prepared. It is cached by the browser for later use.</p>
            <button type="button" onClick={() => controllerRef.current?.abort()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"><Square className="h-3.5 w-3.5" />Cancel OCR</button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex min-h-64 flex-1 flex-col items-center justify-center px-5 py-10 text-center">
            <ScanText className="h-8 w-8 text-slate-300" />
            <p className="mt-4 max-w-lg text-sm font-semibold text-red-800">{error}</p>
            <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">The file could not be read as a text or scanned PDF. The original file has not been stored.</p>
            <button type="button" onClick={close} className="mt-5 h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
          </div>
        )}

        {status === 'ready' && result && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid min-h-full lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-700">{selectingOcrPages ? 'Pages to read with OCR' : 'Pages to include'}</p><span className="text-xs tabular-nums text-slate-500">{selectingOcrPages ? ocrSelection.size : selectedPages.size}/{result.totalPages}</span></div>
                  <div className="mt-2 grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto lg:max-h-[420px] lg:grid-cols-3">
                    {result.pages.map((page) => {
                      const ocrCandidate = result.ocrCandidatePageNumbers.includes(page.pageNumber);
                      const choosingOcr = selectingOcrPages || ocrCandidate;
                      const checked = choosingOcr ? ocrSelection.has(page.pageNumber) : selectedPages.has(page.pageNumber);
                      return <label key={page.pageNumber} title={choosingOcr ? `Select page ${page.pageNumber} for OCR` : `Include page ${page.pageNumber}`} className={`flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded border text-xs ${choosingOcr ? checked ? 'border-amber-400 bg-amber-50 font-semibold text-amber-950' : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50' : checked ? 'border-cyan-300 bg-cyan-50 font-semibold text-cyan-900' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}><input type="checkbox" className="sr-only" checked={checked} onChange={(event) => choosingOcr ? toggleOcrPage(page.pageNumber, event.target.checked) : togglePage(page.pageNumber, event.target.checked)} />{checked && (choosingOcr ? <ScanText className="h-3 w-3" /> : <Check className="h-3 w-3" />)}{page.pageNumber}</label>;
                    })}
                  </div>
                  {!selectingOcrPages && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => updateSelection(new Set(result.pages.filter((page) => !result.emptyPageNumbers.includes(page.pageNumber)).map((page) => page.pageNumber)))} className="text-xs font-semibold text-cyan-800 hover:underline">Select text pages</button><span className="text-slate-300">|</span><button type="button" onClick={() => updateSelection(new Set())} className="text-xs font-semibold text-slate-600 hover:underline">Clear</button><span className="text-slate-300">|</span><button type="button" onClick={() => { setSelectingOcrPages(true); setError(''); }} className="text-xs font-semibold text-amber-800 hover:underline">Choose pages for OCR</button></div>}
                  {(result.ocrCandidatePageNumbers.length > 0 || selectingOcrPages) && <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2.5"><p className="text-xs font-semibold text-amber-950">{result.ocrCandidatePageNumbers.length > 0 ? 'Scanned or image-based pages detected' : 'Read selected pages with OCR'}</p><p className="mt-1 text-xs leading-5 text-amber-900">{selectingOcrPages ? 'Select any page numbers above whose image text is missing from the preview.' : 'Sparse selectable text may be only a file number or header. Amber pages will be read in full.'}</p><label className="mt-2 block"><span className="mb-1 block text-[11px] font-semibold text-amber-950">Document language</span><select value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)} className="h-9 w-full rounded-md border border-amber-300 bg-white px-2 text-xs text-slate-700">{OCR_LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" disabled={!ocrSelection.size} onClick={runOcr} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-amber-700 px-3 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300"><ScanText className="h-4 w-4" />Read {ocrSelection.size || ''} page{ocrSelection.size === 1 ? '' : 's'} with OCR</button>{selectingOcrPages && <button type="button" onClick={() => setSelectingOcrPages(false)} className="mt-2 w-full text-xs font-semibold text-amber-900 hover:underline">Back to page inclusion</button>}{result.ocrCandidatePageNumbers.length > MAX_OCR_PAGES_PER_RUN && <p className="mt-2 text-[11px] leading-4 text-amber-800">For device stability, OCR is limited to {MAX_OCR_PAGES_PER_RUN} pages per run. Remaining pages can be read in another batch.</p>}</div>}
                  {lowConfidencePages.length > 0 && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900">Review OCR wording carefully on page{lowConfidencePages.length === 1 ? '' : 's'} {lowConfidencePages.join(', ')}, where recognition confidence was lower.</p>}
                  {reconstructionItems.length > 0 && <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-2"><p className="text-xs font-semibold text-cyan-950">Layout cleanup complete</p><ul className="mt-1 space-y-0.5 text-xs leading-5 text-cyan-900">{reconstructionItems.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                  <p className="mt-3 text-xs leading-5 text-slate-500">Changing page selection rebuilds the preview. Select pages before making manual corrections.</p>
                </aside>
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">Editable text preview</p><p className="mt-0.5 text-xs text-slate-500">Correct recognition errors or remove material AI does not need.</p></div><p className={`text-xs tabular-nums ${overLimit ? 'font-semibold text-red-700' : 'text-slate-500'}`}>{Math.max(1, Math.ceil(extractedBytes / 1024)).toLocaleString()} KB | about {estimatedTokens.toLocaleString()} tokens</p></div>
                  {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700">{error}</p>}
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={18} aria-label="Extracted PDF Markdown" className="mt-3 min-h-[42vh] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-3 font-mono text-xs leading-5 text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 sm:min-h-[520px]" />
                  {overLimit && <p className="mt-2 text-xs font-medium leading-5 text-red-700">The extracted text exceeds the {modeLabel} limit of {Math.round(maxBytes / 1024)} KB. Remove pages or shorten the preview before attaching it.</p>}
                </div>
              </div>
            </div>
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="flex items-center gap-2 text-xs text-slate-500"><FileText className="h-4 w-4 text-cyan-700" />Only this reviewed text will be available to AI.</p>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={close} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" disabled={!content.trim() || overLimit} onClick={() => onAttach({ name: markdownName(file.name), originalName: file.name, sourceType: 'pdf', content, size: extractedBytes, pageCount: selectedPages.size })} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Check className="h-4 w-4" />Use as context</button></div>
            </footer>
          </>
        )}
    </ModalFrame>
  );
}
