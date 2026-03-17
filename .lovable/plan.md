

## Diagnosis

Based on the edge function logs, the situation is more nuanced than a simple connection failure:

1. **Recent calls ARE succeeding** (status=200, docs=50, strategy=fetch-http1) -- the "connection reset" error is **intermittent**, not permanent
2. **ultNSU=null, maxNSU=null** -- the response from `GET /DFe/{NSU}` is not being parsed correctly for NSU pagination metadata
3. **Multiple rapid "shutdown" events** -- the function likely **times out** after successfully fetching data, during the heavy save phase (50 docs to DB + storage)
4. The 50 "docs" found may be false positives (e.g., the response body parsed incorrectly as XML fragments)

## Root Causes

- **Intermittent connection reset**: The ADN portal occasionally drops connections. This needs retry logic with backoff.
- **Wrong response parsing**: The code assumes the ADN response contains embedded XML documents and NSU fields, but without diagnostic logging we cannot confirm the actual response shape. The code finds "50 docs" but no NSU -- this strongly suggests it's misinterpreting the response (possibly extracting XML-like fragments from an HTML error page or differently structured JSON).
- **Timeout on save**: Processing 50 documents sequentially (upload XML to storage + upsert to DB for each) can easily exceed the edge function time limit.

## Plan

### 1. Add diagnostic logging to capture actual ADN response

Before any parsing, log the first 1000 characters of the raw response body and content-type header. This will reveal the true shape of the ADN response and whether "50 docs" is real or a parsing artifact.

### 2. Add retry with exponential backoff for mTLS connections

Wrap the `requestTextWithMTLS` call in a retry loop (up to 3 attempts with 1s, 2s, 4s delays) to handle intermittent connection resets.

### 3. Limit document processing to prevent timeout

- Cap the number of invoices saved per sync to 20
- Use batch upserts instead of individual inserts
- Skip XML storage upload for the initial sync (just save metadata to DB)

### 4. Fix response parsing for ADN `/DFe/{NSU}`

Per the official manual, `GET /DFe/{NSU}` returns documents with `ultNSU` and `maxNSU` fields. The current generic parser may be failing because:
- The JSON keys may be nested differently (e.g., inside a wrapper object)
- The XML content may be base64+gzip encoded (like `nfseXmlGZipB64` in the SEFIN API)

Add explicit handling for the known ADN response structure while keeping the generic fallback.

### Technical Details

**Files changed**: `supabase/functions/nfse-query/index.ts`

Key changes:
- In `fetchAdnDfeByNsu`: log `response.bodyText.slice(0, 1000)` and `content-type` before parsing
- In `requestTextWithMTLS`: add retry loop with backoff around each strategy attempt
- In main handler: limit `invoicesData` to first 20 items, batch upsert
- In `parseAdnDistributionResponse`: add explicit handling for ADN JSON envelope format

