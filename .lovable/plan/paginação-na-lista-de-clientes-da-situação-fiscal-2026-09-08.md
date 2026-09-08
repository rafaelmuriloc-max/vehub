# Paginação na lista de clientes da Situação Fiscal

## O que muda
Na tela Fiscal > Situação Fiscal, a lista de clientes passa a ser paginada, com tamanho de página configurável (20, 50, 100 ou todos).

## Comportamento
- Padrão: 20 clientes por página.
- Seletor de itens por página: 20, 50, 100, Todos.
- Controles: página anterior, próxima página, indicador "Página X de Y".
- Filtros (busca, situação, regime) continuam aplicados antes da paginação.
- "Selecionar todos" continua selecionando todos os clientes filtrados (mantém compatibilidade com consulta/lote).
- Contadores de total/regular/irregular continuam refletindo todos os filtrados.

## Técnico
- Arquivo alterado: `src/components/integra-contador/SituacaoFiscalTab.tsx`.
- Estados novos: `page` (número), `pageSize` (20 | 50 | 100 | 'all').
- Derivar `paginatedClients` a partir de `filtered` usando slice ou exibindo tudo quando `pageSize === 'all'`.
- Renderizar a `<Table>` com `paginatedClients` em vez de `filtered`.
- Adicionar barra de controles de paginação logo abaixo da tabela, usando componentes do projeto (`Button`, `Select`).
- Sem mudanças de banco de dados, edge functions ou RLS.
