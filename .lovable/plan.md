# Busca de empresa e filtro no topo da página Pessoal

## O que muda
- O campo "Buscar empresa por nome, CNPJ, código SCI ou funcionário..." e o filtro "Situação" (Todos/Ativos/Desligados) saem da barra abaixo dos cartões.
- Eles passam para o topo da página, na mesma linha e à esquerda do campo "Buscar no sistema...", antes do sino e da foto do usuário.
- A barra abaixo dos cartões continua com os botões (Recarregar, Funcionários, Avisos, Férias, Folha, DCTFWeb, FGTS, Sincronizar).
- No celular, os campos ficam empilhados abaixo do título para não apertar.

## Detalhes técnicos
- Arquivo: `src/pages/Personnel.tsx`. Mover o `Input` de `search` (mantendo `setPage(1)`) e o `Select` de `statusFilter` para o bloco de ações do `header` (linha ~722), com largura ~w-72 e w-36, altura h-9 para alinhar ao campo do sistema.
- Header passa a usar `flex-wrap` para caber em telas médias.
