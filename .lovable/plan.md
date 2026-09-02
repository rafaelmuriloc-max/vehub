# Corrigir download do PDF (DANFSE) da NFS-e

## Diagnóstico confirmado

Os logs da função `nfse-download` mostram que todas as 5 tentativas recebem a mesma resposta do portal:

```text
GET https://adn.nfse.gov.br/danfse/<chave>
503 Service Unavailable — "No server is available to handle this request."
```

Não é instabilidade momentânea: o host do ADN não expõe a rota `/danfse`. O ADN publica apenas a distribuição de documentos (`/contribuintes/DFe/{NSU}`), conforme o manual oficial. Testes de rota feitos agora:

- `https://adn.nfse.gov.br/danfse/{chave}` — sem resposta / 503
- `https://adn.nfse.gov.br/contribuintes/danfse/{chave}` — sem resposta
- `https://sefin.nfse.gov.br/sefinnacional/danfse/{chave}` — 403 (rota existe; exige certificado digital, que a função já usa)

Ou seja, o DANFSE é servido pelo SEFIN Nacional, não pelo ADN.

## Correção

Em `supabase/functions/nfse-download/index.ts`, na função `handlePdfDownload`:

1. Trocar a URL do PDF para `https://sefin.nfse.gov.br/sefinnacional/danfse/{chaveAcesso}`.
2. Manter a chamada com mTLS (certificado A1 do cliente) já existente.
3. Manter a URL antiga do ADN apenas como fallback secundário, caso o SEFIN retorne 404.
4. Ajustar as mensagens de erro: distinguir 403 (certificado sem autorização para a chave) de 503 (portal indisponível), em vez de reportar sempre "portal indisponível".
5. Manter as tentativas com backoff, mas não repetir 5 vezes quando o erro for definitivo (403/404) — falhar rápido nesses casos.

Depois: fazer o deploy da função e validar baixando o PDF de uma nota já listada na tela de Notas Fiscais.

## Escopo

Somente a função `nfse-download`. Nenhuma alteração de banco, layout ou de outras integrações.
