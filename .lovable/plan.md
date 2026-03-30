

# Preencher Segmento em lote via IA para clientes sem classificação

## Objetivo
Adicionar um botão que busca todos os clientes com `business_classification` vazio mas que possuem CNAEs (`main_activity` ou `secondary_activities`), e chama a edge function `classify-segment` para cada um, atualizando o banco.

## Mudanças em `src/pages/Clients.tsx`

### 1. Novo estado para controle do batch
- `classifyingAll` (boolean) + `classifyProgress` (`{current, total}`)

### 2. Nova função `batchClassifySegments`
- Busca clientes onde `business_classification` é nulo/vazio E (`main_activity` não é nulo OU `secondary_activities` não é nulo)
- Para cada cliente, chama `classifyByAI(main_activity, secondary_activities)`
- Se retornar classificação, faz `UPDATE` no campo `business_classification`
- Delay de 500ms entre chamadas para evitar rate limit
- Mostra progresso via toast ou estado visual
- Ao finalizar, recarrega lista de clientes

### 3. Botão na UI
- Adicionar botão "Classificar Segmentos" ao lado dos botões de batch existentes (ex: "Atualizar Cadastros")
- Desabilitado enquanto `classifyingAll` é true
- Mostra progresso (ex: "Classificando 3/15...")

### Detalhes técnicos
- Reutiliza `classifyByAI` já existente (chama edge function `classify-segment`)
- Apenas clientes com CNAEs preenchidos e sem classificação serão processados
- Não altera clientes que já possuem `business_classification`

