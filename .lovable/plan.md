# Plan: Badges de status fiscal sem fundo, apenas símbolo colorido

## Objetivo
Na tela `/fiscal` (Situação Fiscal), os badges "Regular" e "Com pendência" devem exibir apenas o símbolo, sem fundo colorido. O ícone deve manter a cor correspondente (verde para regular, vermelho para com pendência).

## Alterações
1. Em `src/components/integra-contador/SituacaoFiscalTab.tsx`, ajustar a função `statusBadge`:
   - `status === 'regular'`: remover classes de fundo (`bg-emerald-600`, `hover:bg-emerald-600`) e texto branco (`text-white`), mantendo apenas `text-emerald-600` no ícone `<SquareCheck />`.
   - `status === 'irregular'`: remover classes de fundo (`bg-red-600`, `hover:bg-red-600`) e texto branco (`text-white`), mantendo apenas `text-red-600` no ícone `<SquareX />`.
   - Preservar `title` para acessibilidade.
   - Manter inalterados os demais badges (Pendente, Erro, Sem procuração).
2. Não alterar filtros, contadores, tabela, paginação ou outras funcionalidades.

## Validação
- Typecheck sem erros.
- Build sem erros.
- Visualmente os badges de status na lista devem mostrar apenas o símbolo colorido, sem fundo.
