## Concluir em massa no calendário

Hoje a barra flutuante de seleção em `src/pages/CalendarView.tsx` mostra apenas "Excluir selecionados" + "Limpar". Adicionar um terceiro botão "Concluir selecionados" que aplica o mesmo fluxo de `quickCompleteInstance` em lote.

### Mudanças (apenas `src/pages/CalendarView.tsx`)

1. **Nova função `quickCompleteSelectedInstances()`**
   - Itera `selectedInstanceIds`.
   - Para cada `instanceId`, resolve o `obligation_id` via `instances.find(i => i.id === instanceId)` (e fallback no `monthInstances`/`deletedInstances` se necessário).
   - Pula instâncias já concluídas (`isInstanceCompleted`) e instâncias sem atividades configuradas (acumula contador para toast).
   - Para as restantes, reaproveita a lógica do `quickCompleteInstance`: para cada atividade da obrigação, `update` se já existir completion ou `insert` com `completed: true`, `completed_at: now`, `notes: 'quick_complete'` (mantém o destaque azul claro na aba Concluídas).
   - Faz um único `loadData()` ao final, fecha o dialog de confirmação, chama `clearSelection()` e emite toast com `X concluída(s)` + `Y já concluídas` + `Z sem atividades` quando aplicável.

2. **Novo estado `showBulkCompleteConfirm`** (mesmo padrão de `showBulkDeleteConfirm`).

3. **UI da barra de seleção (linhas ~1548-1577)**
   - Inserir botão `variant="default"` com ícone `CheckCircle2` (já importado) e label **"Concluir selecionados"** antes do botão de excluir.
   - Abre `AlertDialog` próprio com texto "Deseja concluir N obrigação(ões) selecionada(s)? As atividades serão marcadas como concluídas automaticamente."
   - Ação confirma chamando `quickCompleteSelectedInstances`.

4. **Sem mudanças** em schema, RLS, queries de carregamento, ou outras telas.

### Fora de escopo
- Não altera o comportamento de exclusão.
- Não toca em `Obligations.tsx`, `Documents.tsx`, etc.
- Não muda a forma como obrigações concluídas em massa aparecem (continuam com o destaque azul claro porque usam `notes: 'quick_complete'`).
