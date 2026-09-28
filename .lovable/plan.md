# NFC-e: mostrar todos os cupons do período

## Problema confirmado
Na aba NFC-e, a busca dos cupons tem um limite fixo de 1.000 registros (`.limit(1000)` em `NfceTab.tsx`). Por isso a lista, o contador "Cupons (1000)" e os cards de faturamento, ticket médio e canceladas param em 1.000, mesmo quando há mais cupons no período.

## Correção
- Buscar os cupons em blocos de 1.000 até trazer todos os do período e da empresa escolhidos. É o mesmo método já usado nas abas NFS-e e NF-e.
- Primeiro contar o total, depois buscar os blocos em paralelo para ficar rápido.
- Os cards, o contador, os filtros, a paginação de 20 por página e o download do XML continuam iguais. A diferença é que passam a considerar todos os cupons.

## Detalhes técnicos
- Arquivo: `src/components/invoices/NfceTab.tsx`, `queryFn` de `['nfce-invoices', ...]`.
- `select(..., { count: 'exact', head: true })` com os mesmos filtros (cliente, `issue_date` gte/lte) para obter o total. Depois, `Promise.all` com `.range(i*1000, i*1000+999)` ordenado por `issue_date desc, id`, e concatenar os resultados.
- Sem mudanças no banco, nas regras de acesso ou nas funções.
