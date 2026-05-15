## Mudança

Alterar o painel "Solicitar tarefa" no `src/pages/Chat.tsx` para que, em vez de abrir como overlay absoluto sobre as mensagens, ocupe espaço lateral dentro da área de conversa, empurrando as mensagens para a esquerda.

## Implementação

Em `src/pages/Chat.tsx` (linhas ~813-862):

1. Remover `relative` do wrapper externo e `absolute inset-y-0 right-0 z-20` do painel.
2. O painel passa a ser um irmão flex normal: `w-full md:w-[420px] border-l bg-background flex flex-col shrink-0`.
3. Mantém o `MessageArea` em `flex-1 min-w-0` — assim, ao abrir o painel, o flex layout reduz a largura da área de mensagens automaticamente (push em vez de overlay).
4. No mobile (telas estreitas), o painel ainda ocupa `w-full`, então a área de mensagens fica oculta — comportamento aceitável dado o pouco espaço; alternativa: esconder `MessageArea` via `hidden md:flex` quando `taskPanelOpen` for true no mobile.

Sem mudanças de lógica, props ou outros arquivos.