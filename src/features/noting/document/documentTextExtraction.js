export const MAX_SOURCE_DOCUMENT_BYTES = 20 * 1024 * 1024;

function extensionOf(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] || '';
}

function normalizeExtractedText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractedByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export async function extractSourceDocument(file) {
  if (!file) throw new Error('Choose a Word or text file.');
  const extension = extensionOf(file.name);
  if (extension === 'doc') {
    throw new Error('Older .doc files are not supported. Open the file in Word and save it as .docx first.');
  }
  if (!['docx', 'txt', 'md'].includes(extension)) {
    throw new Error('Choose a Word (.docx) or text (.txt or .md) file.');
  }
  if (file.size > MAX_SOURCE_DOCUMENT_BYTES) {
    throw new Error('Keep the Word or text file below 20 MB.');
  }

  let content = '';
  let sourceType = 'text';
  if (extension === 'docx') {
    const mammothModule = await import('mammoth/mammoth.browser.js');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    content = result.value;
    sourceType = 'word';
  } else {
    content = await file.text();
    sourceType = extension === 'md' ? 'markdown' : 'text';
  }

  content = normalizeExtractedText(content);
  if (!content) throw new Error('No readable text was found in this file.');
  return {
    name: file.name,
    originalName: file.name,
    sourceType,
    content,
    size: extractedByteLength(content),
  };
}
