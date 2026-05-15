## Problema

O painel de Tarefas Pendentes não abre automaticamente em conversas que têm tarefas (ex.: Rafael), porque o gate de renderização depende de uma contagem que só é calculada quando o painel já está montado.

Em `src/pages/Chat.tsx` (linha 868):
```tsx
pendingTasksOpen && pendingTasksCount > 0 && activeConv?.whatsappPhone
  ? <PendingTasksPanel ... onCountChange={setPendingTasksCount} />
  : null
```

`pendingTasksCount` inicia em 0 e só é atualizado pelo `onCountChange` disparado dentro do próprio `PendingTasksPanel` após carregar as tarefas. Como o painel nunca monta, a busca nunca acontece.

## Correção

1. **`src/pages/Chat.tsx`** — Remover o `pendingTasksCount > 0` do gate de renderização. O painel deve ser montado sempre que `pendingTasksOpen && activeConv?.whatsappPhone`. A contagem continua sendo usada apenas para que o usuário possa fechá-lo manualmente sem que ele reabra (já tratado pelo `setPendingTasksOpen(false)` em `onClose`).

2. **`src/components/chat/PendingTasksPanel.tsx`** — Após o carregamento, se `tasks.length === 0`, chamar `onClose()` e retornar `null`. Isso preserva o comportamento já acordado ("sem tarefas a janela fecha") sem depender do gate externo na primeira renderização.

Nenhuma mudança em backend, RLS ou schema. Apenas correção de fluxo de UI.