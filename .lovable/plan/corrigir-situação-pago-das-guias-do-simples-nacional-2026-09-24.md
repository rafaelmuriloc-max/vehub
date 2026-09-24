# Corrigir situação "Pago" das guias do Simples Nacional

## O que foi encontrado
- A tela mostra "Em aberto" sempre que a competência não está marcada como "pago" no banco — e hoje existem só 2 competências gravadas, ambas "aberto".
- A rotina de sincronização tenta descobrir o pagamento lendo o **extrato do PGDAS-D** (CONSEXTRATO16). Esse extrato é da declaração e não traz data de pagamento, então nunca marca "pago".
- Os botões da linha (Gerar guia, Extrato) gravam a competência sem nunca atualizar a situação.

## O que será feito
1. **Consultar o pagamento no lugar certo**: usar o serviço de pagamentos da Receita no Integra Contador (PAGTOWEB / PAGAMENTOS71), que lista os DAS arrecadados da empresa por período de apuração.
   - Uma chamada por empresa cobrindo o ano inteiro; para cada mês, se houver DAS arrecadado daquele período → "Pago", com data e valor pago.
   - Mês com declaração sem movimento continua "Sem movimento"; resto fica "Em aberto".
2. **Botão "Atualizar situação"** no topo da empresa (e na sincronização geral), que roda essa consulta e grava o resultado para todos os meses do ano.
3. **Linha do mês**: mostrar a data do pagamento ao lado do selo "Pago".
4. Se a Receita recusar (procuração sem o serviço de pagamentos), mostrar aviso claro com o nome da empresa, sem mudar a situação.

## Detalhes técnicos
- `supabase/functions/simples-nacional-sync/index.ts`: trocar a verificação via CONSEXTRATO16 por PAGTOWEB/PAGAMENTOS71 (`intervaloDataArrecadacao` do ano + filtro por código de receita do DAS/período de apuração); gravar `status`, `data_pagamento`, valor pago; deploy.
- `SimplesNacionalTab.tsx`: botão por empresa chamando a sync com `client_id` e `ano`; recarregar a lista.
- `CompetenciaRow.tsx`: exibir `data_pagamento`; upserts dos botões não sobrescrevem `status`.
- O formato exato da resposta de PAGAMENTOS71 será conferido no primeiro retorno real (log da função) antes de dar como concluído.
