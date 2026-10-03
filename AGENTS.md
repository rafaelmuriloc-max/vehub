# Project rules

- PGFN negotiations are manual records in `parcelamento_results` with `origem='PGFN'` and `modalidade='PGFN_MANUAL'` (schema in `src/lib/pgfnNegociacao.ts`); why: no official PGFN/SISPAR API or confirmed connector exists, so data must never look like it came from a PGFN query.
- RFB parcelamento code must always filter `origem='RFB'` on reads and deletes; why: both origins share one table and a full RFB refresh would otherwise wipe PGFN records.
- Private guide PDFs go to the private `documents` bucket and are shared via short-lived signed URLs; why: never improvise public buckets for client tax documents.
