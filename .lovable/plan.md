## Objetivo

Aplicar a cor cadastrada do usuário (`profiles.tag_color`) na tag "Atribuído" também nos cards de tarefas pendentes exibidos dentro da conversa (`PendingTasksPanel`), igual ao que já foi feito no Kanban de tarefas.

## Mudanças (apenas `src/components/chat/PendingTasksPanel.tsx`)

1. Trocar o `select('user_id, full_name')` em `profiles` por `select('user_id, full_name, tag_color')`.
2. Substituir o `profileMap: Record<string, string>` por `Record<string, { name: string; color: string | null }>` e atualizar o `setProfileMap` correspondente.
3. Ajustar os usos de `profileMap[uid]` (no "Solicitado em ... por ..." e no badge de atribuído) para ler `.name`.
4. Reescrever o `<Badge variant="outline">` do atribuído usando o mesmo padrão do `Tasks.tsx`: helper local `getReadableTextColor` + componente `AssigneeBadge` (cor de fundo do `tag_color`, texto com contraste YIQ; fallback `outline` quando o usuário não tem cor).

Sem mudanças de schema, RPC ou edge functions.
