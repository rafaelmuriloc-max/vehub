## Objetivo
Fazer com que o quadro cruzado **Regime Tributário × Segmento** (tabela e gráfico empilhado) considere apenas clientes com `status === 'active'`, assim como já foi feito para os gráficos de donut de Regime e Segmento.

## Alteração
No arquivo `src/pages/Clients.tsx`, na construção dos dados cruzados (`crossData`, `cellData`, `rawStackedData`), filtrar a lista `clients` antes do `forEach`:

```
clients.filter(c => c.status === 'active').forEach(c => { ... })
```

Isso garante que contagens, MRR e ticket médio exibidos na tabela reflitam apenas clientes ativos.

## Fora do escopo
- Os gráficos de donut já foram corrigidos em etapa anterior e não serão alterados.
- Cards de KPIs (Ativos, MRR, Churn Rate) já usam `payingClients` filtrado e não serão alterados.