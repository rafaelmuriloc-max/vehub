

# Ampliar detecção de INSS/CP para REINF

## Problema

A regex atual só detecta "RETENÇÃO DE INSS". Algumas empresas usam a descrição "Contribuição Previdenciária Retida" ou mencionam "CP" nas notas, e também existe a tag XML `vRetCP` que indica contribuição previdenciária retida. Essas notas não estão sendo detectadas.

## Solução

Expandir a condição de detecção na linha 86-87 para incluir:
- `vRetCP > 0` (tag XML de contribuição previdenciária)
- Regex para "Contribui(ção|cao) Previdenci(á|a)ria Retida"

### Código (linhas 86-87)

```typescript
const hasRetINSS = extractXmlValue(xml, "vRetINSS") > 0
  || extractXmlValue(xml, "vRetCP") > 0
  || /RETEN[CÇ][AÃ]O\s+DE\s+INSS/i.test(xml)
  || /CONTRIBUI[CÇ][AÃ]O\s+PREVIDENCI[AÁ]RIA\s+RETIDA/i.test(xml);
```

### Ações
1. Atualizar a Edge Function
2. Deletar instâncias REINF existentes de abril (ref 2026-04-01) para re-gerar
3. Re-deployar e executar a função

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/retention-obligation-generate/index.ts` | ~2 linhas — adicionar `vRetCP` e regex para "Contribuição Previdenciária Retida" |

