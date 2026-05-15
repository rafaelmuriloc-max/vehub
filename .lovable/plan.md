## Mudança
Em `src/pages/Chat.tsx`, ajustar a condição de renderização do `PendingTasksPanel` para também exigir `pendingTasksCount > 0`. Assim, quando a contagem chegar a zero (após concluir/mover todas as tarefas, ou quando não houver tarefas), o painel fecha automaticamente.

### Detalhes técnicos
- Linha 868: trocar
  `pendingTasksOpen && activeConv?.whatsappPhone`
  por
  `pendingTasksOpen && pendingTasksCount > 0 && activeConv?.whatsappPhone`
- O `PendingTasksPanel` já chama `onCountChange` (via `onCountChangeRef`) sempre que a lista de tarefas muda, então a janela some sozinha quando a última tarefa sai do status `todo`.
- Manter o reset existente em `setPendingTasksOpen(true)` ao trocar de conversa, para que o painel volte a abrir automaticamente em conversas com tarefas pendentes.