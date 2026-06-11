## Ajuste
Excluir clientes com `without_monthly_fee = true` de **todas** as estatísticas/gráficos restantes em `src/pages/Clients.tsx`:

- Card **Total** (linha 1099): trocar `clients.length` por `payingClients.length`.
- Gráfico **Regime Tributário** (linha 1124): usar `payingClients` no `reduce`.
- Gráfico **Classificação/Segmento** (linha 1133): usar `payingClients` no `reduce`.

Mantém-se inalterado:
- A listagem da tabela (`filtered` em 962) e o filtro de documentos duplicados (2159) continuam usando `clients` completos — esses clientes precisam aparecer na lista para gestão.

Não há outros pontos: `Dashboard.tsx` não consulta clientes diretamente, `ClientsPanel`/`Financial` já filtram via query.