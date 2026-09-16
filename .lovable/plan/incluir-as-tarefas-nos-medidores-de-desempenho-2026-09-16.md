# Incluir as tarefas nos medidores de desempenho

## Objetivo
Os medidores "Desempenho geral da operação" e os de cada setor (Fiscal, Contábil, Pessoal) hoje consideram apenas as obrigações. Passarão a considerar também as tarefas, tanto no calendário quanto no painel inicial.

## Como passa a ser contado
- Entram as tarefas com prazo dentro do mês exibido (tarefas sem prazo continuam fora do cálculo).
- Uma tarefa conta como concluída quando está na coluna "Concluído".
- O percentual geral passa a ser: (obrigações concluídas + tarefas concluídas) ÷ (total de obrigações + total de tarefas do mês).
- Cada medidor de setor soma as obrigações e as tarefas daquele departamento.
- A comparação com o mês anterior segue a mesma regra, agora também com tarefas.
- Os filtros do calendário (empresa, departamento, regime) também se aplicam às tarefas consideradas.
- Empresas com serviços suspensos continuam fora da conta.

## Fora do escopo
Os quatro cartões (A fazer, Atrasadas, Concluídas, Fora do prazo) continuam exatamente como estão, só com obrigações.

## Técnico
- `src/pages/CalendarView.tsx`: incluir `tasks` (já carregadas por `due_date` do mês) em `dashboardStats.performance` e em `departmentPerformance`; para o mês anterior, carregar também as tarefas do mês anterior (hoje só as do mês exibido são buscadas).
- `src/components/performance/OperationPerformance.tsx`: adicionar consulta paginada (`fetchAllPaged`) de `tasks` (id, status, due_date, client_id, department_id) no intervalo mês anterior + mês atual e somar aos totais dos medidores geral e por departamento.
- Concluída = `status = 'done'`; departamento = `tasks.department_id`; suspensão via `clients.services_suspended`.
- Validar com typecheck e build.
