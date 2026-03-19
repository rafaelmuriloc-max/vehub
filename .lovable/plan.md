

# Fix: Caixa Postal inbox not rendering (wrong response field name)

## Problem

The edge function returns the SERPRO response in a field called `data`, but `parseCaixaPostalMessages` looks for `res.dados`. The actual SERPRO response structure is:

```text
Edge function returns:
{
  success: true,
  status: 200,
  data: {                          ← SERPRO full response
    contratante: {...},
    pedidoDados: {
      idSistema: "CAIXAPOSTAL",
      idServico: "MSGCONTRIBUINTE61",
      dados: "{\"quantidadeMensagens\":...}"   ← messages JSON string
    },
    status: 200,
    responseId: "...",
    dados: "{\"quantidadeMensagens\":...}"     ← also at top level
  }
}
```

The `parseCaixaPostalMessages` function checks `res?.dados` but should check `res?.data?.dados` or `res?.data?.pedidoDados?.dados`.

## Fix

### File: `src/pages/IntegraContador.tsx`

Update `parseCaixaPostalMessages` (lines 307-323) to look in the correct path:

1. Try `res.data.dados` (SERPRO top-level dados)
2. Try `res.data.pedidoDados.dados` (nested in pedidoDados)
3. Try `res.dados` as fallback
4. Parse the string and extract the messages array from within

The messages are likely inside an object like `{"quantidadeMensagens": N, "mensagens": [...]}` or similar structure with a `codigoSistemaRemetente` field per message.

