

# Extrair texto do PDF para classificar situação fiscal

## Problema
A API SERPRO retorna apenas o PDF base64 no campo `dados`, sem texto estruturado no JSON. A informação fiscal (pendências, débitos, irregularidades) está dentro do conteúdo do PDF.

## Solução
Usar `pdfjs-dist` (já incluído como dependência do `react-pdf`) para extrair o texto de todas as páginas do PDF base64 no browser, e rodar a busca por indicadores negativos sobre esse texto extraído.

## Mudanças em `src/components/integra-contador/SituacaoFiscalTab.tsx`

1. Importar `pdfjs-dist` e configurar o worker (mesmo padrão usado pelo `react-pdf` no projeto)
2. Criar função `extractTextFromPdfBase64(base64: string): Promise<string>` que:
   - Converte base64 para `Uint8Array`
   - Carrega o documento com `pdfjsLib.getDocument()`
   - Itera por todas as páginas, extraindo texto via `page.getTextContent()`
   - Retorna todo o texto concatenado
3. Na função `consultarSitfis`, após obter o `pdfBase64`:
   - Se houver PDF, extrair texto com a nova função
   - Concatenar o texto extraído do PDF com o `responseStr` existente
   - A busca por indicadores negativos passa a cobrir tanto o JSON quanto o conteúdo real do PDF
4. Manter o fallback atual (busca no JSON) caso o PDF não exista ou a extração falhe

## Fluxo atualizado

```text
Resposta SERPRO
  ├── JSON metadata (mensagens, status) → stripBinaryFields → keywords
  └── PDF base64 → pdfjs extractText → keywords
                         ↓
              Combinar ambos textos
                         ↓
         Buscar indicadores negativos
                         ↓
         regular / irregular
```

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `src/components/integra-contador/SituacaoFiscalTab.tsx` | Adicionar extração de texto do PDF via pdfjs-dist e incluir na análise de keywords |

