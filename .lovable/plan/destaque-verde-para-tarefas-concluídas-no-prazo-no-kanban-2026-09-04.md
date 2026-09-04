# Destaque verde para tarefas concluídas no prazo no Kanban

## O que muda

Na página **Tarefas**, na aba **Kanban**, os cards da coluna **Concluído** que foram finalizados dentro do prazo ganham um destaque verde (fundo + borda).

## Critério de "no prazo"

Uma tarefa concluída está no prazo quando:

- `status === 'done'`
- `due_date` está preenchido
- `completed_at` está preenchido
- A data de conclusão (parte YYYY-MM-DD de `completed_at`) é menor ou igual a `due_date`.

Tarefas concluídas sem `due_date` ou sem `completed_at` não recebem o destaque.

## Mudanças no frontend

Arquivo: `src/pages/Tasks.tsx`

1. Criar helper local `isCompletedOnTime(task: Task): boolean`.
2. No card do Kanban (`<Card>` dentro da coluna `done`), adicionar classes condicionais quando `isCompletedOnTime(task)` for verdadeiro:
   - Fundo verde claro (`bg-green-50 dark:bg-green-900/20`).
   - Borda verde (`border-green-200 dark:border-green-800`).
3. Manter o texto "Concluído em" já existente.

## O que não muda

- Nenhuma alteração de banco de dados.
- Nenhuma alteração no comportamento de conclusão ou no trigger `completed_at`.
- A coluna "Concluído" continua mostrando todas as tarefas concluídas; apenas as no prazo ganham o destaque visual.
