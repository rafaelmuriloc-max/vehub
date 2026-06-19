O novo erro `[EntradaIncorreta-PGDASD-MSG_ISN_048]` mostra que o SERPRO está recusando meses enviados em `receitasBrutasAnteriores` para a declaração sem movimento. Primeiro recusou 03/2026; após remover PA-1, recusou 02/2026. Isso indica que, para este caso, o PGDAS-D não quer receber a lista de receitas anteriores gerada automaticamente.

## Mudança

Em `src/components/integra-contador/PgdasdDeclaracaoForm.tsx`:

1. No payload `semMovimento`, remover também a chave `receitasBrutasAnteriores`.
   - Já removemos `atividades` e `folhasSalario`; agora a declaração sem movimento ficará só com os campos essenciais do período atual e `estabelecimentos` com CNPJ.

2. Manter `receitasBrutasAnteriores` apenas no fluxo com movimento, onde o usuário informa atividades/receitas e a lista pode ser necessária.

3. Como segurança, no fluxo com movimento, sanitizar valores negativos em `receitasAnteriores` e `folhasSalario` para no mínimo `0`, evitando o erro `MSG_ISN_010` quando houver digitação negativa.

Sem alterações em edge function, autenticação ou serviços de regime.