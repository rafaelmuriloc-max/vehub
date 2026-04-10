

# Corrigir REINF: gerar apenas para notas prestadas com INSS retido

## Problema

Na linha 82-84 da Edge Function, **todo** cliente que emitiu uma nota no período é adicionado ao conjunto `clientPrestadas`, sem verificar se a nota tem retenção de INSS. Resultado: a REINF foi gerada para clientes sem INSS retido.

## Solução

Ao processar notas prestadas (onde `isEmitted === true`), verificar o XML da nota para `vRetINSS > 0` antes de adicionar o cliente ao conjunto. Apenas clientes com pelo menos uma nota prestada contendo retenção de INSS terão a REINF gerada.

## Mudança (linhas 82-84)

```typescript
// Antes:
if (isEmitted) {
  clientPrestadas.add(inv.client_id);
}

// Depois:
if (isEmitted) {
  const xml = inv.raw_data?.xml as string | undefined;
  if (xml && extractXmlValue(xml, "vRetINSS") > 0) {
    clientPrestadas.add(inv.client_id);
  }
}
```

## Ações adicionais
- Deletar as instâncias REINF já geradas incorretamente (referência 2026-04-01) para clientes sem INSS retido
- Re-executar a função para gerar apenas as corretas

## Arquivo
| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/retention-obligation-generate/index.ts` | ~3 linhas — verificar `vRetINSS > 0` antes de adicionar a `clientPrestadas` |

