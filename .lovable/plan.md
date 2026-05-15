## Mudanças

1. **Painel inicia abaixo da barra superior da conversa** — render o painel dentro de `MessageArea`, entre o cabeçalho e a área de mensagens, em vez de como irmão flex (que o faz começar no topo, ao lado do cabeçalho).

2. **Fechar painel ao trocar de conversa** — limpar `taskPanelOpen` no `useEffect` quando `activeConvId` muda.

## Implementação

### `src/components/chat/MessageArea.tsx`
- Nova prop opcional `rightPanel?: React.ReactNode`.
- Envolver o bloco `Messages + Composer` em um `<div className="flex-1 flex min-h-0">` contendo:
  - O conteúdo atual de mensagens/composer dentro de `<div className="flex-1 flex flex-col min-w-0 min-h-0">`.
  - Quando `rightPanel` for truthy, renderizá-lo após esse div: `<div className="w-full md:w-[420px] border-l bg-background flex flex-col shrink-0 min-h-0">{rightPanel}</div>`.
- O cabeçalho `sticky top-0` permanece acima de ambos, ocupando toda a largura.

### `src/pages/Chat.tsx`
- Remover o painel sibling atual (`{taskPanelOpen && <div ...>...TaskRequestForm.../>}`).
- Passar para `<MessageArea rightPanel={taskPanelOpen ? <TaskPanel/> : null} />`, onde `TaskPanel` é o conteúdo (header com título + X + `<TaskRequestForm .../>`).
- Adicionar `useEffect(() => setTaskPanelOpen(false), [activeConvId])`.

Sem mudanças de schema ou backend.