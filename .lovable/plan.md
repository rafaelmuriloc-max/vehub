

# Classificar Segmento por IA com base nos CNAEs

## Objetivo
Substituir a lógica rule-based atual (`classifyByCnae`) por uma chamada à IA (Lovable AI Gateway) que analisa os CNAEs principal e secundários da empresa e retorna a classificação correta: Comércio, Serviço, Indústria ou Misto.

## Mudanças

### 1. Nova Edge Function `classify-segment`
Criar `supabase/functions/classify-segment/index.ts`:
- Recebe `{ main_activity: string, secondary_activities: string }`
- Chama Lovable AI Gateway com prompt pedindo para analisar os CNAEs e retornar **apenas** uma das 4 opções: `Comércio`, `Serviço`, `Indústria` ou `Misto`
- Usa tool calling para structured output (retornar `{ classification: string }`)
- Retorna o resultado como JSON

### 2. Atualizar `src/pages/Clients.tsx`
- Remover a função `classifyByCnae`
- Criar função async `classifyByAI(mainCnae: string, secondaryCnaes: string)` que chama a edge function via `supabase.functions.invoke('classify-segment', ...)`
- Nos handlers do `CnaeCombobox` e `CnaeMultiSelect` onChange: chamar `classifyByAI` de forma assíncrona e atualizar o campo `business_classification` quando a resposta chegar
- No `fetchCnpjData`: substituir `classifyByCnae(...)` pela chamada async à IA
- Adicionar um pequeno indicador de loading (spinner) ao lado do campo Segmento enquanto a IA processa

### 3. Atualizar `supabase/config.toml`
- Adicionar a nova function `classify-segment` com `verify_jwt = true`

### Detalhes técnicos
- Modelo: `google/gemini-3-flash-preview` (rápido e barato)
- Prompt: sistema instrui a IA a analisar os códigos e descrições CNAE e classificar a empresa
- Usa `LOVABLE_API_KEY` já disponível nos secrets
- Fallback: se a IA falhar, manter o campo vazio para preenchimento manual
- Debounce de 500ms nos onChange para evitar chamadas excessivas

