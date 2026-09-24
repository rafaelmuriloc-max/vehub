# Paginação de 15 empresas por página no Simples Nacional

## O que muda
Na tela Fiscal > Simples Nacional, a lista de empresas passa a mostrar 15 empresas por página, com botões para navegar.

## Comportamento
- 15 empresas por página (fixo).
- Abaixo da lista: botões "Anterior" e "Próxima" e o indicador "Página X de Y (N empresas)".
- Os botões ficam desativados na primeira e na última página. A navegação some se houver só uma página.
- A busca por nome/CNPJ vale para todas as empresas e volta para a página 1 quando muda. Trocar o ano também volta para a página 1.
- Abrir uma empresa, o botão Sincronizar, Atualizar situação e Extrato continuam funcionando como hoje (a sincronização continua valendo para todas as empresas, não só as da página).

## Técnico
- Arquivo alterado: `src/components/simples-nacional/SimplesNacionalTab.tsx`.
- Novo estado `page`; `PAGE_SIZE = 15`; `paginated = filtered.slice((page-1)*15, page*15)`.
- A lista usa `paginated` no lugar de `filtered`; `useEffect` volta `page` para 1 quando `search` ou `year` mudar.
- Barra de navegação com `Button` e ícones ChevronLeft/ChevronRight.
- Nada muda no banco nem nas funções do servidor.
