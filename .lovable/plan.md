## Problema

Ao concluir obrigações em massa, algumas não aparecem na aba "Concluídas" por dois motivos:

1. **Obrigações sem atividades configuradas**: a função `quickCompleteSelectedInstances` pula essas instâncias (conta como "sem atividades") e não grava nenhuma marcação de conclusão. Como `isInstanceCompleted` também devolve `false` quando a obrigação não tem atividades, elas nunca aparecem como concluídas.
2. **Instâncias excluídas selecionadas em massa**: quando a seleção inclui itens da aba "Excluídas", eles são marcados como concluídos mas continuam com `deleted_at` preenchido, então não aparecem na lista do mês.
3. **Fonte da verdade frágil**: a "conclusão" hoje depende de existir 1 completion por atividade. Isso é frágil para conclusão rápida/em massa.

## Solução

Usar o campo `obligation_instances.status` como fonte oficial da conclusão (já existe na tabela) e marcar adicionalmente um campo de marcador "quick" para manter a cor azul.

### Mudanças

1. **Banco** (`src/integrations/supabase`): migração adicionando coluna `completion_kind text` em `obligation_instances` (valores: `null`, `quick`, `full`). Sem alteração destrutiva.

2. **`src/pages/CalendarView.tsx`**:
   - Em `quickCompleteSelectedInstances` e `quickCompleteInstance`:
     - Sempre atualizar `obligation_instances` com `status='done'` e `completion_kind='quick'`, independentemente de existirem atividades.
     - Restaurar `deleted_at=null` se a instância estava excluída (ou bloquear a ação para itens da aba Excluídas — preferência do usuário).
     - Continuar marcando completions com `notes='quick_complete'` quando houver atividades (para consistência).
   - Em `isInstanceCompleted`:
     - Retornar `true` quando `instance.status === 'done'` OU quando todas as atividades estão concluídas (mantém retrocompatibilidade).
   - Em `isQuickCompleted`:
     - Retornar `true` quando `instance.completion_kind === 'quick'` OU pelo critério atual (notes).
   - Em fluxos que "desfazem" conclusão (toggle individual), zerar `status` e `completion_kind` da instância.
   - Carregar os campos novos em `loadData` (já busca instances).

3. **Aba "Excluídas"**: desabilitar o botão de "Concluir selecionadas" quando a seleção contém itens excluídos, ou perguntar ao usuário se prefere que a ação restaure + conclua.

## Pergunta antes de implementar

Quando uma obrigação está na aba **Excluídas** e o usuário seleciona ela junto com outras e clica em "Concluir em massa", o que deve acontecer?

- (A) Ignorar as excluídas (só conclui as não-excluídas)
- (B) Restaurar automaticamente e concluir
- (C) Bloquear a ação inteira e avisar
