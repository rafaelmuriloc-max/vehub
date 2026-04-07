

# Melhorar reconhecimento de documentos por template

## Problemas identificados

1. **`obligation_type_region` nunca é usada**: Os templates têm uma região configurada para identificar o tipo de obrigação, mas `tryExtractByRegions` ignora completamente esse campo. A função tenta cada template na ordem e retorna o primeiro onde o CNPJ bate — sem validar se o documento é realmente daquele tipo.

2. **Sem scoring/ranking**: Se o CNPJ da região do template A capturar algo num documento que é na verdade template B, o resultado é incorreto ou falha silenciosa.

3. **PDF re-parsed a cada template**: `extractTextFromRegion` chama `pdfjs.getDocument()` de novo para cada campo de cada template — lento e desnecessário.

4. **Sem fallback inteligente**: Se a extração por região falha (coordenadas ligeiramente fora), vai direto para IA, sem tentar uma busca por texto completo nos nomes dos tipos cadastrados.

5. **Coordenadas podem não capturar texto**: A verificação `ty + item.height` pode falhar porque `item.height` nem sempre está definido no pdfjs — o valor padrão é `undefined`, tornando a comparação `NaN`.

## Solução

### 1. Cachear o PDF uma vez por arquivo
Extrair o documento PDF e o conteúdo de texto uma única vez, reutilizando para todos os templates.

### 2. Corrigir `item.height` indefinido
Usar `item.height || 0` para evitar comparações com NaN que fazem textos válidos serem ignorados silenciosamente.

### 3. Usar `obligation_type_region` para validação por scoring
Em vez de retornar no primeiro template com CNPJ válido, pontuar cada template:
- +2 se `obligation_type_region` contém texto que bate com o nome do tipo
- +1 se CNPJ foi extraído e bate com um cliente
- +1 se competência foi extraída e é válida

Retornar o template com maior pontuação.

### 4. Fallback por texto completo
Se nenhum template pontuar bem pela região, fazer uma busca simples no texto completo do PDF procurando os nomes dos tipos de documento cadastrados (ex: "FGTS", "DAS", "Resumo da Folha") antes de recorrer à IA.

## Arquivos alterados

- `src/pages/Documents.tsx`:
  - Refatorar `extractTextFromRegion` para aceitar objetos `page`/`viewport`/`content` pré-carregados (evitar re-parse)
  - Corrigir `item.height` → `item.height || 0`
  - Refatorar `tryExtractByRegions` com sistema de scoring usando `obligation_type_region`
  - Adicionar fallback por busca de nome do tipo no texto completo

## Detalhes técnicos

```text
Fluxo atual:
  Para cada template → extrair CNPJ da região → se bate → retorna

Fluxo proposto:
  1. Carregar PDF uma vez, extrair conteúdo de todas as páginas
  2. Para cada template com config:
     a. Extrair texto de obligation_type_region → comparar com dt.name
     b. Extrair CNPJ da cnpj_region → tentar match com cliente
     c. Extrair competência da reference_month_region
     d. Pontuar: tipo match (+2), cliente match (+1), competência válida (+1)
  3. Retornar template com maior pontuação (mínimo 2 para aceitar)
  4. Se nenhum template atingir mínimo → buscar nomes dos tipos no fullText
     → se encontrar, usar esse tipo + CNPJ/competência do fullText
  5. Se ainda nada → fallback IA (comportamento atual)
```

