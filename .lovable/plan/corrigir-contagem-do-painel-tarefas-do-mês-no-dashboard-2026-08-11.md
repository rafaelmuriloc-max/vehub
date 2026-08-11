# Corrigir contagem do painel "Tarefas do mês" no dashboard

## Problema confirmado
O painel "Tarefas do mês" não consulta a tabela de tarefas: todas as métricas (Pendentes, Em andamento, Concluídas, Atrasadas, Hoje) são calculadas sobre as **obrigações** (mesma fonte do painel Obrigações). Por isso os números não batem com a página de Tarefas.

Dados reais de agosto/2026 na tabela de tarefas: 4 a fazer e 54 concluídas — valores diferentes dos exibidos hoje.

Outros pontos encontrados:
- "Atrasadas" hoje não tem filtro de mês (conta tudo o que já venceu, de qualquer período).
- "Hoje" conta conclusões de atividades de obrigações, não tarefas concluídas hoje.
- O ranking do dia também vem de obrigações.

## O que será feito
Reescrever as consultas do painel para usar a tabela de tarefas:

- **Pendentes**: tarefas do mês com status "a fazer".
- **Em andamento**: status "em andamento" + "em revisão".
- **Concluídas**: status "concluída" no mês.
- **Atrasadas**: tarefas com vencimento anterior a hoje e ainda não concluídas (mantendo o recorte do mês corrente para coerência com o título do painel).
- **Hoje**: tarefas concluídas hoje.
- **Ranking de hoje**: usuários com mais tarefas concluídas hoje (via responsáveis da tarefa), mantendo nome e cor do perfil.

O recorte "do mês" passa a ser pela data de vencimento da tarefa. Tarefas sem data de vencimento ficam fora das métricas mensais, mas continuam contando em Pendentes (serão incluídas explicitamente para não sumirem do total).

## Técnico
- Arquivo único: `src/components/dashboard/TasksPanel.tsx`.
- Trocar `obligation_instances` / `obligation_activity_completions` por `tasks` (+ `task_assignments` e `profiles` para o ranking).
- Mapear `task_status`: `todo`, `in_progress`, `in_review`, `done`.
- Ranking baseado em `task_assignments` das tarefas concluídas hoje (`updated_at` no dia com status `done`).
- Nenhuma mudança em `ObligationsPanel.tsx` ou no layout.
