# Botão "Concluir" nos cards do Kanban de Tarefas

Adicionar um botão de concluir diretamente no cartão da tarefa, sem abrir o diálogo de edição.

## O que muda

- No rodapé do cartão do Kanban (ao lado de "Para o cliente" e da lixeira), exibir um botão **"Concluir"** com ícone de confirmação (check), visível apenas em tarefas **não concluídas** (colunas "A Fazer" e "Aguardando").
- Ao clicar, a tarefa passa para "Concluído" reutilizando a função existente `moveTask(taskId, 'done')`, que já:
  - atualiza o status no banco (o trigger registra `completed_at` automaticamente);
  - protege contra rebaixar tarefa já notificada/concluída (`guardStatus`);
  - dispara a notificação ao cliente (WhatsApp/e-mail) quando configurada e ainda não enviada;
  - recarrega a lista.
- O clique no botão usa `stopPropagation` para não abrir o diálogo de edição.
- Tarefas já concluídas não exibem o botão (o cartão já mostra "Concluído em ..." em verde).

## O que não muda

- Nenhuma regra de negócio, filtro, ordenação, paginação, cronômetro, anexos ou exclusão.
- Nenhuma alteração de banco de dados, permissões ou edge functions.

## Detalhes técnicos

- Arquivo único: `src/pages/Tasks.tsx` — rodapé do `<Card>` do Kanban (linhas ~763-771).
- Botão compacto (`size="sm"`, `h-6 px-2 text-[11px]`, variante ghost/verde) com ícone `CheckCircle2` (já importado no arquivo).
- Validação: `tsgo`/build e conferência visual no preview.
