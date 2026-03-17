

# Plano: Corrigir endpoint de autenticação do Integra Contador

## Problema

O código atual autentica via mTLS em `https://autenticacao.sapi.serpro.gov.br/authenticate`, mas conforme o curl que você compartilhou, a autenticação OAuth2 deve ser feita diretamente no gateway:

```
https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/
```

Com Basic Auth (consumer-key:consumer-secret) e `grant_type=client_credentials`, **sem necessidade de mTLS** no passo de autenticação.

Além disso, o erro 403 `[AcessoNegado-ICGERENCIADOR-018]` indica que o CNPJ do contratante (`40908083000136`) não corresponde ao habilitado no e-commerce SERPRO. Isso pode estar relacionado ao uso do endpoint de auth errado (que pode gerar tokens com escopo diferente).

## Correção em `supabase/functions/integra-contador/index.ts`

1. **Mudar `SERPRO_AUTH_URL`** de `https://autenticacao.sapi.serpro.gov.br/authenticate` para `https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/`
2. **Simplificar a chamada de autenticação** — usar `fetch()` padrão com Basic Auth (sem mTLS/certificado), já que o gateway não exige mTLS para o token OAuth2
3. **Manter mTLS apenas na chamada da API** (POST para `/v1/{tipo}`) que efetivamente precisa do certificado

## Sobre o erro do Contratante

O erro "número do Contratante informado é diferente do conteúdo do Contratante habilitado no ecommerce" é uma questão de configuração na Loja SERPRO — o CNPJ `40908083000136` precisa ser o mesmo cadastrado lá. Após corrigir o endpoint de auth, se o erro persistir, será necessário verificar qual CNPJ está habilitado no e-commerce SERPRO.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/integra-contador/index.ts` — alterar URL de auth e simplificar chamada OAuth2 |

