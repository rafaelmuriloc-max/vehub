

# Proxy PHP na Hostinger para NF-e (SEF-SC)

## Problema
A SEF-SC bloqueia conexões TLS de IPs cloud (Supabase). A edge function `nfe-query` tenta conectar diretamente e recebe `connection reset`.

## Solução
Criar um proxy PHP na Hostinger que recebe a requisição SOAP + certificado PFX em base64, faz a chamada mTLS para a SEF-SC, e retorna a resposta. A edge function passa a enviar para o proxy ao invés de conectar diretamente.

## Alterações

### 1. Script PHP para a Hostinger (arquivo de referência)
Criar `proxy-nfe.php` que:
- Recebe POST JSON com `{ soap_body, pfx_base64, pfx_password, url, soap_action }`
- Valida um token de segurança no header `X-Proxy-Token`
- Converte PFX para PEM temporário
- Faz cURL com `CURLOPT_SSLCERT` + `CURLOPT_SSLKEY` para a SEF-SC
- Retorna `{ status, body, headers }`
- Limpa arquivos temporários

### 2. Alterar `supabase/functions/nfe-query/index.ts`
- Adicionar constante `NFE_PROXY_URL` lendo de `Deno.env.get("NFE_PROXY_URL")`
- Na função `requestTextWithMTLS`, **antes** das tentativas diretas, tentar via proxy:
  - Converter PEM cert/key para PFX (ou enviar os PEMs diretamente)
  - POST para o proxy com os dados SOAP
  - Se o proxy responder, retornar o resultado
  - Se falhar, cair no fluxo direto existente como fallback

### 3. Secrets necessários
- `NFE_PROXY_URL` — URL do proxy na Hostinger (ex: `https://seudominio.com.br/proxy-nfe.php`)
- `NFE_PROXY_TOKEN` — token de autenticação do proxy

## Fluxo
```text
Edge Function → POST JSON (SOAP + cert PEM) → Proxy PHP Hostinger
                                                    ↓
                                              cURL mTLS → SEF-SC
                                                    ↓
                                              Response SOAP ← SEF-SC
                                                    ↓
Edge Function ← JSON { status, body } ← Proxy PHP
```

## Arquivos
- `.lovable/tmp/proxy-nfe.php` (referência para deploy manual na Hostinger)
- `supabase/functions/nfe-query/index.ts` (adicionar tentativa via proxy antes do mTLS direto)

## Observação
O PHP na Hostinger precisa ser hospedado manualmente. O arquivo será gerado como referência no projeto para facilitar o deploy.

