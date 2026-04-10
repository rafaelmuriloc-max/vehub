

# Corrigir detecção de INSS para NFS-e nacional (REINF)

## Problema

A Edge Function `retention-obligation-generate` verifica a tag XML `vRetINSS` para identificar notas com retenção de INSS. Porém, no formato NFS-e nacional (SPED), essa tag **não existe**. Nenhuma das 768 notas de março contém `vRetINSS`.

A informação de retenção de INSS está no texto descritivo da nota, dentro das tags `xInfComp` ou `xDescServ`, com padrão como:
```
RETENCAO DE INSS SOBRE MAO OBRA R$ 326,64 X 11% = R$ 35,93
```

Há 1 cliente (WR SINALIZACOES) com 35 notas prestadas em março contendo esse padrão, e zero instâncias REINF foram geradas.

## Solução

Alterar a lógica de detecção de INSS na Edge Function para, além de verificar `vRetINSS > 0`, também buscar o padrão textual `RETENCAO DE INSS` no XML da nota.

### Mudança no código (linhas 82-87)

```typescript
if (isEmitted) {
  const xml = inv.raw_data?.xml as string | undefined;
  if (xml) {
    const hasRetINSS = extractXmlValue(xml, "vRetINSS") > 0 
      || /RETEN[CÇ][AÃ]O\s+DE\s+INSS/i.test(xml);
    if (hasRetINSS) {
      clientPrestadas.add(inv.client_id);
    }
  }
}
```

### Ações
1. Atualizar a Edge Function com a nova detecção
2. Re-deployar e executar para gerar as instâncias REINF de abril

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/retention-obligation-generate/index.ts` | ~3 linhas — adicionar regex para detectar INSS no texto da nota |

## Resultado esperado

A REINF será gerada para WR SINALIZACOES (e qualquer outro cliente com notas prestadas contendo retenção de INSS) com vencimento em 15/04/2026.

