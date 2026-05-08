## Problema
O endpoint `nfe-download` hoje extrai apenas o trecho `<nfeProc>...</nfeProc>` do `docZip` retornado pelo Ambiente Nacional e salva esse fragmento no Storage. O arquivo resultante:
- Não tem o prólogo `<?xml version="1.0" encoding="UTF-8"?>`.
- Pode perder conteúdo quando o `docZip` traz dados adicionais.

Por isso o XML baixado (tanto individual quanto em lote) não é o XML completo/oficial da NF-e.

## Mudanças

Tudo em `supabase/functions/nfe-download/index.ts`:

1. **Preservar o XML inteiro do `docZip`**: após `decompressGzip(b64)`, validar que contém `<nfeProc` e a `chNFe` correta e usar o conteúdo decodificado **na íntegra** como `fullXml`, em vez de re-extrair via regex `match(/<nfeProc...>/)`.
2. **Adicionar prólogo XML** quando ausente, antes de gravar em Storage e em `raw_xml`:
   - `if (!/^\s*<\?xml/i.test(fullXml)) fullXml = '<?xml version="1.0" encoding="UTF-8"?>\n' + fullXml;`
3. **Mesmo tratamento no caminho do cache** (`invoice.raw_xml` já contém `<nfeProc`): garantir prólogo antes do upload para Storage.
4. **Redeploy** da edge function `nfe-download`.

## Resultado
- Botão individual "Baixar XML" e botão em lote "Baixar XMLs" passam a entregar o XML autêntico/completo (`<?xml ... ?>` + `<nfeProc>` íntegro), pronto para importação em sistemas contábeis.
- Nenhuma alteração necessária em `NfeTab.tsx`.
