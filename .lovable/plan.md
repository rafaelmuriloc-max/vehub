

# Fix PDF worker loading in DocumentFieldAnnotator

## Problem
The `pdfjs.version` resolves to `4.8.69`, which may not exist on cdnjs.cloudflare.com. The console still shows the fallback to `unpkg.com` which is blocked/failing.

## Solution
Use the recommended `import.meta.url` approach from react-pdf docs, which bundles the worker locally via Vite instead of fetching from a CDN:

### `src/components/settings/DocumentFieldAnnotator.tsx` — line 9
Replace:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
```
With:
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
```

This makes Vite resolve the worker from `node_modules/pdfjs-dist` at build time, eliminating any CDN dependency. Single file change, single line.

