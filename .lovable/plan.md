## Objetivo

1. Corrigir as colunas **Número** e **Destinatário** na lista de NF-e Recebidas.
2. Permitir baixar o **XML completo** (procNFe) sob demanda quando o usuário clicar em "Baixar XML" ou "Baixar DANFE".

## Contexto

A consulta `distNSU` ao Ambiente Nacional retorna apenas resumos (`<resNFe>`) — sem itens, sem destinatário, sem `nNF`. O XML completo precisa ser obtido com uma segunda chamada `consChNFe` por chave de acesso.

## Mudanças

### 1. `supabase/functions/nfe-query/index.ts` — corrigir parser

Em `parseNfeEntry`, detectar se o XML é `resNFe` (resumo) e, nesse caso:
- Extrair `xNome` e `CNPJ` direto da raiz (não dentro de `<emit>`).
- Derivar `invoice_number` dos dígitos 26–34 da chave de acesso (sem zeros à esquerda).
- Preencher `recipient_cnpj` e `recipient_name` com os dados do **cliente** (CNPJ do certificado é sempre o destinatário). Passar `clientInfo` como argumento.

Manter o caminho atual para XML completo (`<NFe>`/`<nfeProc>`) intacto.

### 2. `supabase/functions/nfe-download/index.ts` — buscar XML completo sob demanda

Atualizar a função para:
- Verificar se `raw_xml` salvo começa com `<resNFe` (resumo).
- Se sim:
  - Carregar certificado A1 do cliente (Storage `certificates`).
  - Chamar `NFeDistribuicaoDFe` via `NFE_PROXY_URL` (Hostinger) com body SOAP `consChNFe` + `chNFe` da nota.
  - Decompactar `docZip` (gzip+base64) → obter `<nfeProc>` completo.
  - Atualizar `nfe_invoices`: `raw_xml` = XML completo, e refazer `emitter_*`, `recipient_*`, `invoice_number`, `total_value` com extração correta.
- Retornar URL/conteúdo do XML completo (signed URL ou inline) para o frontend.

A geração do DANFE (PDF) no `NfeTab.tsx` já usa esse fluxo — passa a funcionar automaticamente porque vai receber o XML completo na primeira chamada.

### 3. Backfill dos registros existentes

Migration SQL para corrigir as ~N notas já salvas como resumo:
```sql
UPDATE nfe_invoices ni
SET 
  invoice_number = COALESCE(invoice_number, ltrim(substring(access_key from 26 for 9), '0')),
  recipient_cnpj = COALESCE(recipient_cnpj, regexp_replace(c.document, '\D', '', 'g')),
  recipient_name = COALESCE(recipient_name, c.company_name),
  emitter_name   = COALESCE(emitter_name, (regexp_match(raw_xml, '<xNome>([^<]+)</xNome>'))[1]),
  emitter_cnpj   = COALESCE(emitter_cnpj, (regexp_match(raw_xml, '<CNPJ>(\d{14})</CNPJ>'))[1])
FROM clients c
WHERE c.id = ni.client_id
  AND ni.access_key IS NOT NULL;
```

### 4. UI — feedback

Em `NfeTab.tsx`, manter os botões existentes. Adicionar pequena mensagem no toast quando estiver baixando pela 1ª vez ("Buscando XML completo na SEFAZ...") já que vai demorar alguns segundos.

## Validação

- Recarregar `/invoices` aba NF-e → colunas Número e Destinatário preenchidas para todas as NF-e existentes.
- Clicar "Baixar XML" em uma nota → retorna XML completo `<nfeProc>` com `<det>` (itens), `<dest>`, `<total>` etc.
- Segunda vez no mesmo botão é instantâneo (XML já cacheado no banco).
- Clicar "Baixar DANFE" → PDF gerado com todos os dados corretos.

## Notas

- Limite de 20 `consChNFe`/min por CNPJ (NT 2014/002) — como é sob demanda, dificilmente bate.
- XML completo só fica disponível na SEFAZ por ~90 dias após emissão.
