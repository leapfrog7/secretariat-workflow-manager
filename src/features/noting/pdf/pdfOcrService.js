import { resolvePdfWasmUrl } from './pdfAssetUtils.js';

export const MAX_OCR_PAGES_PER_RUN = 40;
const OCR_RENDER_SCALE = 2;
const MAX_CANVAS_PIXELS = 6_000_000;

export const OCR_LANGUAGE_OPTIONS = [
  { value: 'eng', label: 'English', languages: ['eng'] },
  { value: 'hin', label: 'Hindi', languages: ['hin'] },
  { value: 'eng+hin', label: 'English and Hindi', languages: ['eng', 'hin'] },
];

function normalizeOcrLine(value) {
  return String(value || '')
    .replace(/^[\u2022\u25cf\u25e6\u25aa\uf0b7]\s*/, '- ')
    .replace(/^(\d+)[.)]\s+/, '$1. ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function ocrTextToMarkdown(text, pageNumber) {
  const body = String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeOcrLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return body ? `## Page ${pageNumber} (OCR)\n\n${body}` : '';
}

function pageBody(markdown) {
  return String(markdown || '').replace(/^## Page \d+(?: \(OCR\))?\s*/i, '').trim();
}

function comparisonText(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function mergeOcrWithSelectableText(originalMarkdown, ocrMarkdown) {
  if (!ocrMarkdown) return originalMarkdown || '';
  const originalBody = pageBody(originalMarkdown);
  if (!originalBody) return ocrMarkdown;
  const originalComparison = comparisonText(originalBody);
  const ocrComparison = comparisonText(pageBody(ocrMarkdown));
  if (!originalComparison || ocrComparison.includes(originalComparison)) return ocrMarkdown;
  return `${ocrMarkdown}\n\n### Selectable text retained\n\n${originalBody}`;
}

function selectedLanguage(value) {
  return OCR_LANGUAGE_OPTIONS.find((option) => option.value === value) || OCR_LANGUAGE_OPTIONS[0];
}

function renderScaleForPage(page) {
  const viewport = page.getViewport({ scale: 1 });
  const pixelLimitedScale = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, viewport.width * viewport.height));
  return Math.max(1, Math.min(OCR_RENDER_SCALE, pixelLimitedScale));
}

export async function recognizePdfPages(file, pageNumbers, {
  language = 'eng',
  signal,
  onProgress,
} = {}) {
  const selectedPages = [...new Set(pageNumbers || [])]
    .map(Number)
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
  if (!selectedPages.length) throw new Error('Select at least one scanned page to read.');
  if (selectedPages.length > MAX_OCR_PAGES_PER_RUN) {
    throw new Error(`Read no more than ${MAX_OCR_PAGES_PER_RUN} scanned pages at a time.`);
  }

  const languageOption = selectedLanguage(language);
  const [{ getDocument, GlobalWorkerOptions }, workerModule, tesseractModule] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    import('tesseract.js'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const createWorker = tesseractModule.createWorker || tesseractModule.default?.createWorker;
  if (!createWorker) throw new Error('The browser OCR engine could not be loaded.');

  let loadingTask;
  let document;
  let worker;
  let currentPage = selectedPages[0];
  let currentPageIndex = 1;
  const abort = () => {
    worker?.terminate().catch(() => {});
    loadingTask?.destroy();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new DOMException('OCR cancelled.', 'AbortError');
    onProgress?.({ phase: 'loading-engine', pageNumber: 0, totalPages: selectedPages.length, progress: 0 });
    loadingTask = getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
      wasmUrl: resolvePdfWasmUrl({ baseUrl: import.meta.env.BASE_URL, origin: window.location.origin }),
    });
    document = await loadingTask.promise;
    if (selectedPages.some((pageNumber) => pageNumber < 1 || pageNumber > document.numPages)) {
      throw new Error('One or more selected pages could not be found in this PDF.');
    }

    const ocrAssetBase = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.origin).href.replace(/\/$/, '');
    worker = await createWorker(languageOption.languages, 1, {
      workerPath: `${ocrAssetBase}/worker.min.js`,
      corePath: `${ocrAssetBase}/core`,
      langPath: `${ocrAssetBase}/lang`,
      logger: (message) => onProgress?.({
        phase: message.status === 'recognizing text' ? 'recognizing' : 'loading-engine',
        pageNumber: currentPage,
        pageIndex: currentPageIndex,
        totalPages: selectedPages.length,
        progress: Number(message.progress) || 0,
        message: message.status,
      }),
    });
    if (signal?.aborted) throw new DOMException('OCR cancelled.', 'AbortError');
    await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '144' });

    const pages = [];
    for (let index = 0; index < selectedPages.length; index += 1) {
      if (signal?.aborted) throw new DOMException('OCR cancelled.', 'AbortError');
      currentPage = selectedPages[index];
      currentPageIndex = index + 1;
      onProgress?.({ phase: 'rendering', pageNumber: currentPage, pageIndex: index + 1, totalPages: selectedPages.length, progress: 0 });
      const page = await document.getPage(currentPage);
      const viewport = page.getViewport({ scale: renderScaleForPage(page) });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!context) throw new Error('This browser could not prepare the scanned page for OCR.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const recognition = await worker.recognize(canvas);
      const markdown = ocrTextToMarkdown(recognition.data?.text, currentPage);
      pages.push({
        pageNumber: currentPage,
        markdown,
        characterCount: markdown.length,
        confidence: Number(recognition.data?.confidence) || 0,
      });
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      onProgress?.({ phase: 'page-complete', pageNumber: currentPage, pageIndex: index + 1, totalPages: selectedPages.length, progress: 1 });
    }
    return { pages, language: languageOption.value };
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortException') {
      throw new DOMException('OCR cancelled.', 'AbortError');
    }
    const message = typeof error === 'string' ? error : error?.message;
    throw error instanceof Error ? error : new Error(message || 'Unable to read the scanned pages.');
  } finally {
    signal?.removeEventListener('abort', abort);
    await worker?.terminate().catch(() => {});
    await loadingTask?.destroy().catch(() => {});
  }
}
