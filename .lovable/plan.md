
# Ignorar obrigações concluídas ao importar documentos

## Problema
Quando um documento é importado, o sistema vincula e marca atividades como concluídas em todas as instâncias encontradas, mesmo que a obrigação já esteja 100% concluída. Isso pode sobrescrever dados de conclusão existentes.

## Solução

Antes de processar cada instância no loop de vinculação, verificar se todas as atividades daquela instância já estão concluídas. Se sim, pular a instância.

### `src/pages/Documents.tsx` — 2 pontos de alteração

**1. Função auxiliar `isInstanceFullyCompleted`** (~linha 403):
```typescript
async function isInstanceFullyCompleted(instanceId: string, obligationId: string): Promise<boolean> {
  const { data: acts } = await supabase
    .from('obligation_activities')
    .select('id')
    .eq('obligation_id', obligationId);
  if (!acts || acts.length === 0) return false;
  const { data: completions } = await supabase
    .from('obligation_activity_completions')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('completed', true);
  return (completions?.length || 0) >= acts.length;
}
```

**2. Guard no `importDocument`** (linha ~477, loop `for (const inst of allInstances)`):
- Adicionar `if (await isInstanceFullyCompleted(inst.id, inst.obligation_id)) continue;`

**3. Guard no `relinkDocuments`** (linha ~639, loop `for (const inst of allInstances)`):
- Mesmo check: `if (await isInstanceFullyCompleted(inst.id, inst.obligation_id)) continue;`

## Arquivo alterado
- `src/pages/Documents.tsx` — 1 função nova + 2 guards (~15 linhas)
