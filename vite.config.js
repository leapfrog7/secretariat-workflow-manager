import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function localOcrAssets() {
  const assets = [
    ['node_modules/tesseract.js/dist/worker.min.js', 'ocr/worker.min.js'],
    ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'ocr/core/tesseract-core-lstm.wasm.js'],
    ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'ocr/core/tesseract-core-lstm.wasm'],
    ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'ocr/core/tesseract-core-simd-lstm.wasm.js'],
    ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'ocr/core/tesseract-core-simd-lstm.wasm'],
    ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
    ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm', 'ocr/core/tesseract-core-relaxedsimd-lstm.wasm'],
    ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'ocr/lang/eng.traineddata.gz'],
    ['node_modules/@tesseract.js-data/hin/4.0.0_best_int/hin.traineddata.gz', 'ocr/lang/hin.traineddata.gz'],
    ['node_modules/pdfjs-dist/wasm/jbig2.wasm', 'pdfjs/wasm/jbig2.wasm'],
    ['node_modules/pdfjs-dist/wasm/jbig2_nowasm_fallback.js', 'pdfjs/wasm/jbig2_nowasm_fallback.js'],
    ['node_modules/pdfjs-dist/wasm/openjpeg.wasm', 'pdfjs/wasm/openjpeg.wasm'],
    ['node_modules/pdfjs-dist/wasm/openjpeg_nowasm_fallback.js', 'pdfjs/wasm/openjpeg_nowasm_fallback.js'],
    ['node_modules/pdfjs-dist/wasm/qcms_bg.wasm', 'pdfjs/wasm/qcms_bg.wasm'],
  ];
  return {
    name: 'local-ocr-assets',
    configureServer(server) {
      const developmentAssets = new Map(assets.map(([source, destination]) => [`/${destination.replace(/\\/g, '/')}`, path.resolve(source)]));
      server.middlewares.use(async (request, response, next) => {
        const requestPath = String(request.url || '').split('?')[0];
        const source = developmentAssets.get(requestPath);
        if (!source) {
          next();
          return;
        }
        try {
          const content = await readFile(source);
          response.statusCode = 200;
          response.setHeader('Cache-Control', 'public, max-age=3600');
          response.setHeader('Content-Type', requestPath.endsWith('.wasm') ? 'application/wasm' : requestPath.endsWith('.gz') ? 'application/gzip' : 'text/javascript; charset=utf-8');
          response.end(content);
        } catch (error) {
          next(error);
        }
      });
    },
    async writeBundle(outputOptions) {
      const outputDirectory = path.resolve(outputOptions.dir || 'dist');
      await Promise.all(assets.map(async ([source, destination]) => {
        const target = path.join(outputDirectory, destination);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.resolve(source), target);
      }));
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/secretariat-workflow-manager/' : '/',
  plugins: [react(), tailwindcss(), localOcrAssets()],
  server: {
    watch: {
      ignored: ['**/.tmp/**'],
    },
    proxy: {
      '/lmstudio': {
        target: 'http://127.0.0.1:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lmstudio/, ''),
      },
    },
  },
});
