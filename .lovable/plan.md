

# Fix: `leafCert is not defined` in nfse-emit

## Problem
In `parsePfx()` (line 956), the code references `leafCert.pem.trim()` but `leafCert` is never declared. The variable `parsedCerts` is populated but no leaf certificate is selected from it.

## Fix

**File: `supabase/functions/nfse-emit/index.ts`** (lines 951-958)

After `parsedCerts` is built and validated, add leaf certificate selection logic before the return statement:

```typescript
if (parsedCerts.length === 0) throw new Error("Certificado não encontrado no PFX");

// Find leaf cert: match by localKeyId with the private key, or pick the one whose subject != issuer (not self-signed)
let leafCert = parsedCerts.find((c) => keyLocalKeyId && c.localKeyId === keyLocalKeyId)
  || parsedCerts.find((c) => c.subject !== c.issuer)
  || parsedCerts[0];

console.log(`PFX carregado com ${parsedCerts.length} certificado(s); usando apenas o certificado cliente folha para mTLS.`);

return {
  certPem: leafCert.pem.trim(),
  keyPem,
};
```

This matches the pattern used in `nfse-query` -- find the leaf by localKeyId match with the private key, fall back to the non-self-signed cert, then fall back to the first cert.

Single variable addition, no other changes needed.

