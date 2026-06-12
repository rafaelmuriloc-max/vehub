## Objetivo
Eliminar o card superior que exibe "Total" (quantidade de clientes) na página `/clients`.

## Localização
- `src/pages/Clients.tsx`, linha ~1099 — card `<Card><CardHeader...>Total</CardTitle>...{payingClients.length}</p>...</Card>`
- O card está dentro de um container `grid gap-4 md:grid-cols-4` (linha ~1098).

## Mudanças
1. **Remover o card "Total"** (linha 1099 inteira).
2. **Ajustar o grid** de `md:grid-cols-4` para `md:grid-cols-3` para manter o alinhamento proporcional dos 3 cards restantes (Ativos, MRR, Churn Rate).

## Fora de escopo
- Os demais cards (Ativos, MRR, Churn Rate) permanecem inalterados.
- Todos os cálculos de `payingClients` continuam existindo caso sejam usados em outras partes da página.