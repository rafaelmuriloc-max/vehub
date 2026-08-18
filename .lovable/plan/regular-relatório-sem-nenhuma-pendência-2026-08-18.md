# Regular = relatório sem nenhuma pendência

## Regra desejada

- Encontrou pelo menos **um item de pendência** no relatório → **Irregular**.
- Não encontrou nenhum item → **Regular**.

Nada mais interfere: nem número de páginas, nem tamanho do PDF, nem a frase "nada consta".

## O que muda em relação ao comportamento atual

Hoje, quando nenhum item é reconhecido, o relatório só vira Regular se também tiver a frase de "nada consta" **e** for de página única; caso contrário é marcado como "Irregular (a revisar)". Isso está deixando clientes limpos como irregulares.

Com a nova regra esse caminho de "a revisar" deixa de existir: sem item reconhecido, o cliente é Regular.

## Para a regra ser confiável, o reconhecimento de itens precisa estar correto

Antes de fixar, conferir num relatório real com pendência e num relatório limpo que:

- Todo item listado (Pendência, Débito, Parcelamento, Processo, Inscrição, Omissão, Dívida ativa) é reconhecido, mesmo com descrição longa e sem quebra de linha real no texto extraído do PDF.
- Títulos, legendas e cabeçalhos fixos não são contados como item.

Sem PDF continua não virando Regular (fica erro/pendente), como já é hoje.

## Depois de aplicar

Usar o botão **Reclassificar relatórios** para reprocessar os PDFs já armazenados com a nova regra, sem nova consulta ao SERPRO.

## Detalhes técnicos

- `src/components/integra-contador/SitfisOverviewPanel.tsx`
  - `analyzeSitfisReport`: `items.length > 0` → irregular (tipos derivados dos itens); `items.length === 0` → regular. Remover a exigência de `CLEAN_PHRASES` e de `numPages <= 1`, e o retorno com `needsReview`.
  - Manter `toLines` / `ITEM_LINE_RE` / `ITEM_MARKER_RE` / `HEADER_LIKE_RE`, ajustando apenas se a conferência mostrar item não reconhecido.
  - `SitfisReportMeta` deixa de influenciar o resultado.
- `src/components/integra-contador/SituacaoFiscalTab.tsx`: segue passando o texto do PDF; a garantia "sem PDF nunca é Regular" permanece.
- Sem alterações de banco.