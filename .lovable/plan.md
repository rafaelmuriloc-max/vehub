

# Corrigir erro na busca de CNPJ (BrasilAPI bloqueada por CORS)

## Problema
As chamadas diretas do frontend para `https://brasilapi.com.br/api/cnpj/v1/` estão falhando com "Failed to fetch". Isso ocorre porque a BrasilAPI bloqueia requisições CORS vindas do domínio do preview/produção.

## Solução
Criar uma Edge Function `cnpj-lookup` que faz a chamada para a BrasilAPI no servidor (sem restrição CORS) e atualizar o frontend para usar essa função.

## Mudanças

### 1. Nova Edge Function `supabase/functions/cnpj-lookup/index.ts`
- Recebe `{ cnpj: string }` no body
- Chama `https://brasilapi.com.br/api/cnpj/v1/{digits}` no servidor
- Retorna os dados com headers CORS adequados
- Fallback: se BrasilAPI falhar, tenta `https://receitaws.com.br/v1/cnpj/{digits}`

### 2. Atualizar `src/pages/Clients.tsx`
- Substituir `fetch('https://brasilapi.com.br/api/cnpj/v1/...')` por `supabase.functions.invoke('cnpj-lookup', { body: { cnpj } })`
- Aplicar em ambos os locais: busca individual (linha ~203) e batch update de regimes (linha ~281)

### 3. Atualizar `src/pages/InvoiceEmit.tsx`
- Substituir chamada direta à BrasilAPI pela Edge Function

### 4. Atualizar `src/components/CertificateImportDialog.tsx`
- Substituir chamada direta à BrasilAPI pela Edge Function

### Detalhes técnicos
- A Edge Function roda no Deno (servidor), sem restrição CORS
- Não precisa de autenticação extra — usa o JWT do Supabase existente
- Mantém a mesma estrutura de dados retornada pela BrasilAPI

