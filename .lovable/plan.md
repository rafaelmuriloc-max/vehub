

# Corrigir versão do SITFIS: 1.0 → 2.0

## Contexto

Confirmado na documentação oficial SERPRO (changelog e página do serviço): a versão 1.0.0 do SITFIS foi descontinuada em 01/04/2024, substituída pela 2.0.0. A API de produção rejeita requests com versão 1.0.

## Solução

Adicionar `versaoSistema: '2.0'` nos dois serviços SITFIS do catálogo e garantir que o frontend envie esse campo à Edge Function.

### Mudanças

1. **Tipo `ServiceDefinition`** — adicionar campo opcional `versaoSistema?: string`
2. **Catálogo SITFIS** — adicionar `versaoSistema: '2.0'` em `SOLICITARPROTOCOLO91` e `RELATORIOSITFIS92`
3. **`handleSubmit`** — incluir `versaoSistema` do serviço selecionado no body enviado à Edge Function (fallback `'1.0'`)

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `src/pages/IntegraContador.tsx` | Tipo, catálogo e submit — ~5 linhas |

