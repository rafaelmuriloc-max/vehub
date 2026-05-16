# Mover Dashboard para dentro de Financeiro

## Objetivo
Consolidar todas as informações do Dashboard (KPIs, gráficos de fluxo de caixa, distribuição de clientes e evolução de clientes/MRR) dentro da página Financeiro, removendo a rota `/` separada do Dashboard.

## Mudanças

### 1. `src/pages/Financial.tsx`
- Adicionar saudação ("Bom dia/tarde/noite, Nome") no topo, igual ao Dashboard.
- Substituir os 4 KPIs atuais pelos 8 cards do Dashboard (Receita do Mês, Despesas, Saldo, Clientes Ativos, MRR, Churn Rate, Tarefas Pendentes, Tarefas Atrasadas) — manter o estilo atual com borda lateral.
- Reorganizar as abas:
  - **Lançamentos** (mantida)
  - **Fluxo de Caixa** (já existe — manter)
  - **Visão Geral** (nova): gráficos do Dashboard — Distribuição de Clientes (pizza), Evolução de Clientes e Evolução do MRR.
- Carregar dados extras já necessários: `clients` (status, monthly_value, datas) e `tasks` (status, due_date) junto com o `loadData` atual.

### 2. `src/App.tsx`
- Rota `/` passa a renderizar `Financial` em vez de `Dashboard`.
- Remover import e rota separada de `Dashboard`.
- Remover rota `/financial` (ou manter como alias para `/`).

### 3. `src/components/AppLayout.tsx`
- Atualizar `pageTitles`: `/` → "Financeiro"; remover entrada `/financial`.
- Ajustar o redirect de não-admin: hoje redireciona `/` e `/financial` para `/calendar` — manter esse comportamento (não-admin não vê Financeiro).

### 4. `src/components/AppSidebar.tsx`
- Remover item "Dashboard" do menu; manter apenas "Financeiro" apontando para `/`.

### 5. `src/pages/Dashboard.tsx`
- Apagar o arquivo.

## Observação
A funcionalidade do Financeiro (CRUD de lançamentos, filtros, diálogo) é preservada integralmente. Nada de backend muda.
