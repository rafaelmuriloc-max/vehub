

# Migrar consulta CNPJ para API SERPRO (CNPJ-Empresa v2)

## Contexto

Atualmente o sistema usa a BrasilAPI (`brasilapi.com.br/api/cnpj/v1`) para consultar dados de CNPJ. O usuário quer migrar para o endpoint SERPRO `https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnpj-empresa/v2/empresa/{cnpj}` que retorna dados mais completos sobre opção pelo Simples Nacional e MEI.

## Alterações

### 1. Nova Edge Function `cnpj-query`

Arquivo: `supabase/functions/cnpj-query/index.ts`

- Recebe `{ cnpj }` no body
- Autentica via OAuth2 com `SERPRO_CONSUMER_KEY` / `SERPRO_CONSUMER_SECRET` (já configurados)
- Chama `GET https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnpj-empresa/v2/empresa/{cnpj}`
- Retorna os dados da empresa ao frontend
- Sem mTLS (esta API usa apenas Bearer token, diferente do Integra Contador)

### 2. Atualizar `src/pages/Clients.tsx`

- **`fetchCnpjData()`**: trocar a chamada direta à BrasilAPI por `supabase.functions.invoke('cnpj-query', { body: { cnpj } })`
- Mapear os campos da resposta SERPRO para o formulário (razão social, endereço, CNAE, opção Simples/MEI, etc.)
- Manter a mesma regra de regime tributário: MEI → `mei`, Simples → `simples_nacional`, senão → `lucro_presumido`
- **Batch update (`useEffect`)**: mesma lógica, mas chamando a edge function em vez da BrasilAPI, com key `tax_regime_batch_done_v2` para re-executar com a nova fonte

### 3. Outros arquivos que usam BrasilAPI (manter inalterados por ora)

- `CertificateImportDialog.tsx` e `InvoiceEmit.tsx` continuam usando BrasilAPI para outros fins (dados cadastrais básicos). Podem ser migrados futuramente se desejado.

## Detalhes técnicos

| Item | Detalhe |
|---|---|
| Endpoint SERPRO | `https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnpj-empresa/v2/empresa/{cnpj}` |
| Auth SERPRO | OAuth2 client_credentials com consumer key/secret (já existentes nos secrets) |
| Auth URL | `https://apigateway.conectagov.estaleiro.serpro.gov.br/oauth2/jwt-token` (padrão ConectaGov) |
| Secrets necessários | `SERPRO_CONSUMER_KEY`, `SERPRO_CONSUMER_SECRET` (já configurados) |
| Nova edge function | `supabase/functions/cnpj-query/index.ts` |
| Config | Adicionar entry em `supabase/config.toml` |

