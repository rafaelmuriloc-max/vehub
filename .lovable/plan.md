Plano para corrigir o erro `[EntradaIncorreta-PGDASD-MSG_ISN_023]` na declaração sem movimento:

1. Ajustar o payload sem movimento em `PgdasdDeclaracaoForm.tsx`:
   - Manter o bloco obrigatório `declaracao.estabelecimentos`.
   - Enviar cada estabelecimento apenas com `cnpjCompleto`.
   - Não enviar a propriedade `atividades` quando não houver atividade, conforme documentação SERPRO: “Se não houve atividade para o estabelecimento, não enviar esta lista”.

   Estrutura esperada:
   ```json
   "estabelecimentos": [
     { "cnpjCompleto": "66425304000109" }
   ]
   ```

2. Atualizar o texto do checkbox para refletir o comportamento correto:
   - De “omite estabelecimentos” para algo como “sem atividades/receitas no período”.

3. Manter a validação atual para declarações com movimento:
   - Se não for sem movimento, bloquear receita total zero.
   - Bloquear atividades com `valorAtividade <= 0`.

4. Validar o resultado revisando o JSON gerado para confirmar que, em declaração sem movimento, não existe `atividades: []` nem atividade com valor zero.