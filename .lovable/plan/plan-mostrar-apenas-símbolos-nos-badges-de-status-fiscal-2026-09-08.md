# Plan: Mostrar apenas símbolos nos badges de status fiscal

## Objetivo
Na tela `/fiscal` (Situação Fiscal), os badges "Regular" e "Com pendência" devem exibir apenas os ícones (verde ✓ e vermelho ✗), sem o texto ao lado. Os demais badges (Pendente, Erro, Sem procuração) continuam com texto.

## Alterações
1. Em `src/components/integra-contador/SituacaoFiscalTab.tsx`, ajustar a função `statusBadge`:
   - `status === 'regular'`: manter `<SquareCheck />` verde e remover o texto "Regular".
   - `status === 'irregular'`: manter `<SquareX />` vermelho e remover o texto "Com pendência".
   - Preservar estilos, cores e tamanhos atuais.
   - Adicionar `title` nos badges somente-ícone para acessibilidade ("Regular" / "Com pendência").
2. Manter inalterados os filtros, contadores, tabela, paginação e demais funcionalidades.

## Validação
- Typecheck (`npx tsc --noEmit` ou equivalente).
- Build sem erros.
- Visualmente os badges de status na lista devem mostrar apenas o símbolo colorido.
