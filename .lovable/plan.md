

# Fix SITFIS: versaoSistema "1.0" → "2.0" para RELATORIOSITFIS92

## Problema

A API SERPRO retorna erro 400 "Versão Descontinuada" porque `RELATORIOSITFIS92` está sendo chamado com `versaoSistema: "1.0"`. A versão correta é `"2.0"`.

## Solução

Alterar a versão em dois lugares:

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `src/pages/IntegraContador.tsx` | 350 | `versaoSistema: '1.0'` | `versaoSistema: '2.0'` |
| `supabase/functions/integra-contador/index.ts` | 737 | `versaoSistema: versaoSistema \|\| "1.0"` | `versaoSistema: versaoSistema \|\| "2.0"` |

Duas linhas. Sem mudança estrutural.

