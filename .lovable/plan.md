

# Classificar segmentos automaticamente ao carregar a página

## Objetivo
Remover o botão "Classificar Segmentos" e executar a classificação automaticamente em background quando a página de clientes carrega (similar ao `batchUpdateTaxRegimes` que já roda no `useEffect`).

## Mudanças em `src/pages/Clients.tsx`

### 1. Mover lógica do `batchClassifySegments` para um `useEffect`
- Criar um `useEffect` (ou adicionar ao existente) que roda uma vez após o carregamento inicial
- Usar `localStorage` com uma chave tipo `batch_classify_done_YYYY-MM-DD` para não repetir no mesmo dia
- A lógica interna permanece igual: buscar clientes sem `business_classification` mas com CNAEs, chamar `classifyByAI` para cada um, atualizar o banco

### 2. Remover o botão "Classificar Segmentos" da UI
- Remover o `<Button>` que chama `batchClassifySegments` (linha ~783)
- Manter os estados `classifyingAll` e `classifyProgress` para mostrar progresso em background (barra de progresso existente)

### 3. Mostrar progresso discreto
- Manter a barra de progresso já existente para feedback visual enquanto classifica em background

