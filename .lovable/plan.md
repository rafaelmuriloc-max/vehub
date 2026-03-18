

# Dashboard: Gráficos de Evolução de Clientes e Receita

## O que será adicionado

Dois novos gráficos de linha (LineChart) abaixo dos gráficos atuais, mostrando evolução ao longo do tempo:

1. **Evolução de Clientes** -- linha mostrando quantidade acumulada de clientes ativos mês a mês (últimos 12 meses), usando `created_at` e `start_date` dos clientes
2. **Evolução de Receita (MRR)** -- linha mostrando a receita recorrente mensal acumulada ao longo dos últimos 12 meses, calculada a partir do `monthly_value` dos clientes ativos em cada mês

## Como funciona

- Buscar clientes com `created_at`, `start_date`, `end_date`, `status`, `monthly_value`
- Para cada um dos últimos 12 meses, calcular:
  - Quantos clientes estavam ativos naquele mês (start_date <= mês e sem end_date ou end_date > mês)
  - Soma do `monthly_value` desses clientes ativos
- Renderizar dois `LineChart` do recharts em um grid de 2 colunas

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/Dashboard.tsx` | Adicionar estados `clientEvolution` e `revenueEvolution`, calcular dados dos últimos 12 meses no `loadMetrics`, e renderizar dois novos LineCharts abaixo dos gráficos existentes |

