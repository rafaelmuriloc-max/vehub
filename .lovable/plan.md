# Corrigir clientes com pendência classificados como "Regular"

## O que os dados mostram

Distribuição atual de `sitfis_results` (tamanho do PDF em base64):

```text
regular         132 relatórios   menor 27.724   maior 117.248   média 40.163
irregular        42 relatórios   menor 27.940   maior 105.000   média 47.249
sem_procuracao    6
error             5
```

O relatório limpo (uma página, nada listado) tem ~27,7 KB. Existem relatórios de até 117 KB marcados como **Regular** — são páginas e páginas de itens listados. Ou seja, a análise atual está deixando pendências passarem.

## Causas na regra de análise atual

1. O reconhecimento de item exige que a linha tenha no máximo ~200 caracteres. Como o texto extraído do PDF vem sem quebras reais, cada bloco de item costuma ficar bem maior que isso e é descartado — o relatório fica "sem itens".
2. Com zero itens reconhecidos, a regra devolve **Regular** de qualquer jeito (inclusive sem nenhuma frase de "nada consta"). Um relatório grande e cheio de pendências cai nesse caminho.
3. A frase de "nada consta" é buscada no texto inteiro. Basta uma seção limpa (ex.: PGFN sem débitos) para o relatório todo parecer limpo, mesmo com pendências na Receita Federal.

## O que fazer

1. Verificar o texto real primeiro
   - Extrair o texto de um relatório grande hoje marcado como Regular e conferir como os itens aparecem, antes de fixar as expressões de reconhecimento.

2. Reconhecer itens sem limite de tamanho
   - Remover o teto de caracteres da linha; o que define um item é o marcador ("Pendência - ", "Parcelamento - ", "Processo - ", "Inscrição - ", "Omissão - ", "Débito - "), não o comprimento. O recorte curto passa a ser feito só na exibição.

3. Nunca concluir "Regular" por ausência de evidência
   - Só é Regular quando: nenhum item encontrado **e** o relatório traz as frases de "nada consta" **e** o relatório tem apenas a página de rosto (páginas/tamanho compatíveis com relatório vazio).
   - Sem itens reconhecidos, mas com relatório extenso: marcar como **Irregular / a revisar**, nunca Regular. É preferível pedir conferência humana a esconder pendência.

4. Avaliar por seção, não pelo texto inteiro
   - Separar o relatório nas seções (Receita Federal e PGFN) e exigir "nada consta" em todas elas; uma seção limpa não neutraliza a outra.

5. Reclassificar o histórico
   - Reutilizar o botão "Reclassificar relatórios" para reprocessar os PDFs já armazenados com a nova regra, sem nova consulta ao SERPRO.

## Detalhes técnicos

- `src/components/integra-contador/SitfisOverviewPanel.tsx`
  - `ITEM_LINE_RE`: remover o limite `{0,200}`; manter apenas a exigência do marcador seguido de conteúdo.
  - `analyzeSitfisReport(text, meta?)`: aceitar metadados do relatório (nº de páginas / tamanho) e aplicar a regra: itens > 0 → irregular; itens = 0 + "nada consta" em todas as seções + relatório de página única → regular; caso contrário → irregular com tipo `outros` (a revisar).
  - Fatiar o texto por seção antes de procurar as frases limpas.
- `src/components/integra-contador/SituacaoFiscalTab.tsx`
  - `extractTextFromPdfBase64` passa a devolver também `numPages`, repassado para a análise na consulta nova e na reclassificação em lote.
- Sem alterações de banco.