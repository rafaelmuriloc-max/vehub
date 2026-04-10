

# REINF: incluir notas tomadas com retenção INSS/CP

## Problema

Atualmente, a REINF (`retention_tax_type === "inss"`) só considera notas **prestadas** (emitidas pelo cliente). Notas **tomadas** (recebidas) que contenham retenção de INSS/CP também devem gerar REINF.

## Solução

Na seção de processamento de notas tomadas (linhas 94-107), além de chamar `detectRetentions(xml)` que já detecta `inss` e `cp`, esses tipos já são adicionados ao `clientRetentions`. O problema está na linha 120-121: quando `retention_tax_type === "inss"`, só usa `clientPrestadas`.

A correção é simples: para INSS/REINF, unir os clientes de `clientPrestadas` com os clientes de `clientRetentions` que têm `inss` ou `cp`.

### Mudança (linhas 120-121)

```typescript
// Antes:
if (ob.retention_tax_type === "inss") {
  clientsWithRetention = Array.from(clientPrestadas);
}

// Depois:
if (ob.retention_tax_type === "inss") {
  // Union of prestadas + tomadas with inss/cp retention
  const set = new Set(clientPrestadas);
  for (const [clientId, types] of clientRetentions) {
    if (types.has("inss") || types.has("cp")) {
      set.add(clientId);
    }
  }
  clientsWithRetention = Array.from(set);
}
```

Também precisamos garantir que na detecção de tomadas (linhas 94-107), o regex para INSS/CP textual também seja aplicado. A função `detectRetentions` já detecta `inss` via `vRetINSS` e `cp` via `vRetCP`, mas não tem os regex textuais. Vamos adicionar.

### Mudança na função `detectRetentions`

Adicionar as mesmas regex usadas nas prestadas:
```typescript
if (/RETEN[CÇ][AÃ]O\s+DE\s+INSS/i.test(xml)) types.push("inss");
if (/CONTRIBUI[CÇ][AÃ]O\s+PREVIDENCI[AÁ]RIA\s+RETIDA/i.test(xml)) types.push("inss");
```

### Ações
1. Atualizar a Edge Function com ambas as mudanças
2. Deletar instâncias REINF existentes de abril (ref 2026-04-01) e re-gerar
3. Re-deployar e executar

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/retention-obligation-generate/index.ts` | ~10 linhas — unir tomadas+prestadas para INSS, adicionar regex na `detectRetentions` |

