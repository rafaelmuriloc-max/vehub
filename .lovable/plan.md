
# Fix: IBGE code not auto-filling

## Problem
In `src/pages/InvoiceEmit.tsx` line 149, `fetchIbgeFromCep` reads `data.city_ibge` but the BrasilAPI `/cep/v2/` endpoint returns the field as `ibge`. This causes the auto-fill to silently fail.

## Fix

**File: `src/pages/InvoiceEmit.tsx`**
- Line 149: change `return data.city_ibge || null;` → `return data.ibge || null;`

Single-line fix.
