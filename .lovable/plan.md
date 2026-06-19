## Causa raiz

SERPRO retornou `MSG_ISN_023 — O valor da atividade deve ser maior que zero` ao transmitir PGDAS-D 05/2026 do CNPJ `66425304000109` (POUSADA MOLINHA PENHA).

O payload enviado pelo formulário tem `receitaPaCompetenciaInterno: 0` e `estabelecimentos[0].atividades[0].valorAtividade: 0`. Pelas regras do PGDAS-D, se o array `atividades` é enviado, cada `valorAtividade` deve ser > 0. Para **declaração sem movimento**, a atividade não deve ser enviada.

## Plano

Editar `src/components/integra-contador/PgdasdDeclaracaoForm.tsx`:

1. **Adicionar checkbox "Declaração sem movimento"** na seção "1. Dados Gerais", com estado `semMovimento`.

2. **Ao montar o payload (linha ~112):**
   - Se `semMovimento === true`: enviar `estabelecimentos: []` e zerar receitas/folha (deixar arrays vazios `[]` para `receitasBrutasAnteriores` e `folhasSalario`).
   - Caso contrário (com movimento): **validar antes de enviar** que `receitaPaCompetenciaInterno + receitaPaCompetenciaExterno > 0` E que toda `valorAtividade > 0`. Se algum for 0, mostrar `toast.error` explicando que valores zero exigem marcar "sem movimento".

3. **Logar resposta de erro no edge function** `supabase/functions/integra-contador/index.ts` (linhas 816, 825, 859): quando `apiResponse.status >= 400`, fazer `console.error("[integra-contador] SERPRO erro " + status + ":", apiResponse.bodyText?.substring(0, 2000))`. Isso evita ter de adivinhar erros futuros.

## Fora de escopo

- Refatorar todo o formulário PGDAS-D.
- Alterar fluxo de procurador/mTLS (funcionando OK).
- Tocar em outros serviços do Integra Contador.
