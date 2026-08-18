# Corrigir clientes sem pendência classificados como "Irregular"

## Diagnóstico (verificado no banco)

Hoje nenhum cliente está como "Regular" — todos os relatórios emitidos viraram `irregular`. Agrupando por tipo de pendência e tamanho do PDF:

```text
{outros}                        28 relatórios   ~27,8 KB (todos entre 27,7 e 28,0 KB)
{debitos}                       27 relatórios   ~38,5 KB
{suspensa,debitos}              27 relatórios   ~47,0 KB
{parcelamento,suspensa,debitos} 28 relatórios   ~48,3 KB
... demais grupos                               > 28 KB
```

Os 28 marcados como "outros" têm todos praticamente o mesmo tamanho — é o relatório de uma página, sem nenhum item listado. São exatamente os clientes que aparecem como irregulares sem pendência.

Causa: a classificação procura palavras soltas no texto inteiro ("pendência", "débito", "dívida", "multa", "parcelamento", "cobrança", "omissão"...). Essas palavras aparecem nos títulos, cabeçalho fixo e legenda do relatório SITFIS mesmo quando não há nada listado. Resultado: praticamente todo relatório é marcado irregular, e o caso limpo cai em "outros" por não bater com nenhuma regra específica.

## O que fazer

1. Classificar por itens do relatório, não por palavras soltas
   - Reconhecer as frases de relatório limpo ("não constam pendências", "não foram detectadas pendências", "nada consta", "não há débitos"), por seção (Receita Federal e PGFN).
   - Reconhecer os itens reais de pendência, que no SITFIS vêm em linhas próprias iniciadas por "Pendência - ...", "Parcelamento - ...", "Processo - ...", "Inscrição - ...", "Omissão - ...", "Débito - ...".
   - Regra final: sem nenhum item listado e com as frases de "nada consta" → **Regular**; caso contrário → **Irregular**, com os tipos derivados dos próprios itens encontrados.

2. Não usar mais o texto do JSON de resposta na classificação
   - A varredura passa a considerar apenas o texto extraído do PDF; metadados e mensagens do gateway deixam de influenciar.

3. Manter a garantia já existente
   - Sem PDF nunca vira "Regular" (continua como erro/pendente).

4. Reclassificar o que já está no banco
   - Botão "Reclassificar relatórios" na aba: reprocessa os PDFs já armazenados, direto no navegador (pdf.js), recalcula status e tipos e grava o resultado, com indicador de progresso. Nenhuma nova consulta ao SERPRO é feita e nenhum dado de cliente é alterado.

5. Painel e detalhamento
   - Os donuts passam a mostrar "Regular" com valor real; o card "Outros" deixa de concentrar relatórios limpos.
   - No diálogo de detalhe da pendência, os trechos exibidos passam a ser as linhas dos itens encontrados (mais legíveis que o recorte atual em volta da palavra-chave).

## Detalhes técnicos

- `src/components/integra-contador/SitfisOverviewPanel.tsx`
  - Nova função `analyzeSitfisReport(text)` retornando `{ status: 'regular' | 'irregular', types: string[], items: string[] }`.
  - Detecção de itens por regex de linha (`/^\s*(pend[êe]ncia|parcelamento|processo|inscri[çc][ãa]o|omiss[ãa]o|d[ée]bito)\s*[-–:]/im`) e das frases de "nada consta".
  - `classifyPendencies` passa a derivar os tipos apenas das linhas de item; `extractPendencyExcerpts` passa a devolver as linhas de item do tipo escolhido.
- `src/components/integra-contador/SituacaoFiscalTab.tsx`
  - Substituir o bloco `negativeIndicators` por `analyzeSitfisReport(pdfText)`; gravar `status` e `pendency_types` a partir do retorno.
  - Nova ação de reclassificação em lote sobre os registros existentes com `pdf_base64`.
- Sem alterações de banco.