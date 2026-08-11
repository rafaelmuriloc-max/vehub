# Ranking de tarefas

Nova aba **Ranking** na página de Tarefas, com o volume de tarefas agrupado por Empresa, Tarefa (modelo) e Departamento.

## O que será construído

- Nova aba "Ranking" ao lado de Kanban / Lista / Cadastro.
- Três visões selecionáveis (Empresa | Tarefa | Departamento). Cada linha do ranking mostra:
  - posição, nome do agrupador (empresa no formato `211 - EMPRESA X`)
  - total de tarefas, e a quebra em A fazer / Em andamento / Concluídas / Atrasadas
  - barra de proporção relativa ao 1º colocado
- Ordenação por total (padrão) ou por atrasadas / concluídas.
- Filtro de período: mês atual, últimos 3 meses, ano, ou tudo — aplicado sobre a data de vencimento.
- Os filtros já existentes da página (cliente, departamento, responsável, status, prioridade, busca) continuam valendo também no ranking.
- Estado vazio quando não houver tarefas no período.

## Detalhes técnicos

- Arquivo novo `src/components/tasks/TasksRankingTab.tsx`, consumindo a mesma lista de tarefas já carregada em `src/pages/Tasks.tsx` (sem query extra).
- Agregação em memória com `useMemo`; empresa via `formatClientLabel` (inclui SCI), tarefa via `template_id`/título, departamento via `department_id`.
- Atrasada = `due_date` anterior a hoje e status diferente de `done`.
- Tarefas sem cliente/modelo/departamento agrupadas como "Sem empresa" / "Sem modelo" / "Sem departamento".
- Sem mudanças no banco de dados.
