# Painel Custos SERPRO zerado

## O que está acontecendo
- O registro está funcionando. Desde a implantação (14h03) foram gravadas 9 chamadas.
- Todas foram da Situação Fiscal, e a Receita respondeu "protocolo já existe" (código 304). O sistema tratou essas respostas como **não cobradas** e como **erro**, por isso a fatura aparece R$ 0,00.
- As consultas anteriores a hoje não foram registradas, então o ciclo atual começa praticamente vazio.

## O que muda
1. **Resposta 304 deixa de contar como erro.** Ela passa para o novo cartão **Não cobradas / reaproveitadas**, e "Com erro" fica só para recusas reais (4xx e 5xx).
2. **Novo cartão "Chamadas registradas"** com o total do ciclo, incluindo as não cobradas, para mostrar que o painel está recebendo dados.
3. **Estimativa do ciclo antes da implantação.** Usando as consultas já guardadas no sistema desde o dia 21/09 (Situação Fiscal, Simples Nacional, DCTFWeb, MEI e Parcelamentos), o painel mostra uma linha **"Estimado (antes do registro)"**, separada do valor medido. Assim a fatura do ciclo fica mais próxima da real.
4. **Aviso no topo** do ciclo atual: "Registro iniciado em 02/10/2026 às 14h03".

## Detalhes técnicos
- Em `integra-contador/index.ts`, `sucesso` passa a ser `status < 400`. Em `UsageCostTab`, os erros contam só `status_http >= 400`.
- A estimativa conta as linhas com data de atualização dentro do ciclo, anteriores ao primeiro registro em `integra_contador_usage`, em `sitfis_results`, `simples_nacional_competencias`, `dctfweb_competencias`, `mei_competencias` e `parcelamento_results`. Cada linha vale uma Consulta (os PDFs gerados no Simples contam como Emissão). Esse valor é exibido à parte e não entra no medido.
- Sem mudança no banco.
