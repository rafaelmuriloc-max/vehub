## Objetivo

Diferenciar visualmente, na lista de concluídas do calendário, as obrigações finalizadas pelo botão "Concluir" (azul) das concluídas via fluxo normal com anexo/atividades (verde).

## Abordagem

Como não há coluna dedicada para marcar "conclusão rápida", usar o campo `notes` das `obligation_activity_completions` como marcador.

### 1. `quickCompleteInstance` em `src/pages/CalendarView.tsx`
- Ao inserir/atualizar registros em `obligation_activity_completions`, gravar `notes: 'quick_complete'` em todas as atividades concluídas pelo botão.

### 2. Detecção do tipo de conclusão
- Criar helper `isQuickCompleted(instanceId)`:
  - Pega todas as completions da instância.
  - Retorna `true` somente se houver ao menos uma e **todas** tiverem `notes === 'quick_complete'`.
- Para instâncias sem atividades cadastradas (concluídas via quick complete que cria nada), tratar como quick (azul).

### 3. Aplicar estilo condicional
Nas duas listas de concluídas (dia e mês) em `CalendarView.tsx`:
- Se `isQuickCompleted(inst.id)` → manter `bg-sky-50 border-sky-200` + `text-sky-600` no progresso.
- Caso contrário → voltar para `bg-green-50 border-green-200` + `text-green-600`.

### Fora do escopo
- Sem mudanças de schema, RLS, ou em outras telas.
- Sem alterar a lógica de pendentes.
