# Parcelamentos RFB: mostrar parcelas já pagas

## O que muda na tela
- Ao abrir um parcelamento (detalhes), além das parcelas em aberto para gerar guia, aparece uma seção **"Parcelas pagas"** com: nº da parcela / mês, data do pagamento, valor pago e número do DAS (quando a Receita informar).
- Ordenadas da mais recente para a mais antiga, com total pago no rodapé.
- Na linha do parcelamento dentro da empresa, a contagem "pagas / total" passa a vir dessa mesma lista (fica coerente).
- Se a Receita não devolver pagamentos, mostra "Nenhum pagamento registrado".
- Parcelamentos encerrados também mostram o histórico de pagamentos.

## Detalhes técnicos
- Arquivo: `src/components/integra-contador/RfbParcelamentos.tsx`.
- Hoje `parseDetalhe` lê `demonstrativoDePagamentos` (resposta do `OBTERPARC*`) só para contar. Passa a extrair a lista: `mesDaParcela`/`parcela`, `dataDoPagamento`/`dataArrecadacao`, `valorPago`/`valor`, `numeroDas`, com tolerância a nomes alternativos.
- Ao abrir o diálogo de detalhes, chamar `OBTERPARC*` (mapa `PARCELAS_SERVICES.obterService`) em paralelo à busca de parcelas para gerar; guardar em estado `pagamentos` com loading/erro próprios.
- Também reaproveitar o retorno já obtido em "Atualizar" quando disponível, evitando chamada extra.
- Sem mudanças no banco nem nas funções do servidor.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json`.
