# Coluna "Fazendo" no Kanban de Tarefas

## Como vai funcionar
- Nova coluna **Fazendo** entre "A Fazer" e "Aguardando".
- Quando alguém dá play no cronômetro de uma tarefa, ela vai na hora para "Fazendo". O mesmo acontece para quem estiver com a tela aberta.
- Quando o cronômetro para, a tarefa volta para a coluna do status dela ("A Fazer" ou "Aguardando").
- Tarefas concluídas ficam sempre em "Concluído", mesmo que o cronômetro tenha ficado ligado.
- O cabeçalho da coluna segue o padrão das outras: ícone, contador, subtítulo "Tarefas com cronômetro em andamento" e aviso quando estiver vazia. Ela tem os mesmos filtros e o "Ver todas".
- Não dá para criar tarefa direto nessa coluna, por isso ela não tem o botão "+". Os cartões aparecem do jeito de sempre e mostram o cronômetro correndo.

## O que não muda
- O status gravado da tarefa continua o mesmo. "Fazendo" é só uma forma de mostrar as tarefas que estão sendo feitas agora. A Lista, os relatórios e os gráficos de desempenho não mudam.
- O cronômetro em lote do calendário vale só para obrigações e não entra nessa coluna.

## Detalhes técnicos
- Arquivo: `src/pages/Tasks.tsx`.
- Buscar em `time_entries` os registros com `ended_at is null`, `batch_id is null` e `task_id not null` para montar o conjunto `runningTaskIds`. Esse conjunto se atualiza em tempo real por um canal de `time_entries` dentro de um `useEffect`, com limpeza ao sair.
- Coluna virtual `doing` em `statusColumns` do Kanban, com meta em `COLUMN_META`. Uma tarefa entra nela quando `runningTaskIds.has(id) && status !== 'done'`, e esses ids saem das colunas `todo` e `in_progress`.
- Os Selects de status continuam usando só os 3 status reais.
