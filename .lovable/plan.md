

# Gráfico de Evolução de Clientes desde 2021

## Alteração

No `src/pages/Dashboard.tsx`, mudar o loop de evolução de clientes de "últimos 12 meses" para "todos os meses desde janeiro de 2021 até o mês atual".

## Detalhes técnicos

| Arquivo | Alteração |
|---|---|
| `src/pages/Dashboard.tsx` | Alterar o loop (linhas 68-100) para iterar desde `new Date(2021, 0, 1)` até `now`, mês a mês, em vez de `i = 11..0`. O formato do label do mês passará a incluir mês/ano completo (`MMM/YY`) para distinguir os anos. |

A lógica interna de contagem (acumulado por `opening_date`, novos no mês, MRR) permanece igual -- apenas o intervalo de iteração muda.

