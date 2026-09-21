# Remover a lista "Arquivos aguardando revisão" da tela Pessoal

## O que muda
Na página Pessoal (`src/pages/Personnel.tsx`), remover o card **"Arquivos aguardando revisão"** (tabela que lista arquivos com empresa ou funcionário não identificados).

## Detalhes
- Excluir o bloco do card (listagem de arquivo, motivo e data).
- Excluir o cálculo `pendingDocs`, que só serve a essa listagem.
- Manter todo o resto: sincronização, contagem de "aguardando revisão" no resumo do toast, cadastro de funcionários, paginação e cards de totais.

## Impacto
- Nenhuma alteração de banco de dados ou na sincronização — os arquivos continuam sendo rastreados para evitar reprocessamento, apenas deixam de aparecer na tela.

## Validação
- `bunx tsgo --noEmit` e build limpos.
