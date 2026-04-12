

# Fix SITFIS: tratar status 304 como sucesso

## Problema

A API SERPRO retorna **304** para o serviço `SOLICITARPROTOCOLO91` (Apoiar), significando "autorização já concedida". A Edge Function trata 304 como falha (`success: false`) porque a verificação de sucesso só aceita 200-299. O frontend recebe `success: false` e exibe "Erro ao solicitar protocolo".

## Solução

Duas mudanças:

### 1. Edge Function — incluir 304 como sucesso (`supabase/functions/integra-contador/index.ts`, linha 791)

```typescript
// Antes:
success: apiResponse.status >= 200 && apiResponse.status < 300,

// Depois:
success: (apiResponse.status >= 200 && apiResponse.status < 300) || apiResponse.status === 304,
```

### 2. Frontend — melhorar extração do protocolo da resposta 304 (`src/pages/IntegraContador.tsx`, linhas 307-312)

Ajustar a validação para aceitar respostas com `success: true` mesmo quando status é 304, e tentar extrair o protocolo de `data.dados` ou de campos alternativos da resposta 304.

```typescript
// Antes:
if (!step1.data?.success) {
  const msgs = step1.data?.data?.mensagens;
  const errMsg = msgs?.map(...) || ...;
  throw new Error(errMsg);
}

// Depois:  
if (!step1.data?.success && step1.data?.status !== 304) {
  const msgs = step1.data?.data?.mensagens;
  const errMsg = msgs?.map(...) || ...;
  throw new Error(errMsg);
}
```

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/integra-contador/index.ts` | Linha 791 — incluir 304 na condição de sucesso |
| `src/pages/IntegraContador.tsx` | Linhas 307-312 — aceitar status 304 como válido |

