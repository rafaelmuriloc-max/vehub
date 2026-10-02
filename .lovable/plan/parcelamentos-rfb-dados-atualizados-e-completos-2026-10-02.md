# Parcelamentos RFB: dados atualizados e completos

## O que foi encontrado
- A maioria das empresas foi consultada pela última vez em **agosto de 2026** (193 empresas). Só 3 foram consultadas em outubro. Não existe nenhuma atualização automática, e para consultar em lote é preciso marcar cada empresa.
- A consulta usada hoje na Receita ("pedidos de parcelamento") devolve **só número, situação e datas**. Por isso valor total e parcelas pagas aparecem vazios em todos os parcelamentos.
- Situações como "Sem efeito por solicitação do contribuinte" e "Não validado – primeira parcela não paga" não são tratadas como encerradas. Elas aparecem como ativas e com o botão Gerar ligado.

## O que muda
1. **Detalhes completos de cada parcelamento ativo:** depois de buscar os pedidos, o sistema consulta também o detalhe de cada parcelamento "Em parcelamento" na Receita. Com isso preenche valor consolidado, quantidade de parcelas, parcelas pagas, valor da parcela e saldo devedor.
2. **Botão "Atualizar todas"** no topo: consulta de novo todas as empresas que já tiveram parcelamento, uma por vez, com progresso, opção de cancelar e pausa entre as consultas. O botão atual "Consultar selecionados" continua.
3. **Aviso de desatualizado:** cada empresa mostra "Consultado em DD/MM". Se a consulta tiver mais de 7 dias, aparece um selo amarelo "Desatualizado".
4. **Situações finalizadas:** "Sem efeito" e "Não validado" passam a contar como encerradas (ficam esmaecidas, fora do total e sem Gerar/Enviar).
5. O botão **Atualizar** de cada parcelamento também traz os detalhes completos.

## Detalhes técnicos
- `RfbParcelamentos.tsx`: depois do `PEDIDOSPARC*`, para cada item com situação "Em parcelamento", chamar `OBTERPARC*` (164, 174, 184, 194, 204, 214, 224, 234) com `dados: {"numeroParcelamento": n}`. Ler de forma tolerante `consolidacaoOriginal.valorTotalConsolidadoDaEntrada`/`valorTotalConsolidado`, `quantidadeParcelas`, `parcelaBasica`/`valorParcela`, e contar `demonstrativoDePagamentos` para parcelas pagas. Guardar a resposta completa em `raw_response.detalhe`.
- Adicionar `OBTERPARC` ao mapa `PARCELAS_SERVICES`.
- `ENCERRADO_REGEX` passa a incluir `sem efeito|n[aã]o validado`.
- "Atualizar todas": lista de `client_id` distintos com algum registro `success`; reutiliza `consultarCliente` com pausa de 1,5 s e retentativa única em erro.
- Sem mudanças no banco (colunas existentes `valor_total`, `parcelas_pagas`, `parcelas_total`, `raw_response`).
- A primeira atualização completa precisa ser feita clicando em "Atualizar todas", porque a consulta usa o seu acesso.
