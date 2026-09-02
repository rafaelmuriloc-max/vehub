# Mover filtros da lista de NFS-e para abaixo do card de consulta

## Objetivo
Reposicionar os filtros da lista de notas fiscais de serviço (período, cliente e exportar XMLs) para ficarem imediatamente abaixo do card "Consultar Notas no Portal Nacional", mantendo o restante do layout intacto.

## Mudanças (src/components/invoices/NfseTab.tsx)

1. **Extrair filtros do card "Notas Fiscais"**
   - Remover do cabeçalho do card "Notas Fiscais" (linhas ~711-792) os controles de:
     - Período (`datePeriod` + inputs custom de data)
     - Cliente (`filterClient`)
     - Botão "Exportar XMLs"
   - Manter no card apenas as abas Prestados/Tomados e a tabela.

2. **Nova posição dos filtros**
   - Inserir uma nova linha/barra de filtros logo após o card "Consultar Notas no Portal Nacional" e antes dos painéis de resumo "Serviços Prestados" / "Serviços Tomados".
   - Layout: flex-wrap com alinhamento à direita em desktop, empilhado em mobile, respeitando os padrões responsivos já existentes.

3. **Preservar comportamentos**
   - Estados `datePeriod`, `filterClient`, `filterDateFrom`, `filterDateTo`, `exporting` e `filteredInvoices` continuam iguais.
   - O reset de paginação ao trocar filtros permanece.
   - A exportação em lote continua exportando as notas dos filtros + aba ativa.
   - Os resumos de Prestados/Tomados continuam refletindo os filtros ativos (já usam `baseFiltered`).

## Detalhes técnicos
- Nenhuma mudança em estado, hooks, edge functions ou banco.
- Apenas reorganização de JSX no componente `NfseTab.tsx`.
- Ajuste de espaçamento (`space-y-6`) entre o card de consulta, a nova barra de filtros, os resumos e a tabela.
