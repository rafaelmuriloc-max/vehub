

# Fix Caixa Postal Service Definitions

## Problem

The current Caixa Postal service definitions in the service catalog have incorrect field mappings that don't match the SERPRO API documentation:

1. **MSGCONTRIBUINTE61** — Currently only has `cnpjBasico` field. The API expects `statusLeitura`, `indicadorPagina`, and `ponteiroPagina` in the `dados` payload. The contribuinte CNPJ is already sent in the `contribuinte` object, not in `dados`.

2. **MSGDETALHAMENTO62** — Uses field key `idMensagem`, but the SERPRO API expects `isn` (Internal Sequence Number).

3. **INNOVAMSG63** — Currently has `cnpjBasico` field, but the API expects empty `dados` (`""`). The contribuinte is identified by the `contribuinte` object.

## Changes

### File: `src/pages/IntegraContador.tsx` (lines 130-138)

Update the Caixa Postal service definitions:

- **MSGCONTRIBUINTE61**: Replace `[F_CNPJ]` with fields for `statusLeitura` (select: 0=não lidas, 1=lidas, 2=todas), `indicadorPagina`, and `ponteiroPagina` with sensible defaults.
- **MSGDETALHAMENTO62**: Change `idMensagem` field key to `isn` to match the API.
- **INNOVAMSG63**: Remove fields entirely (empty array) since the API expects empty dados. Also need to handle sending empty string for dados when no fields exist.

### File: `src/pages/IntegraContador.tsx` (line 280)

Update `handleSubmit` to send empty string for `dados` when the service has no fields (for INNOVAMSG63 and similar services).

### Technical Details

```text
Current fields → Corrected fields:

MSGCONTRIBUINTE61:
  [cnpjBasico] → [statusLeitura, indicadorPagina, ponteiroPagina]

MSGDETALHAMENTO62:
  [cnpjBasico, idMensagem] → [isn]

INNOVAMSG63:
  [cnpjBasico] → [] (empty, dados sent as "")
```

