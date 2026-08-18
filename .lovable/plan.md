# Corrigir clientes "Regular" sem PDF na Situação Fiscal

## Diagnóstico (confirmado no banco)

Consulta em `sitfis_results`:

```text
irregular : 121 registros — 121 com PDF
irregular : ...
regular   :  40 registros —   0 com PDF
error     :  24 registros —   0 com PDF
```

Ou seja: nenhum cliente marcado como "Regular" tem PDF. Olhando o `raw_response` desses registros, a resposta do SERPRO na etapa "Emitir" não trouxe relatório algum:

- `status 202` + `{"tempoEspera":4000}` + mensagem "A emissão relatório de situação fiscal está em processamento." (relatório ainda não pronto), ou
- erro de runtime do gateway ("Address endpoint ... SUSPENDED").

A lógica atual classifica como "Regular" sempre que não encontra palavras negativas no texto. Sem PDF não há texto, então esses casos caem em "Regular" por engano. Eles não são clientes regulares — são consultas que não concluíram.

## O que fazer

1. Nunca classificar como "Regular" sem PDF
   - Se a etapa Emitir não retornar PDF, gravar o resultado como pendente/erro (com a mensagem retornada pelo SERPRO), nunca como regular.

2. Respeitar o `tempoEspera` do SERPRO na emissão
   - Quando a resposta vier com status 202 e `tempoEspera`, aguardar o tempo indicado e repetir a chamada Emitir (até ~5 tentativas, respeitando o tempo de cada resposta), como já é feito na etapa do protocolo.
   - Só então extrair PDF, texto e classificar situação/pendências.

3. Tratar erro de gateway suspenso
   - Respostas com `code: 303001` / "Runtime Error" viram status `error` com a descrição, entrando na contagem de erros do painel e no filtro de reconsulta.

4. Reconsultar os 40 registros classificados incorretamente
   - Marcar esses registros como pendentes para que voltem à fila e sejam consultados novamente pelo botão de consulta em lote (nenhum dado de cliente é alterado).

5. Painel e download
   - Os cards/donuts passam a refletir a realidade (Regular só com relatório emitido).
   - Botões de visualizar/baixar PDF e o ZIP em lote continuam iguais; deixam de existir linhas "Regular" sem PDF.

## Detalhes técnicos

- Arquivo principal: `src/components/integra-contador/SituacaoFiscalTab.tsx` (função de consulta por cliente, etapa `RELATORIOSITFIS92`).
- Adicionar loop de polling na etapa Emitir usando `tempoEspera` da resposta; abortar após o limite de tentativas com status `error` e mensagem "Relatório não ficou pronto a tempo".
- Guarda explícita: `if (!pdfBase64) -> status 'error'` (nunca `regular`).
- Ajuste de dados: `UPDATE sitfis_results SET status='error', error_message='Consulta incompleta - reconsultar' WHERE status='regular' AND pdf_base64 IS NULL;`
