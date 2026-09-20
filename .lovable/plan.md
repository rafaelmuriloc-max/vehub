# Pessoal: mover seletor de itens por página para a barra de paginação

## Problema
O seletor "10/20/30/Todas" está no cabeçalho da lista (card de filtros, junto à busca e ao filtro de situação). O usuário quer que a quantidade de empresas por página fique na barra de paginação, embaixo da lista.

## Mudança — `src/pages/Personnel.tsx` (único arquivo)

1. **Remover** o `Select` de pageSize do card de filtros (linhas 350–361). O card fica apenas com busca, filtro de situação e botão de recarregar.
2. **Barra de paginação** (rodapé do card da lista):
   - Exibir sempre que houver empresas (não só quando `totalPages > 1`), para o seletor ficar acessível mesmo com "Todas".
   - Layout: à esquerda o texto "{n} empresa(s) — página X de Y"; ao lado, o seletor de itens por página (10 / 20 / 30 / Todas, rótulos compactos); à direita os botões anterior/próxima, visíveis apenas quando `totalPages > 1`.
   - Manter o comportamento atual: trocar o tamanho reseta para a página 1.

## Validação
- `bunx tsgo --noEmit` e build limpos.
- Nenhuma mudança de dados, permissões ou outras telas.
