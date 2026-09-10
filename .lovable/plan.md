# Plano: remover gráficos de desempenho do Financeiro e do Atendimento

## Objetivo
Na tela **Calendário**, ocultar os medidores/gauges dos departamentos **Financeiro** e **Atendimento** ("sucesso") do painel "Desempenho geral dos departamentos", mantendo Fiscal, Contábil e Pessoal.

## Alterações previstas

### 1. `src/pages/CalendarView.tsx`
- No `useMemo` de `departmentPerformance`, ajustar o `departmentOrder` para excluir `'financeiro'` e `'sucesso'`:
  - De: `['fiscal', 'contabil', 'pessoal', 'financeiro', 'sucesso']`
  - Para: `['fiscal', 'contabil', 'pessoal']`
- Manter a lógica de cálculo, filtro, ordenação e renderização dos gauges (`DepartmentGauge`) inalterada.
- O painel "Desempenho geral da operação" (gauge geral) permanece como está.

## Não será alterado
- Cálculo de `dashboardStats` (KPIs de A fazer, Atrasadas, Concluídas, Fora do prazo).
- Dados dos departamentos no banco.
- Filtros de departamento no calendário/lista.
- Gauge geral de desempenho da operação.

## Validação
- Typecheck (`npx tsc --noEmit` ou equivalente do projeto).
- Build de produção.
- Visual: apenas 3 gauges devem aparecer (Fiscal, Contábil, Pessoal).
