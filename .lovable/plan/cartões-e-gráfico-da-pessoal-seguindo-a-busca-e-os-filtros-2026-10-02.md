# Cartões e gráfico da Pessoal seguindo a busca e os filtros

## O que muda
- Ao buscar uma empresa (nome, CNPJ, código SCI ou funcionário), os 4 cartões e o gráfico mostram só os números das empresas que aparecem na lista.
- Sem busca, tudo continua mostrando o total do escritório, como hoje.
- Filtro "Situação":
  - **Todos / Ativos:** os cartões contam os funcionários ativos, como hoje.
  - **Desligados:** o cartão de funcionários passa a mostrar quantos desligados existem nas empresas filtradas. Os prazos de experiência e de férias continuam valendo só para quem está ativo, porque desligados não têm esses prazos.
- O gráfico (relatórios da Folha) e a variação em relação ao mês anterior passam a considerar só as empresas filtradas. Os mini gráficos dos cartões seguem a mesma regra.
- Uma pequena nota "Filtrado: X empresas" aparece no gráfico quando houver busca ativa.

## Detalhes técnicos
- Em `src/pages/Personnel.tsx`, criar `filteredClientIds` a partir de `filteredClients` e recalcular `activeEmployees`, `totalSalaries`, `clientsWithActive`, `trialSoon`, `trialOverdue` e `vacationAlerts` para o PersonnelOverview com base nesse conjunto. Os diálogos de avisos continuam usando os dados completos.
- Passar `clientIds={[...filteredClientIds]}` para o PersonnelOverview, que já repassa a lista para `usePayrollMonthly` (a consulta é refeita quando a lista muda).
- Com `statusFilter === 'terminated'`, o primeiro cartão troca título e valor para "Funcionários desligados".
