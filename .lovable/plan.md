

# Suportar CNPJ raiz (8 dígitos) para guias FGTS

## Problema
A guia do FGTS contém apenas o CNPJ raiz (8 dígitos), mas tanto a extração de texto (`extractCnpjFromText`) quanto a classificação por IA exigem 14 dígitos. O `matchClient` já faz fallback por raiz, mas nunca recebe os 8 dígitos porque são descartados antes.

## Solução

### 1. `src/pages/Documents.tsx` — `extractCnpjFromText`
- Após tentar extrair 14 dígitos, adicionar fallback: se o texto contiver exatamente 8 dígitos numéricos (ou um padrão XX.XXX.XXX), retornar esses 8 dígitos como CNPJ parcial.
- O `matchClient` já aceita CNPJs com 8+ dígitos e faz busca pela raiz.

### 2. `supabase/functions/classify-document/index.ts` — prompt da IA
- Alterar a instrução de "retorne apenas os 14 dígitos" para: "retorne os 14 dígitos se disponível; se o documento contiver apenas o CNPJ básico (8 dígitos), retorne os 8 dígitos."
- Assim a IA não descarta o CNPJ parcial de guias FGTS.

## Arquivos alterados
- `src/pages/Documents.tsx` — ~4 linhas em `extractCnpjFromText`
- `supabase/functions/classify-document/index.ts` — ~1 linha no prompt

