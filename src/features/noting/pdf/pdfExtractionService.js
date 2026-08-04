import { isLikelyScannedPage, pdfItemsToLines, reconstructPdfPages } from './pdfTextToMarkdown';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 150;

function friendlyPdfError(error) {
  if (error?.name === 'PasswordException') {
    return new Error('This PDF is password-protected. Remove the password before using it as AI context.');
  }
  if (error?.name === 'InvalidPDFException') return new Error('This file is not a readable PDF.');
  if (error?.name === 'MissingPDFException') return new Error('The selected PDF could not be opened.');
  return error instanceof Error ? error : new Error('Unable to read this PDF.');
}

export async function extractPdfAsMarkdown(file, { signal, onProgress } = {}) {
  if (!file) throw new Error('Choose a PDF file.');
  if (!file.name?.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Choose a PDF file ending in .pdf.');
  }
  if (file.size > MAX_PDF_BYTES) throw new Error('Keep the PDF below 20 MB.');

  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;

  let loadingTask;
  let passwordProtected = false;
  const abort = () => loadingTask?.destroy();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new DOMException('PDF extraction cancelled.', 'AbortError');
    const data = new Uint8Array(await file.arrayBuffer());
    if (signal?.aborted) throw new DOMException('PDF extraction cancelled.', 'AbortError');
    loadingTask = getDocument({ data, isEvalSupported: false });
    loadingTask.onPassword = () => {
      passwordProtected = true;
      loadingTask.destroy();
    };
    const document = await loadingTask.promise;
    if (document.numPages > MAX_PDF_PAGES) {
      await loadingTask.destroy();
      throw new Error(`This PDF has ${document.numPages} pages. Keep source documents to ${MAX_PDF_PAGES} pages or fewer.`);
    }

    const rawPages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (signal?.aborted) throw new DOMException('PDF extraction cancelled.', 'AbortError');
      onProgress?.({ pageNumber, totalPages: document.numPages, phase: 'extracting' });
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent({ disableNormalization: false });
      const lines = pdfItemsToLines(textContent.items, textContent.styles);
      rawPages.push({ pageNumber, lines, width: viewport.width, height: viewport.height });
      page.cleanup();
    }
    onProgress?.({ pageNumber: document.numPages, totalPages: document.numPages, phase: 'reconstructing' });
    const reconstructed = reconstructPdfPages(rawPages);
    const pages = reconstructed.pages;
    const emptyPageNumbers = pages
      .filter((page) => page.markdown.replace(/^## Page \d+\s*/i, '').trim().length < 12)
      .map((page) => page.pageNumber);
    const ocrCandidatePageNumbers = pages
      .filter((page, index) => isLikelyScannedPage(page.markdown, rawPages[index]?.lines.length || 0))
      .map((page) => page.pageNumber);
    await loadingTask.destroy();

    const meaningfulCharacters = pages.reduce(
      (total, page) => total + page.markdown.replace(/^## Page \d+\s*/i, '').trim().length,
      0,
    );
    return {
      fileName: file.name,
      fileSize: file.size,
      totalPages: document.numPages,
      pages,
      emptyPageNumbers,
      ocrCandidatePageNumbers,
      needsOcr: ocrCandidatePageNumbers.length > 0,
      fullyScanned: meaningfulCharacters === 0,
      reconstruction: reconstructed.metrics,
    };
  } catch (error) {
    if (passwordProtected) throw new Error('This PDF is password-protected. Remove the password before using it as AI context.');
    if (signal?.aborted || error?.name === 'AbortException') {
      throw new DOMException('PDF extraction cancelled.', 'AbortError');
    }
    throw friendlyPdfError(error);
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
