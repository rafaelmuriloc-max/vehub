

# Corrigir cards de retenção ao selecionar cliente

## Problema
A variável `tomadosInvoices` (linha 378) é derivada de `filteredInvoices`, que na linha 372 já foi filtrada por `filterType`. Quando o tipo é "Prestados", todas as notas tomadas são removidas antes do cálculo de retenções, fazendo os cards sumirem.

## Solução

No arquivo `src/components/invoices/NfseTab.tsx`, separar a filtragem em duas etapas:

1. Criar `baseFilteredInvoices` filtrado apenas por cliente e data (linhas 368-371)
2. Aplicar filtro de tipo apenas para a tabela/paginação (`filteredInvoices`)
3. Calcular `tomadosInvoices` e `retentionTotals` a partir de `baseFilteredInvoices` em vez de `filteredInvoices`

### Alteração (linhas 368-378)

De:
```typescript
let filteredInvoices = invoices;
if (filterClient !== 'all') filteredInvoices = filteredInvoices.filter(...);
if (filterDateFrom) filteredInvoices = filteredInvoices.filter(...);
if (filterDateTo) filteredInvoices = filteredInvoices.filter(...);
if (filterType !== 'all') filteredInvoices = filteredInvoices.filter(...);
// ...
const tomadosInvoices = filteredInvoices.filter(i => getInvoiceType(i) === 'tomado');
```

Para:
```typescript
let baseFiltered = invoices;
if (filterClient !== 'all') baseFiltered = baseFiltered.filter(...);
if (filterDateFrom) baseFiltered = baseFiltered.filter(...);
if (filterDateTo) baseFiltered = baseFiltered.filter(...);

let filteredInvoices = baseFiltered;
if (filterType !== 'all') filteredInvoices = filteredInvoices.filter(...);
// ...
const tomadosInvoices = baseFiltered.filter(i => getInvoiceType(i) === 'tomado');
```

Isso garante que os cards de retenção sempre refletem as notas tomadas do cliente/período selecionado, independentemente do filtro de tipo.

## Arquivo
- `src/components/invoices/NfseTab.tsx` — ~5 linhas alteradas

