# Paginação da lista de empresas — Pessoal

## Objetivo
Adicionar paginação à lista de empresas da tela Pessoal (`/personnel`), com seletor de registros por página: **10, 20, 30 e Todas**.

## Escopo
Apenas `src/pages/Personnel.tsx` — a lista já carrega todas as empresas ativas de uma vez (`loadAll`), então a paginação é feita no cliente (front-end), sem mudanças de banco ou dados.

## Implementação

1. **Estado novo**
   - `pageSize` (padrão `10`), valores possíveis: `10`, `20`, `30`, `'all'`.
   - `page` (página atual, começando em 1).

2. **Cálculo da página**
   - A partir de `filteredClients` (que já aplica a busca), fatiar a lista: `filteredClients.slice(offset, offset + pageSize)` quando limitado; lista inteira quando `pageSize === 'all'`.
   - Total de páginas derivado de `filteredClients.length`.

3. **Seletor de quantidade**
   - Ao lado do campo de busca e do filtro de situação, um `Select` com as opções: 10, 20, 30, Todas.
   - Ao mudar o tamanho da página, voltar para a página 1 (evita ficar em página inexistente).

4. **Controles de navegação**
   - Abaixo da lista: botões anterior/próxima e indicador "Página X de Y" (com total de empresas).
   - Botões desabilitados nos extremos; esconder a navegação quando houver apenas uma página (incluindo "Todas").
   - Reset para página 1 quando a busca mudar.

5. **Comportamento preservado**
   - Expansão de empresa, contagem de funcionários, filtro de situação, busca por nome/CNPJ/código SCI e demais ações continuam iguais.
   - Se a empresa expandida sair da página atual (ex.: após busca), o estado de expansão simplesmente não é exibido — nada quebra.

## Validação
- `bunx tsgo --noEmit` sem erros.
- Build limpo (`build-errors.log` com "build OK").
- Verificação visual no preview: navegar páginas, trocar 10/20/30/Todas, buscar e conferir que a página volta a 1.
