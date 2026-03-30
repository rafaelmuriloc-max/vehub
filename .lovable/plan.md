

# Fix: PDF worker failing to load in DocumentFieldAnnotator

## Problem
The pdf.js worker is loaded from `unpkg.com` which is being blocked/failing. Console error: `"Failed to fetch dynamically imported module: https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs"`.

## Solution
Change the worker source URL on line 9 of `DocumentFieldAnnotator.tsx` from `unpkg.com` to `cdnjs.cloudflare.com`, which is more reliably accessible:

```typescript
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
```

## Files modified
- `src/components/settings/DocumentFieldAnnotator.tsx` — line 9 only

