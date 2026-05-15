## Problema

O painel "Solicitar tarefa" não rola: campos finais (anexos, botões) ficam fora da viewport.

## Causa

O wrapper interno `<div className="flex-1 overflow-y-auto p-4">` em `src/pages/Chat.tsx` está dentro de um `flex flex-col` sem `min-h-0`, então o `overflow-y-auto` não dispara — o filho expande além do container.

## Correção

Em `src/pages/Chat.tsx`, no bloco do painel `taskPanelOpen`:

1. Adicionar `min-h-0` ao container externo `<div className="w-full md:w-[420px] border-l ... flex flex-col shrink-0">` para que ele respeite a altura do flex pai.
2. Adicionar `min-h-0` ao `<div className="flex-1 overflow-y-auto p-4">` para permitir o scroll.

Sem mudanças em `TaskRequestForm.tsx`.