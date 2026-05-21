## Objetivo
Permitir marcar uma obrigação como concluída diretamente pela lista do calendário (sem abrir o detalhe, sem anexar documentos nem fazer atividades) e destacar as obrigações concluídas em azul claro em vez de verde.

## Mudanças em `src/pages/CalendarView.tsx`

### 1. Nova função `quickCompleteInstance(instanceId, obligationId)`
- Buscar todas as atividades da obrigação em `oblActivities` (já carregado).
- Para cada atividade, fazer upsert em `obligation_activity_completions`:
  - Se já existe completion → `UPDATE { completed: true, completed_at: now() }`.
  - Senão → `INSERT { instance_id, activity_id, completed: true, completed_at: now() }`.
- Após sucesso, recarregar `completions` do estado e exibir toast "Obrigação concluída".
- Caso a obrigação não tenha atividades cadastradas, criar uma única "completion vazia" (com `activity_id` nulo não é possível pelo schema → nesse caso apenas mostrar toast informativo "Sem atividades configuradas"). 

### 2. Botão "Concluir" nas linhas pendentes
Adicionar, ao lado do `Trash2`, nos 3 locais onde a linha pendente é renderizada:
- Lista do dia (`paginatedDayPending` — bloco do tab pending dentro do `[pending, completed].map`).
- Lista do mês pendentes (`paginatedMonthPending`).

Botão:
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-6 w-6 text-muted-foreground hover:text-emerald-600"
  title="Concluir obrigação"
  onClick={e => { e.stopPropagation(); quickCompleteInstance(ev.instanceId, ev.obligationId); }}
>
  <Check className="h-3.5 w-3.5" />
</Button>
```
- Renderizar somente quando `!completed` (na lista do dia o template é compartilhado entre pending/completed; usar `{!completed && ...}`).

### 3. Destaque azul claro em obrigações concluídas
Substituir as classes verdes pelas azuis (mesma intensidade) nos 3 locais:
- Lista do dia (linha 922-925): `bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800` → `bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800`.
- Texto de progresso da lista do dia (linha 954): `text-green-600 dark:text-green-400` → `text-sky-600 dark:text-sky-400`.
- Lista do mês concluídas (linha 1179): mesmas substituições do bg/border.
- Texto de progresso do mês concluídas (linha 1209): mesma substituição de cor.

Não alterar a paleta dos cards de resumo nem outros indicadores verdes (ex.: ícones de "concluído com sucesso" em outras telas).

## Fora do escopo
- Sem alteração de schema ou RLS.
- Sem mudança em filtros, paginação, contadores ou cards de resumo.
- Sem mudança em outras páginas.