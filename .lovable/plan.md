Plano para corrigir o erro `[EntradaIncorreta-PGDASD-MSG_ISN_045]` no PGDAS-D:

1. Em `src/components/integra-contador/PgdasdDeclaracaoForm.tsx`, ajustar o payload da declaração `semMovimento` para não enviar a chave `folhasSalario`.
   - O SERPRO rejeita `folhasSalario` quando não há atividade com requisito de folha.
   - O payload sem movimento ficará com receitas zeradas, `estabelecimentos` contendo apenas o CNPJ e sem `atividades` nem `folhasSalario`.

2. Manter `folhasSalario` apenas no fluxo com movimento, onde existem atividades informadas.

3. Não alterar autenticação SERPRO, procurador, edge function ou outros serviços do Integra Contador.

Validação esperada: o JSON gerado para `semMovimento` não terá `folhasSalario`, evitando a rejeição `MSG_ISN_045`.