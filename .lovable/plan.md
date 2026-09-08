# Opção de 10 clientes por página na Situação Fiscal

## O que muda
Adicionar a opção de exibir 10 clientes por página no seletor de paginação da tela Fiscal > Situação Fiscal.

## Comportamento
- O seletor passa a oferecer: 10, 20, 50, 100, Todos.
- Padrão permanece 20 clientes por página.
- Nenhuma outra alteração de comportamento.

## Técnico
- Arquivo alterado: `src/components/integra-contador/SituacaoFiscalTab.tsx`.
- Atualizar o tipo `pageSize` para incluir `10`.
- Adicionar `<SelectItem value="10">10 / pág.</SelectItem>` no seletor.
- Sem mudanças de banco de dados, edge functions ou RLS.
