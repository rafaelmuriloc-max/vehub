

# Diagnóstico e Proxy para Emissão NFS-e (SEFIN bloqueando IPs cloud)

## Situação Atual

O `nfse-query` funciona porque conecta em `adn.nfse.gov.br`. O `nfse-emit` falha porque conecta em `sefin.nfse.gov.br` (IP 189.9.84.43), que rejeita conexões TLS de IPs de datacenter/cloud (Supabase). Todas as estratégias (fetch, raw-http1, DoH+SNI) falham com `ECONNRESET`.

Não é possível testar de um VPS diretamente a partir do Lovable. Em vez disso, proponho:

## Plano

### 1. Script de diagnóstico para VPS (arquivo `.lovable/tmp/`)

Criar um script Deno standalone que o usuário pode rodar em qualquer VPS/máquina local para confirmar se a conexão mTLS ao SEFIN funciona fora do Supabase. O script:
- Recebe o caminho do PFX e senha como argumentos
- Tenta `Deno.connectTls()` para `sefin.nfse.gov.br:443` com o certificado cliente
- Envia um POST de teste (ou apenas tenta o handshake TLS)
- Imprime sucesso/falha com detalhes

### 2. Proxy reverso mTLS (implementação futura)

Se o teste confirmar que funciona fora do cloud, criar:
- **Worker/proxy no VPS**: recebe o XML comprimido + certificado PEM via HTTPS, faz o POST mTLS ao SEFIN e retorna a resposta
- **Edge Function atualizada**: em vez de conectar diretamente ao SEFIN, envia o payload ao proxy via HTTPS simples

Isso fica para uma etapa posterior, após confirmação do diagnóstico.

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `.lovable/tmp/test-sefin-connection.ts` | Criar - script Deno para rodar no VPS |

O script é ~80 linhas: parseia PFX com node-forge, tenta `Deno.connectTls` para o SEFIN, reporta resultado.

