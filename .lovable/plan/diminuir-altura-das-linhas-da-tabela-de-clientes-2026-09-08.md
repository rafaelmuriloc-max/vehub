# Diminuir altura das linhas da tabela de clientes

## Objetivo
Reduzir o espaçamento vertical das linhas de dados na tabela "Situação Fiscal dos Clientes".

## Escopo
- `src/components/integra-contador/SituacaoFiscalTab.tsx`

## O que será feito
Aplicar padding menor (`py-2` ou `p-2`) nas `TableCell` das linhas de clientes no corpo da tabela, mantendo o cabeçalho inalterado.

## O que NÃO será alterado
- Componente base `src/components/ui/table.tsx`.
- Altura do cabeçalho.
- Outras tabelas do sistema.
- Funcionalidade, filtros, paginação, ações e badges.

## Validação
- TypeScript check.
- Build.
- Verificação visual de que as linhas ficaram mais compactas.
