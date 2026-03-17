

# Fix: IBGE code not auto-filling (API doesn't return `ibge` field)

## Root Cause

The BrasilAPI `/cep/v2/` endpoint uses multiple backend services (ViaCEP, open-cep, etc.). Some services like `open-cep` do NOT return the `ibge` field in the response. This is visible in the network logs where `service: "open-cep"` is used and no `ibge` property exists.

## Solution

Change `fetchIbgeFromCep` to use **ViaCEP** (`viacep.com.br/ws/{cep}/json/`) as the primary source, which always returns `ibge`. Use BrasilAPI as a fallback.

ViaCEP response format:
```json
{
  "cep": "88385-000",
  "ibge": "4212502",
  "localidade": "Penha",
  ...
}
```

## Implementation in `src/pages/InvoiceEmit.tsx`

Replace `fetchIbgeFromCep` (lines 144-153):

```typescript
async function fetchIbgeFromCep(cep: string): Promise<string | null> {
  try {
    // ViaCEP always returns ibge
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (data.ibge) return data.ibge;
    }
    // Fallback to BrasilAPI
    const res2 = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (res2.ok) {
      const data2 = await res2.json();
      return data2.ibge || null;
    }
    return null;
  } catch {
    return null;
  }
}
```

## File

| Action | File |
|--------|------|
| Edit | `src/pages/InvoiceEmit.tsx` -- replace `fetchIbgeFromCep` function |

