## Objetivo

Aplicar a cor cadastrada do usuário (`profiles.tag_color`) também na tag de "Atribuído" dos cards de tarefas (página `/tasks`). Hoje essas tags renderizam como `Badge variant="outline"` neutra (cinza), independentemente da cor configurada.

## Diagnóstico

- `src/pages/Tasks.tsx` carrega `profiles` apenas com `user_id, full_name` e renderiza o nome do atribuído em `<Badge variant="outline">` nas linhas 437 e 518.
- A cor por usuário existe em `profiles.tag_color` (cadastrada em Configurações → Usuários) e já é usada no chat. Falta apenas pintar essa mesma cor no card de tarefa.

## Mudanças (apenas UI em `src/pages/Tasks.tsx`)

1. Estender o `type Profile` para incluir `tag_color: string | null` e adicionar `tag_color` no `select` da query de `profiles` em `loadData`.
2. Criar helper local `getProfileColor(uid)` que retorna o `tag_color` do perfil (ou `null`).
3. Reutilizar o mesmo padrão visual usado no `ConversationList`:
   - Quando o usuário tem `tag_color` válido (`#rgb` ou `#rrggbb`): aplicar `style={{ backgroundColor, color: textoLegível }}` com cálculo YIQ para contraste; manter o badge sem borda.
   - Quando não tem cor: manter o `Badge variant="outline"` atual (cinza neutro).
4. Adicionar utilitário `getReadableTextColor(hex)` no topo do arquivo (cópia do helper já usado em `ConversationList.tsx`) — sem nova dependência.
5. Aplicar nas duas ocorrências do badge "Atribuído" (linhas 437 e 518).

## Fora de escopo

- Não alterar schema, RPC, RLS nem Edge Functions.
- Não mexer em outros locais que listam atribuídos (somente o card de tarefa indicado pelo usuário). Se desejar depois, replicamos para `PendingTasksPanel` e Lista mensal.
