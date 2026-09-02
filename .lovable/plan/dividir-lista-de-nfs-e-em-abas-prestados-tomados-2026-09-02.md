# Dividir lista de NFS-e em abas Prestados / Tomados

## Objetivo
Na página de Notas Fiscais (aba NFS-e), a lista de notas será dividida em duas abas: **Prestados** e **Tomados**, substituindo o filtro "Tipo" atual.

## Mudanças (src/components/invoices/NfseTab.tsx)

1. **Abas na lista de notas**
   - No card "Notas Fiscais", adicionar abas sublinhadas (estilo relatório, mesmo padrão das abas NFS-e/NF-e/NFC-e da página): **Prestados** (com contador) e **Tomados** (com contador).
   - Estado `listTab: 'prestados' | 'tomados'` (padrão: `prestados`).
   - A tabela passa a listar apenas as notas do tipo da aba ativa (reutiliza `prestadosInvoices` / `tomadosInvoices` já calculados, aplicando os demais filtros de período/cliente).

2. **Remover o filtro "Tipo"**
   - Eliminar o Select `filterType` (Todos os tipos / Prestados / Tomados) do cabeçalho do card — a aba cumpre esse papel.

3. **Coluna "Tipo"**
   - Remover a coluna "Tipo" (badge Prestado/Tomado) da tabela, pois a aba ativa já indica o tipo.

4. **Resumos (Serviços Prestados / Serviços Tomados)**
   - Manter os dois painéis de resumo no topo como estão (azul/laranja, cards de impostos e retenções), sem alteração.

5. **Demais comportamentos preservados**
   - Filtros de período (todos/mês/ano/personalizado), filtro de cliente, exportação de XMLs em lote (exporta as notas da aba ativa), paginação (20 por página, reseta ao trocar de aba), ações por nota (XML/PDF) e o dialog de detalhe de retenções.

## Detalhes técnicos
- `filteredInvoices` passa a ser derivado da aba ativa: `baseFiltered.filter(getInvoiceType === tipo da aba)` + filtros de data/cliente existentes.
- Contadores das abas: `prestadosInvoices.length` e `tomadosInvoices.length`.
- Paginação: resetar `page` ao trocar de aba.
- Nenhuma mudança no banco, edge functions ou nas abas NF-e/NFC-e.
