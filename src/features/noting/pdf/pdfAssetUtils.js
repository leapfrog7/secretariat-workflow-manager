export function resolvePdfWasmUrl({ baseUrl = '/', origin = globalThis.location?.origin || 'http://localhost' } = {}) {
  const segment = String(baseUrl || '/').replace(/^\/+|\/+$/g, '');
  return new URL(`/${segment ? `${segment}/` : ''}pdfjs/wasm/`, origin).href;
}
