## Objetivo
Fazer com que os gráficos de donut **Regime Tributário** e **Segmento** na página de Clientes considerem apenas clientes com `status === 'active'`.

## Problema atual
Ambos os gráficos são gerados a partir de `payingClients`, que inclui tanto clientes ativos quanto churned. Isso distorce a visualização ao contabilizar clientes que já saíram.

## Alteração
Em `src/pages/Clients.tsx`, substituir a fonte de dados dos gráficos:
- `Regime Tributário` (taxData)
- `Segmento` (segmentData)

De:
```
payingClients.reduce(...)
```

Para:
```
payingClients.filter(c => c.status === 'active').reduce(...)
```

Isso filtra apenas os clientes ativos antes de contar e agrupar por regime tributário e segmento.

## Fora do escopo
- O gráfico de barras empilhadas e a tabela **Regime Tributário × Segmento** (`stackedData`/`crossData`) já usam a lógica `cellData` com condição `c.status === 'active'` para MRR/ticket, mas mantêm contagens totais. Não serão alterados nesta tarefa a menos que solicitado.
