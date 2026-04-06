

# Adicionar paginação nas tabelas de NF-e e NFS-e

## Problema
Atualmente as tabelas renderizam todas as notas filtradas de uma vez, sem limite. Com muitas notas, a página fica longa e lenta.

## Solução
Adicionar paginação client-side em ambos os componentes, reutilizando o mesmo padrão visual já usado na página de E-mail (botões Previous/Next + indicador de página).

## Alterações

### 1. `src/components/invoices/NfseTab.tsx`
- Adicionar state `page` (default 0) e constante `PAGE_SIZE = 20`
- Resetar `page` para 0 quando filtros mudarem (`filterClient`, `filterType`, `datePeriod`)
- Calcular `paginatedInvoices = filteredInvoices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)`
- Usar `paginatedInvoices` no `.map()` da tabela (em vez de `filteredInvoices`)
- Manter os cards de resumo usando `filteredInvoices` (totais completos)
- Adicionar bloco de paginação após a tabela: "Página X de Y" + botões Anterior/Próxima com `ChevronLeft`/`ChevronRight`

### 2. `src/components/invoices/NfeTab.tsx`
- Mesma lógica: state `page`, `PAGE_SIZE = 20`, slice, botões de paginação
- Resetar página quando filtros mudarem

### Importações adicionais
- `ChevronLeft`, `ChevronRight` do lucide-react em ambos os arquivos

## Arquivos
- `src/components/invoices/NfseTab.tsx` — ~20 linhas adicionadas
- `src/components/invoices/NfeTab.tsx` — ~20 linhas adicionadas

