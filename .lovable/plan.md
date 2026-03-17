

# Plano: Botões de download XML e PDF para cada nota fiscal

## Situação atual

- Invoices têm `raw_data.xml` com o XML completo, mas `xml_url` e `pdf_url` são `null`
- Os botões atuais só aparecem quando `xml_url`/`pdf_url` existem (nunca aparecem)
- Para XML: basta extrair de `raw_data`, fazer upload no Storage, e atualizar a invoice
- Para PDF: precisa fazer request mTLS ao `https://adn.nfse.gov.br/danfse/{chaveAcesso}` com certificado do cliente

## Alterações

### 1. Nova Edge Function `supabase/functions/nfse-download/index.ts`

Aceita `POST { invoice_id, type: "xml" | "pdf" }`:

**XML**:
- Busca `raw_data->>'xml'` da invoice e `client_id`
- Faz upload para `nfse/{client_id}/{access_key}.xml` no bucket `documents`
- Atualiza `xml_url` na invoice
- Retorna signed URL

**PDF**:
- Busca `access_key` e `client_id` da invoice
- Carrega certificado digital do cliente (mesmo fluxo do `nfse-query`)
- Request mTLS GET `https://adn.nfse.gov.br/danfse/{access_key}` com `Accept: application/pdf`
- Upload do PDF para `nfse/{client_id}/{access_key}.pdf`
- Atualiza `pdf_url` na invoice
- Retorna signed URL

Reutiliza as funções mTLS copiadas do `nfse-query` (parsePfx, requestTextWithMTLS adaptada para binary).

### 2. Atualizar `supabase/config.toml`

Adicionar `[functions.nfse-download]` com `verify_jwt = false`.

### 3. Atualizar `src/pages/Invoices.tsx`

- Mostrar botões "XML" e "PDF" para **todas** as notas (não apenas quando url existe)
- Se `xml_url`/`pdf_url` já existem → download direto via signed URL do Storage
- Se não existem → chamar `nfse-download`, mostrar loading no botão, depois abrir o arquivo
- Adicionar estado de loading individual por invoice/tipo

### Arquivos

- **Criar**: `supabase/functions/nfse-download/index.ts`
- **Editar**: `supabase/config.toml`, `src/pages/Invoices.tsx`

