

# Corrigir incompatibilidade entre proxy PHP e edge function

## Problema
O proxy PHP no servidor (`187.77.228.202:8090`) está com uma versão antiga que espera o campo `pfx_base64`, mas a edge function envia `cert_pem` e `key_pem`. Resultado: proxy rejeita com "Missing required fields: soap_body, pfx_base64, url" e o fallback direto falha com "connection reset".

## Solução
Não há alteração de código necessária no projeto — os arquivos já estão corretos. O problema é que **o arquivo PHP no servidor precisa ser atualizado**.

## Ação necessária (manual)
1. Faça upload do arquivo `.lovable/tmp/proxy-nfe.php` atualizado para o servidor `187.77.228.202:8090`, substituindo a versão antiga
2. O arquivo atual espera os campos `cert_pem`, `key_pem`, `soap_body`, `url` — que é exatamente o que a edge function envia
3. Verifique que o `PROXY_TOKEN` definido no PHP coincide com o secret `NFE_PROXY_TOKEN` do Supabase

## Observação adicional
O proxy está acessível via HTTP (`http://187.77.228.202:8090`) e não HTTPS. Considere configurar HTTPS para proteger os certificados e dados SOAP em trânsito.

## Após atualizar o PHP
Teste novamente a consulta NF-e pela interface. O fluxo será:
```text
Edge Function → POST {soap_body, cert_pem, key_pem, url} → Proxy PHP
                                                              ↓
                                                        cURL mTLS → SEF-SC
                                                              ↓
Edge Function ← JSON {status, body, success} ← Proxy PHP
```

